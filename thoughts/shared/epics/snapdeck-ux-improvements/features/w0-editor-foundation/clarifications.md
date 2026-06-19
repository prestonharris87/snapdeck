---
type: clarifications
scope: feature
parent_feature: w0-editor-foundation
parent_epic: snapdeck-ux-improvements
---

## Q1 — No JS unit-test runner exists for the extension content script; how do FE stories specify "unit tests"?

- **From:** frontend-architect
- **Phase:** /mat_write_feature decompose (Phase 5)
- **Status:** auto-resolved
- **Context:** `extension/content/editor.js` is a vanilla-JS Konva content script. The repo has **no
  `package.json`, no Jest/Vitest config, and no JS test directory** for the extension (verified
  2026-06-19 via Glob). Per `.claude/onboarding/testing.md`, behavioral verification for this surface is
  the **browser-tester Playwright E2E harness**, and standing up a JS unit runner is **devops infra**
  (testing.md "Stop signals": test-runner config is `devops-engineer` work, not a story-level edit).
- **Options:**
  - **A — Author the FE stories' "Unit tests" as Playwright E2E assertions** in
    `extension/e2e/w0-editor-foundation.spec.ts` (driving the content script, inspecting `model` via a
    page evaluate / the resolve payload), owned by `bt`. No new infra in a frontend story.
  - **B — Have a frontend story bootstrap a JS unit runner** (Vitest/Jest) for the extension. Adds build
    infra to a mechanism-refactor feature; crosses into devops; out of the locked scope.
- **Recommendation:** A — keep FE stories free of test-infra bootstrap; specify concrete behavioral
  assertions for the browser-tester's Playwright harness, matching feature.md's E2E spec.
- **Decided by:** frontend-architect on 2026-06-19; **SUPERSEDED** by BOSS HYBRID ruling (via team-lead)
  on 2026-06-19.
- **Decision (superseded):** ~~FE stories specify "Unit tests" only as Playwright E2E assertions; no JS
  unit runner.~~
- **Decision (current — BOSS HYBRID ruling):** A **`node --test` runner DOES exist** for the extension —
  zero-dependency Node built-in test runner (`node:test` + `node:assert/strict`, `*.test.mjs`), run via
  `node --test extension/` (`unit-tester` Phase 5a). The premise "no JS unit-test runner exists" is no
  longer true. **Two lanes:**
  - **Unit lane (`node --test`):** the pure serialize / projection / deserialize logic is factored into
    `extension/content/editor-model.js` (STORY-fe-005, no Konva/DOM) and asserted headlessly in
    `extension/editor.model.test.mjs` — round-trip identity + byte-frozen projection + guards.
  - **E2E lane (kept):** the round-trip THROUGH the real editor UI + Konva select/resize stays as
    browser-tester Playwright assertions (`extension/e2e/w0-editor-foundation.spec.ts`), assertion-grade.
  STORY-fe-003/004 reference the `node --test` cases for pure invariants and keep their E2E lane; STORY-fe-005
  authors the module + the `.test.mjs`; STORY-do-001 registers the module in the manifest.
