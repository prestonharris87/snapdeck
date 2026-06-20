# security-architect → product-owner-arbiter — Phase 7 STRIDE handoff (w2-screenshot-gallery)

**Run:** run-20260620 · **Feature:** w2-screenshot-gallery · **Mode:** single-feature-review
**Verdict:** CLEAN pass — all findings INFO/LOW (defense-in-depth / security-positive).
**No HIGH/CRITICAL.** No PO accept/mitigate/defer judgment required. No STORY-sec authored
(the protection is inherited, not new work). No `PO disposition:` lines written by me — yours
to add in Phase 7.5.

I verified every claim against the RELEASED code on disk (`extension/editor.js`,
`editor-model.js`, `manifest.json`, `background.js`), file:line cited in each story's
`## Security Review` block (fe-001, fe-002, fe-003).

---

## THE load-bearing verdict — bounded arbitrary-model re-open: CONFIRMED bounded ✅

This feature is the consumer that `w0-editor-foundation` STORY-fe-004 (render guard) and
`w1-text-box-autofit` fe-002 / DEFECT-001 r2 **forward-flagged** — the first feature to
re-open ARBITRARY stored models through the render boundary. End-to-end re-confirm:

- Re-open passes `shot.model` **verbatim** (`fe-002` line 72) into the **same** ANNOTATE
  seam `addScreenshot` already uses (`background.js:278`) → `deserializeModel` (opaque,
  never throws, `editor-model.js:86-95`) → guarded `render()` (`editor.js:176-189`).
- **Item count** sliced to `RENDER_ITEM_CAP=500` (`editor.js:179,192`); **hostile geometry**
  (`NaN`/`Infinity`/`1e308`/wrong-type) skipped by finite-guards on arrow/text/box
  (`:223`, `:253-254`, `:324-325`); **oversized text** capped to `RENDER_TEXT_CAP=10000`
  (`:256,193`), auto-fit bounded by min-overflow short-circuit + binary search (~7 measures).
- **lesson-99 slow-band fix is APPLIED:** the degenerate short-circuit keys on the **clamped
  inset** `innerW`/`innerH` (`editor.js:286`), not raw `item.width` — the old ≈12–18px slow
  band is closed; residual worst case (`innerW=6px`, 10000 chars) terminates, not a hang.

**Result: no throw, no hang, no `console.error`. Caps inherited VERBATIM — no bypass, fork,
or re-implementation** (confirmed by fe-002's byte-unchanged assertion for `editor.js`,
lines 155-159, + feature.md Out-of-scope). Reachability is **defense-in-depth only**:
`editor.js` is isolated-world (no `"world"` key, `manifest.json:39-44`; only `capture.js` is
MAIN) and there is **no `externally_connectable`** — the model comes ONLY from the
extension's own IndexedDB, not page-writable, not network. **Not an externally-reachable DoS.**

## Bounded-at-render ≠ bounded-envelope (fe-002 Finding 2, you deferred to me) — ACCEPT

`serializeModel` serializes the **full** unsliced model (`editor.js:486`; deserialize is
unsliced, `editor-model.js:92`), and `resaveScreenshot` persists `resp.model` verbatim
(`fe-002` line 90). So caps are render-time; the persisted envelope is whatever the model is.
**Acceptable** — extension-own IndexedDB, defense-in-depth, no programmatic item-multiplier
(growth bounded by user pointer gestures), and full-model persistence is *required* for the
model-byte-lossless AC. **Recorded standing guardrail: do NOT weaken `RENDER_ITEM_CAP=500` /
`RENDER_TEXT_CAP=10000` (`editor.js:192-193`)** — the bounded-re-open AC + Konva-lane E2E rest
on them; any future cap reduction must return through security.

## Secondary scan (all clean)

- **New BG handlers (fe-001 S1):** port resolved internally via `currentTargetPort()`
  (`background.js:81`); a forged/foreign `sid` → `indexOfScreenshotId` -1 → **fail-safe
  no-op, NOT a cross-port write** (two-port isolation holds, write-key ≡ read-key). No web
  reachability (no `externally_connectable`). No injection (string-equality `sid`, int key).
- **`sid` collision/spoofing (fe-001 S2):** LOW/accept — needs same `captured_at`+orig-len
  +last-24 within one port; effectively impossible for distinct captures, no external plant
  path. Optional belt-and-suspenders: hash full `original`. Not required.
- **DOM-XSS (fe-003 S1):** CONFIRMED clean — thumbnails are `img.src=<data-URL>`, `#N` is
  `textContent`, labels plain text; **no `innerHTML`/raw-HTML sink**. Re-open is canvas.
  Engineer/validator must not introduce `innerHTML` when building tiles.
- **Full-res PNG to popup (fe-003 S2):** LOW/accept — local, bounded by capture count; you
  already accepted with the OffscreenCanvas-downscale re-trigger. Concur.

## Default checklist — N/A dispositions (recorded so you see it was applied, not skipped)

Local no-server MV3 feature: authn/authz = the localhost host-guard in `currentTargetPort()`
reused unchanged; secrets none; audit-columns N/A (no server entity table); CSRF/CORS/
rate-limit N/A (not externally_connectable, no server change, single-user); injection none;
soft-delete N/A (ephemeral in-progress store; hard-delete-behind-confirm is the intended GC
per scope §4); multi-tenant → two-port isolation, confirmed. Output-encoding = in effect (S1).

**be-001 / db-001 / do-001 sentinels:** no security surface — no controller change, no DB
schema/version change, no manifest/permission/build change. Confirmed against `manifest.json`
(permissions `:6` unchanged) and the stories' sentinel assertions.

— security-architect
