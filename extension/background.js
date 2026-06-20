// background.js — Snapdeck service worker (MV3).
// Holds the in-progress report in IndexedDB, captures the visible tab, drives the
// in-page annotation editor, discovers the owning controller, and POSTs the report.

const CONTROLLER_BASE = 7777;
const CONTROLLER_STEP = 10;
const CONTROLLER_TRIES = 40;

// --- IndexedDB (per-port 'report:<port>' records) ----------------------------
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("snapdeck", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly").objectStore("kv").get(key);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbSet(key, val) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite").objectStore("kv").put(val, key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
// mirror idbGet/idbSet — a 'readwrite' delete transaction (used by deleteReport GC).
async function idbDelete(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite").objectStore("kv").delete(key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Per-port storage helpers — keyed report:<port> in the kv store.
// No IndexedDB version bump: the generic kv store is reused as-is.
function reportKey(port) { return `report:${port}`; }
const EMPTY_REPORT = () => ({ note: "", screenshots: [] });

async function getReport(port) {
  if (port == null) return EMPTY_REPORT();              // non-target → empty, no IDB read
  return (await idbGet(reportKey(port))) || EMPTY_REPORT();
}
async function setReport(port, r) {
  if (port == null) return;                             // never persist a report:null record
  await idbSet(reportKey(port), r);
}
async function clearReport(port) { await setReport(port, EMPTY_REPORT()); }
// GC: truly remove report:<port> key. Only called by DELETE_SCREENSHOT when the
// delete empties the report — NOT called by clearReport / SAVE_REPORT / CLEAR_REPORT.
async function deleteReport(port) {
  if (port == null) return;
  await idbDelete(reportKey(port));
}

// Emit a storage.session tick whenever the report count for a port changes.
// Optional-chained so it no-ops cleanly when chrome.storage is absent (the
// frozen vm harnesses have no storage key — invariant 2).
function emitReportCountChanged(port, count) {
  if (port == null) return;                       // null-port guard (load-bearing at site 3)
  chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } });
}

// --- stable-identity helpers (w2-screenshot-gallery) ------------------------
// Synthesize a stable per-screenshot identity from fields that are PRESERVED
// across re-saves (captured_at + original bytes fingerprint). Both inputs are
// preserved by resaveScreenshot (fe-002), so the sid survives a re-save AND an
// array splice → it is the mutation handle for delete / re-open / re-save.
function screenshotId(s) {
  const orig = s.original || "";
  return `${s.captured_at}|${orig.length}:${orig.slice(-24)}`;
}
// Resolve a stable identity to its current array position in a freshly-read report.
// Returns -1 when the shot is gone (deleted mid-edit / not in this target) →
// callers fail safe (no throw, no wrong-record write).
function indexOfScreenshotId(r, sid) {
  return r.screenshots.findIndex((s) => screenshotId(s) === sid);
}

// --- helpers -----------------------------------------------------------------
function portOfUrl(url) {
  try {
    const u = new URL(url);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === "https:" ? 443 : 80;
  } catch (_) { return null; }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Resolve the active tab's dev-server port (the current target). Localhost-gated:
// returns the int port for an http://localhost|127.0.0.1 tab, else null.
// This is the single source of truth for "which port" — the read path (GET_STATE /
// SET_NOTE / CLEAR_REPORT) and the write path (addScreenshot / saveReport) both
// derive their target port from this same predicate (LOW-1 PROMOTE: write-key ≡
// read-key by construction; deceptive hosts like http://localhost.evil.com → null).
async function currentTargetPort() {
  const tab = await activeTab();
  const url = (tab && tab.url) || "";
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) return null;
  return portOfUrl(url);
}

async function fetchJSON(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 600);
  try {
    const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, json: JSON.parse(text) }; }
    catch (_) { return { ok: res.ok, status: res.status, text }; }
  } finally { clearTimeout(t); }
}

