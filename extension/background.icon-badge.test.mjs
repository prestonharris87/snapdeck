/**
 * Unit tests for background.js — per-tab icon state machine
 * (STORY-fe-001, STORY-fe-002, STORY-fe-003)
 *
 * Runs via: node --test extension/background.icon-badge.test.mjs
 *           (or: node --test extension/*.test.mjs — cumulative with sibling suites)
 *
 * Three sandbox configurations:
 *   (A) MAIN  — chrome with storage.session + action.setIcon + tab listener capture.
 *       Active tab = null at load time so the SW cold-start guard fires but exits
 *       immediately (!tab early-return). Per-test state reset in beforeEach.
 *   (B) NO-STORAGE — chrome WITHOUT any `storage` key; proves module loads clean
 *       under the frozen released-suite mock (BOSS-locked gate-2 criterion #1).
 *   (C) COLD-START — fresh vm load with full stubs + pre-seeded kv + cached resolve;
 *       active tab = localhost:5101 with 2 screenshots; proves the top-level guarded
 *       re-derive paints the badge at module load.
 */

import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function makeReq(getValue) {
  const req = {};
  queueMicrotask(() => {
    try { req.result = getValue(); req.onsuccess?.(); }
    catch (e) { req.error = e; req.onerror?.(); }
  });
  return req;
}

function makeIdbStub(kv) {
  return {
    open() {
      return makeReq(() => ({
        createObjectStore() {},
        transaction() {
          return {
            objectStore() {
              return {
                get(key)       { return makeReq(() => kv[key]); },
                put(val, key)  { return makeReq(() => { kv[key] = val; }); },
              };
            },
          };
        },
      }));
    },
  };
}

/** Stub OffscreenCanvas used in all sandboxes. */
class FakeOffscreenCanvas {
  constructor(w, h) { this._w = w; this._h = h; }
  getContext() {
    const d = { gco: '', fill: '' };
    return {
      drawImage() {},
      fillRect() {},
      get globalCompositeOperation() { return d.gco; },
      set globalCompositeOperation(v) { d.gco = v; },
      get fillStyle() { return d.fill; },
      set fillStyle(v) { d.fill = v; },
      getImageData(x, y, w, h) {
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      },
    };
  }
}

/** Wait for microtasks + a tick to drain (real setTimeout, not sandboxed). */
function settle(ms = 40) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Sandbox A — MAIN (used for fe-001 / fe-002 / fe-003 tests)
// ---------------------------------------------------------------------------

const _kvA = {};          // in-memory IDB kv — cleared in-place in beforeEach
let _sessionA = {};       // in-memory session storage — reassigned in beforeEach

// Call-recording arrays — reassigned in beforeEach
let _setIconCalls    = [];
let _setBadgeTxtCalls = [];
let _setBadgeBgCalls = [];
let _setTitleCalls   = [];

// Counters / listeners captured at module load — never reset between tests
let _onMsgCount        = 0;   // total addListener calls (must stay 1)
let _onMsgListener     = null;
let _onActivatedListener = null;
let _onUpdatedListener   = null;
let _onChangedListeners  = [];  // array because addListener may be called once at load

// fetch call counter reset per-test
let _resolveFetchCount = 0;

const _chromeMockA = {
  runtime: {
    onMessage: {
      addListener(cb) { _onMsgCount++; _onMsgListener = cb; },
    },
    getURL(p) { return `chrome-extension://fakeid/${p}`; },
  },
  commands: { onCommand: { addListener() {} } },
  tabs: {
    query() {
      if (_mockTabUrlA === null) return Promise.resolve([]);
      return Promise.resolve([{ id: 42, url: _mockTabUrlA, windowId: 1 }]);
    },
    captureVisibleTab() { return Promise.reject(new Error('not stubbed in icon-badge tests')); },
    sendMessage()       { return Promise.reject(new Error('not stubbed in icon-badge tests')); },
    // Captured at module load by the top-level optional-chain registrations
    onActivated: { addListener(cb) { _onActivatedListener = cb; } },
    onUpdated:   { addListener(cb) { _onUpdatedListener   = cb; } },
  },
  action: {
    setIcon(obj)              { _setIconCalls.push(obj); return Promise.resolve(); },
    setBadgeText(obj)         { _setBadgeTxtCalls.push(obj); },
    setBadgeBackgroundColor(obj) { _setBadgeBgCalls.push(obj); },
    setTitle(obj)             { _setTitleCalls.push(obj); },
    getBadgeText()            { return Promise.resolve(''); },
  },
  storage: {
    session: {
      async get(key)  { return { [key]: _sessionA[key] }; },
      async set(obj)  { Object.assign(_sessionA, obj); },
      async remove(key) { delete _sessionA[key]; },
      onChanged: { addListener(cb) { _onChangedListeners.push(cb); } },
    },
  },
};

