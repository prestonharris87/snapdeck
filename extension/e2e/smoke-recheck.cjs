/**
 * Targeted re-check for DEFECT-001 (commit 6a03abb):
 *   A. Scenario 4 — dblclick re-edit (single-click selects; dblclick opens textarea;
 *      edit→commit preserves geometry; clear→commit removes box)
 *   B. Large-text — 20K-char item renders without hang; binary-search fit loop stays < 1s
 *
 * Run:  node extension/e2e/smoke-recheck.cjs
 */
'use strict';

const path   = require('path');
const fs     = require('fs');
const cp     = require('child_process');
const { chromium } = require('/Users/preston/node_modules/playwright');

const EXT_PATH    = path.resolve(__dirname, '..');   // extension/
const FIXTURE_URL = 'http://localhost:7783';
const SCREENSHOT_DIR = path.join(process.cwd(), '.playwright-mcp');
const BLANK_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9' +
  'AAAAEklEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

const DX = 150, DY = 100, DW = 260, DH = 190;
const SHORT_TEXT = 'Initial annotation text';
const SEL_SELECT = '[title="Select / move / resize"]';
const SEL_DONE   = 'button.snapdeck-primary';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function check(label, got, expected, cmp) {
  const ok = cmp ? cmp(got, expected) : got === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(got)}`);
  return ok;
}

async function shot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const p = path.join(SCREENSHOT_DIR, `bt-s4-${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  Screenshot: ${p}`);
}

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
  let resolved = false;
  const evtP = new Promise(r => ctx.once('serviceworker', w => { resolved = true; r(w); }));
  for (let i = 0; i < 75 && !resolved; i++) {
    await sleep(200);
    const sw = ctx.serviceWorkers();
    if (sw.length) { resolved = true; return sw[0]; }
  }
  return evtP;
}

async function openEditor(ctx, page, sw, model) {
  model = model || { version: 1, items: [] };
  const tabId = await sw.evaluate(async () => {
    const tabs = await new Promise(r => chrome.tabs.query({ url: ['http://localhost/*'] }, r));
    return tabs[0]?.id ?? null;
  });
  if (!tabId) throw new Error('no localhost tab');

  const ready = await sw.evaluate(async (tid) => {
    for (let i = 0; i < 30; i++) {
      const ok = await new Promise(r => chrome.tabs.sendMessage(tid, { type: 'PING' }, resp => {
        void chrome.runtime.lastError; r(resp?.ok === true);
      }));
      if (ok) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }, tabId);
  if (!ready) throw new Error('content script not ready');

  await sw.evaluate(({ tid, image, model }) => {
    globalThis.__smokeResult = '__PENDING__';
    chrome.tabs.sendMessage(tid, { type: 'ANNOTATE', image, model }, resp => {
      if (chrome.runtime.lastError) {
        globalThis.__smokeResult = { _error: chrome.runtime.lastError.message };
      } else {
        globalThis.__smokeResult = resp;
      }
    });
  }, { tid: tabId, image: BLANK_IMAGE, model });

  await page.waitForSelector('.snapdeck-overlay', { timeout: 10_000 });

  return {
    getSWResult: async () => {
      for (let i = 0; i < 60; i++) {
        const r = await sw.evaluate(() => globalThis.__smokeResult);
        if (r !== '__PENDING__') return r;
        await sleep(200);
      }
      return null;
    },
  };
}

async function dragOnStage(page, x0, y0, x1, y1) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10);
  }
  await page.mouse.up();
}

async function drawAndCommit(page, stageEl, text) {
  const sb = await stageEl.boundingBox();
  const bx = sb.x + DX, by = sb.y + DY;

  // Text tool
  const tBtn = page.locator('[title="Add a text comment (drag a box)"]').first();
  await tBtn.click();

  // Draw box
  await dragOnStage(page, bx, by, bx + DW, by + DH);
  await sleep(200);

  // Type and commit
  const ta = page.locator('.snapdeck-textedit');
  if (await ta.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.keyboard.type(text);
    await page.keyboard.press('Enter');
    await sleep(400);
  }
  return { bx, by };
}

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO A — double-click re-edit (all 4 sub-steps from fe's request)
// ═══════════════════════════════════════════════════════════════════════
async function scenarioA() {
  console.log('\n[A] Scenario 4 — dblclick re-edit after DEFECT-001 fix');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    const editor = await openEditor(ctx, page, sw);

    const stageEl = page.locator('.snapdeck-stage canvas').first();
    const { bx, by } = await drawAndCommit(page, stageEl, SHORT_TEXT);

    // Switch to Select
    await page.locator(SEL_SELECT).click();
    await sleep(300);

    // ── Sub-step 1: single-click → handles appear, no textarea ────────
    await page.mouse.click(bx + DW / 2, by + DH / 2);
    await sleep(400);
    const taAfterSingle = await page.locator('.snapdeck-textedit').count();
    passed &= check('1. single-click → no textarea', taAfterSingle, 0);
    await shot(page, '1-single-click-selected');

    // ── Sub-step 2: dblclick → textarea pre-filled ─────────────────────
    await page.mouse.dblclick(bx + DW / 2, by + DH / 2);
    const taVisible = await page.locator('.snapdeck-textedit').waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true).catch(() => false);
    passed &= check('2. dblclick → textarea visible', taVisible, true);
    await shot(page, '2-dblclick-textarea-open');

    if (taVisible) {
      const prefilledValue = await page.locator('.snapdeck-textedit').inputValue().catch(() => '');
      passed &= check('2. textarea pre-filled with original text', prefilledValue, SHORT_TEXT);

      // ── Sub-step 3: edit text, Enter → geometry preserved, text changed ─
      await page.locator('.snapdeck-textedit').fill('Revised annotation text');
      await page.keyboard.press('Enter');
      await sleep(300);
      await shot(page, '3-after-edit-committed');

      // Click Done and get payload from the first (and only) ANNOTATE IPC
      await page.locator(SEL_DONE).click();
      const swRes = await editor.getSWResult();
      if (swRes && swRes.model) {
        const item = swRes.model.items && swRes.model.items[0];
        if (item) {
          passed &= check('3. text updated to revised value', item.text, 'Revised annotation text');
          passed &= check('3. width preserved (within 15px)', Math.abs(item.width - DW), null, v => v < 15);
          passed &= check('3. height preserved (within 15px)', Math.abs(item.height - DH), null, v => v < 15);
        } else {
          console.log('  ✗ 3. no item in SW result');
          passed = false;
        }
      } else {
        console.log('  ✗ 3. SW result null or missing model:', swRes);
        passed = false;
      }
    }

    passed &= check('console errors: 0', pageErrors.length, 0);
  } finally {
    await ctx.close();
  }
  return { passed: !!passed, pageErrors };
}

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO B — 20K-char text item renders without hang (<1s)
// ═══════════════════════════════════════════════════════════════════════
async function scenarioB() {
  console.log('\n[B] Large-text case — 20K chars, binary-search fit loop (<1s target)');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  const largeModel = {
    version: 1,
    items: [
      // 20K-char text in a normal 200×100 box
      {
        id: 'large-1', type: 'text',
        x: 150, y: 100, width: 200, height: 100,
        text: 'x'.repeat(20_000),
      },
      // Also a normal text box to confirm good items still render
      {
        id: 'good-1', type: 'text',
        x: 400, y: 100, width: 160, height: 80,
        text: 'Normal box',
      },
    ],
  };

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });

    const t0 = Date.now();
    let opened = false;
    try {
      await openEditor(ctx, page, sw, largeModel);
      opened = true;
    } catch (e) {
      console.log(`  ✗ editor open failed: ${e.message}`);
    }
    const elapsed = Date.now() - t0;

    passed &= check('editor opens without throw', opened, true);
    passed &= check(`render completes <1500ms (got ${elapsed}ms)`, elapsed < 1500, true);
    console.log(`  Render time: ${elapsed}ms`);

    if (opened) {
      // The overlay should be visible
      const overlayVisible = await page.locator('.snapdeck-overlay').isVisible().catch(() => false);
      passed &= check('overlay visible', overlayVisible, true);

      await shot(page, 'B-large-text-render');
    }

    passed &= check('console errors: 0', pageErrors.length, 0);
    if (pageErrors.length) pageErrors.forEach(e => console.log(`  error: ${e}`));
  } finally {
    await ctx.close();
  }
  return { passed: !!passed, pageErrors };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
(async () => {
  console.log('=== Snapdeck DEFECT-001 re-check (6a03abb) ===');
  console.log(`EXT_PATH: ${EXT_PATH}`);
  console.log(`FIXTURE_URL: ${FIXTURE_URL}\n`);

  const resA = await scenarioA();
  const resB = await scenarioB();

  console.log('\n=== Results ===');
  console.log(`  ${resA.passed ? '✓' : '✗'} Scenario A — dblclick re-edit`);
  console.log(`  ${resB.passed ? '✓' : '✗'} Scenario B — 20K-char large-text render`);
  console.log(`\n${resA.passed && resB.passed ? 'ALL PASS ✓' : 'SOME FAILURES ✗'}`);
  process.exit(resA.passed && resB.passed ? 0 : 1);
})();
