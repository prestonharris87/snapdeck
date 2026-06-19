/**
 * DEFECT-001 r2 (37ed252) verification — scenarios C and D.
 *
 *  C — Normal-box-long-text fit accuracy:
 *      1500-char text in a 220×220 box.  The old TEXT_FIT_SAMPLE=500 approach measured
 *      only the first 500 chars → font too large → full 1500 chars overflow-clip.
 *      r2 measures the full text: font should be chosen accurately (smaller than r1 would pick).
 *      Asserted via: (a) Konva stage fontSize read-back (must be ≤ measured full-text-fit size),
 *      (b) 0 console errors, (c) screenshot.
 *
 *  D — Large-text no-hang (re-confirm under r2):
 *      20K-char text in a 200×100 box.  r2 pre-check (1 measurement at min): text overflows at
 *      fontSize=6 → return immediately.  Expected: render time (after page load, PING done)
 *      < 5 seconds, 0 console errors.
 *
 * Run:  node extension/e2e/smoke-cd.cjs
 */
'use strict';

const path = require('path');
const fs   = require('fs');
const { chromium } = require('/Users/preston/node_modules/playwright');

const EXT_PATH       = path.resolve(__dirname, '..');
const FIXTURE_URL    = 'http://localhost:7783';
const SCREENSHOT_DIR = path.join(process.cwd(), '.playwright-mcp');

const BLANK_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9' +
  'AAAAEklEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

