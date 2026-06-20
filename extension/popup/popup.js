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
  await refreshGallery();
}

// --- Gallery -----------------------------------------------------------------

async function refreshGallery() {
  const res = await send({ type: "GET_REPORT_SCREENSHOTS" });
  renderGallery((res && res.screenshots) || []);
}

function renderGallery(screenshots) {
  const gallery = $("gallery");
  // Clear existing content (no innerHTML)
  while (gallery.firstChild) gallery.removeChild(gallery.firstChild);

  if (!screenshots || screenshots.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sd-empty";
    empty.textContent = "No screenshots in this target's report yet.";
    gallery.appendChild(empty);
    return;
  }

  for (const shot of screenshots) {
    gallery.appendChild(makeTile(shot));
  }
}

function makeTile(shot) {
  // .sd-tile wrapper
  const tile = document.createElement("div");
  tile.className = "sd-tile";
  tile.setAttribute("role", "listitem");

  // Thumbnail button — click → re-open
  const thumbBtn = document.createElement("button");
  thumbBtn.className = "sd-thumb";
  thumbBtn.setAttribute("aria-label", "Re-open screenshot " + (shot.index + 1));
  thumbBtn.title = shot.title || shot.url || "";
  thumbBtn.addEventListener("click", () => reopen(shot.sid));

  const img = document.createElement("img");
  img.className = "sd-thumb-img";
  img.src = shot.thumbnail;  // base64 data-URL — inert in img@src
  img.alt = "";               // decorative; button carries the accessible label

  const badge = document.createElement("span");
  badge.className = "sd-thumb-idx";
  badge.textContent = "#" + (shot.index + 1);  // textContent — auto-escaped

  thumbBtn.appendChild(img);
  thumbBtn.appendChild(badge);
  tile.appendChild(thumbBtn);

  // Delete affordance — two-state inline confirm
  const delContainer = document.createElement("div");
  delContainer.className = "sd-del";

  const delBtn = document.createElement("button");
  delBtn.className = "sd-del-btn";
  delBtn.setAttribute("aria-label", "Delete screenshot " + (shot.index + 1));
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => showConfirm(shot, delContainer));

  delContainer.appendChild(delBtn);
  tile.appendChild(delContainer);

  return tile;
}

function showConfirm(shot, container) {
  // Swap to confirm state
  while (container.firstChild) container.removeChild(container.firstChild);

  const label = document.createElement("span");
  label.className = "sd-del-prompt";
  label.textContent = "Delete?";

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "sd-del-confirm";
  confirmBtn.textContent = "Confirm";
  confirmBtn.addEventListener("click", () => confirmDelete(shot.sid));

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "sd-del-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    // Restore resting state — no mutation
    while (container.firstChild) container.removeChild(container.firstChild);
    const restoreBtn = document.createElement("button");
    restoreBtn.className = "sd-del-btn";
    restoreBtn.setAttribute("aria-label", "Delete screenshot " + (shot.index + 1));
    restoreBtn.textContent = "Delete";
    restoreBtn.addEventListener("click", () => showConfirm(shot, container));
    container.appendChild(restoreBtn);
  });

  container.appendChild(label);
  container.appendChild(confirmBtn);
  container.appendChild(cancelBtn);
}

async function reopen(sid) {
  const res = await send({ type: "REOPEN_SCREENSHOT", sid });
  if (res && res.error) {
    setStatus(res.error, "err");
    // Stay open so the user sees the error
  } else {
    window.close(); // mirrors the Add-flow close so the overlay is usable
  }
}

async function confirmDelete(sid) {
  const res = await send({ type: "DELETE_SCREENSHOT", sid });
  if (res && res.error) {
    setStatus(res.error, "err");
  } else {
    setCount(res.count);
    await refreshGallery(); // re-fetch + re-render so display indices recompute
  }
}

// --- Existing event wiring ---------------------------------------------------

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
    renderGallery([]); // empty the grid after save
  } else {
    setStatus((res && res.error) || "save failed", "err");
  }
});

$("clear").addEventListener("click", async () => {
  await send({ type: "CLEAR_REPORT" });
  setCount(0);
  $("note").value = "";
  setStatus("Report cleared");
  renderGallery([]); // empty the grid after clear
});

refresh();
