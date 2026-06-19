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
status: approved
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

No JavaScript unit-test runner exists for the MV3 extension (no `package.json` /
test harness under `extension/`). Behavioral coverage is the Product Owner's E2E
specs in `feature.md` § E2E test spec, executed by `browser-tester` against the
loaded extension's message API:

- `feature.md` E2E "Two-port capture isolation" — asserts `GET_STATE` returns
  `port: 5101` on tab A and `port: 5102` on tab B (this story's `port` field).
- `feature.md` E2E "Non-target tab reports empty" — asserts `GET_STATE` on a
  non-localhost tab returns `{ count: 0, note: "", port: null }` (this story's
  non-target formalization).

## Dependencies

- STORY-fe-001 — introduces `currentTargetPort()` and the port-scoped
  `getReport(port)` that this story's `GET_STATE` return reads from. Must land
  first.

(No cross-domain producer: the `port` value comes from the active-tab seam, not
from a backend contract. The Snapdeck controller is unchanged by this feature.)

## History

- 2026-06-19 — created by frontend-architect (effort=1, substantive, depends on STORY-fe-001).
  Additive `GET_STATE.port` contract for the w1 badge feature; non-target
  empty-state formalized.

## Revisions

- 2026-06-19 — **product-owner (arbitrate):** Promoted `pending → approved`. No
  content changed. `depends_on: [STORY-fe-001]` verified correct — this story
  consumes `currentTargetPort()` and the port-scoped `getReport(port)` introduced
  by fe-001, and must land after it. The additive `GET_STATE` →
  `{ count, note, port }` shape (with the `port: null` non-target sentinel) is
  consistent with fe-001 and the locked scope, and is the frozen contract
  `w1-dynamic-icon-badge` consumes. Baseline section present and file:line-grounded.
