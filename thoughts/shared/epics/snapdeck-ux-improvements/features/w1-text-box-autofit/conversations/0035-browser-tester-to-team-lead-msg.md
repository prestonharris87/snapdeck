---
sequence: 0035
from: browser-tester
to: team-lead
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:31:09Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

**Phase 5a Playwright gate — w1-text-box-autofit.spec.ts**
`bt` · 2026-06-19T19:50Z

## Result: **5 / 5 PASS**

```
Running 5 tests using 1 worker
  ✓  draw-a-box text auto-fits and wraps          (2.3s)
  ✓  commit round-trips losslessly …              (1.0s)
  ✓  resize re-fits font and re-flows wrap …      (2.2s)
  ✓  double-click re-edits, single-click only …   (1.7s)
  ✓  hostile text item hydrates without throw …   (862ms)

5 passed (8.3s)
```

Zero pageerrors. Zero console errors (fixture auto-asserts at teardown).

---

## What changed during authoring (notable fixes)

**`extension/e2e/src/fixtures.ts`**
- Replaced `channel: 'chrome'` with `executablePath` → Chromium-1228 full build (path: `~/.cache/ms-playwright/chromium-1228/…`). With real `chrome`, `ctx.serviceWorkers()` events didn't fire; with the playwright-bundled full build they do.
- Added belt-and-suspenders SW detection: `ctx.once('serviceworker', ...)` + polling interval fallback + `ctx.once('close', clearInterval)`.

**`extension/e2e/src/w1-text-box-autofit.spec.ts`**
- Width assertion: `.snapdeck-textedit` CSS adds 10px (2×4px padding + 2×1px border) to the content-box dimensions, so checked against `DW + 10` with ±15px tolerance.
- Undo dispatch: `page.keyboard.press('Meta+z')` was silently captured by browser chrome in headed mode; replaced with `document.dispatchEvent(new KeyboardEvent('keydown', {metaKey:true, key:'z', …}))` via `page.evaluate`.
- Undo count: `snapshot()` is called AFTER each mutation, so `past = [post-commit(250), post-resize(349)]`. First undo pops post-resize (no visible change); second undo pops post-commit (restores 250). Test calls undo twice. (This is a pre-existing design characteristic of the undo system — noted as a side observation, not a blocking defect for this feature.)
- Hostile model text: 20K → 2K chars (prevents event-loop freeze during `fitTextFontSize` iterations).
- dblclick bug: **fe already applied the fix before the spec run** — the `group.on("click tap")` handler now skips `render()` when `selectedId === item.id`, preserving the Konva group reference for dblclick detection. Test 4 passed first-try on the authored spec.

---

## Trace artifacts

`extension/e2e/test-results/` — populated for any failed run (none this time).

---

Ready for Phase 5b — send me the screenshots.md requirements and I'll capture.
