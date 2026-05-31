// capture.js — runs in the PAGE's MAIN world (document_start) so it can wrap the
// page's own console / fetch / XHR and observe uncaught errors. Buffered events
// are posted to the isolated-world bridge via window.postMessage; no DevTools
// debugger attach (so no "is being debugged" banner).

(function () {
  "use strict";
  if (window.__snapdeckCaptureInstalled) return;
  window.__snapdeckCaptureInstalled = true;

  function post(kind, data) {
    try {
      window.postMessage({ __snapdeck: true, kind: kind, data: data }, "*");
    } catch (_) { /* ignore */ }
  }
  function ts() { return new Date().toISOString(); }

  // --- console.error / console.warn ---
  ["error", "warn"].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      try {
        var parts = Array.prototype.map.call(arguments, function (a) {
          if (a instanceof Error) return a.message;
          if (typeof a === "object") { try { return JSON.stringify(a); } catch (_) { return String(a); } }
          return String(a);
        });
        var stack = null;
        for (var i = 0; i < arguments.length; i++) {
          if (arguments[i] instanceof Error) { stack = arguments[i].stack; break; }
        }
        post("console", { level: level, message: parts.join(" "), stack: stack, ts: ts() });
      } catch (_) { /* ignore */ }
      return orig.apply(console, arguments);
    };
  });

  // --- uncaught errors + promise rejections ---
  window.addEventListener("error", function (e) {
    post("console", {
      level: "error",
      message: e.message || String(e.error || "uncaught error"),
      stack: e.error && e.error.stack ? e.error.stack : null,
      ts: ts()
    });
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    post("console", {
      level: "error",
      message: "Unhandled rejection: " + (r && r.message ? r.message : String(r)),
      stack: r && r.stack ? r.stack : null,
      ts: ts()
    });
  });

  // --- fetch ---
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var method = (init && init.method) || (input && input.method) || "GET";
      var url = typeof input === "string" ? input : (input && input.url) || "";
      return origFetch.apply(this, arguments).then(function (res) {
        if (!res.ok) post("network", { method: method, url: url, status: res.status, ts: ts() });
        return res;
      }).catch(function (err) {
        post("network", { method: method, url: url, status: 0, error: String(err), ts: ts() });
        throw err;
      });
    };
  }

  // --- XMLHttpRequest ---
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__snapdeck = { method: method, url: url };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var self = this;
    this.addEventListener("load", function () {
      if (self.status >= 400 && self.__snapdeck) {
        post("network", { method: self.__snapdeck.method, url: self.__snapdeck.url, status: self.status, ts: ts() });
      }
    });
    this.addEventListener("error", function () {
      if (self.__snapdeck) {
        post("network", { method: self.__snapdeck.method, url: self.__snapdeck.url, status: 0, error: "network error", ts: ts() });
      }
    });
    return origSend.apply(this, arguments);
  };
})();
