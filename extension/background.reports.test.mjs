/**
 * Unit tests for background.js per-port report helpers + GET_STATE port field
 * (STORY-fe-001 + STORY-fe-002 + LOW-1 security AC)
 *
 * Runs via: node --test extension/background.reports.test.mjs
 *           (or: node --test extension/*.test.mjs  — cumulative with shortcuts)
 *
 * Strategy:
 *   Load background.js source into a node:vm context pre-seeded with hand-written
 *   chrome + in-memory indexedDB stubs BEFORE evaluation.  This exposes the
 *   unexported top-level function declarations (getReport / setReport / clearReport
 *   / currentTargetPort / handle / addScreenshot) directly as sandbox properties,
 *   and lets the stubbed chrome.runtime.onMessage.addListener capture the listener.
 *
 * ACs verified (fe-001 + fe-002 + LOW-1 PROMOTE):
 *   fe-001 §Unit tests cases 1-12 + §Security (addScreenshot deceptive-host)
 *   fe-002 §Unit tests cases 1-4
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bgSrc = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8');

// ---------------------------------------------------------------------------
// Mutable test-scoped state (reset in beforeEach)
// ---------------------------------------------------------------------------
let _kv       = {};          // in-memory kv backing store
let _getCalls = 0;           // count of indexedDB objectStore.get() calls
let _putCalls = 0;           // count of indexedDB objectStore.put() calls
let _mockTabUrl = 'http://localhost:5101/';  // active-tab URL returned by tabs.query

// ---------------------------------------------------------------------------
// In-memory IndexedDB stub
// Mirrors the shortcut-test's _makeReq pattern; adds get/put counters.
// ---------------------------------------------------------------------------
function _makeReq(getValue) {
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

const _idbStub = {
  open(_name, _version) {
    return _makeReq(() => ({
      createObjectStore() {},
      transaction(_storeName, _mode) {
        return {
          objectStore() {
            return {
              get(key) {
                _getCalls++;
                return _makeReq(() => _kv[key]);
              },
              put(val, key) {
                _putCalls++;
                return _makeReq(() => { _kv[key] = val; });
              },
            };
          },
        };
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// Chrome API stubs
// ---------------------------------------------------------------------------
let _onMessageListener = null;

const _chromeMock = {
  runtime: {
    onMessage: {
      addListener(cb) { _onMessageListener = cb; },
    },
  },
  // no-op for kb's chrome.commands.onCommand.addListener (tolerates merged sibling)
  commands: {
    onCommand: {
      addListener() {},
    },
  },
  tabs: {
    // Returns the active tab using the mutable _mockTabUrl (reset per test).
    // Pass null to simulate no active tab.
    query() {
      if (_mockTabUrl === null) return Promise.resolve([]);
      return Promise.resolve([{ id: 1, url: _mockTabUrl, windowId: 1 }]);
    },
    captureVisibleTab() {
      return Promise.reject(new Error('captureVisibleTab not stubbed in reports tests'));
    },
    sendMessage() {
      return Promise.reject(new Error('sendMessage not stubbed in reports tests'));
    },
  },
  // Minimal action stubs so runCaptureCommand() doesn't throw if invoked
  action: {
    setBadgeText() {},
    setBadgeBackgroundColor() {},
    setTitle() {},
  },
};

// ---------------------------------------------------------------------------
// Load background.js into a vm context.
// The sandbox becomes the global scope; top-level `async function` declarations
// (getReport / setReport / clearReport / currentTargetPort / handle /
// addScreenshot / saveReport) are exposed as sandbox properties.
// ---------------------------------------------------------------------------
const sandbox = vm.createContext({
  // Platform APIs not present in a bare ECMAScript vm context
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  console,
  fetch: () => Promise.reject(new Error('fetch not available in unit tests')),
  // Extension APIs
  chrome:    _chromeMock,
  indexedDB: _idbStub,
});

vm.runInContext(bgSrc, sandbox);

// Sanity-check: the onMessage listener must have been registered at module scope.
assert.ok(
  _onMessageListener !== null,
  'background.js must call chrome.runtime.onMessage.addListener at the top level'
);

// ---------------------------------------------------------------------------
// Cross-context helper: JSON round-trip strips vm-context prototypes so that
// deepStrictEqual compares values, not Object/Array constructor identity.
// ---------------------------------------------------------------------------
const toPlain = v => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Invoke the captured onMessage listener with `msg` and return a Promise that
 * resolves to whatever value the handler passes to sendResponse.
 */
function sendMsg(msg) {
  return new Promise((resolve) => {
    _onMessageListener(msg, {}, resolve);
  });
}

// ---------------------------------------------------------------------------
// beforeEach — reset mutable state for every test
// ---------------------------------------------------------------------------
beforeEach(() => {
  _kv           = {};
  _getCalls     = 0;
  _putCalls     = 0;
  _mockTabUrl   = 'http://localhost:5101/';
});

