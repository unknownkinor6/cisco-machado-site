(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---- live clock: London time ---- */
  var clock = document.getElementById("clock");
  function tick() {
    try {
      clock.textContent = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/London"
      }).format(new Date());
    } catch (e) { clock.textContent = ""; }
  }
  tick(); setInterval(tick, 15000);

  /* ---- intro signature, drawn by the scroll ----
     One pen stroke: left line, then each letter in turn, then the right line.
     The drawing eases toward the scroll position, so it moves smoothly both ways. */
  var intro = document.getElementById("intro");
  var hero = document.getElementById("heroTitle");
  var nameEl = document.getElementById("introName");
  var lineL = document.getElementById("introLineL");
  var lineR = document.getElementById("introLineR");
  var hint = document.getElementById("introHint");
  var DASH = 1400; // matches .intro-name tspan in style.css

  // split the name into one tspan per letter, so each can be drawn in turn
  var word = nameEl.textContent;
  nameEl.textContent = "";
  var letters = [];
  for (var c = 0; c < word.length; c++) {
    var t = document.createElementNS(SVGNS, "tspan");
    t.textContent = word[c];
    nameEl.appendChild(t);
    if (word[c] !== " ") letters.push(t);
  }

  var linesSvg = document.getElementById("introLines");
  var nameSvg = document.getElementById("introSvg");
  var heroIn = document.getElementById("heroIn");
  var lenL = 0, lenR = 0;
  function fitLines() {
    // Screen-sized paths, worked out from where the name and the thread's start actually sit.
    // Left: hooks in from the edge, runs down the margin, curves (with a slight dip) into the name.
    // Right: leaves the name, curves down the right margin to the bottom, where the page thread takes over.
    try {
      var st = linesSvg.getBoundingClientRect();
      var W = st.width, H = st.height;
      linesSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var sv = nameSvg.getBoundingClientRect(), k = sv.width / 1200;
      var b = nameEl.getBBox();
      var x0 = sv.left - st.left + b.x * k - 6;
      var x1 = sv.left - st.left + (b.x + b.width) * k + 6;
      var yb = sv.top - st.top + 188 * k;               // just above the baseline, as before
      var hi = heroIn.getBoundingClientRect();
      var xR = hi.left + hi.width / 2 - st.left;        // same x the thread starts from
      if (!(xR > x1 + 8 && xR < W)) xR = W - Math.max(32, W * .05);
      var xL = W - xR;
      var r = Math.max(6, Math.min(80, (x0 - xL) * .6, (xR - x1) * .6, yb * .25));
      var dip = Math.min(14, r * .2);
      var yT = Math.min(Math.max(96, H * .16), yb - 2 * r - 20); // top of the hook, below the bar
      var h = Math.min(xL * .9, 60);                             // size of the hook
      lineL.setAttribute("d",
        "M -8 " + (yT + h * .8) +
        " C " + (xL - h * .5) + " " + (yT - h * .1) + " " + xL + " " + (yT - h * .15) + " " + xL + " " + (yT + h * .45) +
        " L " + xL + " " + (yb - r) +
        " C " + xL + " " + (yb + dip * .6) + " " + (xL + r * .45) + " " + (yb + dip) + " " + (xL + r) + " " + (yb + dip) +
        " C " + (xL + r + (x0 - xL - r) * .45) + " " + (yb + dip) + " " + (x0 - (x0 - xL - r) * .3) + " " + yb + " " + x0 + " " + yb);
      lineR.setAttribute("d",
        "M " + x1 + " " + yb +
        " C " + (x1 + (xR - x1 - r) * .3) + " " + yb + " " + (xR - r - (xR - x1 - r) * .45) + " " + (yb + dip) + " " + (xR - r) + " " + (yb + dip) +
        " C " + (xR - r * .45) + " " + (yb + dip) + " " + xR + " " + (yb + dip * .6) + " " + xR + " " + (yb + r) +
        " L " + xR + " " + (H + 4));
    } catch (e) {}
    lenL = lineL.getTotalLength(); lenR = lineR.getTotalLength();
    lineL.style.strokeDasharray = lenL; lineR.style.strokeDasharray = lenR;
    paint(shown);
  }

  function seg(v, a, b) { return Math.max(0, Math.min(1, (v - a) / (b - a))); }
  function ease(v) { return v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2; }

  function paint(s) {
    lineL.style.strokeDashoffset = lenL * (1 - ease(seg(s, 0, .18)));
    var n = letters.length, w = .16, from = .15, to = .86;
    for (var i = 0; i < n; i++) {
      var a = from + i * (to - from - w) / (n - 1);
      letters[i].style.strokeDashoffset = DASH * (1 - ease(seg(s, a, a + w)));
      letters[i].style.fillOpacity = seg(s, a + w * .6, a + w + .05);
    }
    lineR.style.strokeDashoffset = lenR * (1 - ease(seg(s, .84, .99)));
    hint.style.opacity = 1 - seg(s, 0, .06);
  }

  var target = 0, shown = 0, last = 0, running = false;
  function readScroll() {
    var span = intro.offsetHeight - window.innerHeight;
    target = reduce || span <= 0 ? 1 : Math.max(0, Math.min(1, window.scrollY / span));
    if (window.scrollY + window.innerHeight > intro.offsetHeight + 40) hero.classList.add("sharp");
    if (!running) { running = true; last = 0; requestAnimationFrame(step); }
  }
  function step(now) {
    var dt = last ? Math.min(64, now - last) : 16; last = now;
    shown += (target - shown) * (1 - Math.exp(-dt / 110)); // ~0.1s catch-up, same at any frame rate
    if (Math.abs(target - shown) < .0005) shown = target;
    paint(shown);
    if (shown !== target) requestAnimationFrame(step); else running = false;
  }

  if (reduce) { shown = target = 1; hero.classList.add("sharp"); }
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", readScroll);
  var rf;
  window.addEventListener("resize", function () { clearTimeout(rf); rf = setTimeout(fitLines, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLines);
  fitLines();
  readScroll();

  /* ---- unit grid on the phone illustration ---- */
  var units = document.getElementById("units");
  if (units) {
    var svg = units.ownerSVGElement;
    var defs = document.createElementNS(SVGNS, "defs");
    defs.innerHTML = '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#FF4D1A" stroke-width="2"/></pattern>';
    svg.insertBefore(defs, svg.firstChild);
    var states = "dddd ddpd dpdd pd.. ....".replace(/ /g, "");
    for (var i = 0; i < 20; i++) {
      var r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("x", 92 + (i % 4) * 34);
      r.setAttribute("y", 100 + Math.floor(i / 4) * 34);
      r.setAttribute("width", 26); r.setAttribute("height", 26);
      var s = states[i];
      r.setAttribute("class", "unit" + (s === "d" ? " done" : s === "p" ? " part" : ""));
      units.appendChild(r);
    }
  }

  /* ---- line-by-line reveals ---- */
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -15% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- the thread: one line through every section, drawn as you scroll ---- */
  var threadSvg = document.getElementById("thread");
  var path = document.getElementById("threadPath");
  var head = document.getElementById("threadHead");
  var total = 0, firstY = 0, lastY = 0;

  function build() {
    var docH = document.documentElement.scrollHeight;
    threadSvg.setAttribute("height", docH);
    threadSvg.style.height = docH + "px";
    var pts = [];
    document.querySelectorAll("[data-thread]").forEach(function (el) {
      if (!el.getClientRects().length) return; // hidden at this width
      var b = el.getBoundingClientRect();
      pts.push({ x: b.left + b.width / 2 + window.scrollX, y: b.top + b.height / 2 + window.scrollY });
    });
    pts.sort(function (a, b) { return a.y - b.y; });
    if (pts.length < 2) return;
    var d = "M" + pts[0].x + " " + pts[0].y;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], k = (b.y - a.y) * 0.5;
      d += " C" + a.x + " " + (a.y + k) + " " + b.x + " " + (b.y - k) + " " + b.x + " " + b.y;
    }
    path.setAttribute("d", d);
    total = path.getTotalLength();
    firstY = pts[0].y; lastY = pts[pts.length - 1].y;
    path.style.strokeDasharray = total;
    draw();
  }

  function lengthAtY(y) {
    if (y <= firstY) return 0;
    if (y >= lastY) return total;
    var lo = 0, hi = total;
    for (var i = 0; i < 22; i++) {
      var mid = (lo + hi) / 2;
      if (path.getPointAtLength(mid).y < y) lo = mid; else hi = mid;
    }
    return lo;
  }

  var pending = false;
  function draw() {
    pending = false;
    if (!total) return;
    // the drawing tip sits ~60% down the screen, and catches up to the end as you reach the bottom
    var vh = window.innerHeight;
    var maxScroll = document.documentElement.scrollHeight - vh;
    var nearEnd = Math.max(0, Math.min(1, (window.scrollY - (maxScroll - vh)) / vh));
    var L = reduce ? total : lengthAtY(window.scrollY + vh * (0.62 + 0.5 * nearEnd));
    path.style.strokeDashoffset = total - L;
    var p = path.getPointAtLength(L);
    head.setAttribute("cx", p.x); head.setAttribute("cy", p.y);
    head.style.opacity = L > 0 && L < total ? 1 : 0;
  }
  function onScroll() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  window.addEventListener("scroll", onScroll, { passive: true });
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  window.addEventListener("load", build);
  build();
})();
