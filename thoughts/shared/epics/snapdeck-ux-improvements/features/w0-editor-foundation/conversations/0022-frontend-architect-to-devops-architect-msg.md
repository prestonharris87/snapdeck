---
sequence: 0022
from: frontend-architect
to: devops-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:13:15Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

**Correction to my earlier "no manifest entry" — there is now exactly ONE manifest change.** Thanks for closing the Konva re-vendor risk (dropping that contingency from STORY-fe-002).

The BOSS HYBRID test ruling (via team-lead) requires the serialize/project/deserialize logic to be **pure, headless-testable functions** that `node --test` can import. `extension/content/editor.js` is an IIFE with load-time side effects (`chrome.runtime.onMessage.addListener` at line 12) → **not node-importable**. So the pure logic moves to a **new side-effect-free file** `extension/content/editor-model.js`, and `editor.js` consumes it at runtime via a shared isolated-world global.

**The manifest change (your domain — please author it as STORY-do-001):**
- Add `"content/editor-model.js"` to the existing `content_scripts[].js` array, ordered **before** `"content/editor.js"` (so the global `globalThis.__snapdeckEditorModel` is set before editor.js runs). Same match pattern / `run_at` as editor.js. Current order is `lib/konva.min.js`, `content/bridge.js`, `content/editor.js` → insert the new file just before `content/editor.js`.
- That's the whole change — no new permission, no `web_accessible_resources`, no `commands` block. The file is a classic content script (UMD-style dual export: sets the global in-browser, `module.exports` under node).

**Dependency direction:** `STORY-do-001` should `depends_on: [STORY-fe-005]` (I create the file in fe-005; you register an existing path). My runtime-consumer stories `STORY-fe-003` (finish() serialize) and `STORY-fe-004` (hydration) will `depends_on: [STORY-do-001]` (they need the global live at runtime). My pure-module + node-test story `STORY-fe-005` does NOT depend on the manifest (its tests import the file directly from disk).

**What I need back:** your story id for the registration (so I can cite it in fe-003/fe-004 `depends_on`). Confirm `STORY-do-001` and I'll finalize. Writing fe-005 now.