// _mockTabUrlA is module-level so tabs.query closure can see it
let _mockTabUrlA = null;  // null at load time → cold-start guard fires but no-ops

const _sandboxA = vm.createContext({
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  console,
  fetch: async (url) => {
    if (url.includes('/resolve')) {
      _resolveFetchCount++;
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
    }
    // Icon asset fetches (iconImageDataForState)
    return { ok: true, status: 200, blob: async () => ({}) };
  },
  createImageBitmap: async () => ({}),
  OffscreenCanvas: FakeOffscreenCanvas,
  chrome: _chromeMockA,
  indexedDB: makeIdbStub(_kvA),
});

// Load background.js into sandbox A.
// Cold-start guard fires (storage.session + action.setIcon both present) but
// _mockTabUrlA=null → tabs.query returns [] → activeTab() undefined → returns early.
vm.runInContext(bgSrc, _sandboxA);

assert.ok(_onMsgListener !== null, 'sandbox A: onMessage listener must be registered at module load');

// Helper: fire the captured storage.session.onChanged listener
function fireOnChangedA(changes) {
  for (const cb of _onChangedListeners) cb(changes);
}

// ---------------------------------------------------------------------------
// beforeEach — reset sandbox A mutable state (not the captured listeners)
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Clear kv in-place (IDB stub holds a reference to this object)
  for (const k of Object.keys(_kvA)) delete _kvA[k];
  _sessionA        = {};
  _mockTabUrlA     = 'http://localhost:5101/';
  _setIconCalls    = [];
  _setBadgeTxtCalls = [];
  _setBadgeBgCalls = [];
  _setTitleCalls   = [];
  _resolveFetchCount = 0;
  // Listeners (_onActivatedListener, _onUpdatedListener, _onChangedListeners,
  // _onMsgListener, _onMsgCount) are NOT reset — captured once at module load.
});

// ===========================================================================
// fe-001 — applyIconState + iconImageDataForState
// ===========================================================================

test('applyIconState_gray_clearsBadge_perTab', async () => {
  await _sandboxA.applyIconState(42, { state: 'gray' });

  assert.ok(_setIconCalls.some(o => o.tabId === 42),
    'gray: setIcon must be called with tabId=42');
  assert.ok(_setBadgeTxtCalls.some(o => o.tabId === 42 && o.text === ''),
    'gray: setBadgeText must be { tabId:42, text:"" }');
  assert.ok(_setTitleCalls.some(o => o.tabId === 42 && o.title.includes('not a Snapdeck target')),
    'gray: setTitle must mention "not a Snapdeck target"');

  // No global (no-tabId) calls (AC13 namespace isolation)
  const allCalls = [..._setIconCalls, ..._setBadgeTxtCalls, ..._setBadgeBgCalls, ..._setTitleCalls];
  assert.ok(allCalls.every(o => 'tabId' in o),
    'gray: every chrome.action.* call must carry tabId (no global badge touch)');
});

test('applyIconState_green_emptyBadge_perTab', async () => {
  await _sandboxA.applyIconState(42, { state: 'green' });

  assert.ok(_setIconCalls.some(o => o.tabId === 42),
    'green: setIcon must be called with tabId=42');
  assert.ok(_setBadgeTxtCalls.some(o => o.tabId === 42 && o.text === ''),
    'green: setBadgeText must be { tabId:42, text:"" }');
  assert.ok(_setTitleCalls.some(o => o.tabId === 42 && o.title.includes('ready to capture')),
    'green: setTitle must mention "ready to capture"');

  const allCalls = [..._setIconCalls, ..._setBadgeTxtCalls, ..._setBadgeBgCalls, ..._setTitleCalls];
  assert.ok(allCalls.every(o => 'tabId' in o),
    'green: every chrome.action.* call must carry tabId');
});

