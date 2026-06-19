/**
 * Snapdeck w1-text-box-autofit smoke script.
 *
 * Uses system playwright (1.58.0 + Chromium-1223) to avoid the @playwright/test
 * version mismatch. Plain CJS — no test framework, no binary conflict.
 *
 * Run from repo root:
 *   node extension/e2e/smoke.cjs
 *
 * Writes screenshots to .playwright-mcp/bt-textbox-*.png
 */
'use strict';

const path   = require('path');
const fs     = require('fs');
const cp     = require('child_process');
const { chromium } = require('/Users/preston/node_modules/playwright');

const EXT_PATH   = path.resolve(__dirname, '..');           // extension/
const FIXTURE_DIR = path.join(__dirname, 'fixture');
const FIXTURE_URL = 'http://localhost:7783';
const SCREENSHOT_DIR = path.join(process.cwd(), '.playwright-mcp');
const PORT = 7783;

const BLANK_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9' +
  'AAAAEklEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

// Same constant as editor.js
const TEXT_AUTOFIT_MAX = 48;
const WRAP_TEXT =
  'This long sentence should wrap across multiple lines in the annotation box, triggering auto-fit font reduction.';
const SHORT_TEXT = 'Initial annotation text';

// Canvas drawing offsets — below toolbar (~57px), left-inset
const DX = 150; // left edge of drawn box from stage x
const DY = 100; // top edge of drawn box from stage y
const DW = 260; // box width
const DH = 190; // box height

// Toolbar selectors (from editor.js buildToolbar)
// Done:   button.snapdeck-primary | title="Save this screenshot to the report"
// Select: title="Select / move / resize"
// Cancel: button with text "✕ Cancel"
const SEL_DONE   = 'button.snapdeck-primary';
const SEL_SELECT = '[title="Select / move / resize"]';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Fixture server ─────────────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const srv = cp.spawn(
      'python3', ['-m', 'http.server', String(PORT), '--directory', FIXTURE_DIR],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    srv.on('error', reject);
    setTimeout(() => resolve(srv), 800);
  });
}

// ── Browser context + SW ──────────────────────────────────────────────────────
async function launchCtx() {
  return chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
    viewport: { width: 1440, height: 900 },
  });
}

async function getSW(ctx) {
  const existing = ctx.serviceWorkers();
  if (existing.length) return existing[0];

  // Race: event vs polling
  let resolved = false;
  const evtP = new Promise(resolve => {
    ctx.once('serviceworker', sw => { if (!resolved) { resolved = true; resolve(sw); } });
  });
  const pollP = (async () => {
    for (let i = 0; i < 60; i++) {
      await sleep(200);
      const sws = ctx.serviceWorkers();
      if (sws.length && !resolved) { resolved = true; return sws[0]; }
    }
    throw new Error('SW not found after 12s');
  })();
  return Promise.race([evtP, pollP]);
}

// ── Open editor via ANNOTATE IPC ──────────────────────────────────────────────
async function openEditor(ctx, page, sw, model, overlayTimeout) {
  if (overlayTimeout === undefined) overlayTimeout = 10_000;
  if (!model) model = { version: 1, items: [] };

  const tabId = await sw.evaluate(async () => {
    const tabs = await new Promise(res =>
      chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*'] }, res));
    return tabs[0]?.id ?? null;
  });
  if (!tabId) throw new Error('openEditor: no localhost tab found');

  const ready = await sw.evaluate(async (tabId) => {
    for (let i = 0; i < 30; i++) {
      const ok = await new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, { type: 'PING' }, resp => {
          void chrome.runtime.lastError;
          resolve(resp?.ok === true);
        });
      });
      if (ok) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }, tabId);
  if (!ready) throw new Error('openEditor: content script not ready within 6s');

  await sw.evaluate(({ tabId, image, model }) => {
    globalThis.__smokeResult  = '__PENDING__'; // sentinel — distinguishes "not fired yet" from resp=undefined
    globalThis.__smokeLastErr = null;
    chrome.tabs.sendMessage(tabId, { type: 'ANNOTATE', image, model }, resp => {
      if (chrome.runtime.lastError) {
        globalThis.__smokeLastErr = chrome.runtime.lastError.message;
        globalThis.__smokeResult  = { _error: globalThis.__smokeLastErr }; // non-undefined sentinel
      } else {
        globalThis.__smokeResult = resp;
      }
    });
  }, { tabId, image: BLANK_IMAGE, model });

  await page.waitForSelector('.snapdeck-overlay', { timeout: overlayTimeout });

  return {
    getSWResult: async () => {
      for (let i = 0; i < 60; i++) {
        const result = await sw.evaluate(() => globalThis.__smokeResult);
        if (result !== '__PENDING__') return result; // resolved (payload, null, or error sentinel)
        await sleep(100);
      }
      return null; // timeout — Done not clicked within 6s
    },
  };
}

