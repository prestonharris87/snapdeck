---
type: story
id: STORY-fe-002
name: "GET_STATE additive port field + non-target empty-state"
domain: frontend
parent_feature: w0-per-target-reports
parent_epic: snapdeck-ux-improvements
assignee: frontend-engineer
author_architect: frontend-architect
effort: 1
status: released
depends_on: [STORY-fe-001]
diff_estimate: substantive
files_modified:
  - extension/background.js
files_not_modified:
  - extension/popup/popup.js
  - extension/popup/popup.html
  - extension/popup/popup.css
  - extension/content/capture.js
  - extension/content/editor.js
  - extension/content/bridge.js
  - extension/manifest.json
reuse_patterns:
  - extension/background.js:88-91 # current GET_STATE return ({count, note}) — the contract being extended
  - extension/background.js:41-46 # portOfUrl(url) — the port-derivation seam behind currentTargetPort()
created_at: 2026-06-19T00:00:00Z
last_run_id: run-20260619-021434-24507
frontend_lane: N/A
visual_references: []
defects: []
---

# Story: GET_STATE additive port field + non-target empty-state

## What we're doing

Extend the `GET_STATE` message response with an additive `port` field naming the
resolved current target, and formalize the non-target case. After STORY-fe-001,
`GET_STATE` already resolves the current target via `currentTargetPort()` and
reads `report:<port>`; this story surfaces that resolved port in the response —
`{ count, note, port }` — and makes a non-localhost (non-target) tab return
`{ count: 0, note: "", port: null }` explicitly. This is the **additive
cross-feature contract** that `w1-dynamic-icon-badge` consumes for its
report-in-progress (orange) count + target signal; `w2-screenshot-gallery`
relies on the per-port keying from fe-001. The change is purely additive — the
existing `count`/`note` fields the popup already reads are unchanged.

## What it should look like

`GET_STATE` message response shape:

```js
// localhost target (active tab http://localhost:5101 with 1 screenshot):
{ count: 1, note: "", port: 5101 }

// non-target (active tab https://example.com or any non-localhost page):
{ count: 0, note: "", port: null }
```

Recommended handler (the `port` local is already resolved by fe-001 to key the
`getReport` read — just return it):

```js
case "GET_STATE": {
  const port = await currentTargetPort();   // introduced in fe-001
  const r = await getReport(port);          // port == null → empty default (fe-001)
  return { count: r.screenshots.length, note: r.note || "", port };
}
```

Because `currentTargetPort()` (fe-001) is localhost-gated and returns `null` for a
non-target tab, and `getReport(null)` (fe-001) returns the empty default without
an IDB read, the non-target case naturally yields `{ count: 0, note: "",
port: null }` — no extra branch required.

## Existing behavior baseline

- **Currently (pre-feature):** `extension/background.js:88-91` — `GET_STATE`
  returns `{ count: r.screenshots.length, note: r.note || "" }` for the single
  global report; there is **no `port` field** and no distinct non-target branch.
- **After STORY-fe-001 (lands first; this story depends on it):** `GET_STATE`
  resolves the current target via `currentTargetPort()` and returns the SAME
  `{ count, note }` shape, now port-scoped; a non-target tab already yields
  `{ count: 0, note: "" }` (empty default).
- **Dispatch path / call graph:** popup / future badge → `chrome.runtime`
  message `GET_STATE` → `handle()` (86) → the `GET_STATE` case (88-91) →
  `currentTargetPort()` + `getReport(port)` → IndexedDB `snapdeck`/`kv`.
- **No-regression assertion:** the `count` = `screenshots.length` and `note`
  semantics (established by fe-001) stay identical; the popup's existing
  consumption of `count`/`note` (`popup/popup.js`, unchanged) keeps working
  because the change is a purely additive field. No other handler, helper, or the
  storage keying is touched by this story.
- **Explicitly changing:** the `GET_STATE` return becomes `{ count, note, port }`;
  the non-target response is formalized as `{ count: 0, note: "", port: null }`.
  This `port` field is the additive contract `w1-dynamic-icon-badge` consumes.
- **Verified:** 2026-06-19

## How we're doing it

- Edit only the `GET_STATE` case in `extension/background.js` (88-91). Add the
  already-resolved `port` to the returned object. Do NOT add a new port-derivation
  path — reuse the `currentTargetPort()` value fe-001 introduced.
