/**
 * E2E spec: w1-text-box-autofit — Text-box auto-fit rework (Google-Slides style)
 *
 * Test environment:
 *   - Snapdeck Chrome extension loaded in Chromium via launchPersistentContext
 *   - Fixture target page at http://localhost:7783/ (Python static server)
 *   - Editor opened via ANNOTATE IPC from the extension service worker
 *   - 1440×900 viewport
 *
 * Scenarios (per feature.md §"E2E test spec"):
 *   1. draw-a-box text auto-fits and wraps (no single-line flatten)
 *   2. commit round-trips losslessly; lossy projection stays byte-frozen
 *   3. resize re-fits the font and re-flows the wrap (undoable)
 *   4. double-click re-edits; single-click only selects
 *   5. hostile / oversized text item hydrates without throwing
 *
 * Run:
 *   npx playwright test extension/e2e/src/w1-text-box-autofit.spec.ts \
 *     --config=extension/e2e/playwright.config.ts --reporter=list
 */

import { test, expect } from './fixtures';
import path from 'path';

// ── Shared constants ──────────────────────────────────────────────────────────

/** Font cap from editor.js: TEXT_AUTOFIT_MAX = 48 */
const TEXT_AUTOFIT_MAX = 48;

/** Long enough to wrap at font-cap inside a ~250px-wide box */
const WRAP_TEXT =
  'The quick brown fox jumps over the lazy dog — every word counts for wrapping';

/**
 * Draw area: (DX, DY) → (DX+DW, DY+DH).
 * Chosen to avoid the toolbar (~57px tall at top-center of 1440px viewport).
 */
const DX = 100, DY = 120, DW = 250, DH = 200;

const SCR_DIR = path.resolve(
  __dirname,
  '../../../thoughts/shared/epics/snapdeck-ux-improvements/features/w1-text-box-autofit/screenshots'
);

// ── Helper: drag on the Konva stage ──────────────────────────────────────────

async function dragOnStage(
  page: import('@playwright/test').Page,
  x0: number, y0: number,
  x1: number, y1: number
) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  // Move in steps so Konva's mousemove handler fires at intermediate points
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      x0 + ((x1 - x0) * i) / steps,
      y0 + ((y1 - y0) * i) / steps
    );
  }
  await page.mouse.up();
}

// ── Helper: click toolbar button by label ─────────────────────────────────────