test('applyIconState_orange_setsCountBadge_perTab', async () => {
  await _sandboxA.applyIconState(42, { state: 'orange', count: 3 });

  assert.ok(_setIconCalls.some(o => o.tabId === 42),
    'orange: setIcon must be called with tabId=42');
  assert.ok(_setBadgeTxtCalls.some(o => o.tabId === 42 && o.text === '3'),
    'orange: setBadgeText must be { tabId:42, text:"3" }');
  assert.ok(_setBadgeBgCalls.some(o => o.tabId === 42 && o.color === '#E37400'),
    'orange: setBadgeBackgroundColor must be { tabId:42, color:"#E37400" }');
  assert.ok(_setTitleCalls.some(o => o.tabId === 42 && o.title.includes('3')),
    'orange: setTitle must include count "3"');
});

test('iconImageDataForState_returnsAllThreeSizes', async () => {
  for (const state of ['gray', 'green', 'orange']) {
    const result = await _sandboxA.iconImageDataForState(state);
    assert.ok(result && typeof result === 'object', `${state}: must return an object`);
    for (const size of [16, 48, 128]) {
      assert.ok(size in result,        `${state}: must have key ${size}`);
      assert.strictEqual(result[size].width, size,
        `${state}[${size}]: ImageData.width must equal ${size}`);
    }
  }
});

test('applyIconState_neverSetsGlobalBadge', async () => {
  for (const [state, extra] of [['gray', {}], ['green', {}], ['orange', { count: 5 }]]) {
    _setIconCalls = []; _setBadgeTxtCalls = []; _setBadgeBgCalls = []; _setTitleCalls = [];
    await _sandboxA.applyIconState(42, { state, ...extra });
    const allCalls = [..._setIconCalls, ..._setBadgeTxtCalls, ..._setBadgeBgCalls, ..._setTitleCalls];
    assert.ok(allCalls.length > 0, `${state}: must make at least one action call`);
    assert.ok(allCalls.every(o => 'tabId' in o),
      `${state}: every chrome.action.* call must include tabId (no global badge touch)`);
  }
});

// ===========================================================================
// fe-002 — refreshActiveTab / resolvePortCached / listeners
// ===========================================================================

test('refreshActiveTab_nonLocalhost_grayNoProbe', async () => {
  _mockTabUrlA = 'https://example.com/';
  await _sandboxA.refreshActiveTab();

  assert.ok(_setBadgeTxtCalls.some(o => o.text === ''),
    'non-localhost: must gray (empty badge text, AC1)');
  assert.strictEqual(_resolveFetchCount, 0,
    'non-localhost: must fire ZERO /resolve fetches (AC1 — no probe on non-target)');
});

test('refreshActiveTab_deceptiveHost_grayNoProbe', async () => {
  _mockTabUrlA = 'http://localhost.evil.com/';
  await _sandboxA.refreshActiveTab();

  assert.ok(_setBadgeTxtCalls.some(o => o.text === ''),
    'deceptive host: must gray (AC10 — currentTargetPort returns null)');
  assert.strictEqual(_resolveFetchCount, 0,
    'deceptive host: must fire ZERO /resolve fetches (AC10)');
});

test('refreshActiveTab_localhostController_greenCached', async () => {
  _mockTabUrlA = 'http://localhost:5101/';
  _kvA['report:5101'] = { note: '', screenshots: [] };

  await _sandboxA.refreshActiveTab();

  // resolved + count=0 → green
  assert.ok(_setBadgeTxtCalls.some(o => o.text === ''),
    'localhost + controller + 0 shots → green (empty badge, AC2)');
  assert.ok(_setIconCalls.length > 0, 'must call setIcon');

  // Resolve must be cached
  assert.ok(_sessionA['resolve:5101'] && _sessionA['resolve:5101'].resolved === true,
    'resolve:5101 must be cached in session after first probe (AC12)');

  // Second call: cache hit — no new /resolve fetches
  const firstCount = _resolveFetchCount;
  _setIconCalls = []; _setBadgeTxtCalls = [];
  await _sandboxA.refreshActiveTab();
  assert.strictEqual(_resolveFetchCount, firstCount,
    'second activation within TTL must fire NO new /resolve probe (AC2/AC12 cache hit)');
});

