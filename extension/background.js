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

// Emit a storage.session tick whenever the report count for a port changes.
// Optional-chained so it no-ops cleanly when chrome.storage is absent (the
// frozen vm harnesses have no storage key — invariant 2).
function emitReportCountChanged(port, count) {
  if (port == null) return;                       // null-port guard (load-bearing at site 3)
  chrome.storage?.session?.set?.({ reportCountChanged: { port, count, ts: Date.now() } });
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
