---
type: decision-memo
epic: snapdeck-ux-improvements
feature: w0-keyboard-shortcuts
version: 1
written_at: 2026-06-19T03:00:00Z
run_id: run-20260619-023636-42973
sources:
  - feature.md
  - stories/STORY-be-001.md
  - stories/STORY-fe-001.md
  - stories/STORY-db-001.md
  - stories/STORY-do-001.md
  - conversations/0001-0014
---

# Decision memo — Keyboard shortcut for capture (w0-keyboard-shortcuts)

## Summary

This feature binds `Cmd/Ctrl+Shift+S` to Snapdeck's existing capture+annotate
action without opening the popup, implemented as a manifest `commands` block plus
a top-level `chrome.commands.onCommand` listener in `extension/background.js`
that dispatches to the unchanged zero-arg `addScreenshot()` seam. The path
through planning was non-obvious in two places: (1) the manifest `commands` block
could plausibly belong to devops (extension config) or backend (feature behavior),
and the team needed an explicit cross-domain negotiation to land on single
backend ownership and avoid a split-brain command-id contract; (2) the
popup-independent result signal required choosing between `chrome.action` badge
(zero new permission) and `chrome.notifications` (adds a `notifications`
permission that triggers Chrome's auto-update disable behavior for existing
installs). Both choices were resolved pre-story by peer message exchange and
confirmed by PO arbitration. The entire substantive change lives in one story
(STORY-be-001); the other three domains produced explicit no-work sentinels.

## Positions held during planning

### frontend-architect

- **Advocated for:** Sentinel for the FE domain before any inter-architect
  negotiation, on grounds that scope.md § Out of scope explicitly excludes popup
  UI, annotation overlay, and content scripts. Sent the first cross-domain message
  asking backend to confirm the result signal is a background-worker badge (not a
  popup render) before filing the sentinel. (conv 0001, conv 0010)
- **Conceded:** Nothing contested — sentinel was the only position held. Received
  confirmation from backend-architect (conv 0007) and locked STORY-fe-001.
- **Persona alignment:** Stayed within scope.md scope; introduced no FE work.
  Final position: sentinel (STORY-fe-001 § Revisions).

### backend-architect

- **Advocated for:** Single cohesive service-worker story owning the manifest
  `commands` block, the top-level `chrome.commands.onCommand` listener, and the
  result signal — on the grounds that the command-id string `"capture-screenshot"`
  is shared between manifest and listener, making a split into two stories a
  split-brain contract. (conv 0003, conv 0013)
