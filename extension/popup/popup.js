// popup.js — drives the Snapdeck popup UI.

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

function setStatus(text, cls) {
  const el = $("status");
  el.textContent = text || "";
  el.className = "sd-status" + (cls ? " sd-" + cls : "");
}
function setCount(n) { $("count").textContent = String(n); }

async function refresh() {
  const st = await send({ type: "GET_STATE" });
  setCount(st.count || 0);
  if (st.note) $("note").value = st.note;
}

$("note").addEventListener("change", () => send({ type: "SET_NOTE", note: $("note").value }));

$("add").addEventListener("click", async () => {
  // Persist the note, fire the capture, and close so the page overlay is usable.
  await send({ type: "SET_NOTE", note: $("note").value });
  send({ type: "ADD_SCREENSHOT" });
  window.close();
});

$("save").addEventListener("click", async () => {
  await send({ type: "SET_NOTE", note: $("note").value });
  setStatus("Saving…");
  const res = await send({ type: "SAVE_REPORT" });
  if (res && res.ok) {
    setStatus(`Saved ${res.report_id} (${res.screenshots} screenshot${res.screenshots === 1 ? "" : "s"})`, "ok");
    setCount(0);
    $("note").value = "";
  } else {
    setStatus((res && res.error) || "save failed", "err");
  }
});

$("clear").addEventListener("click", async () => {
  await send({ type: "CLEAR_REPORT" });
  setCount(0);
  $("note").value = "";
  setStatus("Report cleared");
});

refresh();
