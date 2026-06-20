/**
 * Unit tests for background.js — REOPEN_SCREENSHOT + resaveScreenshot
 * (STORY-fe-002 w2-screenshot-gallery).
 *
 * Runs via: node --test extension/background.reopen.test.mjs
 *           (or: node --test extension/*.test.mjs)
 *
 * Harness: vm.createContext + hand-written chrome mock + in-memory IDB stub
 * (mirrors background.emit.test.mjs + background.gallery.test.mjs pattern).
 * IDB stub supports get, put, delete.
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
// IDB stub factory — supports get, put, delete
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
                get(key)    { return makeReq(() => kv[key]); },
                put(val, key) { return makeReq(() => { kv[key] = val; }); },
                delete(key)  { return makeReq(() => { delete kv[key]; }); },
              };
            },
          };
        },
      }));
    },
  };
}

const toPlain = v => JSON.parse(JSON.stringify(v));

// Factory for a seeded screenshot record.
function makeShot(overrides = {}) {
  return Object.assign({
    url:         'http://localhost:5101/',
    title:       'Test Page',
    captured_at: '2026-01-01T00:00:00.000Z',
    viewport:    { w: 1280, h: 800 },
    original:    'data:image/png;base64,ORIG==',
    annotated:   'data:image/png;base64,ANN==',
    annotations: [{ type: 'arrow', old: true }],
    console:     ['log1'],
    network:     ['net1'],
    model:       { version: 1, items: [{ type: 'arrow', old: true }] },
  }, overrides);
}

// ===========================================================================
// Main sandbox — chrome includes storage.session.set + tabs.sendMessage
// ===========================================================================

const _kv = {};
let _tick = null;
let _mockTabUrl = 'http://localhost:5101/';
let _onMsgListener = null;

// sendMessage control: can be set to a value or a function
let _sendMsgControl = null; // null = use default (returns {ok:true})

const _chromeMock = {
  runtime: {
    onMessage: { addListener(cb) { _onMsgListener = cb; } },
  },
  commands: { onCommand: { addListener() {} } },
  tabs: {
    query() {
      if (_mockTabUrl === null) return Promise.resolve([]);
      return Promise.resolve([{ id: 42, url: _mockTabUrl, windowId: 1 }]);
    },
    captureVisibleTab() { return Promise.resolve('data:image/png;base64,abc'); },
    sendMessage(_tabId, msg) {
      if (typeof _sendMsgControl === 'function') return _sendMsgControl(_tabId, msg);
      if (_sendMsgControl !== null) return Promise.resolve(_sendMsgControl);
      return Promise.resolve({ ok: true }); // default: PING succeeds, ANNOTATE no-ops
    },
  },
  action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {}, getBadgeText() { return Promise.resolve(''); } },
  storage: {
    session: {
      set(arg)    { _tick = arg; },
      get()       { return Promise.resolve({}); },
      onChanged:  { addListener() {} },
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
  indexedDB: makeIdbStub(_kv),
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

// Expose helpers for direct calls
const { screenshotId, resaveScreenshot } = _sandbox;

// Helper: wait for all pending microtasks/promises to settle (for fire-and-forget)
function flushAsync() {
  return new Promise(resolve => setTimeout(resolve, 10));
}

describe('REOPEN_SCREENSHOT + resaveScreenshot (STORY-fe-002)', () => {
  beforeEach(() => {
    for (const k of Object.keys(_kv)) delete _kv[k];
    _tick = null;
    _mockTabUrl = 'http://localhost:5101/';
    _sendMsgControl = null; // default: PING and ANNOTATE both resolve ok
  });

  // -------------------------------------------------------------------------
  // reopen_passesStoredOriginalAndModelToAnnotate
  // seed report:5101[1] with original + model; REOPEN_SCREENSHOT {sid};
  // assert ANNOTATE was called with {type:"ANNOTATE", image:original, model:stored-model}.
  // -------------------------------------------------------------------------
  test('reopen_passesStoredOriginalAndModelToAnnotate', async () => {
    const shot = makeShot({
      captured_at: '2026-01-01T00:00:01.000Z',
      original: 'data:image/png;base64,ORIG_MODEL',
      model: { version: 1, items: [{ type: 'arrow', x: 10 }] },
    });
    _kv['report:5101'] = { note: '', screenshots: [shot] };

    const sid = screenshotId(shot);

    const capturedAnnotateCalls = [];
    _sendMsgControl = (_tabId, msg) => {
      if (msg.type === 'PING') return Promise.resolve({ ok: true });
      if (msg.type === 'ANNOTATE') {
        capturedAnnotateCalls.push(toPlain(msg));
        return Promise.resolve({ cancelled: true }); // no re-save needed for this test
      }
      return Promise.resolve({});
    };

    const res = toPlain(await sendMsg({ type: 'REOPEN_SCREENSHOT', sid }));
    await flushAsync(); // let .then() fire

    assert.deepStrictEqual(res, { ok: true, opening: true }, 'must return {ok:true, opening:true}');
    assert.strictEqual(capturedAnnotateCalls.length, 1, 'ANNOTATE must be called exactly once');
    const annotate = capturedAnnotateCalls[0];
    assert.strictEqual(annotate.type, 'ANNOTATE');
    assert.strictEqual(annotate.image, 'data:image/png;base64,ORIG_MODEL', 'must pass stored original');
    assert.deepStrictEqual(annotate.model, shot.model, 'must pass stored model verbatim');
  });

  // -------------------------------------------------------------------------
  // reopen_noHost_returnsReloadError_noMutation
  // PING rejects → returns graceful reload-page error; record unchanged.
  // -------------------------------------------------------------------------
  test('reopen_noHost_returnsReloadError_noMutation', async () => {
    const shot = makeShot({ captured_at: '2026-01-01T00:00:01.000Z' });
    _kv['report:5101'] = { note: '', screenshots: [shot] };
    const originalRecord = toPlain(_kv['report:5101']);

    const sid = screenshotId(shot);
    let annotateCalled = false;
    _sendMsgControl = (_tabId, msg) => {
      if (msg.type === 'PING') return Promise.reject(new Error('no content script'));
      if (msg.type === 'ANNOTATE') { annotateCalled = true; return Promise.resolve({}); }
      return Promise.resolve({});
    };

    const res = toPlain(await sendMsg({ type: 'REOPEN_SCREENSHOT', sid }));

    assert.ok(res.error, 'must return {error}');
    assert.ok(res.error.includes('reload the page'), 'error must mention reload the page');
    assert.strictEqual(annotateCalled, false, 'ANNOTATE must NOT be called when PING fails');
    // Record unchanged
    assert.deepStrictEqual(toPlain(_kv['report:5101']), originalRecord, 'record must be unchanged');
  });

  // -------------------------------------------------------------------------
  // reopen_nonTarget_returnsError
  // about:blank → currentTargetPort() null → {error:"no current Snapdeck target tab"}
  // -------------------------------------------------------------------------
  test('reopen_nonTarget_returnsError', async () => {
    _mockTabUrl = 'about:blank';
    let sendMessageCalled = false;
    _sendMsgControl = () => { sendMessageCalled = true; return Promise.resolve({}); };

    const res = toPlain(await sendMsg({ type: 'REOPEN_SCREENSHOT', sid: 'any' }));

    assert.ok(res.error, 'must return {error}');
    assert.ok(res.error.includes('no current Snapdeck target tab'),
      'error must mention no current target tab');
    assert.strictEqual(sendMessageCalled, false, 'sendMessage must not be called for non-target');
  });

  // -------------------------------------------------------------------------
  // reopen_unknownSid_returnsError
  // seed 2 shots, REOPEN_SCREENSHOT {sid:"nope"} → {error:"no such screenshot"}, no sendMessage.
  // -------------------------------------------------------------------------
  test('reopen_unknownSid_returnsError', async () => {
    const shot0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z' });
    const shot1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z' });
    _kv['report:5101'] = { note: '', screenshots: [shot0, shot1] };

    let sendMessageCalled = false;
    _sendMsgControl = () => { sendMessageCalled = true; return Promise.resolve({}); };

    const res = toPlain(await sendMsg({ type: 'REOPEN_SCREENSHOT', sid: 'nope' }));

    assert.ok(res.error, 'must return {error}');
    assert.ok(res.error.includes('no such screenshot'), 'error must mention no such screenshot');
    assert.strictEqual(sendMessageCalled, false, 'sendMessage must not be called for unknown sid');
  });

  // -------------------------------------------------------------------------
  // resave_preservesCaptureFields_takesOnlyEditorModel
  // THE field-preserve corruption-lock assertion.
  // Seed a shot with all fields; call resaveScreenshot with editor resp that
  // has FRESH meta + LIVE console/network/original values.
  // Assert only model/annotated/annotations are taken; all other fields preserved.
  // -------------------------------------------------------------------------
  test('resave_preservesCaptureFields_takesOnlyEditorModel', async () => {
    const shot = {
      url:         'U',
      title:       'T',
      captured_at: 'CA',
      viewport:    { w: 9, h: 9 },
      original:    'O',
      annotated:   'OLD_ANN',
      annotations: [{ old: true }],
      console:     ['c'],
      network:     ['n'],
      model:       { version: 1, items: [{ old: true }] },
    };
    _kv['report:5101'] = { note: '', screenshots: [shot] };
    const sid = screenshotId(shot);

    // Editor response: FRESH meta, LIVE console/network, ECHO original, NEW model
    const editorResp = {
      model:       { version: 1, items: [{ new: true }] },
      annotated:   'NEW_ANN',
      annotations: [{ new: true }],
      original:    'ECHO',      // echo of what we passed in — must NOT be persisted
      meta:        { url: 'FRESH', title: 'FRESH', captured_at: 'FRESH', viewport: { w: 1, h: 1 } },
      console:     ['LIVE'],
      network:     ['LIVE'],
    };

    await resaveScreenshot(5101, sid, editorResp);

    const stored = toPlain(_kv['report:5101'].screenshots[0]);

    // Taken from editor:
    assert.deepStrictEqual(stored.model, { version: 1, items: [{ new: true }] }, 'model must be taken from editor');
    assert.strictEqual(stored.annotated, 'NEW_ANN', 'annotated must be taken from editor');
    assert.deepStrictEqual(stored.annotations, [{ new: true }], 'annotations must be taken from editor');

    // Preserved from pre-edit record:
    assert.strictEqual(stored.original, 'O', 'original must be preserved (NOT echo from editor)');
    assert.deepStrictEqual(stored.console, ['c'], 'console must be preserved (NOT live)');
    assert.deepStrictEqual(stored.network, ['n'], 'network must be preserved (NOT live)');
    assert.strictEqual(stored.url, 'U', 'url must be preserved');
    assert.strictEqual(stored.title, 'T', 'title must be preserved');
    assert.strictEqual(stored.captured_at, 'CA', 'captured_at must be preserved');
    assert.deepStrictEqual(stored.viewport, { w: 9, h: 9 }, 'viewport must be preserved');
  });

  // -------------------------------------------------------------------------
  // resave_siblingDeletedMidEdit_matchesBySid_noBystanderCorruption
  // THE wrong-record corruption-lock assertion (fe-002 Finding 1 block).
  // seed 3 shots; delete lower-index shot1; then resave by sid2;
  // assert the correct record is updated and the bystander (shot0) is unchanged.
  // -------------------------------------------------------------------------
  test('resave_siblingDeletedMidEdit_matchesBySid_noBystanderCorruption', async () => {
    const shot0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'ORIG0', model: { version: 1, items: [{ id: 'a' }] }, annotated: 'ANN0', annotations: [{ id: 'a' }], console: ['c0'], network: ['n0'], title: 'T0', url: 'U0', viewport: { w: 1 } });
    const shot1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z', original: 'ORIG1', model: { version: 1, items: [{ id: 'b' }] }, annotated: 'ANN1' });
    const shot2 = makeShot({ captured_at: '2026-01-01T00:00:02.000Z', original: 'ORIG2', model: { version: 1, items: [{ id: 'c' }] }, annotated: 'ANN2', annotations: [{ id: 'c' }], console: ['c2'], network: ['n2'] });
    _kv['report:5101'] = { note: '', screenshots: [shot0, shot1, shot2] };

    const sidB = screenshotId(shot2); // the shot being re-edited

    // Simulate: while overlay is open, delete shot1 (lower index splice)
    const sid1 = screenshotId(shot1);
    await sendMsg({ type: 'DELETE_SCREENSHOT', sid: sid1 });
    // Now report is [shot0, shot2] — shot2 is at index 1

    // Re-save shot2's edit
    const editorResp = {
      model:       { version: 1, items: [{ new: true, id: 'c_edited' }] },
      annotated:   'ANN2_EDITED',
      annotations: [{ new: true }],
    };
    await resaveScreenshot(5101, sidB, editorResp);

    const stored = toPlain(_kv['report:5101']);
    assert.strictEqual(stored.screenshots.length, 2, 'must still have 2 screenshots');

    // shot2 (now at index 1) got the edit
    const storedShot2 = stored.screenshots[1];
    assert.deepStrictEqual(storedShot2.model, { version: 1, items: [{ new: true, id: 'c_edited' }] },
      'shot2 must have the new model');
    assert.strictEqual(storedShot2.annotated, 'ANN2_EDITED', 'shot2 must have new annotated');
    // original preserved
    assert.strictEqual(storedShot2.original, 'ORIG2', 'shot2 original must be preserved');

    // shot0 (bystander, now at index 0) is byte-unchanged
    const storedShot0 = stored.screenshots[0];
    assert.strictEqual(storedShot0.captured_at, shot0.captured_at, 'bystander captured_at must be unchanged');
    assert.deepStrictEqual(toPlain(storedShot0.model), toPlain(shot0.model), 'bystander model must be unchanged');
    assert.strictEqual(storedShot0.annotated, shot0.annotated, 'bystander annotated must be unchanged');
    assert.deepStrictEqual(toPlain(storedShot0.annotations), toPlain(shot0.annotations), 'bystander annotations must be unchanged');
    assert.strictEqual(storedShot0.original, shot0.original, 'bystander original must be unchanged');
    assert.deepStrictEqual(storedShot0.console, shot0.console, 'bystander console must be unchanged');
    assert.deepStrictEqual(storedShot0.network, shot0.network, 'bystander network must be unchanged');
    assert.strictEqual(storedShot0.title, shot0.title, 'bystander title must be unchanged');
    assert.strictEqual(storedShot0.url, shot0.url, 'bystander url must be unchanged');
  });

  // -------------------------------------------------------------------------
  // resave_selfDeletedMidEdit_failSafeNoOp
  // seed 2 shots; delete shot0 so sidX no longer resolves;
  // call resaveScreenshot(5101, sidX, ...) → fail-safe no-op; 1 surviving shot unchanged.
  // -------------------------------------------------------------------------
  test('resave_selfDeletedMidEdit_failSafeNoOp', async () => {
    const shot0 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'ORIG0' });
    const shot1 = makeShot({ captured_at: '2026-01-01T00:00:01.000Z', original: 'ORIG1' });
    _kv['report:5101'] = { note: '', screenshots: [shot0, shot1] };

    const sidX = screenshotId(shot0);

    // Delete shot0 so sidX no longer exists
    await sendMsg({ type: 'DELETE_SCREENSHOT', sid: sidX });
    assert.strictEqual(_kv['report:5101'].screenshots.length, 1, 'only shot1 remains');

    const survivingBefore = toPlain(_kv['report:5101'].screenshots[0]);

    // Now try to resave by sidX (deleted mid-edit)
    await resaveScreenshot(5101, sidX, {
      model: { version: 1, items: [{ new: true }] },
      annotated: 'NEW_ANN',
    });

    // fail-safe no-op: exactly 1 shot unchanged
    const stored = toPlain(_kv['report:5101']);
    assert.strictEqual(stored.screenshots.length, 1, 'must still have 1 screenshot (no new record created)');
    assert.deepStrictEqual(stored.screenshots[0], survivingBefore,
      'surviving shot must be byte-unchanged after fail-safe no-op');
  });

  // -------------------------------------------------------------------------
  // resave_cancelled_noMutation
  // resaveScreenshot with {cancelled:true} → record unchanged.
  // -------------------------------------------------------------------------
  test('resave_cancelled_noMutation', async () => {
    const shot = makeShot({ captured_at: '2026-01-01T00:00:00.000Z' });
    _kv['report:5101'] = { note: '', screenshots: [shot] };
    const before = toPlain(_kv['report:5101']);
    const sid = screenshotId(shot);

    await resaveScreenshot(5101, sid, { cancelled: true });

    assert.deepStrictEqual(toPlain(_kv['report:5101']), before, 'record must be unchanged on cancel');
  });

  // -------------------------------------------------------------------------
  // resave_busy_noMutation
  // resaveScreenshot with {cancelled:true, busy:true} → no double-write.
  // -------------------------------------------------------------------------
  test('resave_busy_noMutation', async () => {
    const shot = makeShot({ captured_at: '2026-01-01T00:00:00.000Z' });
    _kv['report:5101'] = { note: '', screenshots: [shot] };
    const before = toPlain(_kv['report:5101']);
    const sid = screenshotId(shot);

    await resaveScreenshot(5101, sid, { cancelled: true, busy: true });

    assert.deepStrictEqual(toPlain(_kv['report:5101']), before, 'record must be unchanged on busy cancel');
  });

  // -------------------------------------------------------------------------
  // resave_doesNotEmitCountTick
  // A successful re-save must NOT emit REPORT_COUNT_CHANGED (count unchanged).
  // -------------------------------------------------------------------------
  test('resave_doesNotEmitCountTick', async () => {
    const shot = makeShot({ captured_at: '2026-01-01T00:00:00.000Z' });
    _kv['report:5101'] = { note: '', screenshots: [shot] };
    const sid = screenshotId(shot);
    _tick = null;

    await resaveScreenshot(5101, sid, {
      model: { version: 1, items: [] },
      annotated: 'NEW',
      annotations: [],
    });

    assert.strictEqual(_tick, null,
      'resaveScreenshot must NOT emit REPORT_COUNT_CHANGED (count is unchanged)');
  });

  // -------------------------------------------------------------------------
  // resave_twoPortIsolation
  // resaveScreenshot(5101, ...) → report:5102 byte-for-byte unchanged.
  // -------------------------------------------------------------------------
  test('resave_twoPortIsolation', async () => {
    const shot5101 = makeShot({ captured_at: '2026-01-01T00:00:00.000Z', original: 'A' });
    const shot5102_0 = makeShot({ captured_at: '2026-01-02T00:00:00.000Z', original: 'B0' });
    const shot5102_1 = makeShot({ captured_at: '2026-01-02T00:00:01.000Z', original: 'B1' });
    _kv['report:5101'] = { note: '', screenshots: [shot5101] };
    _kv['report:5102'] = { note: '', screenshots: [shot5102_0, shot5102_1] };
    const report5102Before = toPlain(_kv['report:5102']);

    const sid = screenshotId(shot5101);
    await resaveScreenshot(5101, sid, { model: { version: 1, items: [] }, annotated: 'NEW', annotations: [] });

    assert.deepStrictEqual(toPlain(_kv['report:5102']), report5102Before,
      'report:5102 must be byte-for-byte unchanged after resaveScreenshot on port 5101');
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
        sendMessage() { return Promise.resolve({ ok: true }); },
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
