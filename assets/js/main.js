/* Portfolio interactions: image lightbox, comparison slider, research chart.
   Everything degrades gracefully: without JavaScript the images, the static
   comparison and the data table remain available. */
(function () {
  "use strict";

  // Lightbox ----------------------------------------------------------------
  var dialog = document.querySelector(".lightbox");
  if (dialog && typeof dialog.showModal === "function") {
    var big = dialog.querySelector("img");
    var cap = dialog.querySelector(".lightbox-caption");
    document.querySelectorAll("img[data-zoom]").forEach(function (img) {
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "Enlarge image: " + img.alt);
      function open() {
        big.src = img.dataset.zoom;
        big.alt = img.alt;
        var fig = img.closest("figure");
        var fc = fig && fig.querySelector("figcaption");
        cap.textContent = fc ? fc.textContent : img.alt;
        dialog.showModal();
      }
      img.addEventListener("click", open);
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  }

  // Comparison slider ----------------------------------------------------------
  document.querySelectorAll("[data-compare]").forEach(function (box) {
    var frame = box.querySelector(".compare-frame");
    var range = box.querySelector("input[type=range]");
    function set(v) { frame.style.setProperty("--pos", v + "%"); range.value = v; }
    range.addEventListener("input", function () { set(range.value); });
    function fromPointer(e) {
      var r = frame.getBoundingClientRect();
      set(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)).toFixed(1));
    }
    var dragging = false;
    frame.addEventListener("pointerdown", function (e) { dragging = true; frame.setPointerCapture(e.pointerId); fromPointer(e); });
    frame.addEventListener("pointermove", function (e) { if (dragging) fromPointer(e); });
    frame.addEventListener("pointerup", function () { dragging = false; });
    frame.style.touchAction = "pan-y";
  });

  // Research scatter chart -------------------------------------------------------
  var holder = document.querySelector("[data-research-chart]");
  var dataEl = document.getElementById("research-data");
  if (holder && dataEl) {
    var data = JSON.parse(dataEl.textContent);
    var NS = "http://www.w3.org/2000/svg";
    var W = 560, H = 330, M = { l: 58, r: 16, t: 14, b: 46 };
    var tip = document.createElement("p");
    tip.className = "scatter-tip";
    tip.setAttribute("aria-live", "polite");
    tip.textContent = "Select a point to see its values.";

    function el(name, attrs, text) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text !== undefined) n.textContent = text;
      return n;
    }
    function ticks(min, max, n) {
      var step = (max - min) / n, out = [];
      for (var i = 0; i <= n; i++) out.push(min + step * i);
      return out;
    }
    function fmt(v) { return Math.abs(v) >= 100 ? Math.round(v) : (Math.round(v * 100) / 100); }

    function draw(key) {
      var ind = data.indicators.filter(function (d) { return d.key === key; })[0];
      var xs = data.cases.map(function (c) { return c[key]; });
      var ys = data.cases.map(function (c) { return c.irradiation; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var pad = (x1 - x0) * 0.08 || 1; x0 -= pad; x1 += pad;
      var y0 = 700, y1 = 1200;
      var sx = function (v) { return M.l + (v - x0) / (x1 - x0) * (W - M.l - M.r); };
      var sy = function (v) { return H - M.b - (v - y0) / (y1 - y0) * (H - M.t - M.b); };
      var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
        "aria-label": "Scatter plot of " + ind.label + " against annual solar irradiation for 16 urban forms" });
      ticks(y0, y1, 5).forEach(function (t) {
        svg.appendChild(el("line", { x1: M.l, x2: W - M.r, y1: sy(t), y2: sy(t), class: "ax" }));
        svg.appendChild(el("text", { x: M.l - 8, y: sy(t) + 4, "text-anchor": "end", class: "ax-text" }, Math.round(t)));
      });
      ticks(x0, x1, 4).forEach(function (t) {
        svg.appendChild(el("text", { x: sx(t), y: H - M.b + 18, "text-anchor": "middle", class: "ax-text" }, fmt(t)));
      });
      svg.appendChild(el("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", class: "ax-title" }, ind.label));
      svg.appendChild(el("text", { x: 12, y: (M.t + H - M.b) / 2, "text-anchor": "middle", class: "ax-title",
        transform: "rotate(-90 12 " + (M.t + H - M.b) / 2 + ")" }, "Irradiation (kWh/m²)"));
      data.cases.forEach(function (c) {
        var cx = sx(c[key]), cy = sy(c.irradiation);
        var pt = el("circle", { cx: cx, cy: cy, r: 7, class: "pt", tabindex: 0,
          "aria-label": "Urban form " + c.id + ": " + ind.label + " " + c[key] + ", irradiation " + c.irradiation + " kWh/m²" });
        function show() {
          tip.textContent = "Urban form " + c.id + " — " + ind.label + ": " + c[key] +
            " · annual irradiation: " + c.irradiation + " kWh/m² · plot ratio " + c.plot_ratio +
            "%, site coverage " + c.site_coverage + "%, average height " + c.avg_height + " m, sky view factor " + c.svf;
        }
        pt.addEventListener("mouseenter", show); pt.addEventListener("focus", show); pt.addEventListener("click", show);
        svg.appendChild(pt);
        svg.appendChild(el("text", { x: cx + 9, y: cy - 7, class: "pt-label" }, c.id));
      });
      holder.innerHTML = "";
      holder.appendChild(svg);
      holder.appendChild(tip);
    }

    var buttons = document.querySelectorAll(".chart-buttons button");
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        buttons.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        draw(b.dataset.key);
      });
    });
    draw(data.indicators[0].key);
  }
})();
