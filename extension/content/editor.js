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
      openEditor(msg.image, msg.model).then(sendResponse);
      return true; // async response
    }
  });

  function uid() { return "a" + Math.random().toString(36).slice(2, 9); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function openEditor(imageDataUrl, initialModel) {
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

      // --- toolbar drag + persisted position (fe-002) ---
      // Consume the pure clamp/serialize/parse helpers registered by do-001.
      var ec = window.__snapdeckEditorChrome;
      // _posConverted: true once the default translateX(-50%) centering is replaced by explicit left/top.
      var _posConverted = false;
      var _dragActive = false, _dragPtrId = null;
      var _dragStartX = 0, _dragStartY = 0, _dragBarLeft = 0, _dragBarTop = 0;

      bar.grip.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
        bar.grip.setPointerCapture(e.pointerId);
        _dragPtrId = e.pointerId;
        // First drag: convert default centering transform (translateX(-50%)) to
        // explicit fixed-viewport left/top so position arithmetic is unambiguous.
        if (!_posConverted) {
          var rect = bar.el.getBoundingClientRect();
          bar.el.style.left = rect.left + "px";
          bar.el.style.top = rect.top + "px";
          bar.el.style.transform = "none";
          _posConverted = true;
        }
        _dragActive = true;
        _dragStartX = e.clientX;
        _dragStartY = e.clientY;
        _dragBarLeft = parseFloat(bar.el.style.left) || 0;
        _dragBarTop = parseFloat(bar.el.style.top) || 0;
      });

      bar.grip.addEventListener("pointermove", function (e) {
        if (!_dragActive || e.pointerId !== _dragPtrId) return;
        e.stopPropagation();
        bar.el.style.left = (_dragBarLeft + (e.clientX - _dragStartX)) + "px";
        bar.el.style.top  = (_dragBarTop  + (e.clientY - _dragStartY)) + "px";
      });

      bar.grip.addEventListener("pointerup", function (e) {
        if (!_dragActive || e.pointerId !== _dragPtrId) return;
        e.stopPropagation();
        _dragActive = false;
        _dragPtrId = null;
        // Clamp final position to viewport, then persist.
        var finalLeft = parseFloat(bar.el.style.left) || 0;
        var finalTop  = parseFloat(bar.el.style.top)  || 0;
        var clamped = ec.clampToViewport(
          { left: finalLeft, top: finalTop },
          { vw: W, vh: H, tw: bar.el.offsetWidth, th: bar.el.offsetHeight }
        );
        bar.el.style.left = clamped.left + "px";
        bar.el.style.top  = clamped.top  + "px";
        // serializeToolbarPos returns null for non-finite inputs — safe no-op if that somehow occurs.
        var toStore = ec.serializeToolbarPos(clamped);
        if (toStore) { chrome.storage.local.set({ snapdeckEditorToolbarPos: toStore }); }
      });

      bar.grip.addEventListener("pointercancel", function () {
        // OS-level gesture interrupt (e.g. system gesture) — abort drag cleanly.
        _dragActive = false;
        _dragPtrId = null;
      });

      // Apply stored position on open (async). Trust boundary: raw value from
      // chrome.storage.local is always routed through parseStoredPos → clampToViewport
      // before any style write. On null / corrupt / non-finite → no apply; CSS default
      // centering stays. Never throws, never writes a non-numeric value to style.left/top.
      chrome.storage.local.get("snapdeckEditorToolbarPos", function (result) {
        var raw = result && result.snapdeckEditorToolbarPos;
        var pos = ec.parseStoredPos(raw); // → {left, top} | null; never throws
        if (pos) {
          var clamped = ec.clampToViewport(
            pos,
            { vw: W, vh: H, tw: bar.el.offsetWidth, th: bar.el.offsetHeight }
          );
          bar.el.style.left = clamped.left + "px";
          bar.el.style.top  = clamped.top  + "px";
          bar.el.style.transform = "none";
          _posConverted = true;
        }
      });

      // --- Konva ---
      var Konva = window.Konva;
      var stage = new Konva.Stage({ container: stageDiv, width: W, height: H });
      var bgLayer = new Konva.Layer({ listening: false });
      var annLayer = new Konva.Layer();
      var selectLayer = new Konva.Layer(); // transformer lives here; survives annLayer.destroyChildren()
      var cursorLayer = new Konva.Layer({ listening: false });
      stage.add(bgLayer); stage.add(annLayer); stage.add(selectLayer); stage.add(cursorLayer);

      // --- shared Konva.Transformer (one per session; reused by all box subtypes — contract surface #3) ---
      var transformer = new Konva.Transformer({ rotateEnabled: false });
      selectLayer.add(transformer);

      // Internal helper: w1 text-box and w2 rectangle call this instead of rolling their own transformer.
      // Signature + behavior are frozen — do not rename/reshape without a contract bump.
      function attachBoxTransformer(node, item) {
        transformer.nodes([node]);
        node.draggable(true);
        // Konva applies scaleX/scaleY during resize — bake back into width/height on commit
        node.on("transformend", function () {
          item.x      = node.x();
          item.y      = node.y();
          item.width  = Math.max(1, node.width()  * node.scaleX());
          item.height = Math.max(1, node.height() * node.scaleY());
          node.scaleX(1); node.scaleY(1);
          snapshot(); render();
        });
        node.on("dragend", function () { item.x = node.x(); item.y = node.y(); snapshot(); });
      }

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
      // deserializeModel returns [] for absent/invalid payloads — safe no-op for normal capture flow
      var model = window.__snapdeckEditorModel.deserializeModel(initialModel); // [{id,type:'arrow'|'box'|'text',...}]
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
        // Item-count cap: bound render to RENDER_ITEM_CAP to prevent DoS on oversized models
        var renderItems = model.length > RENDER_ITEM_CAP ? model.slice(0, RENDER_ITEM_CAP) : model;
        renderItems.forEach(function (item) {
          if (item.type === "arrow") renderArrow(item);
          else if (item.type === "box") renderBox(item);
          else if (item.type === "text") renderText(item);
        });
        // Detach transformer when no box is selected in select mode
        if (!(selectedId && tool === "select")) { transformer.nodes([]); }
        annLayer.draw();
        selectLayer.batchDraw();
      }

      // --- render-boundary constants and helper (fe-004: guard against oversized/malformed models) ---
      var RENDER_ITEM_CAP = 500;    // max items rendered per call
      var RENDER_TEXT_CAP = 10000;  // max chars displayed per text item
      // --- text box auto-fit constants (fe-002) ---
      var TEXT_AUTOFIT_MAX = 48;    // max font size for text box auto-fit
      var TEXT_AUTOFIT_MIN = 6;     // min font size for text box auto-fit
      var TEXT_PAD = 6;             // inset padding (px) from box outline to text
      var TEXT_FONT_FAMILY = "Arial, Helvetica, sans-serif"; // pinned for measurement stability (contrarian Finding 2)
      var TEXT_FIT_SAMPLE = 500;  // max chars fed to Konva per fit iteration (DEFECT-001: bounds per-iteration cost;
                                  // display uses full safeText — Group clip contains any overflow)
      function isFiniteNum(v) { return typeof v === "number" && isFinite(v); }

      // Auto-fit helper: find the largest integer font size in [min, cap] such that
      // textNode (set to width=innerW, wrap:"word") has wrapped height <= innerH.
      // Binary search: O(log(cap-min)) ≈ 6 iterations (vs. 42 for linear scan) — DEFECT-001 fix.
      // textNode must have text set before calling; call fitTextFontSize with the measurement
      // sample text already set on the node (not the full display text) to bound per-call cost.
      // Returns min if even min overflows innerH (Group clip contains the overflow).
      function fitTextFontSize(textNode, innerW, innerH, cap, min) {
        var lo = min, hi = cap, best = min;
        while (lo <= hi) {
          var mid = lo + Math.floor((hi - lo) / 2);
          textNode.fontSize(mid);
          if (textNode.height() <= innerH) { best = mid; lo = mid + 1; }
          else { hi = mid - 1; }
        }
        return best;
      }

      function renderArrow(item) {
        // Render-boundary guard: skip items with non-finite geometry (fe-004 malformed-item tolerance)
        if (!isFiniteNum(item.x1) || !isFiniteNum(item.y1) || !isFiniteNum(item.x2) || !isFiniteNum(item.y2)) return;
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
        // Render-boundary guard: skip non-finite or wrong-type geometry (mirrors renderBox; fe-002 extends to width/height)
        if (!isFiniteNum(item.x) || !isFiniteNum(item.y) || !isFiniteNum(item.width) || !isFiniteNum(item.height)) return;
        if (item.width <= 0 || item.height <= 0) return;
        // Cap text length before any measurement (fe-004 + auto-fit safety)
        var safeText = (typeof item.text === "string" ? item.text : " ").slice(0, RENDER_TEXT_CAP) || " ";

        // Clamp inset to positive floor (fe-002: contrarian Finding 1 + security LOW PROMOTE)
        var innerW = Math.max(1, item.width - 2 * TEXT_PAD);
        var innerH = Math.max(1, item.height - 2 * TEXT_PAD);

        // Compose: white-fill Rect + red outline + black wrapped Text in a clipped Group (fe-002)
        var group = new Konva.Group({
          x: item.x, y: item.y,
          width: item.width, height: item.height,
          clip: { x: 0, y: 0, width: item.width, height: item.height },
          // Tight draggable gate (fe-002/fe-003): unselected box mousedown selects via click, not drag
          draggable: tool === "select" && selectedId === item.id,
        });
        var bgRect = new Konva.Rect({
          x: 0, y: 0, width: item.width, height: item.height,
          fill: "#ffffff", stroke: "#e53935", strokeWidth: 2,
        });
        var textNode = new Konva.Text({
          x: TEXT_PAD, y: TEXT_PAD,
          width: innerW,
          text: safeText,
          wrap: "word",
          fill: "#111111",
          fontStyle: "normal",
          fontFamily: TEXT_FONT_FAMILY,
          listening: false,
        });

        // Auto-fit font size: short-circuit when clamped inset is below minimum (security LOW PROMOTE)
        if (innerW < TEXT_AUTOFIT_MIN || innerH < TEXT_AUTOFIT_MIN) {
          textNode.fontSize(TEXT_AUTOFIT_MIN);
        } else {
          // DEFECT-001 fix 2: bound per-iteration measurement cost for pathological long text.
          // Use a short sample for the fit loop; restore full safeText for display
          // (Group clip contains any glyph overflow — visual fidelity maintained).
          if (safeText.length > TEXT_FIT_SAMPLE) { textNode.text(safeText.slice(0, TEXT_FIT_SAMPLE)); }
          textNode.fontSize(fitTextFontSize(textNode, innerW, innerH, TEXT_AUTOFIT_MAX, TEXT_AUTOFIT_MIN));
          textNode.text(safeText); // restore full display text (no-op when text was not sampled)
        }

        group.add(bgRect);
        group.add(textNode);

        group.on("click tap", function (e) {
          e.cancelBubble = true;
          // Only re-render on selection CHANGE — if already selected, skip render() so
          // click #2 of a dblclick arrives at the same Group object (Konva 9.3.22 dblclick
          // detection compares shape refs; a render() between clicks creates a new Group
          // object, so r !== l → dblclick never fires). (bt smoke finding, 2026-06-19)
          if (tool === "select" && selectedId !== item.id) {
            selectedId = item.id;
            render();
          }
        });
        group.on("dblclick dbltap", function (e) {
          e.cancelBubble = true;
          editText(item, null); // null → box-aware path uses item.{x,y,width,height} directly
        });

        annLayer.add(group);

        // Select block (fe-003): attach the shared transformer (mirrors renderBox:185-188)
        if (selectedId === item.id && tool === "select") {
          attachBoxTransformer(group, item);
          selectLayer.batchDraw();
        }
      }

      // renderBox: box primitive (fe-001); transformer attach in select mode (fe-002); geometry guard (fe-004)
      function renderBox(item) {
        // Render-boundary guard: skip items with non-finite or wrong-type geometry (fe-004)
        if (!isFiniteNum(item.x) || !isFiniteNum(item.y) || !isFiniteNum(item.width) || !isFiniteNum(item.height)) return;
        if (item.width <= 0 || item.height <= 0) return;
        var rect = new Konva.Rect({
          x: item.x, y: item.y, width: item.width, height: item.height,
          stroke: "#1e88e5", strokeWidth: 2,
          fill: "rgba(0,0,0,0.001)", // near-transparent fill makes interior hittable for click-select
          draggable: tool === "select",
        });
        rect.on("click tap", function (e) {
          e.cancelBubble = true;
          if (tool === "select") { selectedId = item.id; render(); }
        });
        annLayer.add(rect);
        if (selectedId === item.id && tool === "select") {
          attachBoxTransformer(rect, item);
          selectLayer.batchDraw();
        }
      }

      // --- text editing via a positioned textarea ---
      function editText(item, node) {
        var ta = document.createElement("textarea");
        ta.className = "snapdeck-textedit";
        ta.value = item.text || "";
        var box;
        if (isFiniteNum(item.width) && isFiniteNum(item.height)) {
          // Box-aware: position and size the textarea to match the drawn box (fe-001)
          box = { x: item.x, y: item.y, width: item.width, height: item.height };
        } else {
          // Legacy: use node's client rect or fixed fallback (for any {x,y}-only text items)
          box = node ? node.getClientRect() : { x: item.x, y: item.y, width: 160, height: 28 };
        }
        ta.style.left   = box.x + "px";
        ta.style.top    = box.y + "px";
        ta.style.width  = box.width  + "px";
        ta.style.height = box.height + "px";
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
        if (tool === "arrow" && (e.target === stage || e.target.getLayer() === bgLayer)) {
          var p = stage.getPointerPosition();
          drawing = { id: uid(), type: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        } else if ((tool === "box" || tool === "text") && (e.target === stage || e.target.getLayer() === bgLayer)) {
          var p = stage.getPointerPosition();
          // Shared box-shaped draw branch: _x0/_y0 drag origin for top-left normalization (fe-001)
          drawing = { id: uid(), type: tool, _x0: p.x, _y0: p.y, x: p.x, y: p.y, width: 0, height: 0 };
        } else if (tool === "select" && (e.target === stage || e.target.getLayer() === bgLayer)) {
          selectedId = null; render();
        }
      });
      stage.on("mousemove touchmove", function () {
        if (!drawing) return;
        var p = stage.getPointerPosition();
        if (drawing.type === "arrow") {
          drawing.x2 = p.x; drawing.y2 = p.y;
          var tmp = annLayer.findOne(".__drawing");
          if (tmp) tmp.points([drawing.x1, drawing.y1, drawing.x2, drawing.y2]);
          else { var a = new Konva.Arrow({ name: "__drawing", points: [drawing.x1, drawing.y1, drawing.x2, drawing.y2], stroke: "#e53935", fill: "#e53935", strokeWidth: 3, pointerLength: 12, pointerWidth: 12 }); annLayer.add(a); }
        } else if (drawing.type === "box" || drawing.type === "text") {
          // Shared box-shaped draw: normalize to top-left origin on every move (fe-001)
          drawing.x = Math.min(drawing._x0, p.x); drawing.y = Math.min(drawing._y0, p.y);
          drawing.width = Math.abs(p.x - drawing._x0); drawing.height = Math.abs(p.y - drawing._y0);
          var previewName = drawing.type === "text" ? "__textdrawing" : "__boxdrawing";
          var previewStroke = drawing.type === "text" ? "#e53935" : "#1e88e5";
          var tmp = annLayer.findOne("." + previewName);
          if (tmp) { tmp.x(drawing.x); tmp.y(drawing.y); tmp.width(drawing.width); tmp.height(drawing.height); }
          else { annLayer.add(new Konva.Rect({ name: previewName, x: drawing.x, y: drawing.y, width: drawing.width, height: drawing.height, stroke: previewStroke, strokeWidth: 2, fill: "rgba(0,0,0,0.001)", dash: [4, 4] })); }
        }
        annLayer.batchDraw();
      });
      stage.on("mouseup touchend", function () {
        if (!drawing) return;
        if (drawing.type === "arrow") {
          var dx = drawing.x2 - drawing.x1, dy = drawing.y2 - drawing.y1;
          if (Math.hypot(dx, dy) > 8) { model.push(drawing); snapshot(); }
        } else if (drawing.type === "box") {
          // Sub-threshold reject: mirrors arrow's >8 guard; require >4 in each dimension (fe-001)
          if (drawing.width > 4 && drawing.height > 4) {
            model.push({ id: drawing.id, type: "box", x: drawing.x, y: drawing.y, width: drawing.width, height: drawing.height });
            snapshot();
          }
        } else if (drawing.type === "text") {
          // Sub-threshold reject: same >4 guard (fe-001); do NOT snapshot — editText commit does it
          if (drawing.width > 4 && drawing.height > 4) {
            var newText = { id: drawing.id, type: "text", x: drawing.x, y: drawing.y, width: drawing.width, height: drawing.height, text: "" };
            model.push(newText);
            editText(newText, null); // null → box-aware path; snapshot deferred to editText commit
          }
        }
        drawing = null; render();
      });
      // Note: the old stage.on("click tap") text-placement handler was removed (fe-001).
      // Text is now drag-to-draw via the mousedown/mousemove/mouseup path above.

      document.addEventListener("keydown", onKey, true);
      function onKey(e) {
        if (!active) return;
        if ((e.key === "Delete" || e.key === "Backspace") && selectedId && document.activeElement.tagName !== "TEXTAREA") {
          model = model.filter(function (m) { return m.id !== selectedId; });
          selectedId = null; snapshot(); render(); e.preventDefault();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { undo(); e.preventDefault(); }
        else if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { redo(); e.preventDefault(); }
        else if (e.key === "Escape") { if (selectedId) { selectedId = null; render(); } else { finish(true); } }
      }

      // --- toolbar wiring ---
      bar.onTool = setTool;
      bar.onUndo = undo;
      bar.onRedo = redo;
      bar.onDone = function () { finish(false); };
      bar.onCancel = function () { finish(true); };
      // Visibility toggle (fe-003): pure view state — never in model / past / future.
      var annShown = true;
      bar.onToggleVisibility = function () {
        annShown = ec.nextVisibility(annShown);
        var v = ec.layerVisibility(annShown);
        annLayer.visible(v.annVisible);
        selectLayer.visible(v.selectVisible);
        cursorLayer.visible(v.annVisible); // cursor tracks annVisible: PO arbitration (truly-raw view)
        annLayer.batchDraw(); selectLayer.batchDraw(); cursorLayer.batchDraw();
        bar.setVisibility(annShown);
        // No snapshot(), no model mutation, no render() — toggling adds NO undo/redo step.
      };
      bar.setVisibility(true); // init button state to "shown"
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
        // Export guard (fe-003): restore all 3 overlay layers before rasterizing so
        // Done-while-hidden exports an annotated PNG byte-identical to the never-toggled path.
        // In the common (never-toggled) path this is a no-op (layers already visible).
        // Cancel branch returns before this line (editor.js:374-378), so guard is Done-path only.
        annLayer.visible(true); selectLayer.visible(true); cursorLayer.visible(true);
        var annotated = stage.toDataURL({ pixelRatio: dpr });
        // Use the pure module (fe-003): byte-frozen lossy projection + lossless model (additive field)
        var em = window.__snapdeckEditorModel;
        var annotations = em.projectAnnotations(model);    // box excluded; arrow/text byte-frozen
        var losslessModel = em.serializeModel(model);      // {version:1, items:[…]} deep clone
        var buffers = window.__snapdeckBuffers || { console: [], network: [] };
        cleanup();
        resolve({
          original: imageDataUrl,
          annotated: losslessModel.items.length ? annotated : null, // widened gate: includes box-only (fe-003)
          annotations: annotations,
          model: losslessModel,
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
    // Grab handle — first child (fe-002); CSS-painted grip dots, pointer-capture drag target.
    // No emoji / symbol-icon char / inline SVG — affordance is CSS radial-gradient dots.
    var grip = document.createElement("div");
    grip.className = "snapdeck-grip";
    grip.setAttribute("aria-label", "Drag to move toolbar");
    grip.title = "Drag to move the toolbar";
    el.appendChild(grip);
    var arrow = btn("➤ Arrow", "Draw a red arrow (drag)");
    var text = btn("T Text", "Add a text comment (drag a box)");
    var box = btn("Box", "Draw a box (drag)"); // plain-text label per fe-001 (no emoji/inline SVG)
    var select = btn("⤢ Select", "Select / move / resize");
    var sepVis = document.createElement("span"); sepVis.className = "snapdeck-sep"; el.appendChild(sepVis);
    // Visibility toggle — plain-text "Hide"/"Show" label; no emoji / symbol-icon / inline SVG (fe-003).
    var toggle = btn("Hide", "Hide the annotation layer");
    var sep1 = document.createElement("span"); sep1.className = "snapdeck-sep"; el.appendChild(sep1);
    var undo = btn("↶ Undo"); var redo = btn("↷ Redo");
    var sep2 = document.createElement("span"); sep2.className = "snapdeck-sep"; el.appendChild(sep2);
    var done = btn("✓ Done", "Save this screenshot to the report"); done.className = "snapdeck-primary";
    var cancel = btn("✕ Cancel");
    var api = {
      el: el, grip: grip, onTool: null, onUndo: null, onRedo: null, onDone: null, onCancel: null,
      onToggleVisibility: null,
      setTool: function (t) {
        [["arrow", arrow], ["text", text], ["box", box], ["select", select]].forEach(function (p) {
          p[1].classList.toggle("snapdeck-active", p[0] === t);
        });
      },
      setUndo: function (canUndo, canRedo) { undo.disabled = !canUndo; redo.disabled = !canRedo; },
      // shown=true → label "Hide" (active state off); shown=false → label "Show" (active state on)
      setVisibility: function (shown) {
        toggle.textContent = shown ? "Hide" : "Show";
        toggle.title = shown ? "Hide the annotation layer" : "Show the annotation layer";
        toggle.classList.toggle("snapdeck-active", !shown);
      },
    };
    arrow.onclick = function () { api.onTool && api.onTool("arrow"); };
    text.onclick = function () { api.onTool && api.onTool("text"); };
    box.onclick = function () { api.onTool && api.onTool("box"); };
    select.onclick = function () { api.onTool && api.onTool("select"); };
    undo.onclick = function () { api.onUndo && api.onUndo(); };
    redo.onclick = function () { api.onRedo && api.onRedo(); };
    done.onclick = function () { api.onDone && api.onDone(); };
    cancel.onclick = function () { api.onCancel && api.onCancel(); };
    toggle.onclick = function () { api.onToggleVisibility && api.onToggleVisibility(); };
    api.setUndo(false, false);
    return api;
  }
})();
