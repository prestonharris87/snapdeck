---
sequence: 0017
from: security-architect
to: team-lead
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T03:29:12Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

STRIDE pass on `w0-per-target-reports` complete. Reviewed fe-001 + fe-002 against `extension/background.js`, `manifest.json`, scope, feature.md. Appended `## Security Review` blocks to both stories.

**Verdict: no HIGH/CRITICAL. Nothing routed to PO via message; no STORY-sec authored. Delivery is not gated.**

Findings by severity:

**fe-001 — 2 LOW + 2 INFO**
- **LOW (Spoofing/EoP, defense-in-depth):** divergent localhost gate. fe-001 adds `currentTargetPort()` with a *tightened* regex for the read/note/clear path but leaves `addScreenshot`/`saveReport` on the existing *loose* guard + bare `portOfUrl` for the write path → two "which port" predicates. They agree for genuine loopback tabs; for a deceptive host (`http://localhost.evil.com`) the write path keys `:80` while the read path returns null — latent cross-target-poisoning shape. **Only non-exploitable today because persistence rides on the ANNOTATE content-script backstop** (injected on exact localhost only), not on the report store's own gate. Also contradicts the scope's "one source of truth" directive. Rec: derive the write-key port from the same localhost-gated helper as the read path (free tightening of the loose guard). Fits inside fe-001's "How we're doing it" — no new story.
- **LOW (DoS):** `report:<port>` keys accumulate forever — `clearReport` resets-but-doesn't-delete, `unlimitedStorage` removes the quota backstop, abandoned non-empty reports on dead ports never GC'd. Local/single-user so LOW. **For PO to disposition in Phase 7.5:** either an accept-risk AC note on feature.md, or an optional GC follow-up under w2. I did NOT mint a STORY-sec (overkill for a local-tool LOW).
- **INFO (affirm):** retiring `saveReport`'s `portOfUrl(screenshots[0].url)` fallback is a net *positive* — removes a page-content-influenced controller-routing input. Not a dropped guard.
- **INFO (affirm):** "callers never pass a port" eliminates an IDOR/port-enumeration vector; per-port keying is a UX boundary, not a security boundary (flagged for w1/w2 to preserve).

**fe-002 — INFO only, no material findings.** Additive `GET_STATE.port` discloses only the active tab's own resolved port (caller already has it); no cross-port disclosure; `port: null` non-target sentinel correct.

Key backstops verified in manifest: **no `externally_connectable`** (web pages can't drive the message API), `content_scripts`/`host_permissions` limited to exact `localhost`/`127.0.0.1`, and `tab.url` is browser-authoritative (userinfo/pushState tricks defeated). That's why the spoofing surface stays LOW.

Two LOWs are the only things needing a PO decision (gate unification → fold into fe-001; DoS → accept-risk-or-defer). Neither blocks delivery.
