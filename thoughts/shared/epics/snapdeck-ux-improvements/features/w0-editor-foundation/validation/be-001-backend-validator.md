# Backend Validator — STORY-be-001

**Date:** 2026-06-18  
**Validator:** backend-validator  
**Story:** STORY-be-001 — Persist lossless editor model on screenshot record  
**Commit:** 87f8273

## Verdict: ✅ VALIDATED

---

## Rationale

The implementation is clean, surgical, and complete. A single line is added to the `addScreenshot()` push-object literal at line 225 (`model: resp.model ?? null,`) to store the lossless editor model opaquely on each per-screenshot record in the local IndexedDB. The `saveReport()` function's upstream `/report/save` payload whitelist (lines 248–252) remains frozen at exactly 9 fields and explicitly excludes `model`, ensuring no new data is shipped downstream. The change is strictly additive (the 9 pre-existing screenshot record fields are unchanged), and the per-port keying infrastructure from w0-per-target-reports (`getReport(port)`, `setReport(port)`, `reportKey(port)`) is intact and transparent to this edit. All 30 unit tests pass (5 new + 25 existing siblings), with the strongest guard being the exact 9-field key-set assertion in `saveReport_omitsModelFromUpstreamPayload_whenRecordHasModel`.

---

## Acceptance Criteria — Explicit Confirmation

### (a) Model Stored Verbatim/Opaque ✅

- **Evidence:** Line 225 in `extension/background.js` adds `model: resp.model ?? null,` to the push-object literal inside `addScreenshot()`.
- **Behavior:** The entire `resp.model` object is stored as-is without enumeration, field validation, or whitelisting—exactly what the story requires for forward-compat with w1/w2 box/rectangle subtypes.
- **Forward-compat default:** The `?? null` operator correctly substitutes `null` only when the entire `model` field is absent (pre-fe-003 content scripts).
- **Test confirmation:** `addScreenshot_storesModelVerbatim_onScreenshotRecord` — invokes real `addScreenshot()` through the listener seam, asserts `screenshots[0].model` deep-equals the fixture model verbatim.
- **Test confirmation:** `addScreenshot_defaultsModelToNull_whenResolveOmitsModel` — asserts `model === null` when the resolve payload has no `model` key.

### (b) `/report/save` Upstream Payload UNCHANGED (Model Omitted) ✅

- **Evidence:** Lines 248–252 in `extension/background.js` — `saveReport()` maps each stored screenshot through an explicit field whitelist:
  ```js
  screenshots: r.screenshots.map((s) => ({
    url: s.url, title: s.title, captured_at: s.captured_at, viewport: s.viewport,
    original_png_b64: s.original, annotated_png_b64: s.annotated,
    annotations: s.annotations, console: s.console, network_failures: s.network,
  }))
  ```
  **No `model` key appears in this mapping.**
- **Byte-frozen invariant:** The upstream payload contains exactly the 9 frozen projection fields, with zero drift.
- **Test confirmation:** `saveReport_omitsModelFromUpstreamPayload_whenRecordHasModel` — seeds a report with a screenshot carrying `model`, calls real `saveReport()`, captures the POST body to `/report/save`, and asserts (1) no `model` key and (2) exact 9-field key-set via `Object.keys(screenshots[0]).sort()` deep-equal to `["annotations", "annotated_png_b64", "captured_at", "console", "network_failures", "original_png_b64", "title", "url", "viewport"]`.
- **Test confirmation:** `saveReport_upstreamPayloadByteIdentical_forSameAnnotations` — full payload deep-equals expected object, proving no silent field drift.

### (c) Additive-Only / Port-Keying Intact ✅

- **Additive:** Single line added; all 9 pre-existing screenshot record fields (`url`, `title`, `captured_at`, `viewport`, `original`, `annotated`, `annotations`, `console`, `network`) remain unchanged in name, value, and shape.
- **Test confirmation:** `addScreenshot_preservesExistingNineFields_whenAddingModel` — asserts all 9 pre-existing fields match their source resolve payload values exactly.
- **Port-keying merge compat:** The w0-per-target-reports feature's `getReport(port)` and `setReport(port)` (lines 40–48) use `reportKey(port)` to generate per-port keys (`report:${port}`). The `addScreenshot()` call at line 214 invokes `const r = await getReport(port)`, and line 227 calls `await setReport(port, r)`. The model field flows through the structured-clone `idbSet()` path untouched — the per-port keying is transparent to this change, and the model survives re-keying intact.
- **No schema migrations:** Diff adds zero migration files, zero `db.version` bumps, zero new object stores. Value-shape change only.
- **No auth changes:** The `localhost`/`127.0.0.1` URL guard at line 112 is untouched. No new guards added or removed.

---

## Unit Test Results

```
node --test extension/*.test.mjs
TAP version 13
# ... 30 tests ...
1..30
# tests 30
# pass 30
# fail 0
# duration_ms 199.232
```

**New tests (5):**
1. `addScreenshot_storesModelVerbatim_onScreenshotRecord` ✅
2. `addScreenshot_defaultsModelToNull_whenResolveOmitsModel` ✅
3. `addScreenshot_preservesExistingNineFields_whenAddingModel` ✅
4. `saveReport_omitsModelFromUpstreamPayload_whenRecordHasModel` ✅ **(strongest guard)**
5. `saveReport_upstreamPayloadByteIdentical_forSameAnnotations` ✅ **(regression proof)**

**Sibling tests (25):** All pass (from `background.reports.test.mjs` and `background.test.mjs`).

**Test harness quality:** Tests drive real `addScreenshot()` and `saveReport()` through the `chrome.runtime.onMessage` listener seam (vm-context, hand-written stubs for Chrome API and IndexedDB). Zero production refactor, no exports added. The frozen-projection test locks the 9-field key-set with an exact sorted-key match—a strong guarantee against silent upstream drift.

---

## Defects

None. The implementation meets all acceptance criteria.

---

## Integration Verification Status

**Unit-test-only validation is appropriate.** This story modifies internal `chrome.runtime` service-worker messaging and local IndexedDB storage—there is no HTTP endpoint to smoke-test. The side effects (model persistence in local store, upstream omission) are fully verified by the unit lane with real `addScreenshot()` and `saveReport()` code paths. The E2E lane (real service worker + IndexedDB + annotation overlay) is the remaining gate per the story's Engineer Notes, delegated to browser-tester Phase 5b.

---

## Backend Domain Checks ✅

| Check | Status | Notes |
|-------|--------|-------|
| API contract | ✅ | Internal chrome.runtime messaging (not HTTP). Contract is the resolve payload from STORY-fe-003. BE consumes and stores verbatim. |
| Auth scheme | ✅ | No HTTP auth applicable. Same-extension messaging, origin-enforced by browser. localhost guard unchanged. |
| Input validation | ✅ | Input is resolve payload from same-extension content script. Schema owned by producer (STORY-fe-003). |
| DB access | ✅ | Flows through standard structured-clone `idbSet()` path. No raw queries. |
| Soft-delete | N/A | Local ephemeral client-side store, not entity table. |
| Logging | ✅ | No secrets/PII involved. |
| Multi-tenant | N/A | Single-user local extension. |
| Schema migrations | ✅ | **ZERO migration files added.** Value-shape change only. |
| Security posture | ✅ | Load-bearing property: `model` stays local-only and is excluded from `/report/save`. Locked by exact 9-field key-set assertion. Privacy-neutral-to-positive per STRIDE review. |

---

**Status:** Ready for release.