// ===========================================================================
// fe-001 Unit test cases (12 cases)
// ===========================================================================

/**
 * getReport_emptyStore_returnsEmptyDefault
 * getReport(5101) on an empty kv store → { note:"", screenshots:[] }
 */
test('getReport_emptyStore_returnsEmptyDefault', async () => {
  const r = await sandbox.getReport(5101);
  assert.deepStrictEqual(toPlain(r), { note: '', screenshots: [] });
});

/**
 * setReport_thenGetReport_roundTripsUnderPortKey
 * setReport(5101, r) then getReport(5101) deep-equals r; kv has key 'report:5101'.
 */
test('setReport_thenGetReport_roundTripsUnderPortKey', async () => {
  const data = { note: 'hello', screenshots: [{ url: 'http://localhost:5101/' }] };
  await sandbox.setReport(5101, data);
  // Verify the kv key format
  assert.ok('report:5101' in _kv, 'kv must use key report:5101');
  // Round-trip via getReport
  const result = await sandbox.getReport(5101);
  assert.deepStrictEqual(result, data);
});

/**
 * setReport_portIsolation_otherPortUntouched
 * Writing report:5101 does not create or affect report:5102.
 */
test('setReport_portIsolation_otherPortUntouched', async () => {
  const data = { note: 'A', screenshots: [{}] };
  await sandbox.setReport(5101, data);

  // report:5102 must not exist in kv
  assert.strictEqual(_kv['report:5102'], undefined, 'report:5102 must not exist after writing 5101');
  // getReport(5102) → empty default
  const r = await sandbox.getReport(5102);
  assert.deepStrictEqual(toPlain(r), { note: '', screenshots: [] });
});

/**
 * clearReport_resetsOnlyThatPort
 * clearReport(5101) resets 5101 to the empty default; 5102 is untouched.
 */
test('clearReport_resetsOnlyThatPort', async () => {
  const r5101 = { note: 'x', screenshots: [{ url: 'a' }] };
  const r5102 = { note: 'y', screenshots: [{ url: 'b' }] };
  await sandbox.setReport(5101, r5101);
  await sandbox.setReport(5102, r5102);

  await sandbox.clearReport(5101);

  const after5101 = await sandbox.getReport(5101);
  assert.deepStrictEqual(toPlain(after5101), { note: '', screenshots: [] }, '5101 must be empty after clearReport');

  const after5102 = await sandbox.getReport(5102);
  assert.deepStrictEqual(toPlain(after5102), toPlain(r5102), '5102 must be untouched by clearReport(5101)');
});

/**
 * currentTargetPort_localhost_returnsPort
 * tabs.query returns http://localhost:5101 → currentTargetPort() === 5101.
 */
test('currentTargetPort_localhost_returnsPort', async () => {
  _mockTabUrl = 'http://localhost:5101/';
  const port = await sandbox.currentTargetPort();
  assert.strictEqual(port, 5101);
});

/**
 * currentTargetPort_127001_returnsPort
 * tabs.query returns http://127.0.0.1:5173 → currentTargetPort() === 5173.
 */
test('currentTargetPort_127001_returnsPort', async () => {
  _mockTabUrl = 'http://127.0.0.1:5173/';
  const port = await sandbox.currentTargetPort();
  assert.strictEqual(port, 5173);
});

/**
 * currentTargetPort_httpsNonLocalhost_returnsNull
 * https://example.com → null (NOT 443; proves the localhost gate, not bare portOfUrl).
 */
test('currentTargetPort_httpsNonLocalhost_returnsNull', async () => {
  _mockTabUrl = 'https://example.com/';
  const port = await sandbox.currentTargetPort();
  assert.strictEqual(port, null);
});

/**
 * currentTargetPort_nonLocalhostScheme_returnsNull
 * about:blank → null.
 */
test('currentTargetPort_nonLocalhostScheme_returnsNull', async () => {
  _mockTabUrl = 'about:blank';
  const port = await sandbox.currentTargetPort();
  assert.strictEqual(port, null);
});

/**
 * getReport_nullPort_returnsEmptyDefault_noIdbRead
 * getReport(null) → empty default; indexedDB stub records ZERO get calls.
 */
test('getReport_nullPort_returnsEmptyDefault_noIdbRead', async () => {
  const r = await sandbox.getReport(null);
  assert.deepStrictEqual(toPlain(r), { note: '', screenshots: [] });
  assert.strictEqual(_getCalls, 0, 'getReport(null) must not call indexedDB.get');
});

/**
 * setReport_nullPort_doesNotWrite
 * setReport(null, {…}) writes nothing: no report:null key; zero put calls.
 */
test('setReport_nullPort_doesNotWrite', async () => {
  await sandbox.setReport(null, { note: 'x', screenshots: [{}] });
  assert.strictEqual(_putCalls, 0, 'setReport(null) must not call indexedDB.put');
  assert.strictEqual(_kv['report:null'], undefined, 'report:null key must not exist');
  // No key at all should have been written
  assert.strictEqual(Object.keys(_kv).length, 0, 'kv must remain empty');
});