test('resolvePortCached_singleFlight_oneProbeForConcurrentDerives', async () => {
  // No cached resolve → cache miss
  delete _sessionA['resolve:5101'];
  _kvA['report:5101'] = { note: '', screenshots: [] };
  _resolveFetchCount = 0;

  // Fire two concurrent resolvePortCached calls (no await between them)
  const [r1, r2] = await Promise.all([
    _sandboxA.resolvePortCached(5101),
    _sandboxA.resolvePortCached(5101),
  ]);

  assert.strictEqual(r1, true, 'first concurrent call must resolve true');
  assert.strictEqual(r2, true, 'second concurrent call must resolve true (shared in-flight)');

  // Single-flight: only ONE findController fan-out → at most CONTROLLER_TRIES (40) fetches
  assert.ok(_resolveFetchCount <= 40,
    `single-flight must issue ≤40 /resolve fetches, got ${_resolveFetchCount} (not ~80)`);

  // After settle, _resolveInFlight entry is cleared (finally block). Re-probe.
  delete _sessionA['resolve:5101'];
  const beforeThird = _resolveFetchCount;
  await _sandboxA.resolvePortCached(5101);
  assert.ok(_resolveFetchCount > beforeThird,
    'third call after settle must re-probe (in-flight entry cleared in finally)');
});

test('refreshActiveTab_localhostNoController_gray', async () => {
  // Make all /resolve probes return non-ok → findController returns null
  const origFetch = _sandboxA.fetch;
  try {
    _sandboxA.fetch = async (url) => {
      if (url.includes('/resolve')) {
        return { ok: false, status: 404, text: async () => JSON.stringify({ error: 'no' }) };
      }
      return { ok: true, blob: async () => ({}) };
    };
    _mockTabUrlA = 'http://localhost:5101/';
    _kvA['report:5101'] = { note: '', screenshots: [] };

    await _sandboxA.refreshActiveTab();

    assert.ok(_setBadgeTxtCalls.some(o => o.text === ''),
      'localhost + no controller → gray (empty badge, AC3)');
  } finally {
    _sandboxA.fetch = origFetch;
  }
});

test('refreshActiveTab_reportCountPositive_orange', async () => {
  _mockTabUrlA = 'http://localhost:5101/';
  _kvA['report:5101'] = { note: '', screenshots: [{}, {}] };         // 2 screenshots
  _sessionA['resolve:5101'] = { resolved: true, ts: Date.now() };   // cache hit → no probe

  await _sandboxA.refreshActiveTab();

  assert.ok(_setBadgeTxtCalls.some(o => o.text === '2'),
    'resolved target + 2 screenshots → orange badge "2" (AC4)');
  assert.ok(_setBadgeBgCalls.some(o => o.color === '#E37400'),
    'orange state must set badge background #E37400');
});

test('refreshActiveTab_reportCountZero_green', async () => {
  _mockTabUrlA = 'http://localhost:5101/';
  _kvA['report:5101'] = { note: '', screenshots: [] };
  _sessionA['resolve:5101'] = { resolved: true, ts: Date.now() };

  await _sandboxA.refreshActiveTab();

  assert.ok(_setBadgeTxtCalls.some(o => o.text === ''),
    'resolved target + 0 screenshots → green (empty badge, AC2/AC6)');
  assert.ok(!_setBadgeBgCalls.some(o => o.color === '#E37400'),
    'empty report must NOT set orange badge background');
});

test('onActivated_registeredTopLevel', () => {
  assert.ok(_onActivatedListener !== null,
    'chrome.tabs.onActivated.addListener must be called at module load (AC8 top-level)');
  assert.strictEqual(typeof _onActivatedListener, 'function');
});

test('invalidateOnReload_bustsCacheForPort', async () => {
  _mockTabUrlA = 'http://localhost:5101/';
  _sessionA['resolve:5101'] = { resolved: true, ts: Date.now() };

  // Simulate onUpdated with status='loading' on the active tab
  _onUpdatedListener(42, { status: 'loading' }, { active: true, url: 'http://localhost:5101/' });

  await settle();

  assert.strictEqual(_sessionA['resolve:5101'], undefined,
    'onUpdated(loading) must delete resolve:5101 from session cache (deck-up cache-bust)');
});