- **Signal choice:** Action badge (`chrome.action.setBadgeText`), not
  `chrome.notifications`, to avoid adding a manifest permission. Independently
  reached the same conclusion as the devops-architect's non-binding operational
  note. (STORY-be-001 § How we're doing it, conv 0013)
- **Conceded:** Nothing — all peer architects agreed. DB and DO each confirmed
  no-work; FE confirmed no popup/overlay need.
- **Persona alignment:** Claimed the seam that is genuinely its domain (service
  worker + manifest behavior), verified actual file:line baseline before writing
  (STORY-be-001 § Existing behavior baseline). Single story for a single owner.

### database-architect

- **Advocated for:** Sentinel for the DB domain. Scope.md § Out of scope
  explicitly reserves the IndexedDB `report` seam for sibling
  `w0-per-target-reports`; `addScreenshot()` is treated as a stable
  function-level seam. (conv 0002, conv 0011)
- **Delivered:** Also created the missing `data-model.md` artifact at the epic
  level to record the ownership boundary so sibling features can append without
  clobber. (conv 0011)
- **Persona alignment:** Verified the no-DB-work decision with backend-architect
  as a two-way agreement rather than an isolated assumption (conv 0002 / 0009).
  Sentinel STORY-db-001 carries the peer-confirmed rationale.

### devops-architect

- **Initial position:** Flagged that the manifest `commands` block *could* be
  read as extension config (devops territory). (conv 0004)
- **Resolved position:** Recommended that backend own the `commands` block +
  listener + signal as one cohesive story; proposed writing a DO sentinel with no
  cross-domain `depends_on`. (conv 0004, conv 0008, conv 0012)
- **Operational note (non-binding):** Adding a `notifications` permission triggers
  Chrome's "extension disabled pending re-acceptance" on auto-update for existing
  installs; the action badge avoids this. Flagged as the DO architect's blast-
  radius lens input, leaving the final mechanism decision to backend/PO. (conv
  0008, STORY-do-001 § Ownership resolution)
- **Persona alignment:** Performed the correct cross-domain check before filing
  the sentinel rather than assuming; the sentinel is a documented team agreement.

### product-owner

- **Arbitration decisions:** Promoted all four stories `pending → approved`.
  Accepted backend's badge choice as a valid realization of feature.md's
  mechanism-agnostic AC (non-silence required; mechanism left to architect).
  Applied a visibility probe (badge is weaker than a toast when gaze is on page)
  and accepted the v1 risk as deferred/non-blocking. Added `## Revisions` blocks
  to STORY-db-001 (missing frontmatter + checklist) and STORY-do-001 (checklist
  formatting) — content meaning unchanged. (conv 0014)

## Tensions resolved

| Tension | Position A | Position B | Resolution | Decided by |
|---|---|---|---|---|
| Manifest `commands` block ownership | devops-architect: manifest config belongs to DO domain | backend-architect: commands block is behaviorally coupled to the listener; single owner avoids split-brain command-id contract | Backend owns both as one cohesive service-worker story (STORY-be-001); DO writes a sentinel | conv 0003/0004/0008/0012; STORY-do-001 § Ownership resolution |
| Result-signal mechanism: badge vs `chrome.notifications` | `chrome.notifications` offers richer, more prominent toast | `chrome.action.setBadgeText` needs zero new permissions; `notifications` permission triggers Chrome auto-update disable for existing installs | Action badge chosen (STORY-be-001); deferred notification expansion left as separately-scoped future work | STORY-be-001 § How we're doing it; conv 0008; conv 0014 PO probe |
| DB sentinel correctness when `background.js` is shared | Could a new `onCommand` listener require a DB-side schema or IndexedDB change? | `addScreenshot()` is a stable function-level seam; its persistence tail is owned by sibling `w0-per-target-reports` | STORY-db-001 sentinel confirmed correct by peer exchange; reopen only if a storage edit appears in the diff | conv 0002/0009; STORY-db-001 § Cross-domain contract; conv 0014 |

## Tensions accepted as known risk

- **Badge `!` may be missed when user gaze is on the page:** An action-badge `!`
  on the toolbar icon is a weaker not-a-target signal than a toast when the user's
  focus is on the page they just tried to capture — a user could miss it and
  re-press the shortcut. Accepted for v1 because (a) feature.md explicitly
  delegates the signal mechanism to the architect with only a non-silence
  requirement, and (b) the `notifications` permission auto-update-disable cost is a
  real, documented operational hazard the badge avoids. Deferred, non-blocking
  follow-up: if usability observation shows users miss the badge on the
  not-a-target path, a one-shot in-page hint (FE/overlay domain, no new manifest
  permission) could be added as a separate story. Risk owner: product-owner.
  Cite: conv 0014 § PO probe — badge visibility.

## Alternatives rejected

- **`chrome.notifications` for the result signal:** Rejected because it requires
  adding a `notifications` permission to the manifest, which triggers Chrome's
  "extension disabled pending re-acceptance of new permissions" behavior on
  auto-update for existing installs. The badge achieves non-silence with zero new
  permissions and cannot be OS-suppressed. Cite: STORY-be-001 § How we're doing
  it; conv 0008 (devops operational note); conv 0014 PO cross-domain consistency
  check.

- **Splitting the manifest `commands` block into a separate DO story:** Rejected
  because the command-id string `"capture-screenshot"` is a shared contract between
  the manifest `commands` key and the `onCommand` listener's compare in
  `background.js`. A DO/BE split would manufacture a `depends_on` seam and a
  split-brain ownership of the contract string with no DevOps content to justify
  it. Cite: conv 0003 (backend position); conv 0004 (devops endorsement); STORY-
  do-001 § Why this domain has no work.

## Cross-team contracts (for implementation reference)

- **`addScreenshot()` stays zero-arg:** The listener calls `addScreenshot()` as-is
  with no new parameter. The function owns its own active-tab resolution and
  localhost guard. Any caller that passes a tab would violate this contract.
  Cite: STORY-be-001 § How we're doing it; conv 0006.
- **Report storage not touched:** `getReport` / `setReport` / the IndexedDB `kv`
  store / the single `report` record shape are owned this wave by sibling
  `w0-per-target-reports`. STORY-be-001 must not edit them. Cite: STORY-db-001
  § Why this is a sentinel; conv 0014.
- **`background.js` merge coordination:** Both this feature (new `onCommand`
  listener) and the sibling `w0-per-target-reports` feature touch `background.js`.
  Merge coordination is a push-window concern with BOSS, not a story-level
  `depends_on`. Cite: STORY-be-001 § Dependencies; conv 0013.

## Next actions

Mirror of feature.md acceptance criteria (unchanged):

- [ ] `manifest.json` declares a `commands` block with `suggested_key`
      `{ "default": "Ctrl+Shift+S", "mac": "Command+Shift+S" }` and a
      human-readable `description`.
- [ ] The capture command does NOT set `"global": true` (focus-only).
- [ ] A `chrome.commands.onCommand.addListener(...)` is registered at the top
      level (module scope) of `background.js`, adjacent to the existing
      `chrome.runtime.onMessage` listener.
- [ ] On the capture command, focused `http://localhost/*` / `http://127.0.0.1/*`
      tab → dispatch to the zero-arg `addScreenshot()`; popup does NOT open; a
      completed annotation appends exactly one screenshot to the in-progress
      report.
- [ ] `addScreenshot()` is called as-is; no changes to report storage, IndexedDB,
      or the `report` record shape.
- [ ] Non-localhost focused tab → no capture; popup-independent visible signal
      (action-badge `!` + tooltip) — not silent.
- [ ] Capture/overlay error path also surfaces a popup-independent visible signal.
- [ ] Cancelled annotate → report unchanged; no success/error signal.
- [ ] Localhost-only restriction unchanged; binding is user-rebindable via
      `chrome://extensions/shortcuts`.

## Open questions deferred to implementation

- The extension unit-test file (`extension/background.test.mjs`) is the **first**
  extension test file in the repo. If standing up the test harness is deemed out
  of scope during implementation, backend-engineer should escalate to team-lead
  (testing.md/devops territory) rather than silently skipping the assertions.
  Cite: STORY-be-001 § Unit tests.