const SEL_DONE = 'button.snapdeck-primary';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function check(label, got, expected, cmp) {
  const ok = cmp ? cmp(got) : got === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(got)}`);
  return ok;
}

async function shot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const p = path.join(SCREENSHOT_DIR, `bt-cd-${name}.png`);
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

/** Waits for content script, fires ANNOTATE via SW, waits for overlay.
 *  Returns { getSWResult, tabId }. */
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

  await page.waitForSelector('.snapdeck-overlay', { timeout: 15_000 });

  return {
    tabId,
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

/**
 * Read the Konva stage to find all Text nodes and their font sizes.
 * Runs in the content script's ISOLATED world via chrome.scripting.executeScript
 * (Konva lives there, not in the main page context).
 * Returns [{text, fontSize, width, height}] or null.
 */
async function readKonvaFontSizes(sw, tabId) {
  return sw.evaluate(async (tid) => {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tid },
        world: 'ISOLATED',
        func: () => {
          try {
            const stages = window.Konva && window.Konva.stages;
            if (!stages || !stages.length) return { _error: 'no Konva stages' };
            const stage = stages[0];
            const texts = stage.find('Text');
            return texts.map(t => ({
              text: (t.text() || '').slice(0, 40),
              fontSize: t.fontSize(),
              width: t.width(),
              height: t.height(),
            }));
          } catch (e) {
            return { _error: e.message };
          }
        },
      });
      return results?.[0]?.result ?? { _error: 'no result from executeScript' };
    } catch (e) {
      return { _error: e.message };
    }
  }, tabId);
}

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO C — Normal-box-long-text fit accuracy (1500 chars / 220×220)
// ═══════════════════════════════════════════════════════════════════════
async function scenarioC() {
  console.log('\n[C] Normal-box-long-text fit accuracy — 1500 chars in 220×220 box (r2 fix)');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  // 1500 chars that genuinely CAN fit in 220×220 at some font size ≥ TEXT_AUTOFIT_MIN(6).
  // 'a ' repeated fills lines without ligatures; Konva's word-wrap sees spaces.
  const longText = ('Lorem ipsum dolor sit amet, consectetur adipiscing elit. ').repeat(27).slice(0, 1500);

  const model = {
    version: 1,
    items: [
      {
        id: 'long-1', type: 'text',
        x: 100, y: 80, width: 220, height: 220,
        text: longText,
      },
      // A short-text control box to confirm normal items still render correctly.
      {
        id: 'ctrl-1', type: 'text',
        x: 380, y: 80, width: 160, height: 80,
        text: 'Control box',
      },
    ],
  };

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
    const editor = await openEditor(ctx, page, sw, model);

    // Give Konva a tick to finish rendering all items.
    await sleep(300);

    // ── (a) Read Konva font sizes via chrome.scripting (isolated world) ─
    const texts = await readKonvaFontSizes(sw, editor.tabId);
    console.log('  Konva Text nodes:', JSON.stringify(texts, null, 2).split('\n').map(l => '    ' + l).join('\n'));

    if (!texts || texts._error) {
      console.log(`  ✗ C. could not read Konva stage: ${texts ? texts._error : 'null'}`);
      passed = false;
    } else {
      const longNode  = texts.find(t => t.text.startsWith('Lorem'));
      const ctrlNode  = texts.find(t => t.text.startsWith('Control'));

      if (!longNode) {
        console.log('  ✗ C. long-text Konva node not found in stage');
        passed = false;
      } else {
        // With r2, font is measured from all 1500 chars. For a 220×220 box the text
        // should fit at some small size; with r1 it was measured from 500 chars → too large.
        // We assert fontSize <= 12 (a reasonable upper bound for 1500 chars in 220×220).
        // Also assert fontSize >= TEXT_AUTOFIT_MIN (6) — we're not below the configured min.
        const fs = longNode.fontSize;
        passed &= check('C. long-text fontSize ≥ TEXT_AUTOFIT_MIN (6)', fs, null, v => v >= 6);
        passed &= check('C. long-text fontSize ≤ 12 (accurate full-text fit, not 500-char over-estimate)', fs, null, v => v <= 12);
      }

      if (!ctrlNode) {
        console.log('  ✗ C. control-box Konva node not found');
        passed = false;
      } else {
        passed &= check('C. ctrl fontSize ≥ 6', ctrlNode.fontSize, null, v => v >= 6);
      }
    }

    // ── (b) Screenshot ─────────────────────────────────────────────────
    await shot(page, 'C-long-text-220x220');

    // ── (c) Console errors ─────────────────────────────────────────────
    passed &= check('C. console errors: 0', pageErrors.length, 0);
    if (pageErrors.length) pageErrors.forEach(e => console.log(`  error: ${e}`));
  } finally {
    await ctx.close();
  }
  return { passed: !!passed, pageErrors };
}

// ═══════════════════════════════════════════════════════════════════════
// SCENARIO D — Large-text no-hang re-confirm (20K chars / 200×100)
// Under r2, this hits Phase 1 (min-overflow pre-check) after 1 measurement.
// ═══════════════════════════════════════════════════════════════════════
async function scenarioD() {
  console.log('\n[D] Large-text no-hang (20K chars / 200×100) — r2 pre-check should cost 1 measurement');
  const ctx = await launchCtx();
  const pageErrors = [];
  let passed = true;

  const largeModel = {
    version: 1,
    items: [
      {
        id: 'large-1', type: 'text',
        x: 100, y: 80, width: 200, height: 100,
        text: 'x'.repeat(20_000),
      },
      {
        id: 'ctrl-2', type: 'text',
        x: 360, y: 80, width: 160, height: 80,
        text: 'Normal control',
      },
    ],
  };

  try {
    const sw = await getSW(ctx);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });

    // Time from *after* page load + PING completion to overlay visible — excludes Chrome startup.
    const t0 = Date.now();
    let editor = null;
    try {
      editor = await openEditor(ctx, page, sw, largeModel);
    } catch (e) {
      console.log(`  ✗ editor open failed: ${e.message}`);
    }
    const elapsed = Date.now() - t0;
    const opened = editor !== null;

    passed &= check('D. editor opens without throw', opened, true);
    // 5 s generous threshold: PING handshake (~1–3 s) + 1 canvas measurement ≈ instant.
    passed &= check(`D. render completes <5000ms (got ${elapsed}ms)`, elapsed, null, v => v < 5000);
    console.log(`  Render time (PING→overlay): ${elapsed}ms`);

    if (opened) {
      await sleep(200);

      // Confirm Konva returned min fontSize (6) — proves Phase 1 short-circuit path
      const texts = await readKonvaFontSizes(sw, editor.tabId);
      const largeNode = texts && !texts._error && texts.find(t => t.text.startsWith('x'));
      if (largeNode) {
        passed &= check('D. large-text fontSize = TEXT_AUTOFIT_MIN (6, min-overflow path)', largeNode.fontSize, 6);
      } else {
        console.log('  ✗ D. large-text Konva node not found (or stage unreadable)');
        passed = false;
      }

      const overlayVisible = await page.locator('.snapdeck-overlay').isVisible().catch(() => false);
      passed &= check('D. overlay visible', overlayVisible, true);

      await shot(page, 'D-large-text-200x100');
    }

    passed &= check('D. console errors: 0', pageErrors.length, 0);
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
  console.log('=== DEFECT-001 r2 verification (37ed252) ===');
  console.log(`EXT_PATH: ${EXT_PATH}`);
  console.log(`FIXTURE_URL: ${FIXTURE_URL}\n`);

  const resC = await scenarioC();
  const resD = await scenarioD();

  console.log('\n=== Results ===');
  console.log(`  ${resC.passed ? '✓' : '✗'} Scenario C — normal-box-long-text fit accuracy (1500 chars / 220×220)`);
  console.log(`  ${resD.passed ? '✓' : '✗'} Scenario D — large-text no-hang re-confirm (20K chars / 200×100)`);
  console.log(`\n${resC.passed && resD.passed ? 'ALL PASS ✓' : 'SOME FAILURES ✗'}`);
  process.exit(resC.passed && resD.passed ? 0 : 1);
})();
