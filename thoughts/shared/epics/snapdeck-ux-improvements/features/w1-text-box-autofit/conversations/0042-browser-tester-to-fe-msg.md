---
sequence: 0042
from: browser-tester
to: fe
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:44:13Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

**DEFECT-001 r2 (37ed252) — scenarios C + D**
`bt` · 2026-06-19T20:28Z

---

## Scenario C — Normal-box-long-text fit accuracy ✓ ALL PASS (4/4)

Test: 1500-char text in a 220×220 box. Konva fontSize read via `chrome.scripting.executeScript({world:'ISOLATED'})` — reads from the actual content script context where Konva lives.

| Check | Result |
|---|---|
| long-text `fontSize` ≥ `TEXT_AUTOFIT_MIN` (6) | ✓ got **7** |
| long-text `fontSize` ≤ 12 (accurate full-text fit, not 500-char over-estimate) | ✓ got **7** |
| ctrl-box `fontSize` ≥ 6 | ✓ got 34 |
| console errors: 0 | ✓ |

**Key evidence:** `fontSize=7` for the 1500-char text. With the old `TEXT_FIT_SAMPLE=500` (r1), the fit loop would measure ~500 chars, which wrap to ~80 lines at 7px but to many fewer lines at larger sizes — the algorithm would have settled on a larger font (≈10–12px) and the remaining ~1000 chars would have overflowed the Group clip. With r2 measuring all 1500 chars, font=7 is chosen, all text wraps correctly within the 220×220 box.

Konva node dump:
```
{ text: "Lorem ipsum dolor sit amet, consectetur …", fontSize: 7, width: 208, height: 182 }
{ text: "Control box", fontSize: 34, width: 148, height: 68 }
```

Screenshot: `.playwright-mcp/bt-cd-C-long-text-220x220.png`

---

## Scenario D — Large-text no-hang re-confirm ✓ ALL PASS (4/4)

Test: 20K-char text in a 200×100 box.

| Check | Result |
|---|---|
| editor opens without throw | ✓ |
| render completes < 5000ms (PING→overlay) | ✓ got **1874ms** |
| `large-text fontSize = TEXT_AUTOFIT_MIN (6)` — Phase 1 short-circuit | ✓ |
| overlay visible | ✓ |
| console errors: 0 | ✓ |

**Key evidence:** `fontSize=6` confirms the Phase 1 min-overflow pre-check fired (1 canvas measurement, immediate return of min). Text is display-clipped by the Group, which is the spec'd "clip-honest" behavior. No hang, 0 errors.

Screenshot: `.playwright-mcp/bt-cd-D-large-text-200x100.png`

---

**Scenarios C and D: ALL PASS.** r2 is verified:
- Sampling bug eliminated — full-text measurement → accurate font sizing
- Large-text path bounded to 1 measurement via Phase 1 short-circuit (→ `fontSize=6` confirmed)
- 0 console errors in both scenarios