// ===========================================================================
// fe-003 — storage.session.onChanged consumer + key-filter + gate-2 criteria
// ===========================================================================

// ── BOSS-locked gate-2 criterion #2 ──────────────────────────────────────────

test('reportCountChanged_rightTabOrange_whenCountPositive', async () => {
  _mockTabUrlA = 'http://localhost:5101/';
  _kvA['report:5101'] = { note: '', screenshots: [{}, {}] };        // IDB has count=2 (SSOT)
  _sessionA['resolve:5101'] = { resolved: true, ts: Date.now() };

  fireOnChangedA({ reportCountChanged: { newValue: { port: 5101, count: 2, ts: Date.now() } } });
  await settle();

  assert.ok(_setBadgeTxtCalls.some(o => o.text === '2'),
    'reportCountChanged tick with count=2 → active tab painted orange "2" (AC4/AC5)');
});

test('reportCountChanged_rightTabGreen_whenCountZero', async () => {
  _mockTabUrlA = 'http://localhost:5101/';
  _kvA['report:5101'] = { note: '', screenshots: [] };              // IDB count=0 (SSOT)
  _sessionA['resolve:5101'] = { resolved: true, ts: Date.now() };

  fireOnChangedA({ reportCountChanged: { newValue: { port: 5101, count: 0, ts: Date.now() } } });
  await settle();

  assert.ok(_setBadgeTxtCalls.some(o => o.text === ''),
    'reportCountChanged tick with count=0 → active tab painted green (empty badge, AC6)');
  assert.ok(!_setBadgeBgCalls.some(o => o.color === '#E37400'),
    'count=0 tick must NOT set orange badge background');
});

test('onChanged_keyFiltered_resolveCacheWriteNoRederive', async () => {
  _mockTabUrlA = 'http://localhost:5101/';
  // Fire onChanged with a resolve: key — NOT reportCountChanged
  fireOnChangedA({ 'resolve:5101': { newValue: { resolved: true, ts: Date.now() } } });
  await settle();

  assert.strictEqual(_setIconCalls.length, 0,
    'onChanged with resolve:5101 key must NOT trigger setIcon (strict key-filter, no self-trigger loop)');
  assert.strictEqual(_setBadgeTxtCalls.length, 0,
    'onChanged with resolve:5101 key must NOT trigger setBadgeText');
});

// ─────────────────────────────────────────────────────────────────────────────

test('noSecondOnMessageListener', () => {
  // background.js must call chrome.runtime.onMessage.addListener exactly ONCE.
  // A second listener for fe-003 (storage.session.onChanged is used instead)
  // would break the released sibling suites' single-capture mock.
  assert.strictEqual(_onMsgCount, 1,
    'background.js must register exactly ONE chrome.runtime.onMessage.addListener');
});