- Do not branch reducer-style on the port: a `null` port flows straight into the
  response as `port: null` and `getReport(null)` (fe-001) supplies the empty
  default — keep the handler a single return, no special-case branch.
- **Contract freeze:** once this lands, the `GET_STATE` shape `{ count, note, port }`
  is the frozen contract for `w1-dynamic-icon-badge`. Do not change field names or
  the `null` non-target sentinel without the team-lead re-broadcasting the 🤝
  CONTRACT on `#snapdeck-ux-improvements/active`.
- **Verification:** ask the `browser-tester` teammate to drive `GET_STATE` on a
  localhost tab and on a non-localhost tab and confirm the returned shape. Confirm
  any dev servers / controllers the smoke needs are already running in user-owned
  terminals.

## How we validate it was done correctly

- [ ] `GET_STATE` on a localhost tab at `:5101` with N screenshots returns
      `{ count: N, note: <note>, port: 5101 }` (E2E "Two-port capture isolation"
      asserts `port: 5101` / `port: 5102`).
- [ ] `GET_STATE` on a non-localhost tab (e.g. `https://example.com`) returns
      `{ count: 0, note: "", port: null }` (E2E "Non-target tab reports empty").
- [ ] The `port` field equals the active tab's resolved dev-server port, derived
      from the same `currentTargetPort()`/`portOfUrl` seam (no second derivation).
- [ ] `count` and `note` semantics are unchanged from fe-001; the popup still
      renders count/note with no popup code change.
- [ ] No diff outside the `GET_STATE` case in `extension/background.js`; no diff
      under `extension/popup/*`, `extension/content/*`, or `extension/manifest.json`.

## Motion contract

n/a — additive field on a service-worker message response; no rendered or animated
surface. The popup is unchanged.

## Unit tests

