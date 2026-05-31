// background.js — Snapdeck service worker (MV3).
// Holds the in-progress report in IndexedDB, captures the visible tab, drives the
// in-page annotation editor, discovers the owning controller, and POSTs the report.

const CONTROLLER_BASE = 7777;
const CONTROLLER_STEP = 10;
const CONTROLLER_TRIES = 40;

// --- IndexedDB (single 'report' record) --------------------------------------
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
async function getReport() {
  return (await idbGet("report")) || { note: "", screenshots: [] };
}
async function setReport(r) { await idbSet("report", r); }
async function clearReport() { await setReport({ note: "", screenshots: [] }); }

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

async function handle(msg) {
  switch (msg.type) {
    case "GET_STATE": {
      const r = await getReport();
      return { count: r.screenshots.length, note: r.note || "" };
    }
    case "SET_NOTE": {
      const r = await getReport();
      r.note = msg.note || "";
      await setReport(r);
      return { ok: true };
    }
    case "ADD_SCREENSHOT":
      return addScreenshot();
    case "SAVE_REPORT":
      return saveReport();
    case "CLEAR_REPORT":
      await clearReport();
      return { ok: true };
    default:
      return { error: "unknown message" };
  }
}

async function addScreenshot() {
  const tab = await activeTab();
  if (!tab || !/^http:\/\/(localhost|127\.0\.0\.1)/.test(tab.url || "")) {
    return { error: "Snapdeck only works on your local dev app (localhost / 127.0.0.1)." };
  }
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
  const r = await getReport();
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
  });
  await setReport(r);
  return { ok: true, count: r.screenshots.length };
}

async function saveReport() {
  const r = await getReport();
  if (!r.screenshots.length) return { error: "report is empty — add a screenshot first" };
  const tab = await activeTab();
  let browserPort = portOfUrl(tab && tab.url);
  if (!browserPort) browserPort = portOfUrl(r.screenshots[0].url);
  if (!browserPort) return { error: "could not determine the dev-server port" };

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
    await clearReport();
    return res.json;
  }
  return { error: (res.json && res.json.error) || res.text || `save failed (HTTP ${res.status})` };
}