test('coldStart_rederivesActiveTab_whenApisPresent', async () => {
  // This test loads background.js in a fresh vm context where:
  //   - chrome.storage.session + chrome.action.setIcon are present → guard is true
  //   - active tab = localhost:5101 with 2 screenshots pre-seeded
  //   - resolve:5101 pre-cached → no probe needed
  // Result: the top-level guarded refreshActiveTab() call paints orange '2'.

  const kvC = { 'report:5101': { note: '', screenshots: [{}, {}] } };
  const sessionC = { 'resolve:5101': { resolved: true, ts: Date.now() } };
  const badgeTxtCallsC = [];
  const setIconCallsC  = [];
  let onMsgC = null;

  const chromeMockC = {
    runtime: {
      onMessage: { addListener(cb) { onMsgC = cb; } },
      getURL(p) { return `chrome-extension://fakeid/${p}`; },
    },
    commands: { onCommand: { addListener() {} } },
    tabs: {
      query() { return Promise.resolve([{ id: 99, url: 'http://localhost:5101/', windowId: 1 }]); },
      captureVisibleTab() { return Promise.reject(new Error('n/a')); },
      sendMessage()       { return Promise.reject(new Error('n/a')); },
      onActivated: { addListener() {} },
      onUpdated:   { addListener() {} },
    },
    action: {
      setIcon(obj)             { setIconCallsC.push(obj); return Promise.resolve(); },
      setBadgeText(obj)        { badgeTxtCallsC.push(obj); },
      setBadgeBackgroundColor() {},
      setTitle() {},
      getBadgeText()           { return Promise.resolve(''); },
    },
    storage: {
      session: {
        async get(key)   { return { [key]: sessionC[key] }; },
        async set(obj)   { Object.assign(sessionC, obj); },
        async remove(key){ delete sessionC[key]; },
        onChanged: { addListener() {} },
      },
    },
  };

  const sandboxC = vm.createContext({
    URL, AbortController, setTimeout, clearTimeout, queueMicrotask, console,
    fetch: async (url) => {
      if (url.includes('/resolve')) return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
      return { ok: true, blob: async () => ({}) };
    },
    createImageBitmap: async () => ({}),
    OffscreenCanvas: FakeOffscreenCanvas,
    chrome: chromeMockC,
    indexedDB: makeIdbStub(kvC),
  });

  // Load: cold-start guard (storage.session AND action.setIcon present) fires refreshActiveTab()
  vm.runInContext(bgSrc, sandboxC);

  // Wait for the async re-derive to complete
  await settle(60);

  assert.ok(setIconCallsC.length > 0,
    'cold-start re-derive must call setIcon (SW wake self-heal)');
  assert.ok(badgeTxtCallsC.some(o => o.text === '2'),
    'cold-start re-derive must paint active tab orange "2" (2 screenshots — self-heal-on-wake)');
});

test('droppedTick_wakeReconcilesFromGetState', async () => {
  // Simulate: badge was last painted with count=1, but then a screenshot was added
  // without the tick firing (dropped tick). IDB now has count=3.
  _mockTabUrlA = 'http://localhost:5101/';
  _kvA['report:5101'] = { note: '', screenshots: [{}, {}, {}] };    // SSOT: count=3
  _sessionA['resolve:5101'] = { resolved: true, ts: Date.now() };

  // No onChanged fired (tick dropped). Fire a wake event (onActivated) to reconcile.
  _onActivatedListener();
  await settle();

  assert.ok(_setBadgeTxtCalls.some(o => o.text === '3'),
    'wake event after dropped tick must reconcile badge to "3" from getReport SSOT (never drifts)');
});

// ===========================================================================
// Sandbox B — NO-STORAGE (BOSS-locked gate-2 criterion #1)
// ===========================================================================

describe('moduleLoadsClean_noStorageInMock', () => {
  test('module_loads_without_throw_when_storage_absent', () => {
    let onMsgB = null;
    const chromeMockB = {
      runtime: {
        onMessage: { addListener(cb) { onMsgB = cb; } },
        getURL(p) { return `chrome-extension://fakeid/${p}`; },
      },
      commands: { onCommand: { addListener() {} } },
      tabs: {
        // Mirrors the frozen released-suite mock: has tabs.query but NO onActivated/onUpdated
        query() { return Promise.resolve([]); },
        captureVisibleTab() { return Promise.resolve('data:,fake'); },
        sendMessage()       { return Promise.resolve(null); },
      },
      action: {
        setBadgeText() {},
        setBadgeBackgroundColor() {},
        setTitle() {},
        getBadgeText() { return Promise.resolve(''); },
        // Deliberately NO setIcon — ensures cold-start guard (storage?.session && action?.setIcon) is false
      },
      // NO storage key — the critical condition for this test
    };

    const kvB = {};
    const sandboxB = vm.createContext({
      URL, AbortController, setTimeout, clearTimeout, queueMicrotask, console,
      fetch: async () => ({ ok: false, text: async () => '{}' }),
      createImageBitmap: async () => ({}),
      OffscreenCanvas: FakeOffscreenCanvas,
      chrome: chromeMockB,
      indexedDB: makeIdbStub(kvB),
    });

    // Must NOT throw at module load (all top-level chrome.* registrations are optional-chained)
    assert.doesNotThrow(
      () => vm.runInContext(bgSrc, sandboxB),
      'background.js must load without throwing when chrome.storage is absent (gate-2 criterion #1)'
    );

    // Released behavior: onMessage listener still registered despite missing storage
    assert.ok(onMsgB !== null,
      'chrome.runtime.onMessage.addListener must still be called even when storage is absent');
  });
});
