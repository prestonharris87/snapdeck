/**
 * Unit tests for background.js — emitReportCountChanged storage.session tick
 * emission at 3 sites (STORY-fe-003).
 *
 * Runs via: node --test extension/background.emit.test.mjs
 *           (or: node --test extension/background*.test.mjs — cumulative with
 *            background.reports (17) + background.shortcuts (8) suites)
 *
 * Two harness variants:
 *   (a) chrome mock INCLUDES storage.session.set that captures its arg — proves
 *       the tick fires at all 3 emit sites and does NOT fire on non-emit paths.
 *   (b) chrome mock OMITS storage entirely (mirrors frozen mocks) — proves the
 *       optional-chain no-op: module still loads, return values + IDB writes
 *       are byte-identical to released behavior, no throw.
 *
 * Mirrors (does NOT import) the node:vm harness + chrome / in-memory indexedDB
 * stub pattern from background.reports.test.mjs:42-145.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');

// ---------------------------------------------------------------------------
// Shared in-memory IndexedDB stub factory (mirrors background.reports.test.mjs)
// kv must be a single mutable object — clear keys in-place (not reassign) so
// the factory's internal reference stays valid across test resets.
// ---------------------------------------------------------------------------
function makeIdbStub(kv) {
  function makeReq(getValue) {
    const req = {};
    queueMicrotask(() => {
      try {
        req.result = getValue();
        req.onsuccess && req.onsuccess();
      } catch (e) {
        req.error = e;
        req.onerror && req.onerror();
      }
    });
    return req;
  }
  return {
    open(_name, _version) {
      return makeReq(() => ({
        createObjectStore() {},
        transaction(_storeName, _mode) {
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

// Cross-context JSON round-trip strips vm prototype identity (same as frozen suites).
const toPlain = v => JSON.parse(JSON.stringify(v));

// Canonical fake annotation response for addScreenshot paths.
function fakeAnnotationResp() {
  return {
    meta: {
      url: 'http://localhost:5101/',
      title: 'Test Page',
      captured_at: '2026-01-01T00:00:00.000Z',
      viewport: { width: 1280, height: 800 },
    },
    original:    'data:image/png;base64,orig',
    annotated:   'data:image/png;base64,ann',
    annotations: [],
    console:     [],
    network:     [],
  };
}

// Minimal seeded screenshot for saveReport paths.
function seededScreenshot() {
  return {
    url:          'http://localhost:5101/',
    title:        'T',
    captured_at:  '2026-01-01T00:00:00.000Z',
    viewport:     { width: 1280, height: 800 },
    original:     'data:image/png;base64,orig',
    annotated:    'data:image/png;base64,ann',
    annotations:  [],
    console:      [],
    network:      [],
    model:        null,
  };
}

// ===========================================================================
// Group (a) — chrome mock INCLUDES storage.session.set
// Proves the tick fires at all 3 sites; non-emit paths assert NO tick.
// ===========================================================================

// --- mutable group (a) state (cleared in beforeEach) ---
const _kvA             = {};   // kv object — cleared in-place, never reassigned
let _tickA             = null; // last arg passed to storage.session.set
let _mockTabUrlA       = 'http://localhost:5101/';
let _sendMsgRespA      = null; // what chrome.tabs.sendMessage resolves to
let _fetchBehaviorA    = null; // (url, opts) => Promise | null (null → default)
let _onMsgListenerA    = null;

const _chromeMockA = {
  runtime: {
    onMessage: { addListener(cb) { _onMsgListenerA = cb; } },
  },
  commands: { onCommand: { addListener() {} } },
  tabs: {
    query() {
      if (_mockTabUrlA === null) return Promise.resolve([]);
      return Promise.resolve([{ id: 1, url: _mockTabUrlA, windowId: 1 }]);
    },
    captureVisibleTab() {
      return Promise.resolve('data:image/png;base64,abc');
    },
    sendMessage(_tabId, _msg) {
      if (_sendMsgRespA === undefined) {
        return Promise.reject(new Error('sendMessage not configured for this test'));
      }
      return Promise.resolve(_sendMsgRespA);
    },
  },
  action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
  storage: {
    session: {
      set(arg) { _tickA = arg; },
    },
  },
};

// Default fetch: returns { ok: true } JSON for both /resolve?port= and /report/save
// (findController resolves immediately, saveReport POST succeeds).
function _defaultFetchA(url, opts) {
  const text = JSON.stringify({ ok: true });
  return Promise.resolve({
    ok: true,
    status: 200,
    text() { return Promise.resolve(text); },
  });
}

const _sandboxA = vm.createContext({
  URL, AbortController, setTimeout, clearTimeout, queueMicrotask, console,
  fetch(url, opts) {
    if (_fetchBehaviorA) {
      const r = _fetchBehaviorA(url, opts);
      if (r !== undefined) return r;
    }
    return _defaultFetchA(url, opts);
  },
  chrome:    _chromeMockA,
  indexedDB: makeIdbStub(_kvA),
});

vm.runInContext(bgSrc, _sandboxA);
assert.ok(_onMsgListenerA !== null, 'group (a): background.js must register the onMessage listener');

function sendMsgA(msg) {
  return new Promise((resolve) => {
    _onMsgListenerA(msg, {}, resolve);
  });
}

describe('group (a) — with storage.session.set', () => {
  beforeEach(() => {
    // Clear kv in-place (never reassign — stub holds a reference)
    for (const k of Object.keys(_kvA)) delete _kvA[k];
    _tickA          = null;
    _mockTabUrlA    = 'http://localhost:5101/';
    _sendMsgRespA   = fakeAnnotationResp();   // default: successful annotation
    _fetchBehaviorA = null;                   // default: ok for all fetches
  });

  // -------------------------------------------------------------------------
  // addScreenshot_success_emitsTick
  // captureVisibleTab + sendMessage both resolve; assert tick fires with
  // { port: 5101, count: 1, ts: <number> }.
  // -------------------------------------------------------------------------
  test('addScreenshot_success_emitsTick', async () => {
    const result = await _sandboxA.addScreenshot();
    assert.deepStrictEqual(toPlain(result), { ok: true, count: 1 },
      'addScreenshot must return { ok:true, count:1 }');
    assert.ok(_tickA !== null, 'storage.session.set must have been called');
    const tick = _tickA.reportCountChanged;
    assert.ok(tick, 'tick must carry reportCountChanged key');
    assert.strictEqual(tick.port,  5101,     'tick.port must be 5101');
    assert.strictEqual(tick.count, 1,        'tick.count must be 1 after first screenshot');
    assert.strictEqual(typeof tick.ts, 'number', 'tick.ts must be a number (Date.now())');
  });

  // -------------------------------------------------------------------------
  // saveReport_successfulPost_emitsZeroTick
  // Seed one screenshot; POST succeeds; assert tick { port:5101, count:0 }.
  // -------------------------------------------------------------------------
  test('saveReport_successfulPost_emitsZeroTick', async () => {
    _kvA['report:5101'] = { note: '', screenshots: [seededScreenshot()] };
    const result = await _sandboxA.saveReport();
    assert.ok(result && result.ok, 'saveReport must return ok on successful POST');
    assert.ok(_tickA !== null, 'storage.session.set must have been called');
    const tick = _tickA.reportCountChanged;
    assert.strictEqual(tick.port,  5101, 'tick.port must be 5101');
    assert.strictEqual(tick.count, 0,    'tick.count must be 0 after save clears the report');
    assert.strictEqual(typeof tick.ts, 'number', 'tick.ts must be a number');
  });

  // -------------------------------------------------------------------------
  // clearReport_handler_emitsZeroTick
  // CLEAR_REPORT on localhost:5101 → tick { port:5101, count:0 }.
  // -------------------------------------------------------------------------
  test('clearReport_handler_emitsZeroTick', async () => {
    const result = await sendMsgA({ type: 'CLEAR_REPORT' });
    assert.deepStrictEqual(toPlain(result), { ok: true });
    assert.ok(_tickA !== null, 'storage.session.set must have been called');
    const tick = _tickA.reportCountChanged;
    assert.strictEqual(tick.port,  5101, 'tick.port must be 5101');
    assert.strictEqual(tick.count, 0,    'tick.count must be 0 on clear');
    assert.strictEqual(typeof tick.ts, 'number', 'tick.ts must be a number');
  });

  // -------------------------------------------------------------------------
  // clearReport_handler_nonTargetTab_noEmit
  // CLEAR_REPORT on about:blank → currentTargetPort() null → helper guard
  // returns early → NO tick captured (no phantom emit).
  // -------------------------------------------------------------------------
  test('clearReport_handler_nonTargetTab_noEmit', async () => {
    _mockTabUrlA = 'about:blank';
    const result = await sendMsgA({ type: 'CLEAR_REPORT' });
    assert.deepStrictEqual(toPlain(result), { ok: true });
    assert.strictEqual(_tickA, null,
      'NO tick must be captured for a non-target tab (null-port guard at site 3)');
  });

  // -------------------------------------------------------------------------
  // setNote_doesNotEmit
  // SET_NOTE mutates the note only; screenshots.length unchanged → invariant 4.
  // -------------------------------------------------------------------------
  test('setNote_doesNotEmit', async () => {
    const result = await sendMsgA({ type: 'SET_NOTE', note: 'x' });
    assert.deepStrictEqual(toPlain(result), { ok: true });
    assert.strictEqual(_tickA, null,
      'NO tick must be captured for SET_NOTE (invariant 4: no count change)');
  });

  // -------------------------------------------------------------------------
  // addScreenshot_cancelled_noEmit
  // sendMessage resolves { cancelled:true } → addScreenshot returns before
  // setReport → no tick.
  // -------------------------------------------------------------------------
  test('addScreenshot_cancelled_noEmit', async () => {
    _sendMsgRespA = { cancelled: true };
    const result = await _sandboxA.addScreenshot();
    assert.deepStrictEqual(toPlain(result), { cancelled: true });
    assert.strictEqual(_tickA, null,
      'NO tick must be captured when user cancels the annotation');
  });

  // -------------------------------------------------------------------------
  // saveReport_failedPost_noEmit
  // /report/save returns non-ok → success branch is not entered → no tick.
  // -------------------------------------------------------------------------
  test('saveReport_failedPost_noEmit', async () => {
    _kvA['report:5101'] = { note: '', screenshots: [seededScreenshot()] };
    _fetchBehaviorA = (url) => {
      if (url.includes('/report/save')) {
        const text = JSON.stringify({ ok: false, error: 'server error' });
        return Promise.resolve({ ok: false, status: 500, text() { return Promise.resolve(text); } });
      }
      // /resolve?port= probes still succeed so findController finds a port
      const text = JSON.stringify({ ok: true });
      return Promise.resolve({ ok: true, status: 200, text() { return Promise.resolve(text); } });
    };
    const result = await _sandboxA.saveReport();
    assert.ok(result && result.error, 'saveReport must return an error on a failed POST');
    assert.strictEqual(_tickA, null,
      'NO tick must be captured when the POST fails (only the success branch emits)');
  });

  // -------------------------------------------------------------------------
  // saveReport_noController_noEmit  (Contrarian Finding 1, PO PROMOTE_TO_AC)
  // Every /resolve?port= probe fails → findController returns null → early
  // return at background.js:254; report NOT cleared; NO tick.
  // -------------------------------------------------------------------------
  test('saveReport_noController_noEmit', async () => {
    _kvA['report:5101'] = { note: '', screenshots: [seededScreenshot()] };
    _fetchBehaviorA = (_url) => Promise.reject(new Error('no controller'));
    const result = await _sandboxA.saveReport();
    assert.ok(result && result.error, 'saveReport must return an error when no controller found');
    // Report must NOT have been cleared (early return before clear)
    assert.ok(
      _kvA['report:5101'] && _kvA['report:5101'].screenshots.length === 1,
      'report must NOT be cleared when no controller is found'
    );
    assert.strictEqual(_tickA, null,
      'NO tick must be captured when no controller is found');
  });

  // -------------------------------------------------------------------------
  // saveReport_emptyReport_noEmit  (Contrarian Finding 1, PO PROMOTE_TO_AC)
  // report:5101 empty → early return at background.js:251 before any
  // controller probe; NO tick.
  // -------------------------------------------------------------------------
  test('saveReport_emptyReport_noEmit', async () => {
    // kv empty — report:5101 will read as the EMPTY_REPORT default
    const result = await _sandboxA.saveReport();
    assert.ok(result && result.error, 'saveReport must return an error when the report is empty');
    assert.ok(
      result.error.includes('empty') || result.error.includes('screenshot'),
      'error must mention the empty-report condition'
    );
    assert.strictEqual(_tickA, null,
      'NO tick must be captured for the empty-report early-return branch');
  });
});

// ===========================================================================
// Group (b) — chrome mock OMITS storage entirely (mirrors frozen mocks)
// Proves the optional-chain no-op: module still loads, return values and
// IDB writes are byte-identical to released behavior, no throw.
// ===========================================================================

const _kvB          = {};
let _onMsgListenerB = null;
let _mockTabUrlB    = 'http://localhost:5101/';
let _sendMsgRespB   = null;

const _chromeMockB = {
  runtime: {
    onMessage: { addListener(cb) { _onMsgListenerB = cb; } },
  },
  commands: { onCommand: { addListener() {} } },
  tabs: {
    query() {
      if (_mockTabUrlB === null) return Promise.resolve([]);
      return Promise.resolve([{ id: 1, url: _mockTabUrlB, windowId: 1 }]);
    },
    captureVisibleTab() { return Promise.resolve('data:image/png;base64,abc'); },
    sendMessage()       { return Promise.resolve(_sendMsgRespB || fakeAnnotationResp()); },
  },
  action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
  // NO storage key — this is the critical difference from group (a)
};

const _sandboxB = vm.createContext({
  URL, AbortController, setTimeout, clearTimeout, queueMicrotask, console,
  fetch(_url) {
    const text = JSON.stringify({ ok: true });
    return Promise.resolve({ ok: true, status: 200, text() { return Promise.resolve(text); } });
  },
  chrome:    _chromeMockB,
  indexedDB: makeIdbStub(_kvB),
});

vm.runInContext(bgSrc, _sandboxB);
assert.ok(_onMsgListenerB !== null, 'group (b): background.js must register the onMessage listener even without chrome.storage');

function sendMsgB(msg) {
  return new Promise((resolve) => {
    _onMsgListenerB(msg, {}, resolve);
  });
}

describe('group (b) — storage absent (no chrome.storage key)', () => {
  beforeEach(() => {
    for (const k of Object.keys(_kvB)) delete _kvB[k];
    _mockTabUrlB = 'http://localhost:5101/';
    _sendMsgRespB = null;
  });

  // -------------------------------------------------------------------------
  // moduleLoads_withoutStorageKey
  // vm.runInContext above completed without throwing; onMessage listener was
  // registered — proves the optional-chain no-ops at load time (invariant 2).
  // -------------------------------------------------------------------------
  test('moduleLoads_withoutStorageKey', () => {
    assert.ok(_onMsgListenerB !== null,
      'onMessage listener must be registered even when chrome.storage is absent');
  });

  // -------------------------------------------------------------------------
  // storageAbsent_addScreenshot_returnsOkCount_noThrow
  // With no chrome.storage, a successful addScreenshot returns
  // { ok:true, count:1 } and the IDB record has 1 screenshot; no throw.
  // -------------------------------------------------------------------------
  test('storageAbsent_addScreenshot_returnsOkCount_noThrow', async () => {
    _sendMsgRespB = fakeAnnotationResp();
    let result;
    await assert.doesNotReject(async () => {
      result = await _sandboxB.addScreenshot();
    }, 'addScreenshot must not throw when chrome.storage is absent');
    assert.deepStrictEqual(toPlain(result), { ok: true, count: 1 },
      'addScreenshot must return { ok:true, count:1 } (byte-identical to released behavior)');
    assert.ok(
      _kvB['report:5101'] && _kvB['report:5101'].screenshots.length === 1,
      'screenshot must be persisted to IDB even without chrome.storage'
    );
  });

  // -------------------------------------------------------------------------
  // storageAbsent_saveReport_clearsAndReturnsJson_noThrow
  // With no chrome.storage, the success POST path returns the server json AND
  // clears the IDB record; no throw.
  // -------------------------------------------------------------------------
  test('storageAbsent_saveReport_clearsAndReturnsJson_noThrow', async () => {
    _kvB['report:5101'] = { note: '', screenshots: [seededScreenshot()] };
    let result;
    await assert.doesNotReject(async () => {
      result = await _sandboxB.saveReport();
    }, 'saveReport must not throw when chrome.storage is absent');
    assert.ok(result && result.ok, 'saveReport must return ok (byte-identical to released behavior)');
    const r = await _sandboxB.getReport(5101);
    assert.deepStrictEqual(toPlain(r), { note: '', screenshots: [] },
      'report must be cleared in IDB after successful save (byte-identical to released behavior)');
  });

  // -------------------------------------------------------------------------
  // storageAbsent_clearReport_returnsOk_noThrow
  // With no chrome.storage, CLEAR_REPORT returns { ok:true } and resets the
  // IDB record; no throw.
  // -------------------------------------------------------------------------
  test('storageAbsent_clearReport_returnsOk_noThrow', async () => {
    _kvB['report:5101'] = { note: 'x', screenshots: [{ url: 'a' }] };
    let result;
    await assert.doesNotReject(async () => {
      result = await sendMsgB({ type: 'CLEAR_REPORT' });
    }, 'CLEAR_REPORT must not throw when chrome.storage is absent');
    assert.deepStrictEqual(toPlain(result), { ok: true });
    const r = await _sandboxB.getReport(5101);
    assert.deepStrictEqual(toPlain(r), { note: '', screenshots: [] },
      'report must be cleared in IDB (byte-identical to released behavior)');
  });
});