// Probe the controller port range for one whose project owns `browserPort`.
async function findController(browserPort) {
  const tries = [];
  for (let i = 0; i < CONTROLLER_TRIES; i++) {
    const p = CONTROLLER_BASE + i * CONTROLLER_STEP;
    tries.push(
      fetchJSON(`http://127.0.0.1:${p}/resolve?port=${browserPort}`, null, 400)
        .then((r) => { if (r.json && r.json.ok) return p; throw new Error("no"); })
        .catch(() => { throw new Error("no"); })
    );
  }
  try { return await Promise.any(tries); }
  catch (_) { return null; }
}

// --- message handling --------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg).then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
  return true; // async
});

// --- keyboard shortcut command -----------------------------------------------
let captureInFlight = false;

// Per-tabId flash bookkeeping (DEF-001 — badge-flash shadow fix).
// The capture-result `!`/`✓` flash is scoped to the active tab's tabId so it
// takes precedence over any per-tab steady-state badge another feature paints on
// that tab (e.g. the report-in-progress count badge). On teardown we clear that
// tab's badge ONLY IF it still shows our own flash (guarded) — so a steady-state
// repaint (the live count) survives the flash (AC5). The steady-state owner
// re-asserts via its own wake-reconcile (DEF-001 option c — no seam / no storage).
let flashTabId = null; // tab currently showing a kb flash (null = none / global)
let flashTimer = null; // pending teardown timer id

/** Clear kb's flash on `tabId` — GUARDED. Only clears if the badge STILL shows
 *  kb's own `✓`/`!`; if the steady-state owner has already repainted that tab
 *  (e.g. the report-in-progress count), leave it — blanking it would drop the
 *  live count (AC5). On a read failure, default to NOT clearing (never blank a
 *  badge we can't confirm is ours). Falls back to the global badge when no tab
 *  was resolved. Async: it reads the current badge text before deciding. */
async function clearFlash(tabId) {
  const target = tabId == null ? {} : { tabId };
  let current;
  try {
    current = await chrome.action.getBadgeText(target);
  } catch (_) {
    return; // can't confirm the badge is ours → leave it (never blank the count)
  }
  if (current !== "✓" && current !== "!") return; // steady-state owner repainted
  chrome.action.setBadgeText({ ...target, text: "" });
  chrome.action.setTitle({ ...target, title: "Snapdeck" });
}

/** Cancel any pending flash teardown and clear its tab immediately. Run at the
 *  start of a new invocation so a still-showing prior flash is handed back —
 *  WITHOUT blanking the *current* tab's steady-state badge (no destructive
 *  pre-clear: a cancelled / in-flight capture must leave the count intact). */
function cancelPendingFlash() {
  if (flashTimer !== null) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
  if (flashTabId !== null) {
    const prev = flashTabId;
    flashTabId = null;
    void clearFlash(prev); // guarded + fire-and-forget; never blanks a repaint
  }
}

/** Paint kb's `!`/`✓` flash on `tabId` (or the global badge when tabId is null). */
function setFlash(tabId, text, color, title) {
  const target = tabId == null ? {} : { tabId };
  chrome.action.setBadgeText({ ...target, text });
  chrome.action.setBadgeBackgroundColor({ ...target, color });
  if (title != null) chrome.action.setTitle({ ...target, title });
}

/** Schedule kb's flash on `tabId` to self-clear (guarded) after `ms`. */
function scheduleFlashClear(tabId, ms) {
  flashTabId = tabId;
  flashTimer = setTimeout(async () => {
    flashTimer = null;
    const t = flashTabId;
    flashTabId = null;
    await clearFlash(t);
  }, ms);
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "capture-screenshot") return;
  // fire-and-forget; result is surfaced via the action badge, not a return value
  runCaptureCommand();
});