/**
 * GET_STATE_localhostTab_returnsPortScopedCountNote
 * GET_STATE while tabs resolves localhost:5101 with 2 screenshots + note "n"
 * → count === 2, note === "n". (Fields asserted individually — port field added
 * by fe-002 must not break this test.)
 */
test('GET_STATE_localhostTab_returnsPortScopedCountNote', async () => {
  _mockTabUrl = 'http://localhost:5101/';
  _kv['report:5101'] = { note: 'n', screenshots: [{ url: 'a' }, { url: 'b' }] };

  const resp = await sendMsg({ type: 'GET_STATE' });
  assert.strictEqual(resp.count, 2, 'count must equal screenshots.length for port 5101');
  assert.strictEqual(resp.note, 'n', 'note must equal report note for port 5101');
});

/**
 * SET_NOTE_writesOnlyCurrentTargetRecord
 * SET_NOTE at 5101 writes "A"; GET_STATE at 5101 → note "A";
 * switch to 5102 and GET_STATE → note "" (per-port note isolation).
 */
test('SET_NOTE_writesOnlyCurrentTargetRecord', async () => {
  _mockTabUrl = 'http://localhost:5101/';
  await sendMsg({ type: 'SET_NOTE', note: 'A' });

  // Verify 5101 has the note
  const resp1 = await sendMsg({ type: 'GET_STATE' });
  assert.strictEqual(resp1.note, 'A', 'note must be "A" on port 5101 after SET_NOTE');

  // Switch to 5102 — its note must be untouched
  _mockTabUrl = 'http://localhost:5102/';
  const resp2 = await sendMsg({ type: 'GET_STATE' });
  assert.strictEqual(resp2.note, '', 'note on port 5102 must still be "" (isolation)');
});

// ===========================================================================
// LOW-1 PROMOTE security case
// ===========================================================================

/**
 * addScreenshot_deceptiveHost_writesNoRecord
 * A deceptive hostname (http://localhost.evil.com/) fails the tight localhost gate
 * and returns an error; zero put calls — no report:* record is written.
 * (fe-001 LOW-1 PROMOTE: write-key ≡ read-key, deceptive host → no-target.)
 */
test('addScreenshot_deceptiveHost_writesNoRecord', async () => {
  _mockTabUrl = 'http://localhost.evil.com/';
  const result = await sandbox.addScreenshot();

  assert.ok(result && result.error, 'addScreenshot must return an error for deceptive host');
  assert.ok(
    result.error.includes('localhost'),
    'error message must mention localhost (guard error string)'
  );
  assert.strictEqual(_putCalls, 0, 'zero put calls — no report:* record must be written');
  assert.strictEqual(Object.keys(_kv).length, 0, 'kv must remain empty (no report:80 or similar)');
});

// ===========================================================================
// fe-002 Unit test cases (4 cases)
// ===========================================================================

/**
 * GET_STATE_localhostTarget_includesResolvedPort
 * GET_STATE on localhost:5101 with 1 screenshot + note "n"
 * → deep-equals { count:1, note:"n", port:5101 }.
 */
test('GET_STATE_localhostTarget_includesResolvedPort', async () => {
  _mockTabUrl = 'http://localhost:5101/';
  _kv['report:5101'] = { note: 'n', screenshots: [{ url: 'http://localhost:5101/' }] };

  const resp = await sendMsg({ type: 'GET_STATE' });
  assert.deepStrictEqual(toPlain(resp), { count: 1, note: 'n', port: 5101 });
});

/**
 * GET_STATE_secondPort_returnsThatPort
 * GET_STATE on localhost:5102 → port === 5102.
 */
test('GET_STATE_secondPort_returnsThatPort', async () => {
  _mockTabUrl = 'http://localhost:5102/';
  _kv['report:5102'] = { note: '', screenshots: [{}] };

  const resp = await sendMsg({ type: 'GET_STATE' });
  assert.strictEqual(resp.port, 5102);
});

/**
 * GET_STATE_nonLocalhostTab_returnsEmptyWithNullPort
 * GET_STATE on https://example.com → { count:0, note:"", port:null }.
 */
test('GET_STATE_nonLocalhostTab_returnsEmptyWithNullPort', async () => {
  _mockTabUrl = 'https://example.com/';

  const resp = await sendMsg({ type: 'GET_STATE' });
  assert.deepStrictEqual(toPlain(resp), { count: 0, note: '', port: null });
});

/**
 * GET_STATE_aboutBlank_returnsNullPort
 * GET_STATE on about:blank → count===0, port===null.
 */
test('GET_STATE_aboutBlank_returnsNullPort', async () => {
  _mockTabUrl = 'about:blank';

  const resp = await sendMsg({ type: 'GET_STATE' });
  assert.strictEqual(resp.count, 0);
  assert.strictEqual(resp.port, null);
});
