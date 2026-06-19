# PO arbitration — w0-keyboard-shortcuts (Phase 6)

- **Arbiter:** product-owner
- **Date:** 2026-06-19
- **Run:** run-20260619-023636-42973
- **Stories reviewed:** STORY-be-001 (substantive), STORY-fe-001 / STORY-db-001 / STORY-do-001 (sentinels)
- **Verdict:** all 4 promoted `pending` → `approved`. No cross-domain conflict required reconciliation.

## Cross-domain consistency check (PASS)

- **Command-id contract is intra-story.** `"capture-screenshot"` is the shared
  string between the manifest `commands` key and the `chrome.commands.onCommand`
  listener's compare. Both live in STORY-be-001 — there is no cross-story seam to
  reconcile, so the contract cannot drift between domains.
- **Result-signal mechanism is consistent.** STORY-be-001 selects the
  **action badge** (`chrome.action.setBadgeText`, zero new permission) and the
  STORY-do-001 sentinel records the same choice with the same rationale (a
  `notifications` permission would trigger Chrome's "extension disabled pending
  re-acceptance" on auto-update). feature.md left the mechanism open ("exact
  mechanism is the architect's call; the requirement is non-silence") — the badge
  is a valid realization of that AC.
- **Report storage untouched.** STORY-db-001 (sentinel) + scope.md keep the
  IndexedDB `report` seam owned by sibling `w0-per-target-reports`; STORY-be-001
  calls `addScreenshot()` zero-arg, as-is, and edits no storage path. Consistent.

## depends_on accuracy (PASS)

- All four stories declare `depends_on: []`. Justified:
  - be-001 is caller-only: no schema (db out of scope), no env/build/CI (do
    sentinel), no FE surface (fe sentinel). The only coupling is a shared-file
    merge window in `background.js` with sibling w0 features — coordinated at push
    time with BOSS, **not** a story-level dependency.
  - fe/db/do are sentinels that produce and consume nothing.
- No missing producer→consumer citations within the feature. No cross-wave or
  same-wave dependency errors.

## Tensions considered (durable record — not silent convergence)

1. **Manifest `commands` ownership: devops-architect vs backend-architect.**
   Resolved → backend owns the `commands` block + `onCommand` listener + signal
   as ONE cohesive service-worker story. Single owner of the command-id contract,
   lowest blast radius, no manufactured cross-domain `depends_on`. See
   conversations 0003 / 0004 / 0008 / 0012.
2. **Result signal: badge vs `chrome.notifications` (devops blast-radius probe).**
   Resolved → badge. A new manifest permission disables the extension pending
   user re-acceptance on auto-update for existing installs; the badge needs no new
   permission and cannot be OS-suppressed. Richer toasts, if ever wanted, are a
   deliberate separately-scoped permission expansion.
3. **DB sentinel correctness on a shared `background.js`.** Resolved →
   `addScreenshot()` consumed as a stable function-level seam; the storage tail is
   owned by `w0-per-target-reports`. db-001 sentinel is correct; reopen only if a
   data-layer edit appears in this feature's diff.

## PO probe — badge visibility (accepted, with a deferred follow-up note)

Applying the persona's "probe what the warm room didn't say": an action-badge
`!` on the **toolbar icon** is a weaker not-a-target signal than a toast when the
user's gaze is on the page they just tried to capture — a user could miss it and
re-press the shortcut. I accept the badge for v1 because (a) feature.md
explicitly delegates the mechanism to the architect and requires only
non-silence, and (b) the `notifications`-permission auto-update-disable cost is a
real, documented operational hazard the badge avoids. **Deferred, non-blocking
follow-up:** if usability observation shows users miss the badge on the
not-a-target path, revisit signal prominence (e.g. a one-shot in-page hint owned
by the FE/overlay domain, which would NOT require a new manifest permission) as a
separate story. Recorded here so the trade-off is on the record, not implicit.

## Fixes applied during arbitration (documented per-story via ## Revisions)

- **STORY-db-001** — added missing core story frontmatter (`type: story`,
  `domain: database`, `parent_feature`, `parent_epic`, `created_at`,
  `last_run_id`, `visual_references: []`, `defects: []`) for tooling/dashboard
  parity with the other stories; converted the prose `## How we validate` into a
  `- [ ]` checklist (≥1 item) to satisfy the validates-checklist requirement.
  Meaning unchanged.
- **STORY-do-001** — converted the two plain-bullet validation items under
  `## How we validate` to `- [ ]` checklist form for an unambiguous validates
  checklist. Meaning unchanged.
- **STORY-be-001 / STORY-fe-001** — no content change; status promoted to
  `approved`.
