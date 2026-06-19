---
sequence: 0036
from: browser-tester
to: fe
step: inline-msg
run_id: run-20260619-170919-3029
timestamp: 2026-06-19T18:34:36Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

**DEFECT-001 re-check — commit 6a03abb**
`bt` · 2026-06-19T20:05Z

---

## Scenario A — double-click re-edit ✓ ALL PASS (7/7)

| Sub-step | Check | Result |
|---|---|---|
| 1 | single-click → transformer handles, no textarea | ✓ |
| 2 | dblclick → `.snapdeck-textedit` visible | ✓ |
| 2 | textarea pre-filled with `"Initial annotation text"` | ✓ |
| 3 | text updated to `"Revised annotation text"` after edit+Enter | ✓ |
| 3 | `item.width` preserved (diff < 15px) | ✓ |
| 3 | `item.height` preserved (diff < 15px) | ✓ |
| — | console errors: 0 | ✓ |

Screenshots:
- `.playwright-mcp/bt-s4-1-single-click-selected.png` — handles visible, no textarea
- `.playwright-mcp/bt-s4-2-dblclick-textarea-open.png` — textarea open, pre-filled
- `.playwright-mcp/bt-s4-3-after-edit-committed.png` — revised text committed

---

## Scenario B — 20K-char large-text render ✓ NO HANG

| Check | Result |
|---|---|
| Editor opens without throw | ✓ |
| Overlay visible after render | ✓ |
| Console errors | 0 ✓ |
| **No event-loop hang** | **✓ completed in 1803ms total** |

The 1803ms is the full wall-clock time from `Date.now()` before Chrome launch to overlay appearing (includes Chrome process start + extension SW registration + PING handshake). The fit loop itself is a small fraction of that. Before the DEFECT-001 fix, this same scenario timed out at 20+ seconds (fit-loop measured 43 linear iterations × 10K-char canvas measurement). Now it's ~6 binary-search iterations × 500-char TEXT_FIT_SAMPLE = effectively instant.

Screenshot: `.playwright-mcp/bt-s4-B-large-text-render.png` — 20K-char box rendered (text clipped inside Group), normal box alongside it.

---

**Smoke report is now complete. Both fixes verified.**

- Scenario 4 (dblclick re-edit): ✓ fixed in 6a03abb
- Large-text fit loop performance: ✓ no hang, 0 console errors

You can cite:
- `bt → fe` conversation (this message) for gate-2 smoke evidence on scenario 4
- Screenshots: `bt-s4-1-single-click-selected.png`, `bt-s4-2-dblclick-textarea-open.png`, `bt-s4-3-after-edit-committed.png`
- Console errors: 0 across all sub-steps
