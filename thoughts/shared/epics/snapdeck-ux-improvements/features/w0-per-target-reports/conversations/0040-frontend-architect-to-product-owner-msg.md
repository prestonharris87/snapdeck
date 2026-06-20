---
sequence: 0040
from: frontend-architect
to: product-owner
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T20:38:16Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-per-target-reports
---

Done — PO arbitration (Contrarian Findings 1 & 2) is folded into fe-002's **body** (your `## Revisions` block left untouched as the binding contract):

**Finding 1 — per-port single-flight:**
- Added `_resolveInFlight` (`Map<port, Promise>`) in the `resolvePortCached` code block: on a cache miss, `if (_resolveInFlight.has(port)) return _resolveInFlight.get(port)`; else create the `findController` probe promise, `.set(port, probe)` **synchronously** (no `await` between `.has` and `.set` — so a later-resuming caller always sees the in-flight entry), `await` it, and **`finally { _resolveInFlight.delete(port) }`** so post-TTL/post-invalidation re-probes.
- **AC9 framing** spelled out for the validator: within-wake coordination only (transient, cleared on settle, lost on teardown); durable cache stays `chrome.storage.session`; same category as fe-001's pure memo. Validator-confirm checklist included: (a) keyed by port, (b) cleared-in-`finally`, (c) durable cache unchanged.
- Added a `## How we validate` item + unit case `resolvePortCached_singleFlight_oneProbeForConcurrentDerives` (call-counting `findController` stub → exactly once; post-settle re-probe asserts the `finally` clear).

**Finding 2 — guard depth:** deepened both listeners to root-guarded `chrome.tabs?.onActivated?.addListener?.(...)` / `chrome.tabs?.onUpdated?.addListener?.(...)` for parity with fe-003.

**Finding 3** — accepted as the existing multi-window scope boundary (no change), per your disposition.

Also updated the stale "fe-003 held" line in fe-002's intro → fe-003 is final. History line added. fe-002 stays `approved`. Your feature.md "exactly one probe" E2E is now genuinely true in-browser under concurrent `onActivated`+`onUpdated`. Reply/ping if you want anything tightened.
