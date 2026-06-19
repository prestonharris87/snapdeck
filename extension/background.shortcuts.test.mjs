/**
 * Unit tests for background.js keyboard-shortcut command (STORY-be-001)
 *
 * Runs via: node --test extension/background.shortcuts.test.mjs
 *
 * Strategy:
 *   Set globalThis.chrome + globalThis.indexedDB hand-written stubs BEFORE
 *   loading background.js so the top-level chrome.commands.onCommand.addListener
 *   call captures our stub and we can invoke the registered callback directly in
 *   each test scenario.
 *
 * ACs verified:
 *   AC3  — onCommand listener registered at module scope (top-level load)
 *   AC4  — localhost tab + completed annotation → success badge + 1 screenshot
 *   AC6  — non-localhost tab → error badge, no capture
 *   AC7  — overlay unavailable (sendMessage error) → error badge
 *   AC8  — cancelled annotation → badge ends neutral
 *   AC10 — re-entrancy guard: second command while in-flight is ignored
 *   INFO-2 — addScreenshot() throw (uncaught rejection) → error badge
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Capture the REAL setTimeout before we replace it with a stub.
// Tests use _realSetTimeout for the settle() helper; background.js's
// auto-clear timers use the stub (captured, not scheduled → no process-hang).
// ---------------------------------------------------------------------------
const _realSetTimeout = globalThis.setTimeout;

/** Wait for all pending microtasks + the current timer queue to drain. */
function settle(ms = 20) {
  return new Promise(resolve => _realSetTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// In-memory IndexedDB stub
// ---------------------------------------------------------------------------
let _kv = {}; // shared kv store; reset between tests

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

globalThis.indexedDB = {
  open(name, version) {
    return _makeReq(() => ({
      createObjectStore() {},
      transaction(storeName, mode) {
        return {
          objectStore() {
            return {
              get(key)      { return _makeReq(() => _kv[key]); },
              put(val, key) { return _makeReq(() => { _kv[key] = val; }); },
            };
          },
        };
      },
    }));
  },
};

// ---------------------------------------------------------------------------
// Stub globalThis.setTimeout so background.js's badge auto-clear timers are
// captured but never scheduled (prevents process-hang after tests finish).
// ---------------------------------------------------------------------------
const _capturedTimeouts = [];
globalThis.setTimeout = (fn, ms) => { _capturedTimeouts.push(fn); return 0; };
globalThis.clearTimeout = () => {};

// ---------------------------------------------------------------------------
// Chrome API stubs
// ---------------------------------------------------------------------------

/** Captured by the stub — the onCommand callback registered at module load. */
let commandListener = null;

// Mutable per-test config ↓
let mockTabsQueryResult  = null; // Array | () => Promise
let mockCaptureResult    = 'data:image/png;base64,FAKE'; // string | () => Promise
let mockSendMessageResult = null; // value | () => Promise
let captureVisibleTabCallCount = 0;
let badgeTextCalls       = [];
let badgeBgColorCalls    = [];
let badgeTitleCalls      = [];

globalThis.chrome = {
  runtime: {
    onMessage: { addListener() {} },
    lastError:  null,
  },
  commands: {
    onCommand: {
      addListener(cb) { commandListener = cb; },
    },
  },
  tabs: {
    query(filter) {
      return typeof mockTabsQueryResult === 'function'
        ? mockTabsQueryResult()
        : Promise.resolve(mockTabsQueryResult ?? []);
    },
    captureVisibleTab(windowId, opts) {
      captureVisibleTabCallCount++;
      return typeof mockCaptureResult === 'function'
        ? mockCaptureResult()
        : Promise.resolve(mockCaptureResult);
    },
    sendMessage(tabId, msg) {
      return typeof mockSendMessageResult === 'function'
        ? mockSendMessageResult()
        : Promise.resolve(mockSendMessageResult);
    },
  },
  action: {
    setBadgeText(obj)           { badgeTextCalls.push(obj.text); },
    setBadgeBackgroundColor(obj){ badgeBgColorCalls.push(obj.color); },
    setTitle(obj)               { badgeTitleCalls.push(obj.title); },
  },
};

// ---------------------------------------------------------------------------
// Load background.js — runs its top-level code against our stubs.
// No import/export in background.js → treated as CJS by Node; top-level
// statements (including addListener calls) execute immediately.
// ---------------------------------------------------------------------------
await import('./background.js');

// Fail fast: if the listener wasn't registered at module scope, every test
// below would silently pass without exercising anything.
assert.ok(
  commandListener !== null,
  'background.js must call chrome.commands.onCommand.addListener at the top level'
);

// ---------------------------------------------------------------------------
// Convenience fixtures
// ---------------------------------------------------------------------------
const LOCALHOST_TAB     = { id: 1, url: 'http://localhost:3000/', windowId: 1 };
const NON_LOCALHOST_TAB = { id: 2, url: 'https://example.com/', windowId: 1 };

/** Completed-annotation response from the ANNOTATE overlay. */
const ANNOTATE_OK_RESP = {
  meta: {
    url: 'http://localhost:3000/',
    title: 'Test Page',
    captured_at: '2026-01-01T00:00:00.000Z',
    viewport: { width: 1280, height: 720 },
  },
  original:    'data:image/png;base64,orig',
  annotated:   'data:image/png;base64,ann',
  annotations: [],
  console:     [],
  network:     [],
};

// ---------------------------------------------------------------------------
// beforeEach — reset per-test mutable state
// ---------------------------------------------------------------------------
beforeEach(() => {
  _kv                         = {};
  mockTabsQueryResult         = null;
  mockCaptureResult           = 'data:image/png;base64,FAKE';
  mockSendMessageResult       = null;
  captureVisibleTabCallCount  = 0;
  badgeTextCalls              = [];
  badgeBgColorCalls           = [];
  badgeTitleCalls             = [];
  _capturedTimeouts.length    = 0;
});

// ===========================================================================
// Tests
// ===========================================================================

/**
 * AC3 — chrome.commands.onCommand.addListener is registered at module scope
 * (top level) when background.js loads.  Verified by the import-time assertion
 * above; this named test makes it visible in the test output.
 */
test('onCommand_registeredAtModuleLoad_topLevel', () => {
  assert.ok(commandListener !== null, 'listener must be registered at module load');
  assert.strictEqual(typeof commandListener, 'function', 'listener must be a function');
});

/**
 * Invoking the captured callback with a command name other than
 * "capture-screenshot" must NOT call captureVisibleTab and must set no badge.
 */
test('onCommand_unknownCommand_doesNotCapture', async () => {
  commandListener('some-other-command');
  await settle();
  assert.strictEqual(captureVisibleTabCallCount, 0, 'captureVisibleTab must not be called for unknown command');
  assert.deepStrictEqual(badgeTextCalls, [], 'no badge text must be set for unknown command');
});

/**
 * AC6 — non-localhost tab → no capture; red "!" badge + tooltip carrying the
 * localhost-guard message.
 */
test('onCommand_nonLocalhostTab_setsErrorBadge_noCapture', async () => {
  mockTabsQueryResult  = [NON_LOCALHOST_TAB];

  commandListener('capture-screenshot');
  await settle();

  assert.strictEqual(captureVisibleTabCallCount, 0, 'captureVisibleTab must not be called on non-localhost tab');
  assert.ok(badgeTextCalls.includes('!'), 'error "!" badge text must be set');
  assert.ok(badgeBgColorCalls.includes('#C0392B'), 'error badge color must be red #C0392B');
  assert.ok(
    badgeTitleCalls.some(t => t && t.includes('localhost')),
    'tooltip must carry the localhost-guard message'
  );
});

/**
 * AC4 — localhost tab + completed annotation → green "✓" badge; exactly one
 * screenshot appended to the in-progress report.
 */
test('onCommand_localhostTab_completedAnnotate_setsSuccessBadge', async () => {
  mockTabsQueryResult   = [LOCALHOST_TAB];
  mockSendMessageResult = ANNOTATE_OK_RESP;

  commandListener('capture-screenshot');
  await settle();

  assert.ok(badgeTextCalls.includes('✓'), 'success "✓" badge text must be set');
  assert.ok(badgeBgColorCalls.includes('#1E8E3E'), 'success badge color must be green #1E8E3E');
  assert.ok(_kv['report'], 'report must be written to IndexedDB');
  assert.strictEqual(_kv['report'].screenshots.length, 1, 'exactly one screenshot must be appended');
});

/**
 * AC8 — cancelled annotation → no success and no error badge; report unchanged;
 * badge ends neutral (only the start-of-invocation neutral reset was applied).
 */
test('onCommand_cancelledAnnotate_leavesBadgeNeutral', async () => {
  mockTabsQueryResult   = [LOCALHOST_TAB];
  mockSendMessageResult = { cancelled: true };

  commandListener('capture-screenshot');
  await settle();

  assert.ok(!badgeTextCalls.includes('!'), 'must not set error badge on cancel');
  assert.ok(!badgeTextCalls.includes('✓'), 'must not set success badge on cancel');
  // The only badge text set is the neutral reset "" at start
  assert.deepStrictEqual(
    badgeTextCalls.filter(t => t !== ''),
    [],
    'only the neutral reset ("") badge text is expected; no error or success text'
  );
  // No screenshots stored
  const report = _kv['report'];
  assert.ok(
    !report || report.screenshots.length === 0,
    'report must remain unchanged (no screenshots) on cancel'
  );
});

/**
 * AC7 — overlay unavailable (sendMessage rejects) → addScreenshot() returns
 * {error: "..."} → error badge fires (not silent).
 */
test('onCommand_overlayUnavailable_setsErrorBadge', async () => {
  mockTabsQueryResult   = [LOCALHOST_TAB];
  mockSendMessageResult = () => Promise.reject(new Error('Could not establish connection'));

  commandListener('capture-screenshot');
  await settle();

  assert.ok(badgeTextCalls.includes('!'), 'error "!" badge must fire when overlay unavailable');
  assert.ok(badgeBgColorCalls.includes('#C0392B'), 'error badge color must be red');
  assert.ok(
    badgeTitleCalls.some(t => t && t.includes('overlay')),
    'tooltip must carry the overlay-unavailable message'
  );
});

/**
 * AC10 — re-entrancy guard: holding the first addScreenshot() in-flight (tabs.query
 * pending), a second command invocation is ignored; the resolved first invocation
 * appends exactly one screenshot.
 */
test('onCommand_reentrantPress_ignoredWhileInFlight', async () => {
  let resolveTabsQuery;
  // tabs.query returns a promise that we control — keeps the first invocation in-flight
  mockTabsQueryResult   = () => new Promise(res => { resolveTabsQuery = res; });
  mockSendMessageResult = ANNOTATE_OK_RESP;

  // Fire first command.
  // runCaptureCommand() sets captureInFlight = true SYNCHRONOUSLY (before first await),
  // then suspends at `await addScreenshot()`.
  commandListener('capture-screenshot');

  // Fire second command while first is still in-flight.
  // captureInFlight is already true → second invocation returns immediately.
  commandListener('capture-screenshot');

  // Now unblock the first invocation by resolving tabs.query.
  resolveTabsQuery([LOCALHOST_TAB]);
  await settle();

  assert.strictEqual(captureVisibleTabCallCount, 1, 'captureVisibleTab must be called exactly once (re-entrancy guard)');
  assert.ok(_kv['report'], 'report must be written');
  assert.strictEqual(_kv['report'].screenshots.length, 1, 'exactly one screenshot appended (no double-write)');
});

/**
 * INFO-2 — if addScreenshot() throws (e.g. unexpected chrome.tabs.query rejection
 * not caught inside addScreenshot), the outer try/catch in runCaptureCommand()
 * must catch it and fire the red "!" error badge (no silent failure).
 */
test('onCommand_addScreenshotThrows_setsErrorBadge', async () => {
  // chrome.tabs.query rejection propagates through activeTab() → addScreenshot() throws
  mockTabsQueryResult = () => Promise.reject(new Error('Simulated tabs.query failure'));

  commandListener('capture-screenshot');
  await settle();

  assert.ok(badgeTextCalls.includes('!'), 'error "!" badge must fire on addScreenshot() throw');
  assert.ok(badgeBgColorCalls.includes('#C0392B'), 'error badge color must be red');
});