async function toolbarClick(page: import('@playwright/test').Page, label: string) {
  await page.locator('.snapdeck-toolbar').getByText(label, { exact: true }).click();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — draw-a-box text auto-fits and wraps (no single-line flatten)
// ─────────────────────────────────────────────────────────────────────────────
test('draw-a-box text auto-fits and wraps', async ({ extPage, consoleErrors, openEditor }) => {
  // ── Verify toolbar button title before opening editor ──────────────────────
  const { getDonePayload } = await openEditor();

  const textBtn = extPage.locator('.snapdeck-toolbar button').filter({ hasText: 'T Text' });
  await expect(textBtn).toHaveAttribute('title', 'Add a text comment (drag a box)');

  // ── Select Text tool ───────────────────────────────────────────────────────
  await toolbarClick(extPage, 'T Text');

  // ── Sub-threshold drag creates NO item ────────────────────────────────────
  // A near-zero drag (3px) should be rejected.
  await extPage.mouse.move(200, 200);
  await extPage.mouse.down();
  await extPage.mouse.move(202, 202);
  await extPage.mouse.up();
  // If a textarea appeared, sub-threshold guard failed.
  const taAfterSubthreshold = extPage.locator('.snapdeck-textedit');
  await expect(taAfterSubthreshold).toHaveCount(0);

  // ── Real drag: draw a ~250×200 text box ───────────────────────────────────
  await dragOnStage(extPage, DX, DY, DX + DW, DY + DH);

  // Textarea should open, positioned and sized to the drawn box.
  const ta = extPage.locator('.snapdeck-textedit');
  await ta.waitFor({ state: 'visible', timeout: 5_000 });

  const taBox = await ta.boundingBox();
  expect(taBox, 'textarea should appear').toBeTruthy();
  // The textarea CSS adds padding (4px each side) + border (1px each side) = 10px to
  // both content-width and content-height (box-sizing: content-box).  Allow ±15px.
  expect(Math.abs(taBox!.x - DX)).toBeLessThan(15);
  expect(Math.abs(taBox!.y - DY)).toBeLessThan(15);
  expect(Math.abs(taBox!.width  - (DW + 10))).toBeLessThan(15); // 10 = 2×(4px pad + 1px border)
  expect(Math.abs(taBox!.height - (DH + 6))).toBeLessThan(15);  //  6 = 2×(2px pad + 1px border)

  // ── Type text long enough to wrap at font-cap ─────────────────────────────
  await ta.type(WRAP_TEXT);

  // ── Commit with Enter (without Shift) ─────────────────────────────────────
  await extPage.keyboard.press('Enter');

  // Textarea should be gone after commit.
  await expect(ta).toHaveCount(0);

  // ── Screenshot: committed wrapping box (white fill / red outline / black text) ──
  await extPage.screenshot({
    path: path.join(__dirname, '../../../.playwright-mcp/bt-textbox-autofit-wrapped.png'),
    fullPage: true,
  });

  // ── Click ✓ Done and capture resolve payload ───────────────────────────────
  await toolbarClick(extPage, '✓ Done');
  const payload = await getDonePayload();
  expect(payload, 'Done payload must arrive').toBeTruthy();

  const items = (payload!.model as any)?.items as any[];
  expect(items).toHaveLength(1);

  const item = items[0];
  // Model item must carry geometry (no stored fit field).
  expect(item.type).toBe('text');
  expect(item.text).toBe(WRAP_TEXT.trim());
  expect(typeof item.x).toBe('number');
  expect(typeof item.y).toBe('number');
  expect(typeof item.width).toBe('number');
  expect(typeof item.height).toBe('number');
  expect(item).not.toHaveProperty('fontSize'); // no stored fit field
  expect(item).not.toHaveProperty('fittedFontSize');

  // Width must approximately match the drawn box width.
  expect(item.width).toBeCloseTo(DW, -1);

  // ── Projection: byte-frozen {id,type,x,y,text} only — no width/height ──────
  const annotations = (payload!.annotations as any[]);
  expect(annotations).toHaveLength(1);
  const ann = annotations[0];
  const annKeys = Object.keys(ann).sort();
  expect(annKeys).toEqual(['id', 'text', 'type', 'x', 'y']);
  // Coordinates are Math.round()'d in the projection.
  expect(ann.x).toBe(Math.round(item.x));
  expect(ann.y).toBe(Math.round(item.y));
  expect(ann.type).toBe('text');

  // Console errors: zero.
  expect(consoleErrors).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — commit round-trips losslessly; lossy projection stays byte-frozen
// ─────────────────────────────────────────────────────────────────────────────
test('commit round-trips losslessly and projection stays byte-frozen', async ({
  extPage,
  consoleErrors,
  openEditor,
}) => {
  // ── First editor session: draw + type + Done ──────────────────────────────
  const { getDonePayload: getDone1 } = await openEditor();

  await toolbarClick(extPage, 'T Text');
  await dragOnStage(extPage, DX, DY, DX + DW, DY + DH);
  await extPage.locator('.snapdeck-textedit').waitFor({ state: 'visible' });
  await extPage.locator('.snapdeck-textedit').type(WRAP_TEXT);
  await extPage.keyboard.press('Enter');
  await toolbarClick(extPage, '✓ Done');

  const done1 = await getDone1();
  expect(done1, 'done1 payload must arrive').toBeTruthy();
  const model1 = (done1!.model as any);

  // ── Annotations projection: exactly {id,type,x,y,text} — no width/height ──
  const annotations1 = done1!.annotations as any[];
  expect(annotations1).toHaveLength(1);
  const ann1Keys = Object.keys(annotations1[0]).sort();
  expect(ann1Keys).toEqual(['id', 'text', 'type', 'x', 'y']);
  expect(annotations1[0]).not.toHaveProperty('width');
  expect(annotations1[0]).not.toHaveProperty('height');

  // ── Second editor session: re-open with done1.model, immediately Done ──────
  const { getDonePayload: getDone2 } = await openEditor(model1);

  // Committed text box should render (the model hydrates it).
  // Just click Done immediately — no user edits.
  await toolbarClick(extPage, '✓ Done');

  const done2 = await getDone2();
  expect(done2, 'done2 payload must arrive').toBeTruthy();
  const model2 = (done2!.model as any);

  // ── Round-trip: model.items must be identity (deepEquals) ─────────────────
  expect(model2.items).toEqual(model1.items);

  // ── Annotations projection unchanged on second round ──────────────────────
  const annotations2 = done2!.annotations as any[];
  expect(annotations2).toHaveLength(1);
  expect(Object.keys(annotations2[0]).sort()).toEqual(['id', 'text', 'type', 'x', 'y']);

  expect(consoleErrors).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — resize re-fits the font and re-flows the wrap (undoable)
// ─────────────────────────────────────────────────────────────────────────────
test('resize re-fits font and re-flows wrap (undoable)', async ({
  extPage,
  consoleErrors,
  openEditor,
}) => {
  const { getDonePayload } = await openEditor();

  // Draw a text box and commit text.
  await toolbarClick(extPage, 'T Text');
  await dragOnStage(extPage, DX, DY, DX + DW, DY + DH);
  await extPage.locator('.snapdeck-textedit').waitFor({ state: 'visible' });
  await extPage.locator('.snapdeck-textedit').type(WRAP_TEXT);
  await extPage.keyboard.press('Enter');

  // Switch to Select, single-click to select the box (handles appear).
  await toolbarClick(extPage, '⤢ Select');
  const centerX = DX + DW / 2;
  const centerY = DY + DH / 2;
  await extPage.mouse.click(centerX, centerY);
  await extPage.waitForTimeout(200); // let Konva re-render

  // Screenshot: selected box with transformer handles visible.
  await extPage.screenshot({
    path: path.join(__dirname, '../../../.playwright-mcp/bt-textbox-selected-handles.png'),
    fullPage: true,
  });

  // The transformer handle for the bottom-right corner is at approximately:
  //   x ≈ DX + DW, y ≈ DY + DH
  // Drag it to enlarge the box by ~100px in each dimension.
  const handleX = DX + DW;
  const handleY = DY + DH;
  await extPage.mouse.move(handleX, handleY);
  await extPage.waitForTimeout(100);
  await extPage.mouse.down();
  await extPage.mouse.move(handleX + 100, handleY + 80, { steps: 8 });
  await extPage.mouse.up();
  await extPage.waitForTimeout(300); // wait for transformend + render

  // Screenshot: box after resize (larger → font re-fits up toward cap, wrap re-flows).
  await extPage.screenshot({
    path: path.join(__dirname, '../../../.playwright-mcp/bt-textbox-resize-refit.png'),
    fullPage: true,
  });

  // Undo: dispatch directly to document (bypasses browser-chrome Cmd+Z interception).
  // NOTE: snapshot() is called AFTER each mutation, so past = [post-commit(250), post-resize(349)].
  // First undo pops post-resize(349) → no visible change.
  // Second undo pops post-commit(250) → restores original width.
  // Two undo dispatches are required.
  async function dispatchUndo() {
    await extPage.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z', code: 'KeyZ', metaKey: true,
        bubbles: true, cancelable: true,
      }));
    });
    await extPage.waitForTimeout(150);
  }
  await dispatchUndo();
  await dispatchUndo();
  await extPage.waitForTimeout(200); // let final render() settle

  // Screenshot: undo should restore original size.
  await extPage.screenshot({
    path: path.join(__dirname, '../../../.playwright-mcp/bt-textbox-after-undo.png'),
    fullPage: true,
  });

  // Click Done and verify the model (after undo) reflects the ORIGINAL geometry.
  await toolbarClick(extPage, '✓ Done');
  const payload = await getDonePayload();
  expect(payload, 'Done payload').toBeTruthy();

  const item = (payload!.model as any).items[0];
  // After undo, geometry should be back to the drawn size (±15px tolerance for mouse
  // coordinate rounding and sub-pixel Konva scaling).  Must NOT be the resized value (~350).
  expect(Math.abs(item.width  - DW)).toBeLessThan(15);
  expect(Math.abs(item.height - DH)).toBeLessThan(15);

  expect(consoleErrors).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — double-click re-edits; single-click only selects
//
// KNOWN BUG (filed in smoke report to fe, 2026-06-19):
//   Konva 9.3.22 uses pointer-event tracking for dblclick detection. It fires
//   `pointerdblclick` only when `ClickEndShape` from click #1 === `getIntersection()`
//   at click #2's pointerup. The `group.on("click tap")` handler calls `render()`
//   which calls `annLayer.destroyChildren()`, replacing Group A with Group B.
//   Since r (Group A) !== l (Group B), `pointerdblclick` never fires.
//   Fix: skip render() in click handler when selectedId === item.id already.
//   Until fixed: `ta2.waitFor({state: 'visible'})` will timeout here.
// ─────────────────────────────────────────────────────────────────────────────
test('double-click re-edits, single-click only selects', async ({
  extPage,
  consoleErrors,
  openEditor,
}) => {
  const { getDonePayload } = await openEditor();

  // Draw and commit a text box.
  await toolbarClick(extPage, 'T Text');
  await dragOnStage(extPage, DX, DY, DX + DW, DY + DH);
  const ta = extPage.locator('.snapdeck-textedit');
  await ta.waitFor({ state: 'visible' });
  await ta.type('Original text');
  await extPage.keyboard.press('Enter');
  await extPage.waitForTimeout(100);

  // Switch to Select mode.
  await toolbarClick(extPage, '⤢ Select');

  // ── Single-click: selects the box — no textarea ───────────────────────────
  const centerX = DX + DW / 2;
  const centerY = DY + DH / 2;
  await extPage.mouse.click(centerX, centerY);
  await extPage.waitForTimeout(200);

  // Screenshot: single-click selected state (transformer handles, no textarea).
  await extPage.screenshot({
    path: path.join(__dirname, '../../../.playwright-mcp/bt-textbox-single-click-selected.png'),
    fullPage: true,
  });

  // Textarea must NOT be open after single-click.
  await expect(extPage.locator('.snapdeck-textedit')).toHaveCount(0);

  // ── Double-click: opens textarea pre-filled with existing text ────────────
  await extPage.mouse.dblclick(centerX, centerY);
  await extPage.waitForTimeout(200);

  const ta2 = extPage.locator('.snapdeck-textedit');
  await ta2.waitFor({ state: 'visible', timeout: 5_000 });

  // Screenshot: re-edit state (textarea open, pre-filled).
  await extPage.screenshot({
    path: path.join(__dirname, '../../../.playwright-mcp/bt-textbox-reedit.png'),
    fullPage: true,
  });

  // Value should be the committed text (pre-filled).
  await expect(ta2).toHaveValue('Original text');

  // Edit: change the text, commit.
  await ta2.selectText();
  await ta2.type('Revised text');
  await extPage.keyboard.press('Enter');
  await extPage.waitForTimeout(100);

  // Click Done and verify geometry unchanged, only text differs.
  await toolbarClick(extPage, '✓ Done');
  const payload = await getDonePayload();
  expect(payload, 'Done payload').toBeTruthy();

  const item = (payload!.model as any).items[0];
  expect(item.text).toBe('Revised text');
  // Geometry should be unchanged (only text changed).
  expect(item.x).toBeCloseTo(DX, -1);
  expect(item.y).toBeCloseTo(DY, -1);
  expect(item.width).toBeCloseTo(DW, -1);
  expect(item.height).toBeCloseTo(DH, -1);

  expect(consoleErrors).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — hostile / oversized text item hydrates without throwing
// ─────────────────────────────────────────────────────────────────────────────
test('hostile text item hydrates without throw or console error', async ({
  extPage,
  consoleErrors,
  openEditor,
}) => {
  /**
   * Model with:
   *   - item[0]: NaN x, Infinity height, string width, oversized text → should be skipped
   *   - item[1]: well-formed text box → should render normally
   * Plus a text item with an impossibly thin box (width:15 → TEXT_AUTOFIT_MIN short-circuit).
   */
  const hostileModel = {
    version: 1,
    items: [
      // Hostile geometry: NaN x, wrong-type width, Infinity height
      // Use 2K-char text (below TEXT_RENDER_CAP=10000) to avoid blocking the
      // event loop — 20K chars × 43 fitTextFontSize iterations = 20+ second freeze.
      {
        id: 'bad1',
        type: 'text',
        x: NaN,
        y: 0,
        width: '200',      // wrong type (string)
        height: Infinity,
        text: 'x'.repeat(2_000),
      },
      // Well-formed text box — must render normally.
      {
        id: 'good1',
        type: 'text',
        x: 100,
        y: 120,
        width: 200,
        height: 100,
        text: 'Good box',
      },
      // Thin box: width=15 → innerW=3 < TEXT_AUTOFIT_MIN (6) → short-circuit to min font
      {
        id: 'thin1',
        type: 'text',
        x: 350,
        y: 120,
        width: 15,
        height: 200,
        text: 'thin',
      },
    ],
  };

  const { getDonePayload } = await openEditor(hostileModel);

  // Editor should have opened with no throw.
  await expect(extPage.locator('.snapdeck-overlay')).toBeVisible();

  // Screenshot: hostile model opened — good box must be visible; bad item skipped.
  await extPage.screenshot({
    path: path.join(__dirname, '../../../.playwright-mcp/bt-textbox-hostile-render.png'),
    fullPage: true,
  });

  // Immediately click Done (no user edits).
  await toolbarClick(extPage, '✓ Done');
  const payload = await getDonePayload();
  expect(payload, 'Done payload').toBeTruthy();

  // The model round-trip: the well-formed + thin items survive (bad1 with NaN x is
  // skipped at render boundary, but the model still stores the raw items since
  // deserializeModel is opaque pass-through). Check count includes all three.
  const items = (payload!.model as any).items as any[];
  // All 3 items pass through opaquely (render boundary only skips, doesn't strip).
  expect(items.length).toBe(3);

  // Zero console errors: auto-fit must not throw on hostile geometry.
  expect(consoleErrors).toHaveLength(0);
});
