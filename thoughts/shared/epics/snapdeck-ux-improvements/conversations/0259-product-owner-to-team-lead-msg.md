---
sequence: 0259
from: product-owner
to: team-lead
step: inline-msg
run_id: run-20260620-161821-90174
timestamp: 2026-06-20T16:32:27Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

✅ **screenshots.md** authored for w2-screenshot-gallery → `features/w2-screenshot-gallery/screenshots.md`. `status: required` (real new UI surface despite `skip_ui_designer`), every **Screen: n/a** (no mockup slug to pair against).

**4 requirement blocks** (pairing slug → `screenshots/<req-id>.png`):
1. **`gallery-populated`** — populated 3-tile thumbnail grid in the popup (280×600). Proves AC "Gallery render".
2. **`gallery-empty`** — empty-state message, zero tiles, non-target/empty report (280×600). Proves AC "Empty state".
3. **`delete-confirm`** — tile in its armed `Confirm? ✓/✕` state, count still 3, nothing deleted yet (280×600). Proves AC "Delete behind a confirm".
4. **`reopen-overlay`** — the **in-page editor overlay** on the stored `original` PNG with annotations restored model-byte (1440×900, browser-tester Konva lane). Proves the lossless re-open ACs.

I added #4 beyond the three you named (populated grid / empty / delete-confirm) because the re-open overlay on the stored PNG is the feature's central value prop — a reviewer needs to *see* the lossless re-edit to believe it. Easy to drop if you'd rather keep the contract to the three popup-chrome states; say the word.

Popup states framed at the popup's intrinsic **280px** body width (height auto-grows); the re-open state is the full host tab.

Back to **idle / warm** — ready for architect-standby / arbitrate / security-finalize.
