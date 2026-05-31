// editor.js — isolated world. The freeze-and-annotate overlay, built on Konva.
// Invoked by the background worker with a captured PNG; resolves with the
// annotated PNG + structured annotations + page metadata + console/network.

(function () {
  "use strict";
  if (window.__snapdeckEditorInstalled) return;
  window.__snapdeckEditorInstalled = true;

  var active = false;

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === "PING") { sendResponse({ ok: true }); return; }
    if (msg && msg.type === "ANNOTATE") {
      if (active) { sendResponse({ cancelled: true, busy: true }); return; }
      openEditor(msg.image).then(sendResponse);
      return true; // async response
    }
  });

  function uid() { return "a" + Math.random().toString(36).slice(2, 9); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function openEditor(imageDataUrl) {
    return new Promise(function (resolve) {
      active = true;
      var dpr = window.devicePixelRatio || 1;
      var W = window.innerWidth, H = window.innerHeight;
      var prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";

      // --- DOM scaffold ---
      var root = document.createElement("div");
      root.className = "snapdeck-overlay";
      var stageDiv = document.createElement("div");
      stageDiv.className = "snapdeck-stage";
      root.appendChild(stageDiv);
      var bar = buildToolbar();
      root.appendChild(bar.el);
      (document.body || document.documentElement).appendChild(root);

      // --- Konva ---
      var Konva = window.Konva;
      var stage = new Konva.Stage({ container: stageDiv, width: W, height: H });
      var bgLayer = new Konva.Layer({ listening: false });
      var annLayer = new Konva.Layer();
      var cursorLayer = new Konva.Layer({ listening: false });
      stage.add(bgLayer); stage.add(annLayer); stage.add(cursorLayer);

      // background screenshot
      var imgEl = new Image();
      imgEl.onload = function () {
        bgLayer.add(new Konva.Image({ image: imgEl, x: 0, y: 0, width: W, height: H }));
        bgLayer.draw();
      };
      imgEl.src = imageDataUrl;

      // synthetic cursor at last mouse position
      var lm = window.__snapdeckLastMouse || { x: W / 2, y: H / 2 };
      drawCursor(Konva, cursorLayer, lm.x, lm.y);

      // --- editor state ---
      var model = [];           // [{id,type:'arrow',x1,y1,x2,y2} | {id,type:'text',x,y,text}]
      var tool = "arrow";
      var selectedId = null;
      var past = [], future = [];
      function snapshot() { past.push(clone(model)); future.length = 0; bar.setUndo(past.length > 0, false); }
      function undo() { if (!past.length) return; future.push(clone(model)); model = past.pop(); selectedId = null; render(); bar.setUndo(past.length > 0, future.length > 0); }
      function redo() { if (!future.length) return; past.push(clone(model)); model = future.pop(); selectedId = null; render(); bar.setUndo(past.length > 0, future.length > 0); }

      function setTool(t) { tool = t; selectedId = null; bar.setTool(t); render(); }

      // --- rendering from model ---
      function render() {
        annLayer.destroyChildren();
        model.forEach(function (item) {
          if (item.type === "arrow") renderArrow(item);
          else if (item.type === "text") renderText(item);
        });
        annLayer.draw();
      }

      function renderArrow(item) {
        var arrow = new Konva.Arrow({
          points: [item.x1, item.y1, item.x2, item.y2],
          stroke: "#e53935", fill: "#e53935", strokeWidth: 3,
          pointerLength: 12, pointerWidth: 12, hitStrokeWidth: 16,
          draggable: tool === "select",
        });
        arrow.on("click tap", function (e) { e.cancelBubble = true; if (tool === "select") { selectedId = item.id; render(); } });
        arrow.on("dragend", function () {
          var dx = arrow.x(), dy = arrow.y();
          item.x1 += dx; item.y1 += dy; item.x2 += dx; item.y2 += dy;
          arrow.position({ x: 0, y: 0 });
          snapshot(); render();
        });
        annLayer.add(arrow);
        if (selectedId === item.id && tool === "select") {
          [["x1", "y1"], ["x2", "y2"]].forEach(function (pair) {
            var anchor = new Konva.Circle({
              x: item[pair[0]], y: item[pair[1]], radius: 7,
              fill: "#fff", stroke: "#e53935", strokeWidth: 2, draggable: true,
            });
            anchor.on("dragmove", function () { item[pair[0]] = anchor.x(); item[pair[1]] = anchor.y(); arrow.points([item.x1, item.y1, item.x2, item.y2]); annLayer.batchDraw(); });
            anchor.on("dragend", function () { snapshot(); });
            annLayer.add(anchor);
          });
        }
      }

      function renderText(item) {
        var text = new Konva.Text({
          x: item.x, y: item.y, text: item.text || " ", fontSize: 18,
          fontStyle: "bold", fill: "#e53935", draggable: tool === "select",
          padding: 4,
        });
        text.on("click tap", function (e) { e.cancelBubble = true; if (tool === "select") { selectedId = item.id; render(); } });
        text.on("dblclick dbltap", function (e) { e.cancelBubble = true; editText(item, text); });
        text.on("dragend", function () { item.x = text.x(); item.y = text.y(); snapshot(); });
        annLayer.add(text);
        if (selectedId === item.id && tool === "select") {
          var box = text.getClientRect();
          annLayer.add(new Konva.Rect({
            x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4,
            stroke: "#1e88e5", strokeWidth: 1, dash: [4, 4], listening: false,
          }));
        }
      }

      // --- text editing via a positioned textarea ---
      function editText(item, node) {
        var ta = document.createElement("textarea");
        ta.className = "snapdeck-textedit";
        ta.value = item.text || "";
        var box = node ? node.getClientRect() : { x: item.x, y: item.y, width: 160, height: 28 };
        ta.style.left = box.x + "px";
        ta.style.top = box.y + "px";
        root.appendChild(ta);
        ta.focus(); ta.select();
        function commit() {
          var v = ta.value.trim();
          if (ta.parentNode) ta.parentNode.removeChild(ta);
          if (!v) { model = model.filter(function (m) { return m.id !== item.id; }); }
          else { item.text = v; }
          snapshot(); render();
        }
        ta.addEventListener("blur", commit);
        ta.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.blur(); }
          if (e.key === "Escape") { ta.value = item.text || ""; ta.blur(); }
        });
      }

      // --- drawing interactions ---
      var drawing = null;
      stage.on("mousedown touchstart", function (e) {
        if (tool === "arrow" && e.target === stage || (tool === "arrow" && e.target.getLayer() === bgLayer)) {
          var p = stage.getPointerPosition();
          drawing = { id: uid(), type: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        } else if (tool === "select" && (e.target === stage || e.target.getLayer() === bgLayer)) {
          selectedId = null; render();
        }
      });
      stage.on("mousemove touchmove", function () {
        if (!drawing) return;
        var p = stage.getPointerPosition();
        drawing.x2 = p.x; drawing.y2 = p.y;
        var tmp = annLayer.findOne(".__drawing");
        if (tmp) tmp.points([drawing.x1, drawing.y1, drawing.x2, drawing.y2]);
        else { var a = new Konva.Arrow({ name: "__drawing", points: [drawing.x1, drawing.y1, drawing.x2, drawing.y2], stroke: "#e53935", fill: "#e53935", strokeWidth: 3, pointerLength: 12, pointerWidth: 12 }); annLayer.add(a); }
        annLayer.batchDraw();
      });
      stage.on("mouseup touchend", function () {
        if (!drawing) return;
        var dx = drawing.x2 - drawing.x1, dy = drawing.y2 - drawing.y1;
        if (Math.hypot(dx, dy) > 8) { model.push(drawing); snapshot(); }
        drawing = null; render();
      });
      stage.on("click tap", function (e) {
        if (tool === "text" && (e.target === stage || e.target.getLayer() === bgLayer)) {
          var p = stage.getPointerPosition();
          var item = { id: uid(), type: "text", x: p.x, y: p.y, text: "" };
          model.push(item); render();
          var node = annLayer.children[annLayer.children.length - 1];
          editText(item, node);
        }
      });

      document.addEventListener("keydown", onKey, true);
      function onKey(e) {
        if (!active) return;
        if ((e.key === "Delete" || e.key === "Backspace") && selectedId && document.activeElement.tagName !== "TEXTAREA") {
          model = model.filter(function (m) { return m.id !== selectedId; });
          selectedId = null; snapshot(); render(); e.preventDefault();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { undo(); e.preventDefault(); }
        else if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { redo(); e.preventDefault(); }
        else if (e.key === "Escape") { finish(true); }
      }

      // --- toolbar wiring ---
      bar.onTool = setTool;
      bar.onUndo = undo;
      bar.onRedo = redo;
      bar.onDone = function () { finish(false); };
      bar.onCancel = function () { finish(true); };
      setTool("arrow");

      function finish(cancelled) {
        if (!active) return;
        active = false;
        document.removeEventListener("keydown", onKey, true);
        document.documentElement.style.overflow = prevOverflow;
        if (cancelled) {
          cleanup();
          resolve({ cancelled: true });
          return;
        }
        selectedId = null; render();
        var annotated = stage.toDataURL({ pixelRatio: dpr });
        var annotations = model.map(function (m) {
          if (m.type === "arrow") return { id: m.id, type: "arrow", from: [Math.round(m.x1), Math.round(m.y1)], to: [Math.round(m.x2), Math.round(m.y2)] };
          return { id: m.id, type: "text", x: Math.round(m.x), y: Math.round(m.y), text: m.text };
        });
        var buffers = window.__snapdeckBuffers || { console: [], network: [] };
        cleanup();
        resolve({
          original: imageDataUrl,
          annotated: annotations.length ? annotated : null,
          annotations: annotations,
          meta: {
            url: location.href, title: document.title,
            viewport: { w: W, h: H, dpr: dpr },
            captured_at: new Date().toISOString(),
          },
          console: (buffers.console || []).slice(),
          network: (buffers.network || []).slice(),
        });
      }
      function cleanup() { try { stage.destroy(); } catch (_) {} if (root.parentNode) root.parentNode.removeChild(root); }
    });
  }

  function drawCursor(Konva, layer, x, y) {
    // classic arrow pointer
    var pts = [0, 0, 0, 16, 4, 12, 7, 18, 9, 17, 6, 11, 11, 11];
    var poly = new Konva.Line({ points: pts.map(function (v, i) { return v + (i % 2 ? y : x); }), closed: true, fill: "#fff", stroke: "#000", strokeWidth: 1 });
    layer.add(poly); layer.draw();
  }

  function buildToolbar() {
    var el = document.createElement("div");
    el.className = "snapdeck-toolbar";
    function btn(label, title) { var b = document.createElement("button"); b.textContent = label; b.title = title || label; el.appendChild(b); return b; }
    var arrow = btn("➤ Arrow", "Draw a red arrow (drag)");
    var text = btn("T Text", "Add a text comment (click)");
    var select = btn("⤢ Select", "Select / move / resize");
    var sep1 = document.createElement("span"); sep1.className = "snapdeck-sep"; el.appendChild(sep1);
    var undo = btn("↶ Undo"); var redo = btn("↷ Redo");
    var sep2 = document.createElement("span"); sep2.className = "snapdeck-sep"; el.appendChild(sep2);
    var done = btn("✓ Done", "Save this screenshot to the report"); done.className = "snapdeck-primary";
    var cancel = btn("✕ Cancel");
    var api = {
      el: el, onTool: null, onUndo: null, onRedo: null, onDone: null, onCancel: null,
      setTool: function (t) {
        [["arrow", arrow], ["text", text], ["select", select]].forEach(function (p) {
          p[1].classList.toggle("snapdeck-active", p[0] === t);
        });
      },
      setUndo: function (canUndo, canRedo) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
    };
    arrow.onclick = function () { api.onTool && api.onTool("arrow"); };
    text.onclick = function () { api.onTool && api.onTool("text"); };
    select.onclick = function () { api.onTool && api.onTool("select"); };
    undo.onclick = function () { api.onUndo && api.onUndo(); };
    redo.onclick = function () { api.onRedo && api.onRedo(); };
    done.onclick = function () { api.onDone && api.onDone(); };
    cancel.onclick = function () { api.onCancel && api.onCancel(); };
    api.setUndo(false, false);
    return api;
  }
})();