async function runCaptureCommand() {
  if (captureInFlight) return;
  captureInFlight = true;
  try {
    // Hand back any still-showing prior flash (cancel its timer + clear its tab).
    // We deliberately do NOT blank the *current* tab here.
    cancelPendingFlash();

    // Resolve the active tab so the flash is scoped to it (per-tabId precedence).
    let tabId = null;
    try {
      const tab = await activeTab();
      if (tab && tab.id != null) tabId = tab.id;
    } catch (_) {
      tabId = null; // fall back to a global flash (still non-silent)
    }

    let result;
    try {
      result = await addScreenshot();
    } catch (e) {
      // INFO-2: a thrown error (e.g. unexpected chrome.tabs rejection) is also
      // a non-silent failure — map it onto the same red "!" error badge.
      setFlash(tabId, "!", "#C0392B", e.message || String(e));
      scheduleFlashClear(tabId, 4000);
      return;
    }
    if (result && result.error) {
      setFlash(tabId, "!", "#C0392B", result.error);
      scheduleFlashClear(tabId, 4000);
    } else if (result && result.ok) {
      setFlash(tabId, "✓", "#1E8E3E", null);
      scheduleFlashClear(tabId, 2000);
    }
    // { cancelled: true }: no badge change at all — the tab's steady-state badge
    // is left intact (no false signal; report count preserved).
  } finally {
    captureInFlight = false;
  }
}

async function handle(msg) {
  switch (msg.type) {
    case "GET_STATE": {
      const port = await currentTargetPort();
      const r = await getReport(port);
      // port: null for non-target tabs (formalized by STORY-fe-002)
      return { count: r.screenshots.length, note: r.note || "", port };
    }
    case "SET_NOTE": {
      const port = await currentTargetPort();
      const r = await getReport(port);
      r.note = msg.note || "";
      await setReport(port, r);
      return { ok: true };
    }
    case "ADD_SCREENSHOT":
      return addScreenshot();
    case "SAVE_REPORT":
      return saveReport();
    case "CLEAR_REPORT": {
      const port = await currentTargetPort();
      await clearReport(port);
      emitReportCountChanged(port, 0);  // site 3: helper guard drops null (non-target clear)
      return { ok: true };
    }
    case "GET_REPORT_SCREENSHOTS": {
      const port = await currentTargetPort();          // released SSOT; non-target → null
      const r = await getReport(port);                 // port==null → EMPTY_REPORT(), no IDB read
      return {
        port,
        screenshots: r.screenshots.map((s, index) => ({
          index,                                        // display ordering only — NOT the mutation handle
          sid: screenshotId(s),                         // stable identity (captured_at + original fingerprint)
          thumbnail: s.annotated || s.original,         // annotated PNG; fall back to original when no annotations
          url: s.url, title: s.title, captured_at: s.captured_at,
          hasAnnotations: !!(s.annotations && s.annotations.length),
        })),
      };
    }
    case "DELETE_SCREENSHOT": {
      const port = await currentTargetPort();
      if (port == null) return { error: "no current Snapdeck target tab" };
      const r = await getReport(port);
      const index = indexOfScreenshotId(r, msg.sid);   // match by stable identity, never array position
      if (index < 0) {
        return { error: "no such screenshot" };         // already deleted / not in current target → fail-safe no-op
      }
      r.screenshots.splice(index, 1);                  // remove exactly that one
      if (r.screenshots.length === 0) {
        await deleteReport(port);                       // GC: remove the report:<port> KEY
      } else {
        await setReport(port, r);                       // shrink the record
      }
      emitReportCountChanged(port, r.screenshots.length);  // badge repaints
      return { ok: true, count: r.screenshots.length };
    }
    case "REOPEN_SCREENSHOT":
      return reopenScreenshot(msg.sid);
    default:
      return { error: "unknown message" };
  }
}

async function addScreenshot() {
  const tab = await activeTab();
  // Tight localhost gate — same predicate as currentTargetPort() so write-key ≡
  // read-key (LOW-1 PROMOTE). Deceptive hosts (http://localhost.evil.com) fail the
  // (:|/|$) anchor and are rejected here, writing no report:* record.
  if (!tab || !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(tab.url || "")) {
    return { error: "Snapdeck only works on your local dev app (localhost / 127.0.0.1)." };
  }
  const port = portOfUrl(tab.url);
  let image;
  try {
    image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (e) {
    return { error: "capture failed: " + e.message };
  }
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tab.id, { type: "ANNOTATE", image });
  } catch (e) {
    return { error: "could not open the annotation overlay (reload the page so the content script loads): " + e.message };
  }
  if (!resp || resp.cancelled) return { cancelled: true };
  const r = await getReport(port);
  r.screenshots.push({
    url: resp.meta.url,
    title: resp.meta.title,
    captured_at: resp.meta.captured_at,
    viewport: resp.meta.viewport,
    original: resp.original,
    annotated: resp.annotated,
    annotations: resp.annotations || [],
    console: resp.console || [],
    network: resp.network || [],
    model: resp.model ?? null,   // lossless editor model — local store only, NOT in saveReport() whitelist
  });
  await setReport(port, r);
  emitReportCountChanged(port, r.screenshots.length);  // site 1: count rose by 1
  return { ok: true, count: r.screenshots.length };
}

