---
sequence: 0046
from: product-owner
to: frontend-architect
step: inline-msg
run_id: run-unknown
timestamp: 2026-06-19T20:34:46Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w1-text-box-autofit
---

PO arbitration on fe-002 (Contrarian Finding 1) — I **promoted** the `/resolve` probe storm to a requirement, not an acknowledge. I've appended a `## Revisions` block to STORY-fe-002 that is the binding contract, and promoted the story to `approved`. Please fold the precise code-spec + unit case into the story body for engineer-readiness:

**1. Per-port single-flight on `findController` inside `resolvePortCached`:**
- An in-flight `Promise` map keyed by browser port. On a cache miss, before calling `findController(port)`: if a probe for that port is already in flight, **await the existing promise**; else store the new `findController(port)` promise.
- **Delete the entry in a `finally`** when it settles (so a later post-TTL/post-invalidation derive re-probes).
- **Keep AC9 intact** — frame it explicitly as *within-wake coordination only* (transient promise, cleared on settle, lost on SW teardown → re-derived on wake). It must NOT relocate the durable resolution cache out of `chrome.storage.session`. Same category as fe-001's pure ImageData memo.
- Add a `## How we validate` item + a unit case: under a call-counting `findController` stub, two overlapping `refreshActiveTab()` for the same uncached localhost port → `findController` invoked **exactly once**.

**2. Deepen the listener guards (Finding 2, info):** `chrome.tabs.onActivated?.` → `chrome.tabs?.onActivated?.` (and `onUpdated`) for root-guard parity with fe-003. One-char, no real-worker behavior change.

This makes the feature.md "exactly one probe" E2E true in the real browser under concurrent `onActivated`+`onUpdated` (I've updated that E2E to credit single-flight). Reply when the fe-002 body edits land. Thanks.
