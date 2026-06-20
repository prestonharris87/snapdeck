/**
 * Unit tests for background.js — GET_REPORT_SCREENSHOTS + DELETE_SCREENSHOT
 * handlers + GC (STORY-fe-001 w2-screenshot-gallery).
 *
 * Runs via: node --test extension/background.gallery.test.mjs
 *           (or: node --test extension/*.test.mjs)
 *
 * Harness: vm.createContext + hand-written chrome mock + in-memory IDB stub
 * (mirrors background.emit.test.mjs pattern). IDB stub is extended with a
 * delete() operation so idbDelete/deleteReport GC can be tested.
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
// IDB stub factory — supports get, put, AND delete (required for idbDelete).
// kv is a single mutable object; clear in-place between tests.
// ---------------------------------------------------------------------------
function makeIdbStub(kv, counters) {
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
                get(key)       {
                  if (counters) counters.gets++;
                  return makeReq(() => kv[key]);
                },
                put(val, key)  { return makeReq(() => { kv[key] = val; }); },
                delete(key)    { return makeReq(() => { delete kv[key]; }); },
              };
            },
          };
        },
      }));
    },
  };
}

const toPlain = v => JSON.parse(JSON.stringify(v));

// Canonical seeded screenshot factory.
function makeShot(overrides = {}) {
  return Object.assign({
    url:         'http://localhost:5101/',
    title:       'Test Page',
    captured_at: '2026-01-01T00:00:00.000Z',
    viewport:    { w: 1280, h: 800 },
    original:    'data:image/png;base64,orig==',
    annotated:   'data:image/png;base64,ann==',
    annotations: [{ type: 'arrow' }],
    console:     ['log1'],
    network:     ['net1'],
    model:       { version: 1, items: [{ type: 'arrow' }] },
  }, overrides);
}

// ===========================================================================
// Main test group — chrome includes storage.session.set
// ===========================================================================

const _kv = {};
const _counters = { gets: 0 };
let _tick = null;
let _mockTabUrl = 'http://localhost:5101/';
let _onMsgListener = null;

const _chromeMock = {
  runtime: {
    onMessage: { addListener(cb) { _onMsgListener = cb; } },
  },
  commands: { onCommand: { addListener() {} } },
  tabs: {
    query() {
      if (_mockTabUrl === null) return Promise.resolve([]);
      return Promise.resolve([{ id: 1, url: _mockTabUrl, windowId: 1 }]);
    },
    captureVisibleTab() { return Promise.resolve('data:image/png;base64,abc'); },
    sendMessage()       { return Promise.resolve({ ok: true }); },
  },
  action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, getBadgeText() { return Promise.resolve(''); } },
  storage: {
    session: {
      set(arg)          { _tick = arg; },
      get()             { return Promise.resolve({}); },
      onChanged:        { addListener() {} },
    },
  },
};

const _sandbox = vm.createContext({
  URL, AbortController, setTimeout, clearTimeout, queueMicrotask, console,
  fetch(_url) {
    const text = JSON.stringify({ ok: true });
    return Promise.resolve({ ok: true, status: 200, text() { return Promise.resolve(text); } });
  },
  chrome:    _chromeMock,
  indexedDB: makeIdbStub(_kv, _counters),
  createImageBitmap() { return Promise.resolve({}); },
  OffscreenCanvas: class { getContext() { return { drawImage() {}, fillRect() {}, getImageData() { return {}; }, globalCompositeOperation: '', fillStyle: '' }; } },
});

vm.runInContext(bgSrc, _sandbox);
assert.ok(_onMsgListener !== null, 'background.js must register the onMessage listener');

function sendMsg(msg) {
  return new Promise((resolve) => {
    _onMsgListener(msg, {}, resolve);
  });
}

// Expose screenshotId so tests can compute expected sids
const { screenshotId, indexOfScreenshotId } = _sandbox;

describe('GET_REPORT_SCREENSHOTS + DELETE_SCREENSHOT (STORY-fe-001)', () => {
  beforeEach(() => {
    for (const k of Object.keys(_kv)) delete _kv[k];
    _tick = null;
    _counters.gets = 0;
    _mockTabUrl = 'http://localhost:5101/';
  });

  // -------------------------------------------------------------------------
  // getReportScreenshots_returnsIndexedProjection
  // seed report:5101 with 3 screenshots (one with annotated, one without);
  // assert the response is correctly projected with sids, indices, thumbnails.
  // -------------------------------------------------------------------------
  test('getReportScreenshots_returnsIndexedProjection', async () => {
    const shot0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'data:image/png;base64,orig0', annotated: 'data:image/png;base64,ann0' });
    const shot1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z', original: 'data:image/png;base64,orig1', annotated: null, annotations: [] }); // no annotated
    const shot2 = makeShot({ captured_at: '2026-01-01T00:00:02.000Z', original: 'data:image/png;base64,orig2', annotated: 'data:image/png;base64,ann2' });
    _kv['report:5101'] = { note: '', screenshots: [shot0, shot1, shot2] };

    const res = toPlain(await sendMsg({ type: 'GET_REPORT_SCREENSHOTS' }));

    assert.strictEqual(res.port, 5101, 'port must be 5101');
    assert.strictEqual(res.screenshots.length, 3, 'must return 3 screenshots');

    // indices are 0..2 in order
    assert.strictEqual(res.screenshots[0].index, 0);
    assert.strictEqual(res.screenshots[1].index, 1);
    assert.strictEqual(res.screenshots[2].index, 2);

    // thumbnail: annotated when present, else original
    assert.strictEqual(res.screenshots[0].thumbnail, 'data:image/png;base64,ann0', 'shot0: use annotated');
    assert.strictEqual(res.screenshots[1].thumbnail, 'data:image/png;base64,orig1', 'shot1: fallback to original');
    assert.strictEqual(res.screenshots[2].thumbnail, 'data:image/png;base64,ann2', 'shot2: use annotated');

    // sids are present and distinct
    const sids = res.screenshots.map(s => s.sid);
    assert.ok(sids[0] && sids[1] && sids[2], 'all sids must be non-empty');
    assert.notStrictEqual(sids[0], sids[1], 'sids must be distinct');
    assert.notStrictEqual(sids[1], sids[2], 'sids must be distinct');
    assert.notStrictEqual(sids[0], sids[2], 'sids must be distinct');

    // sids match what screenshotId() would compute
    assert.strictEqual(sids[0], screenshotId(shot0), 'sid[0] must match screenshotId(shot0)');
    assert.strictEqual(sids[1], screenshotId(shot1), 'sid[1] must match screenshotId(shot1)');
    assert.strictEqual(sids[2], screenshotId(shot2), 'sid[2] must match screenshotId(shot2)');

    // meta fields present
    assert.ok(res.screenshots[0].captured_at, 'captured_at must be present');
    assert.ok(res.screenshots[0].title, 'title must be present');
  });

  // -------------------------------------------------------------------------
  // getReportScreenshots_nonTarget_emptyNoIdbRead
  // Non-target tab: currentTargetPort() → null → EMPTY_REPORT() → screenshots:[].
  // Proves getReport(null) short-circuit (no IDB read).
  // -------------------------------------------------------------------------
  test('getReportScreenshots_nonTarget_emptyNoIdbRead', async () => {
    _mockTabUrl = 'about:blank';
    const getsBefore = _counters.gets;

    const res = toPlain(await sendMsg({ type: 'GET_REPORT_SCREENSHOTS' }));

    assert.strictEqual(res.port, null, 'port must be null for non-target tab');
    assert.deepStrictEqual(res.screenshots, [], 'screenshots must be empty');
    assert.strictEqual(_counters.gets, getsBefore,
      'no IDB get must be issued for a non-target tab (getReport(null) short-circuit)');
  });

  // -------------------------------------------------------------------------
  // deleteScreenshot_bySid_splicesAndEmitsCount
  // seed 3 shots, DELETE middle by sid → remaining are former #0 and #2,
  // return {ok,count:2}, storage.session.set tick emitted.
  // -------------------------------------------------------------------------
  test('deleteScreenshot_bySid_splicesAndEmitsCount', async () => {
    const shot0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'data:image/png;base64,orig0' });
    const shot1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z', original: 'data:image/png;base64,orig1' });
    const shot2 = makeShot({ captured_at: '2026-01-01T00:00:02.000Z', original: 'data:image/png;base64,orig2' });
    _kv['report:5101'] = { note: '', screenshots: [shot0, shot1, shot2] };

    const sid1 = screenshotId(shot1);
    const res = toPlain(await sendMsg({ type: 'DELETE_SCREENSHOT', sid: sid1 }));

    assert.deepStrictEqual(res, { ok: true, count: 2 }, 'must return {ok:true,count:2}');

    const r = _kv['report:5101'];
    assert.strictEqual(r.screenshots.length, 2, 'must have 2 remaining screenshots');
    assert.strictEqual(r.screenshots[0].captured_at, shot0.captured_at, 'former #0 must survive');
    assert.strictEqual(r.screenshots[1].captured_at, shot2.captured_at, 'former #2 must survive');

    // tick emitted
    assert.ok(_tick !== null, 'storage.session.set must have been called');
    const tick = _tick.reportCountChanged;
    assert.strictEqual(tick.port, 5101, 'tick.port must be 5101');
    assert.strictEqual(tick.count, 2, 'tick.count must be 2');
    assert.strictEqual(typeof tick.ts, 'number', 'tick.ts must be a number');
  });

  // -------------------------------------------------------------------------
  // screenshotId_stableAcrossSpliceAndUnknownSidNoOp
  // identity stability: after deleting a lower-index sibling, the held sid
  // still resolves to the correct record at its shifted position.
  // unknown sid → {error}, no mutation.
  // -------------------------------------------------------------------------
  test('screenshotId_stableAcrossSpliceAndUnknownSidNoOp', async () => {
    const shot0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'data:image/png;base64,orig0' });
    const shot1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z', original: 'data:image/png;base64,orig1' });
    const shot2 = makeShot({ captured_at: '2026-01-01T00:00:02.000Z', original: 'data:image/png;base64,orig2' });
    _kv['report:5101'] = { note: '', screenshots: [shot0, shot1, shot2] };

    // Capture sid of shot2 BEFORE any splice
    const sid2 = screenshotId(shot2);
    assert.strictEqual(typeof sid2, 'string', 'sid2 must be a string');

    // Delete the lower-index shot1 by its sid
    const sid1 = screenshotId(shot1);
    await sendMsg({ type: 'DELETE_SCREENSHOT', sid: sid1 });

    // Now report has [shot0, shot2] → shot2 is at index 1
    const r = _kv['report:5101'];
    const newIndex = indexOfScreenshotId(r, sid2);
    assert.strictEqual(newIndex, 1,
      'sid2 must resolve to the shifted position (former #2 → index 1) after lower-index splice');
    assert.strictEqual(r.screenshots[newIndex].captured_at, shot2.captured_at,
      'the record at the resolved index must be the same shot2 record');

    // Unknown sid → {error}, no mutation
    _tick = null;
    const countBefore = r.screenshots.length;
    const res = toPlain(await sendMsg({ type: 'DELETE_SCREENSHOT', sid: 'does-not-exist' }));
    assert.ok(res.error, 'unknown sid must return {error}');
    assert.strictEqual(_kv['report:5101'].screenshots.length, countBefore,
      'unknown sid delete must not mutate the report');
    assert.strictEqual(_tick, null, 'unknown sid delete must not emit a tick');
  });

  // -------------------------------------------------------------------------
  // deleteScreenshot_lastShot_removesKey_GC
  // seed 1 shot, delete by sid → idb key is ABSENT (not merely empty),
  // getReport reads {note:"",screenshots:[]}, tick emits count:0.
  // -------------------------------------------------------------------------
  test('deleteScreenshot_lastShot_removesKey_GC', async () => {
    const shot = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'data:image/png;base64,origGC' });
    _kv['report:5101'] = { note: '', screenshots: [shot] };

    const sid = screenshotId(shot);
    const res = toPlain(await sendMsg({ type: 'DELETE_SCREENSHOT', sid }));

    assert.deepStrictEqual(res, { ok: true, count: 0 }, 'must return {ok:true,count:0}');

    // Key must be ABSENT from the kv store (not merely empty record)
    assert.strictEqual('report:5101' in _kv, false,
      'report:5101 key must be absent from the store after GC delete (not just empty)');

    // getReport still reads as empty (idbGet → undefined → EMPTY_REPORT())
    const r = toPlain(await _sandbox.getReport(5101));
    assert.deepStrictEqual(r, { note: '', screenshots: [] },
      'getReport after GC delete must return EMPTY_REPORT()');

    // tick emits count:0
    assert.ok(_tick !== null, 'storage.session.set must have been called');
    const tick = _tick.reportCountChanged;
    assert.strictEqual(tick.port, 5101);
    assert.strictEqual(tick.count, 0);
  });

  // -------------------------------------------------------------------------
  // deleteScreenshot_unknownSid_noMutation
  // seed 2 shots, DELETE with unknown sid → {error}, record unchanged, no tick.
  // -------------------------------------------------------------------------
  test('deleteScreenshot_unknownSid_noMutation', async () => {
    const shot0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'data:image/png;base64,orig0' });
    const shot1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z', original: 'data:image/png;base64,orig1' });
    _kv['report:5101'] = { note: '', screenshots: [shot0, shot1] };

    const res = toPlain(await sendMsg({ type: 'DELETE_SCREENSHOT', sid: 'nope' }));

    assert.ok(res.error, 'must return {error} for unknown sid');
    assert.strictEqual(_kv['report:5101'].screenshots.length, 2,
      'report must be unchanged (2 shots)');
    assert.strictEqual(_tick, null, 'no tick must be emitted for unknown sid');
  });

  // -------------------------------------------------------------------------
  // deleteScreenshot_twoPortIsolation
  // seed report:5101 (2 shots) + report:5102 (3 shots), active tab :5101,
  // delete first shot from :5101 → report:5101 has 1 shot, report:5102 unchanged.
  // -------------------------------------------------------------------------
  test('deleteScreenshot_twoPortIsolation', async () => {
    const shot5101_0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'data:image/png;base64,a0' });
    const shot5101_1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z', original: 'data:image/png;base64,a1' });
    const shot5102_0 = makeShot({ captured_at: '2026-01-02T00:00:00.000Z', original: 'data:image/png;base64,b0' });
    const shot5102_1 = makeShot({ captured_at: '2026-01-02T00:00:01.000Z', original: 'data:image/png;base64,b1' });
    const shot5102_2 = makeShot({ captured_at: '2026-01-02T00:00:02.000Z', original: 'data:image/png;base64,b2' });
    _kv['report:5101'] = { note: '', screenshots: [shot5101_0, shot5101_1] };
    _kv['report:5102'] = { note: '', screenshots: [shot5102_0, shot5102_1, shot5102_2] };

    // active tab is 5101
    _mockTabUrl = 'http://localhost:5101/';

    const sid = screenshotId(shot5101_0);
    const res = toPlain(await sendMsg({ type: 'DELETE_SCREENSHOT', sid }));

    assert.deepStrictEqual(res, { ok: true, count: 1 });
    assert.strictEqual(_kv['report:5101'].screenshots.length, 1, 'report:5101 must have 1 shot');
    // report:5102 completely untouched
    assert.strictEqual(_kv['report:5102'].screenshots.length, 3, 'report:5102 must be unchanged (3 shots)');
    assert.strictEqual(_kv['report:5102'].screenshots[0].captured_at, shot5102_0.captured_at);
    assert.strictEqual(_kv['report:5102'].screenshots[1].captured_at, shot5102_1.captured_at);
    assert.strictEqual(_kv['report:5102'].screenshots[2].captured_at, shot5102_2.captured_at);
  });

  // -------------------------------------------------------------------------
  // moduleLoadsClean_noStorageKey
  // Second vm context with chrome mock that OMITS storage entirely:
  // proves module loads clean, onMessage registers, no throw.
  // -------------------------------------------------------------------------
  test('moduleLoadsClean_noStorageKey', () => {
    const kv2 = {};
    let listener2 = null;
    const chromeMock2 = {
      runtime: { onMessage: { addListener(cb) { listener2 = cb; } } },
      commands: { onCommand: { addListener() {} } },
      tabs: {
        query() { return Promise.resolve([{ id: 1, url: 'http://localhost:5101/', windowId: 1 }]); },
        captureVisibleTab() { return Promise.resolve('data:image/png;base64,abc'); },
        sendMessage() { return Promise.resolve({}); },
      },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      // NO storage key
    };
    const sandbox2 = vm.createContext({
      URL, AbortController, setTimeout, clearTimeout, queueMicrotask, console,
      fetch(_url) { return Promise.resolve({ ok: true, status: 200, text() { return Promise.resolve('{"ok":true}'); } }); },
      chrome:    chromeMock2,
      indexedDB: makeIdbStub(kv2),
      createImageBitmap() { return Promise.resolve({}); },
      OffscreenCanvas: class { getContext() { return { drawImage() {}, fillRect() {}, getImageData() { return {}; }, globalCompositeOperation: '', fillStyle: '' }; } },
    });

    assert.doesNotThrow(() => {
      vm.runInContext(bgSrc, sandbox2);
    }, 'module must load without throwing when chrome.storage is absent');

    assert.ok(listener2 !== null, 'onMessage listener must be registered even without chrome.storage');
  });
});