async function saveReport() {
  // Derive port via the same gated helper as the read path (LOW-1 PROMOTE).
  // Retires the portOfUrl(screenshots[0].url) fallback — per-port keying must
  // resolve the key before reading the record; a page-content-derived fallback
  // is also a Tampering risk (see fe-001 INFO: security positive).
  const browserPort = await currentTargetPort();
  if (!browserPort) return { error: "could not determine the dev-server port" };
  const r = await getReport(browserPort);
  if (!r.screenshots.length) return { error: "report is empty — add a screenshot first" };

  const ctrlPort = await findController(browserPort);
  if (!ctrlPort) {
    return { error: `no Snapdeck controller owns port :${browserPort} — is \`deck up\` running in that worktree?` };
  }
  const payload = {
    browser_port: browserPort,
    note: r.note || "",
    screenshots: r.screenshots.map((s) => ({
      url: s.url, title: s.title, captured_at: s.captured_at, viewport: s.viewport,
      original_png_b64: s.original, annotated_png_b64: s.annotated,
      annotations: s.annotations, console: s.console, network_failures: s.network,
    })),
  };
  const res = await fetchJSON(`http://127.0.0.1:${ctrlPort}/report/save`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }, 20000);
  if (res.json && res.json.ok) {
    await clearReport(browserPort);
    emitReportCountChanged(browserPort, 0);  // site 2: count reset to 0 on successful save
    return res.json;
  }
  return { error: (res.json && res.json.error) || res.text || `save failed (HTTP ${res.status})` };
}

// =============================================================================
// w2-screenshot-gallery — re-open + preserve-from-record re-save (STORY-fe-002)
// =============================================================================

// Re-open a stored screenshot in the in-page editor by stable identity (sid).
// Returns quickly (pre-flight PING only) so the popup can surface a no-host error.
// The long-lived ANNOTATE round-trip + re-save run deferred after the popup closes.
async function reopenScreenshot(sid) {
  const port = await currentTargetPort();
  if (port == null) return { error: "no current Snapdeck target tab" };
  const r = await getReport(port);
  const index = indexOfScreenshotId(r, sid);     // resolve stable identity → current position
  const shot = r.screenshots[index];
  if (index < 0 || !shot) return { error: "no such screenshot" };

  const tab = await activeTab();
  // Pre-flight PING — proves content-script host present, not busy (returns quickly).
  // The popup awaits THIS result and surfaces {error} or window.close() on {ok}.
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PING" });
  } catch (e) {
    return { error: "could not open the annotation overlay (reload the page so the content script loads): " + e.message };
  }

  // Host present → fire the long-lived ANNOTATE round-trip fire-and-forget.
  // The SW survives popup closing, so .then() re-save runs after window.close().
  // Pass the STABLE sid (not a held array index) — the array may splice mid-edit.
  chrome.tabs.sendMessage(tab.id, { type: "ANNOTATE", image: shot.original, model: shot.model })
    .then((resp) => resaveScreenshot(port, sid, resp))
    .catch(() => { /* tab navigated/closed mid-edit → record left unchanged */ });

  return { ok: true, opening: true };
}