**Unit lane (HYBRID ruling 2026-06-19):** `node --test` (`node:test` +
`node:assert/strict`, ESM, zero-dep, no `package.json`). This story **appends**
GET_STATE-port cases to the SAME feature test file STORY-fe-001 creates —
`extension/background.reports.test.mjs` (feature-distinct from sibling
`w0-keyboard-shortcuts`' `extension/background.test.mjs`). Same harness: load
`background.js` into a `node:vm` context with hand-written `chrome.tabs.query` +
in-memory `indexedDB` stubs, capture the `onMessage` listener, invoke it with
`{ type:"GET_STATE" }`, await `sendResponse`. `unit-tester` Phase 5a runs
`node --test extension/*.test.mjs`.

Cases (test file `extension/background.reports.test.mjs`):

- `GET_STATE_localhostTarget_includesResolvedPort` — `tabs.query` resolves
  `http://localhost:5101`, `report:5101` holds 1 screenshot + note "n"; the awaited
  `sendResponse` deep-equals `{ count: 1, note: "n", port: 5101 }`.
- `GET_STATE_secondPort_returnsThatPort` — `tabs.query` resolves
  `http://localhost:5102`; `sendResponse.port === 5102` (pairs with E2E "Two-port
  capture isolation").
- `GET_STATE_nonLocalhostTab_returnsEmptyWithNullPort` — `tabs.query` resolves
  `https://example.com`; `sendResponse` deep-equals `{ count: 0, note: "",
  port: null }` (the non-target sentinel `w1-dynamic-icon-badge` consumes).
- `GET_STATE_aboutBlank_returnsNullPort` — `tabs.query` resolves `about:blank`;
  `sendResponse.count === 0` and `sendResponse.port === null`.

**Integration lane:** `feature.md` § E2E test spec "Two-port capture isolation"
(asserts `port: 5101` / `port: 5102`) and "Non-target tab reports empty" (asserts
`{ count: 0, note: "", port: null }`) remain the assertion-grade integration
coverage, driven by `browser-tester` against the live message API.

## Dependencies

- STORY-fe-001 — introduces `currentTargetPort()` and the port-scoped
  `getReport(port)` that this story's `GET_STATE` return reads from. Must land
  first.

(No cross-domain producer: the `port` value comes from the active-tab seam, not
from a backend contract. The Snapdeck controller is unchanged by this feature.)

## Engineer Notes

Implemented in the same pass as STORY-fe-001 (coupled: same file, depends on fe-001 helpers). The `GET_STATE` handler now returns `{ count, note, port }` where `port = await currentTargetPort()`. The non-target sentinel (`port: null`) falls out naturally since `currentTargetPort()` returns `null` for non-localhost tabs, and `getReport(null)` (fe-001) returns the empty default without an IDB read — no extra branch required.

**Unit gate result:** 4 GET_STATE-port cases appended to `extension/background.reports.test.mjs`. Cumulative run: tests 25 | pass 25 | fail 0.

**Smoke verification:** Additive field on service-worker response; popup is unchanged. Manual verification deferred — no UI surface; E2E coverage (Two-port capture isolation, Non-target tab reports empty) via browser-tester at Phase 5b.

## History

- 2026-06-19 — created by frontend-architect (effort=1, substantive, depends on STORY-fe-001).
  Additive `GET_STATE.port` contract for the w1 badge feature; non-target
  empty-state formalized.
- 2026-06-18 — implemented by frontend-engineer. GET_STATE → { count, note, port }; non-target → { count:0, note:"", port:null }. node --test: tests 25 | pass 25 | fail 0. Manual verification deferred — additive service-worker field, no UI surface.
2026-06-19T04:10:24Z — orchestrator: status: 'in-progress' -> 'validated' (frontend-validator: validated; honesty-check: passed (commit db6f7b7); node --test 25/25)
2026-06-19T15:02:27Z — BOSS: status: 'validated' -> 'released' (Released via Wave-0 PR #1 (merge 5526403))

## Revisions

- 2026-06-19 — **product-owner (arbitrate):** Promoted `pending → approved`. No
  content changed. `depends_on: [STORY-fe-001]` verified correct — this story
  consumes `currentTargetPort()` and the port-scoped `getReport(port)` introduced
  by fe-001, and must land after it. The additive `GET_STATE` →
  `{ count, note, port }` shape (with the `port: null` non-target sentinel) is
  consistent with fe-001 and the locked scope, and is the frozen contract
  `w1-dynamic-icon-badge` consumes. Baseline section present and file:line-grounded.

## Security Review

STRIDE pass by security-architect (2026-06-18). **No material findings** for this
story — severity INFO.

### INFO — Additive `port` field discloses only the active tab's own resolved port

- **Information disclosure (assessed, no finding).** The new `port` field in the
  `GET_STATE` response (`{ count, note, port }`) surfaces the port that
  `currentTargetPort()` resolved for the **active tab** — i.e. data the caller
  (the popup, or the `w1` badge, both running for that same active tab) already
  possesses. It exposes no *other* port's existence or contents: `currentTargetPort()`
  is localhost-gated and the handler still resolves from the active tab with no
  caller-supplied port, so there is no cross-port disclosure or enumeration. The
  `port: null` non-target sentinel correctly avoids implying a target exists on a
  non-localhost tab.
- **No new entry point, permission, or auth path** — this is a purely additive
  field on an existing response shape; no Spoofing/Tampering/DoS/EoP delta beyond
  what STORY-fe-001 already carries (see fe-001's Security Review, esp. the LOW
  guard-unification finding, which governs how `currentTargetPort()` resolves the
  value this story returns).
- **Contract note (forward-looking):** once frozen, `w1-dynamic-icon-badge`
  treats `port: null` as "no current target." Downstream consumers must keep
  trusting `null` as the non-target signal and must NOT reintroduce a
  caller-supplied port into this contract (that would open the IDOR vector
  fe-001's INFO note calls out). No action required for this story.
**PO disposition:** ACCEPT_AS_RECOMMENDATION (affirm). Agreed — the additive
  `port` field surfaces only the active tab's own resolved port (data the popup /
  `w1` badge for that same tab already possess); it is localhost-gated, exposes no
  other port's existence or contents, and `port: null` correctly avoids implying a
  target on a non-loopback tab. No finding, no AC. The forward-looking contract note
  (downstream consumers keep trusting `null` as the non-target signal and must NOT
  reintroduce a caller-supplied port) is the same standing guardrail recorded on
  fe-001's IDOR INFO disposition — governed there.

## Files touched

_Computed at validation time vs `master`. Engineer divergence from architect intent is shown in the delta sections — that's rationale-relevant signal, not noise._

**Files changed in diff:**
- _(no files in diff)_

**Declared but not touched** (architect's `files_modified` front-matter entries that did not appear in the diff):
- `extension/background.js`

**Touched but not declared** (diff entries the architect did not list in `files_modified`):
- _(none — engineer stayed within declared scope)_
