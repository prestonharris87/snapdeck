---
sequence: 0190
from: team-lead
to: fe
step: inline-msg
run_id: run-20260619-161353-46977
timestamp: 2026-06-19T16:28:09Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
---

do-001 landed (editor-chrome.js registered in manifest, `window.__snapdeckEditorChrome` is live). Now implement **STORY-fe-002** — toolbar grab handle DOM-drag + persisted position.

Story: thoughts/shared/epics/snapdeck-ux-improvements/features/w1-draggable-toolbar-toggle/stories/STORY-fe-002.md — read it + the feature.md ACs (incl. the security/PROMOTE_TO_AC corrupt-value handling) in full first.

**Edits:** `extension/content/editor.js` + `extension/content/overlay.css`. You are FIRST on the editor.js / `buildToolbar()` track (no concurrency now) — edit freely; w1-text-box-autofit rebases on your `buildToolbar()` additions later.

Key requirements (story is authoritative):
- Add a **grab handle** affordance to `.snapdeck-toolbar` (new element in `buildToolbar()` + CSS grip cursor in overlay.css). It is the ONLY drag target; the existing buttons keep their click behavior.
- **DOM drag**: pointerdown on handle → pointermove sets the toolbar's `style.left/top` (fixed-viewport). On FIRST drag, convert the default `transform:translateX(-50%)` centering to explicit `left/top` so position is unambiguous. Use **pointer-capture + stopPropagation** on the handle so the drag never leaks into the Konva `stage` (never starts an annotation, never changes selection).
- **Persist** on drag-end: `chrome.storage.local.set({ snapdeckEditorToolbarPos: serializeToolbarPos({left,top}) })` using `window.__snapdeckEditorChrome.serializeToolbarPos`.
- **Apply on open**: in `openEditor()`, read `chrome.storage.local.get('snapdeckEditorToolbarPos')`, run the raw value through `parseStoredPos` → `clampToViewport` (using viewport + toolbar dims), apply to the toolbar. **AWAIT the async storage read** (contrarian anti-flake note). On `null`/corrupt/non-finite → fall back to the default centered position; NEVER throw, NEVER pass a non-numeric to `style.left/top` (the security AC trust boundary).
- Reuse the fe-001 pure module exports (`clampToViewport`, `serializeToolbarPos`, `parseStoredPos`) — do NOT re-roll that logic or rename the contract.

Constraints: do NOT touch the frozen w0 `model`/`editor-model.js` contract; NO regression to existing arrow/box/text draw/select/transform/undo/redo. Story ACs FROZEN (append `## History` + `## Engineer Notes` only). Run `node --test extension/*.test.mjs` (no regression). If the dev server is up you may SendMessage `bt` for a quick smoke, but the formal browser E2E is Phase 5 — not required now.

**Atomic pathspec commit** (`git commit -- extension/content/editor.js extension/content/overlay.css <story md>`). NEVER `git commit -a`. No push. Reply with files/diff summary, test results, and any `## Engineer Notes`. Then go idle (stay warm for fe-003).
