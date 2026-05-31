// bridge.js — isolated world. Buffers the console/network events posted by the
// MAIN-world capture script, and tracks the last mouse position so the editor
// can draw a synthetic cursor on the captured frame.

(function () {
  "use strict";
  if (window.__snapdeckBridgeInstalled) return;
  window.__snapdeckBridgeInstalled = true;

  var MAX = 200;
  window.__snapdeckBuffers = { console: [], network: [] };
  window.__snapdeckLastMouse = { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };

  window.addEventListener("message", function (e) {
    if (e.source !== window) return;
    var m = e.data;
    if (!m || m.__snapdeck !== true) return;
    var buf = m.kind === "network" ? window.__snapdeckBuffers.network : window.__snapdeckBuffers.console;
    buf.push(m.data);
    if (buf.length > MAX) buf.shift();
  });

  document.addEventListener("mousemove", function (e) {
    window.__snapdeckLastMouse = { x: e.clientX, y: e.clientY };
  }, { passive: true, capture: true });
})();