// Re-save the edited screenshot back into the report — preserve-from-record contract.
// Takes ONLY model/annotated/annotations from the editor response; preserves ALL
// other fields (original, console, network, url, title, captured_at, viewport).
async function resaveScreenshot(port, sid, resp) {
  if (!resp || resp.cancelled) return;          // Cancel OR busy ({cancelled:true,busy:true}) → unchanged

  const r2 = await getReport(port);             // re-read fresh (robust to SW wake + mid-edit splice)
  const index = indexOfScreenshotId(r2, sid);   // match by STABLE identity, NOT held array position
  const target = r2.screenshots[index];
  if (index < 0 || !target) return;             // shot deleted while overlay open → FAIL-SAFE no-op

  // Take ONLY from the editor response:
  target.model       = resp.model ?? null;
  target.annotated   = resp.annotated;
  target.annotations = resp.annotations || [];

  // PRESERVE from the pre-edit record (NEVER from resp):
  //   target.original, target.console, target.network,
  //   target.url, target.title, target.captured_at, target.viewport
  // (untouched by construction — only the three fields above are overwritten;
  //  original+captured_at preserved → sid is UNCHANGED across re-saves)

  await setReport(port, r2);
  // NO emitReportCountChanged — a re-save does NOT change the count
}

// =============================================================================
// w1-dynamic-icon-badge — per-tab icon state machine
// =============================================================================

// --- fe-001: per-tabId icon-state render primitives --------------------------

// State color tokens — green anchored to the existing badge token (#1E8E3E / AC13);
// orange/gray selected per design.md (CLAR-001).
const ICON_COLORS = {
  gray:   "#5F6368",   // not-a-target / inactive
  green:  "#1E8E3E",   // registered target (existing badge token — AC13 anchor)
  orange: "#E37400",   // in-progress report (also the orange badge background)
};

// Tints the packaged logo to a flat silhouette in the state color, at all 3 sizes.
// Returns { 16: ImageData, 48: ImageData, 128: ImageData } for chrome.action.setIcon.
// OffscreenCanvas is a service-worker global; chrome.runtime.getURL on own packaged
// assets is same-origin — both need no new permission (AC13, INFO-1 security positive).
async function iconImageDataForState(state) {
  const color = ICON_COLORS[state];
  const sizes = [16, 48, 128];
  const entries = await Promise.all(sizes.map(async (s) => {
    const url = chrome.runtime.getURL("icons/icon-" + s + ".png");
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(s, s);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, s, s);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
    return [s, ctx.getImageData(0, 0, s, s)];
  }));
  return Object.fromEntries(entries);
}

// Applies one resolved state to ONE tab via the tabId-scoped action API.
// Every chrome.action.* call carries { tabId } — no global badge touch (namespace
// isolation: keeps this feature out of the released global-badge namespace kb owns).
async function applyIconState(tabId, { state, count = 0 }) {
  const imageData = await iconImageDataForState(state);
  await chrome.action.setIcon({ tabId, imageData });
  if (state === "orange") {
    chrome.action.setBadgeText({ tabId, text: String(count) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: ICON_COLORS.orange });
    chrome.action.setTitle({ tabId, title: "Snapdeck — " + count + " unsaved screenshot(s)" });
  } else {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setTitle({
      tabId,
      title: state === "gray"
        ? "Snapdeck — not a Snapdeck target"
        : "Snapdeck — ready to capture",
    });
  }
}

// --- fe-002: tab-driven icon derivation + two-tier resolve + session cache ---

const RESOLVE_TTL_MS = 30000;  // green/gray resolution cache TTL (self-heals deck up/down)

// Per-port single-flight for the /resolve fan-out (PO-required, Contrarian Finding 1).
// WITHIN-WAKE coordination only: a transient promise cleared on settle (finally) and
// lost on SW teardown — NOT durable state (same category as iconImageDataForState memo;
// does not relocate the durable resolution cache out of storage.session — AC9 intact).
const _resolveInFlight = new Map();  // port -> Promise<boolean>