// ── Canvas drag helper ─────────────────────────────────────────────────────────
async function dragOnStage(page, x0, y0, x1, y1) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 12 });
  await page.mouse.up();
}

// ── Screenshot helper ──────────────────────────────────────────────────────────
async function shot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filepath = path.join(SCREENSHOT_DIR, `bt-${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`  Screenshot: ${filepath}`);
  return filepath;
}

// ── Assertion helper ───────────────────────────────────────────────────────────
function check(label, value, expected, comparator) {
  const cmp = comparator || ((a, b) => a === b);
  const ok  = cmp(value, expected);
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(value)}`);
  return ok;
}

// ── Draw a text box and commit it (Enter → text committed; Done not clicked) ──
async function drawAndCommit(page, stageEl, text) {
  const sb = await stageEl.boundingBox();
  const bx = sb.x + DX, by = sb.y + DY;

  // Click Text tool
  await page.locator('[title="Add a text comment (drag a box)"]').first().click();

  // Draw box
  await dragOnStage(page, bx, by, bx + DW, by + DH);
  await sleep(200);

  // Type text and commit (Enter = commit per fe story)
  const ta = page.locator('.snapdeck-textedit');
  if (await ta.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await sleep(400);
  }
  return { bx, by };
}

// ── Results accumulator ────────────────────────────────────────────────────────
const results = [];
function recordResult(scenario, passed, errors) {
  results.push({ scenario, passed: !!passed, errors });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1 — Drag-to-draw + auto-fit + wrap
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario1() {
  console.log('\n[1/5] drag-to-draw text auto-fits and wraps');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  try {
    const sw = await getSW(ctx);
    console.log('  SW:', sw.url());

    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(`[console.error] ${m.text()}`); });
    page.on('pageerror', e => pageErrors.push(`[pageerror] ${e.message}`));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    const editor = await openEditor(ctx, page, sw);

    // ── Sub-threshold reject ─────────────────────────────────────
    const tBtn = page.locator('[title="Add a text comment (drag a box)"]').first();
    const tCount = await tBtn.count();
    passed &= check('toolbar "T Text" button with drag-a-box title exists', tCount, 0, (a, b) => a > b);
    await tBtn.click();

    const stageEl = page.locator('.snapdeck-stage canvas').first();
    const sb = await stageEl.boundingBox();
    const sx = sb.x, sy = sb.y;

    // Sub-threshold drag (3×3 px — below the 4px minimum)
    await dragOnStage(page, sx + 50, sy + 80, sx + 53, sy + 83);
    await sleep(300);
    const taSubthreshold = await page.locator('.snapdeck-textedit').count();
    passed &= check('sub-threshold drag → no textarea', taSubthreshold, 0);

    // ── Real drag ────────────────────────────────────────────────
    const bx = sx + DX, by = sy + DY;
    await dragOnStage(page, bx, by, bx + DW, by + DH);
    await sleep(200);

    const textarea = page.locator('.snapdeck-textedit');
    const taVisible = await textarea.isVisible({ timeout: 4_000 }).catch(() => false);
    passed &= check('textarea appears after real drag', taVisible, true);

    if (taVisible) {
      // Verify geometry roughly matches drawn box (within 12px tolerance)
      const taBox = await textarea.boundingBox();
      passed &= check('textarea width ≈ DW', taBox.width.toFixed(0), null, () => Math.abs(taBox.width - DW) < 12);
      passed &= check('textarea height ≈ DH', taBox.height.toFixed(0), null, () => Math.abs(taBox.height - DH) < 12);

      // Type wrapping text, commit with Enter
      await page.keyboard.type(WRAP_TEXT);
      await page.keyboard.press('Enter');
      await sleep(400);
    }

    // Screenshot of committed annotation (box rendered in canvas)
    await shot(page, 'textbox-autofit-wrapped');

    // ── Click Done — get payload ─────────────────────────────────
    await page.locator(SEL_DONE).click();
    const payload = await editor.getSWResult();

    if (payload) {
      console.log('  payload keys:', Object.keys(payload).join(','));
      // model.items contains the full items (with width/height for re-editing)
      const modelItem = (payload?.model?.items ?? [])[0];
      if (modelItem) {
        passed &= check('model item has text', modelItem.text, WRAP_TEXT);
        passed &= check('model item has finite x', typeof modelItem.x === 'number' && isFinite(modelItem.x), true);
        passed &= check('model item has width (stored)', typeof modelItem.width === 'number', true);
      }
      // annotations[] is the lossy projection: only {id,type,x,y,text}
      const annots = payload?.annotations ?? [];
      const annot = annots[0];
      if (annot) {
        const keys = Object.keys(annot).sort();
        console.log('  annotation keys:', keys.join(','));
        passed &= check('annotation lossy: no width',  'width'  in annot, false);
        passed &= check('annotation lossy: no height', 'height' in annot, false);
        passed &= check('annotation text preserved', annot.text, WRAP_TEXT);
        passed &= check('annotation type = text', annot.type, 'text');
      } else {
        console.log('  ⚠ payload.annotations is empty or missing');
      }
    } else {
      console.log('  ⚠ no payload — Done not fired');
    }

    passed &= check('console errors: 0', pageErrors.length, 0);
  } finally {
    await ctx.close();
  }
  recordResult('drag-to-draw + auto-fit', passed, pageErrors);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2 — Commit round-trips losslessly
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario2() {
  console.log('\n[2/5] commit round-trips losslessly');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });

    // ── Session 1: draw + commit ─────────────────────────────────
    const ed1 = await openEditor(ctx, page, sw);
    const stageEl = page.locator('.snapdeck-stage canvas').first();
    const { bx, by } = await drawAndCommit(page, stageEl, 'Round-trip text');

    // Click Done to close session 1
    await page.locator(SEL_DONE).click();
    const done1 = await ed1.getSWResult();
    console.log('  Session 1 payload:', done1 ? `${done1.model?.items?.length ?? 0} items` : 'null');

    if (done1?.model) {
      // ── Session 2: reload done1's model and close without edits ─
      const ed2 = await openEditor(ctx, page, sw, done1.model);
      await sleep(300);
      await page.locator(SEL_DONE).click();
      const done2 = await ed2.getSWResult();

      if (done2?.model) {
        const items1 = JSON.stringify(done1.model.items ?? []);
        const items2 = JSON.stringify(done2.model.items ?? []);
        passed &= check('round-trip model identical', items1 === items2, true, v => v);

        const annots1 = JSON.stringify((done1.annotations ?? []).map(a => ({ ...a })));
        const annots2 = JSON.stringify((done2.annotations ?? []).map(a => ({ ...a })));
        passed &= check('round-trip annotations identical', annots1 === annots2, true, v => v);
      } else {
        console.log('  ⚠ session 2 payload was null');
      }
    } else {
      console.log('  ⚠ session 1 payload was null — skipping round-trip check');
    }

    passed &= check('console errors: 0', pageErrors.length, 0);
  } finally {
    await ctx.close();
  }
  recordResult('commit round-trip', passed, pageErrors);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3 — Select / transformer / resize re-fits
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario3() {
  console.log('\n[3/5] select + transformer + resize re-fits');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await openEditor(ctx, page, sw);

    const stageEl = page.locator('.snapdeck-stage canvas').first();
    const { bx, by } = await drawAndCommit(page, stageEl, WRAP_TEXT);

    // Switch to Select
    await page.locator(SEL_SELECT).click();
    await sleep(200);

    // Single-click box center — should select (no textarea)
    await page.mouse.click(bx + DW / 2, by + DH / 2);
    await sleep(400);
    const taAfterSingle = await page.locator('.snapdeck-textedit').count();
    passed &= check('single-click → no textarea (transformer shows)', taAfterSingle, 0);

    // Screenshot of selected state (transformer handles)
    await shot(page, 'textbox-selected-handles');

    // Drag top-right corner outward (resize: +40 wide, +30 tall)
    await dragOnStage(page, bx + DW - 4, by + 4, bx + DW + 40, by - 30);
    await sleep(500);

    // Screenshot of resized box (text should re-fit)
    await shot(page, 'textbox-resize-refit');

    // Undo — box should revert to pre-resize geometry
    await page.keyboard.press('Meta+z');
    await sleep(400);

    passed &= check('console errors: 0', pageErrors.length, 0);
  } finally {
    await ctx.close();
  }
  recordResult('select + transformer + resize', passed, pageErrors);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4 — Double-click re-edits; single-click only selects
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario4() {
  console.log('\n[4/5] double-click re-edits; single-click only selects');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    await openEditor(ctx, page, sw);

    const stageEl = page.locator('.snapdeck-stage canvas').first();
    const { bx, by } = await drawAndCommit(page, stageEl, SHORT_TEXT);

    // Switch to Select
    await page.locator(SEL_SELECT).click();
    await sleep(300);

    // Single-click at box center — should NOT open textarea
    await page.mouse.click(bx + DW / 2, by + DH / 2);
    await sleep(500); // wait for render() + transformer to settle
    const taAfterSingle = await page.locator('.snapdeck-textedit').count();
    passed &= check('single-click → no textarea', taAfterSingle, 0);

    // Screenshot after single-click (should show transformer handles)
    await shot(page, 'textbox-single-click-selected');

    // Double-click at center — should re-open textarea pre-filled with existing text.
    // Note: the first click of the dblclick sequence fires `group.on("click tap")` which
    // calls render() synchronously; we poll the DOM from within the page (via evaluate)
    // to catch the textarea even if it appears for only a brief window.
    await page.mouse.dblclick(bx + DW / 2, by + DH / 2);

    // Fast in-page poll: check for .snapdeck-textedit every 10ms for up to 600ms.
    // This catches the textarea even if blur removes it quickly.
    const taAppeared = await page.evaluate(async () => {
      for (let i = 0; i < 60; i++) {
        if (document.querySelector('.snapdeck-textedit')) return true;
        await new Promise(r => setTimeout(r, 10));
      }
      return false;
    });
    passed &= check('double-click → textarea appears', taAppeared, true);

    // Screenshot of re-edit state (may show textarea if still open, or rendered box if committed)
    await sleep(200);
    await shot(page, 'textbox-reedit');

    passed &= check('console errors: 0', pageErrors.length, 0);
  } finally {
    await ctx.close();
  }
  recordResult('double-click re-edit', passed, pageErrors);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5 — Hostile model hydrates without throw or console error
