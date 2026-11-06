/* Page drawings that draw themselves as you scroll (Kino's sketches 3, 4 and 5; 2026-11-05).
   Everything here is driven by a page's own rest progress (holdT, 0..1) through __blend.onFrame,
   so it runs backwards when you scroll back. With reduced motion everything shows complete.
   - Drafting (#work): construction lines shoot past their ends and get trimmed back, the walls arrive
     out of order, the roof is pitched up from the wall line, dimension ticks come and go, the dashed
     link travels from plan to elevation, the labels type themselves. Every stroke ends where it always was.
     The tags are a ledger: each orange rule draws out and sets its words to the right.
   - The Pitch (#work-2): Kino's stage drawing. The screen and stage are sketched in with overshooting
     strokes, the five of us arrive one by one, the presenter's arm lifts as a line rises on the screen. */
(function () {
  "use strict";
  var B = window.__blend;
  if (!B || !B.onFrame) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";
  var root = document.documentElement;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(v, a, b) { return clamp01((v - a) / (b - a)); }
  function easeIO(v) { return v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2; }
  function easeOut(v) { return 1 - Math.pow(1 - v, 3); }
  function easeBack(v) { var c = 1.25; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); }
  function lerp(a, b, e) { return a + (b - a) * e; }
  function mk(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  /* ---------- strokes: any element with data-w="a b" is drawn over that share of the page's rest ---------- */
  function strokes(svg) {
    return Array.prototype.map.call(svg.querySelectorAll("[data-w]"), function (el) {
      var w = el.getAttribute("data-w").split(" ").map(parseFloat);
      return { el: el, a: w[0], b: w[1], rev: el.hasAttribute("data-rev"), len: 0, last: -1 };
    });
  }
  function measure(list) {
    list.forEach(function (s) {
      s.len = s.el.getTotalLength ? s.el.getTotalLength() : 0;
      // one dash as long as the stroke, then a gap longer than it: nothing shows until the dash slides in
      s.el.style.strokeDasharray = s.len.toFixed(2) + " " + (s.len + 10).toFixed(2);
      s.last = -1;
    });
  }
  function drawStroke(s, e) {
    if (e === s.last) return;
    s.last = e;
    var off = (s.len + 5) * (1 - e);
    s.el.style.strokeDashoffset = (s.rev ? -off : off).toFixed(2);
    s.el.style.visibility = e > 0 ? "" : "hidden";
  }
  function drawStrokes(list, t) {
    for (var i = 0; i < list.length; i++) drawStroke(list[i], easeIO(seg(t, list[i].a, list[i].b)));
  }
  // strokes keep a steady weight on screen whatever size their drawing is shown at
  function setWeight(svg, vbW, vbH) {
    var w = svg.clientWidth, h = svg.clientHeight;
    if (!w) return;
    var k = vbH && h ? Math.min(w / vbW, h / vbH) : w / vbW;
    svg.style.setProperty("--k", (1 / k).toFixed(3));
  }

  var pages = [];   // { el, paint(t), layout(), last }

  /* ---------- Drafting ---------- */
  var work = document.getElementById("work");
  var ill = document.getElementById("draftIll");
  if (work && ill) (function () {
    var list = strokes(ill);
    // construction lines: [shot out to (overshoot), trimmed back to (the real extent), when they shoot]
    var G = [
      [[6, 300, 894, 300], [40, 300, 880, 300], 0, .1],
      [[480, 40, 6, 40], [460, 40, 40, 40], .02, .1],
      [[6, 170, 480, 170], [40, 170, 460, 170], .05, .13],
      [[894, 150, 520, 150], [830, 150, 580, 150], .04, .12],
      [[40, 334, 40, 6], [40, 300, 40, 40], .03, .11],
      [[460, 6, 460, 334], [460, 40, 460, 300], .06, .13],
      [[580, 334, 580, 110], [580, 300, 580, 150], .07, .14],
      [[830, 110, 830, 334], [830, 150, 830, 300], .08, .15],
      [[705, 318, 705, 24], [705, 150, 705, 60], .1, .18]
    ];
    var gg = mk("g", { "class": "guides" });
    ill.insertBefore(gg, ill.firstChild);
    var guides = G.map(function (g, i) { return { g: g, i: i, el: mk("line", {}, gg) }; });
    // dimension lines with their 45-degree ticks: drawn in, then gone again before the end
    var dims = [
      { d: "M 35 21 L 45 11 M 40 16 L 460 16 M 455 21 L 465 11", a: .19, b: .31, out: .5 },
      { d: "M 857 155 L 867 145 M 862 150 L 862 300 M 857 305 L 867 295", a: .26, b: .36, out: .53 }
    ].map(function (o) {
      var el = mk("path", { "class": "dimln", d: o.d }, ill);
      return { s: { el: el, a: o.a, b: o.b, rev: false, len: 0, last: -1 }, out: o.out };
    });
    var dimStrokes = dims.map(function (o) { return o.s; });
    // the roof: drawn flat along the wall top, then pitched up
    var roof = document.getElementById("draftRoof");
    var roofS = { el: roof, a: .25, b: .31, rev: false, len: 280, last: -1 };
    // the labels type themselves
    var labels = Array.prototype.map.call(ill.querySelectorAll("[data-type]"), function (el) {
      var w = el.getAttribute("data-type").split(" ").map(parseFloat);
      return { el: el, text: el.textContent, a: w[0], b: w[1], last: -1 };
    });
    // the dashed link travels from the plan to the elevation, a dot at its head
    var link = document.getElementById("draftLink"), linkLen = 0, linkLast = -1;
    var head = mk("circle", { "class": "lhead", r: 4 }, ill);
    // the tags ledger
    var tagItems = Array.prototype.map.call(work.querySelectorAll(".tags-big li"), function (li, i) {
      return { line: li.querySelector(".tg-line"), word: li.querySelector(".tg-word"), a: .06 + i * .085, b: .36 + i * .085, w: 0, min: 0, last: -1 };
    });
    var frame = work.querySelector(".frame");

    // fit the frame: as big as the page allows, beside the title (full height) or above it (title runs under it)
    function fitFrame() {
      var VW = root.clientWidth;
      ["--fw", "--fch", "--fgap", "--fmt"].forEach(function (v) { work.style.removeProperty(v); });
      if (VW <= 860) return;
      var cs = getComputedStyle(work);
      var inner = work.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var gap = parseFloat(cs.columnGap) || 0;
      var fcs = getComputedStyle(frame);
      var side = parseFloat(fcs.marginRight) || 0, mt = parseFloat(fcs.marginTop) || 0;
      var title = work.querySelector(".proj-name"), projNo = work.querySelector(".proj-no");
      var top = projNo.offsetTop + mt;
      var bottom = work.clientHeight - parseFloat(cs.paddingBottom);
      title.style.width = "max-content";
      var titleW = title.offsetWidth;   // the word itself, not its column
      title.style.width = "";
      var titleTop = title.offsetTop;
      // the ledger needs its longest words plus a short rule
      var fs = parseFloat(getComputedStyle(work.querySelector(".tags-big")).fontSize);
      var tagsW = 0;
      tagItems.forEach(function (it) { tagsW = Math.max(tagsW, it.word.offsetWidth + fs * 1.4); });
      var colMin = tagsW;
      function heightAt(w) { work.style.setProperty("--fw", w + "px"); return frame.offsetHeight; }
      function largest(maxW, maxH) {
        var lo = 280, hi = Math.floor(maxW);
        if (hi < lo) return lo;
        if (heightAt(hi) <= maxH) return hi;
        for (var n = 0; n < 12 && hi - lo > 2; n++) { var m = (lo + hi) / 2; if (heightAt(m) <= maxH) lo = m; else hi = m; }
        return Math.floor(lo);
      }
      // above the title the frame starts a little higher (12px, the label still clears the rule) and ends 14px over the title
      var mtA = Math.min(mt, 12), topA = projNo.offsetTop + mtA;
      function fit(s, g) {
        var b = largest(inner - g - s - Math.max(titleW, colMin), bottom - top);
        var a = largest(inner - g - s - colMin, titleTop - 14 - topA);
        return a > b ? { w: a, above: true } : { w: b, above: false };
      }
      var r = fit(side, gap);
      // where the room beside it is what stops the frame (Kino wants it bigger), its right margin (to 24px)
      // and the column gap (to 32px) give way
      var sMin = Math.min(side, 24), gMin = Math.min(gap, 32), r2 = fit(sMin, gMin);
      if (r2.w > r.w + 8) {
        var need = r2.w - r.w, ds = Math.min(need, side - sMin), dg = Math.min(need - ds, gap - gMin);
        work.style.setProperty("--fch", (side - ds).toFixed(1) + "px");
        work.style.setProperty("--fgap", (gap - dg).toFixed(1) + "px");
        r = r2;
      }
      if (r.above) work.style.setProperty("--fmt", mtA + "px");
      work.style.setProperty("--fw", r.w + "px");
    }

    function layout() {
      fitFrame();
      measure(list); measure(dimStrokes);
      linkLen = link.getTotalLength(); linkLast = -1;
      setWeight(ill, 900);
      tagItems.forEach(function (it) {
        it.line.style.transform = ""; it.word.style.transform = "";
        it.w = it.line.offsetWidth;
        it.min = parseFloat(getComputedStyle(it.word).fontSize) * .6;
        it.last = -1;
      });
      roofS.last = -1;
      labels.forEach(function (l) { l.last = -1; });
    }

    function paint(t) {
      drawStrokes(list, t);
      // construction lines: shoot out, get trimmed back to the real extent, fade away
      guides.forEach(function (o) {
        var g = o.g, a = g[0], b = g[1];
        var e1 = easeOut(seg(t, g[2], g[3]));
        var e2 = easeIO(seg(t, .4 + o.i * .012, .54 + o.i * .012));
        var x1 = lerp(a[0], b[0], e2), y1 = lerp(a[1], b[1], e2);
        var x2 = lerp(a[2], b[2], e2), y2 = lerp(a[3], b[3], e2);
        // while shooting, the far end runs out from the start
        x2 = lerp(x1, x2, e1); y2 = lerp(y1, y2, e1);
        o.el.setAttribute("x1", x1.toFixed(1)); o.el.setAttribute("y1", y1.toFixed(1));
        o.el.setAttribute("x2", x2.toFixed(1)); o.el.setAttribute("y2", y2.toFixed(1));
        var op = e1 > 0 ? 1 - seg(t, .5 + o.i * .01, .64 + o.i * .01) : 0;
        o.el.style.opacity = op ? (op * .34).toFixed(3) : "0";
      });
      dims.forEach(function (o) {
        drawStroke(o.s, easeIO(seg(t, o.s.a, o.s.b)));
        o.s.el.style.opacity = (1 - seg(t, o.out, o.out + .13)).toFixed(3);
      });
      // the roof: flat along the wall top first, then pitched up to its ridge
      var ef = easeIO(seg(t, roofS.a, roofS.b)), ep = seg(t, .31, .43);
      if (ep <= 0) {
        roof.setAttribute("d", "M565 150 L705 150 L845 150");
        roofS.len = 280; roof.style.strokeDasharray = "280 290";
        drawStroke(roofS, ef);
      } else {
        var ry = 150 - 90 * easeBack(ep);
        roof.setAttribute("d", ep >= 1 ? "M565 150 L705 60 L845 150" : "M565 150 L705 " + ry.toFixed(1) + " L845 150");
        roof.style.strokeDasharray = ""; roof.style.strokeDashoffset = ""; roof.style.visibility = ""; roofS.last = -1;
      }
      labels.forEach(function (l) {
        var n = Math.round(l.text.length * seg(t, l.a, l.b));
        if (n !== l.last) { l.last = n; l.el.textContent = l.text.slice(0, n); }
      });
      // the link: its dashes appear one after another from the plan to the elevation
      var el = easeIO(seg(t, .56, .7));
      if (el !== linkLast) {
        linkLast = el;
        if (el >= 1) { link.style.strokeDasharray = ""; link.style.visibility = ""; head.style.opacity = 0; }
        else if (el <= 0) { link.style.visibility = "hidden"; head.style.opacity = 0; }
        else {
          var drawn = linkLen * el, arr = [], s = 0;
          while (s < drawn) { arr.push(Math.min(5, drawn - s), 6); s += 11; }
          arr[arr.length - 1] = linkLen + 20;
          link.style.strokeDasharray = arr.map(function (v) { return v.toFixed(2); }).join(" ");
          link.style.visibility = "";
          var hp = link.getPointAtLength(drawn);
          head.setAttribute("cx", hp.x.toFixed(1)); head.setAttribute("cy", hp.y.toFixed(1));
          head.style.opacity = 1;
        }
      }
      // the ledger: each rule draws out from the left and carries its words across; the words settle from grey to ink
      tagItems.forEach(function (it) {
        var e = easeIO(seg(t, it.a, it.b));
        if (e === it.last || !it.w) return;
        it.last = e;
        var shift = Math.max(0, it.w - it.min);
        it.line.style.transform = "scaleX(" + ((it.min + shift * e) / it.w).toFixed(4) + ")";
        it.word.style.transform = e >= 1 ? "" : "translateX(" + (-shift * (1 - e)).toFixed(1) + "px)";
        // #5C5952 (grey, measured over 4.5:1 on the tinted paper) to #0B0B0C (ink)
        it.word.style.color = e >= 1 ? "" : "rgb(" + Math.round(lerp(92, 11, e)) + "," + Math.round(lerp(89, 11, e)) + "," + Math.round(lerp(82, 12, e)) + ")";
      });
    }
    pages.push({ el: work, paint: paint, layout: layout, last: -1 });
  })();

  /* ---------- The Pitch ---------- */
  var pitch = document.getElementById("work-2");
  var stage = document.getElementById("pitchStage");
  if (pitch && stage) (function () {
    var list = strokes(stage);
    var arm = document.getElementById("pitchArm");
    // the presenter's arm: shoulder, upper arm, forearm; it rests on the lectern, then lifts towards the screen
    var S = [381, 152], L1 = 34, L2 = 32;
    function armAt(e) {
      var a1 = lerp(62, -38, e) * Math.PI / 180, a2 = lerp(92, -64, e) * Math.PI / 180;
      var ex = S[0] + L1 * Math.cos(a1), ey = S[1] + L1 * Math.sin(a1);
      var hx = ex + L2 * Math.cos(a2), hy = ey + L2 * Math.sin(a2);
      return "M " + S[0] + " " + S[1] + " L " + ex.toFixed(1) + " " + ey.toFixed(1) + " L " + hx.toFixed(1) + " " + hy.toFixed(1);
    }
    var armEnd = arm.getAttribute("d"), armLast = -1;
    function layout() { measure(list); setWeight(stage, 760, 440); armLast = -1; }
    function paint(t) {
      drawStrokes(list, t);
      var e = seg(t, .6, .7);
      if (e !== armLast) { armLast = e; arm.setAttribute("d", e >= 1 ? armEnd : armAt(easeBack(e))); }
    }
    pages.push({ el: pitch, paint: paint, layout: layout, last: -1 });
  })();

  /* ---------- wiring ---------- */
  B.onLayout(function () {
    pages.forEach(function (p) { p.layout(); p.last = -1; });
  });
  B.onFrame(function (f) {
    pages.forEach(function (p) {
      var i = f.panels.indexOf(p.el);
      var t = reduce ? 1 : f.holdT(i);
      if (t === p.last) return;
      p.last = t;
      p.paint(t);
    });
  });
})();