// Two-tier resolution with a chrome.storage.session cache keyed by browser port.
async function resolvePortCached(port) {
  const key = "resolve:" + port;
  const hit = (await chrome.storage.session.get(key))[key];
  if (hit && (Date.now() - hit.ts) < RESOLVE_TTL_MS) return hit.resolved;  // cache hit — NO probe
  // Single-flight: concurrent derives for the SAME port share ONE findController fan-out.
  // CRITICAL: no `await` between the .has() check and the .set(), so a later-resuming
  // caller always observes the in-flight entry (collapses onActivated+onUpdated bursts
  // to a single probe — AC12).
  if (_resolveInFlight.has(port)) return _resolveInFlight.get(port);
  const probe = (async () => {
    const ctrlPort = await findController(port);         // released seam — the ONLY probe
    const resolved = ctrlPort != null;
    await chrome.storage.session.set({ [key]: { resolved, ts: Date.now() } });
    return resolved;
  })();
  _resolveInFlight.set(port, probe);
  try { return await probe; }
  finally { _resolveInFlight.delete(port); }   // cleared on settle — post-TTL re-probes fresh
}

async function invalidateResolveCache(port) {
  if (port == null) return;
  await chrome.storage.session.remove("resolve:" + port);
}

// Re-derive + paint the CURRENT active tab. Reuses currentTargetPort() (the released
// single source of truth) — never a second/looser localhost predicate (AC10).
async function refreshActiveTab() {
  const tab = await activeTab();                  // released helper
  if (!tab) return;
  const tabId = tab.id;
  const port = await currentTargetPort();         // released SSOT (non-localhost/deceptive → null)
  if (port == null) { await applyIconState(tabId, { state: "gray" }); return; }   // AC1/AC10 — no probe
  const resolved = await resolvePortCached(port);
  if (!resolved) { await applyIconState(tabId, { state: "gray" }); return; }      // AC3
  const r = await getReport(port);                // released read seam (SSOT for count)
  const count = r.screenshots.length;
  await applyIconState(tabId, count > 0 ? { state: "orange", count } : { state: "green" }); // AC4/AC2
}

// Top-level listeners — registered SYNCHRONOUSLY at module scope (AC8).
// Double `?.` (root-guarded) for frozen-mock tolerance: the released sibling suites
// define chrome.tabs but omit onActivated/onUpdated — the optional chain no-ops
// rather than throwing at module load (Contrarian Finding 2, PO fold-in).
chrome.tabs?.onActivated?.addListener?.(() => { void refreshActiveTab(); });
chrome.tabs?.onUpdated?.addListener?.((tabId, changeInfo, tab) => {
  if (!tab || !tab.active) return;                // best-effort: only the active tab
  if (changeInfo.status === "loading") { void (async () => {
    await invalidateResolveCache(await currentTargetPort());  // reload re-probes (deck up after the fact)
  })(); }
  if (changeInfo.status === "complete" || changeInfo.url) { void refreshActiveTab(); }
});

// --- fe-003: live-count freshness trigger + cold-start re-derive -------------

// Top-level storage.session.onChanged listener (key-filtered).
// STRICT key-filter: acts ONLY on `changes.reportCountChanged`; ignores fe-002's
// own `resolve:<port>` cache writes (same storage.session area) — prevents the
// cache-write → onChanged → re-derive → cache-write feedback loop (BOSS-flagged).
// Double `?.` for frozen-mock tolerance: released suites stub NO `storage` at all —
// the optional chain short-circuits cleanly at module load (gate-2 criterion #1).
// A SECOND chrome.runtime.onMessage.addListener is FORBIDDEN here — the released
// suites single-capture the last listener; `storage.session.onChanged` is the
// harness-safe alternative.
chrome.storage?.session?.onChanged?.addListener?.((changes) => {
  if (!changes.reportCountChanged) return;    // key-filter: ignore resolve:* cache writes
  void refreshActiveTab();                    // re-derive from the GET_STATE/getReport SSOT
});

// SW cold-start re-derive — MV3 re-evaluates the SW top level on every wake, so this
// runs on each cold-start. The feature-detect guard makes module load clean under the
// frozen no-`storage`/no-`setIcon` mocks (condition false → no call → no rejection —
// gate-2 criterion #1). Self-heals a tick dropped during prior SW teardown.
if (chrome.storage?.session && chrome.action?.setIcon) void refreshActiveTab();