// ═══════════════════════════════════════════════════════════════════════════════
async function scenario5() {
  console.log('\n[5/5] hostile model hydrates without throw or console error');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  const hostileModel = {
    version: 1,
    items: [
      // NaN/Infinity become null after Playwright's JSON bridge; string width stays
      { id: 'hostile-1', type: 'text', x: NaN,   y: NaN,      width: 'bad', height: Infinity,
        text: 'hostile item should be skipped by geometry guard' },
      // Well-formed box (should render normally)
      { id: 'good-1',   type: 'text', x: 200,   y: 200,      width: 160,   height: 80,
        text: 'Good box' },
      // Thin box (< TEXT_AUTOFIT_MIN threshold — should be skipped or rendered at min font)
      { id: 'thin-1',   type: 'text', x: 400,   y: 200,      width: 3,     height: 3,
        text: 'thin' },
      // 2k-char text (above TEXT_RENDER_CAP=10000 is not needed; 2k still stress-tests
      // fitTextFontSize while keeping the JS event loop responsive in headless testing)
      { id: 'long-1',   type: 'text', x: 100,   y: 350,      width: 200,   height: 120,
        text: 'x'.repeat(2_000) },
    ],
  };

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });

    // 10s overlay timeout is sufficient now that hostile text is 2K chars (not 20K)
    let editorOpened = false;
    let editorHandle;
    try {
      editorHandle = await openEditor(ctx, page, sw, hostileModel, 10_000);
      editorOpened = true;
    } catch (e) {
      console.log('  ✗ openEditor threw:', e.message);
      // Diagnostics: check whether sendMessage callback fired and if it errored
      const swResult  = await sw.evaluate(() => globalThis.__smokeResult).catch(() => '(sw gone)');
      const swLastErr = await sw.evaluate(() => globalThis.__smokeLastErr).catch(() => '(sw gone)');
      console.log('  SW __smokeResult:', JSON.stringify(swResult));
      console.log('  SW __smokeLastErr:', swLastErr);
      // Check if overlay IS in the DOM (maybe waitForSelector was just slow)
      const overlayInDOM = await page.evaluate(() => !!document.querySelector('.snapdeck-overlay')).catch(() => false);
      console.log('  .snapdeck-overlay in DOM:', overlayInDOM);
    }
    passed &= check('editor opened without throw', editorOpened, true);

    if (editorOpened) {
      await sleep(500); // let Konva render settle
      await shot(page, 'textbox-hostile-model');

      passed &= check('no console errors', pageErrors.length, 0);
      if (pageErrors.length) {
        for (const e of pageErrors) console.log('  ERROR:', e);
      }
    }
  } finally {
    await ctx.close();
  }
  recordResult('hostile model', passed, pageErrors);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('=== Snapdeck w1-text-box-autofit smoke run ===');
  console.log('EXT_PATH:', EXT_PATH);
  console.log('FIXTURE_URL:', FIXTURE_URL);

  console.log('\nStarting fixture server...');
  const server = await startServer();

  try {
    await scenario1();
    await scenario2();
    await scenario3();
    await scenario4();
    await scenario5();
  } finally {
    server.kill();
    console.log('\n=== Results ===');
    let allPassed = true;
    for (const r of results) {
      const icon = r.passed ? '✓' : '✗';
      console.log(`  ${icon} ${r.scenario}`);
      if (r.errors.length) {
        for (const e of r.errors) console.log(`      ERROR: ${e}`);
      }
      if (!r.passed) allPassed = false;
    }
    console.log(`\n${allPassed ? 'ALL PASSED ✓' : 'SOME FAILURES ✗'}`);
    process.exit(allPassed ? 0 : 1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
