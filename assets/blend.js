/* The site as one space.
   Every section is a panel placed somewhere in a big 2D world. The page still scrolls normally
   (so the scrollbar, keys, touch and links all work), but the scroll position drives a camera:
   it rests on a panel, then pulls back so you see the panels and the thread between them,
   and glides on to the next one. The four projects sit in a row and the camera pans across them.
   Panels: data-x / data-y = place in the world (in screen widths / heights),
           data-hold = how long the camera rests there (in screen heights of scrolling),
           data-glide = the move to the next panel is a straight pan, not a pull-back. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";
  var root = document.documentElement;
  var world = document.getElementById("world");
  var space = document.getElementById("space");
  var spacer = document.getElementById("spacer");
  var panels = Array.prototype.slice.call(document.querySelectorAll(".st"));

  var VW = 0, VH = 0, G = 32;          // screen size, gutter
  var segs = [], total = 1;             // the camera's timeline (in px of scroll)
  var cur = 0, target = 0, last = 0, raf = 0;

  /* ---------- live clock: London time ---------- */
  var clock = document.getElementById("clock");
  function tick() {
    try { clock.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date()); }
    catch (e) { clock.textContent = ""; }
  }
  tick(); setInterval(tick, 15000);

  /* ---------- unit grid on the phone drawing ---------- */
  var units = document.getElementById("units");
  if (units) {
    var usvg = units.ownerSVGElement;
    var defs = document.createElementNS(SVGNS, "defs");
    defs.innerHTML = '<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#FF4D1A" stroke-width="2"/></pattern>';
    usvg.insertBefore(defs, usvg.firstChild);
    var states = "ddddddpddpddpd......";
    for (var u = 0; u < 20; u++) {
      var r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("x", 92 + (u % 4) * 34); r.setAttribute("y", 100 + Math.floor(u / 4) * 34);
      r.setAttribute("width", 26); r.setAttribute("height", 26);
      r.setAttribute("class", "unit" + (states[u] === "d" ? " done" : states[u] === "p" ? " part" : ""));
      units.appendChild(r);
    }
  }

  /* ---------- the opening: the name signs itself (Kino's sketched lines) ---------- */
  var nameEl = document.getElementById("introName");
  var nameSvg = document.getElementById("introSvg");
  var lineL = document.getElementById("introLineL");
  var lineR = document.getElementById("introLineR");
  var hint = document.getElementById("introHint");
  var DASH = 1400;
  var word = nameEl.textContent, letters = [];
  nameEl.textContent = "";
  for (var c = 0; c < word.length; c++) {
    var t = document.createElementNS(SVGNS, "tspan"); t.textContent = word[c];
    nameEl.appendChild(t); if (word[c] !== " ") letters.push(t);
  }
  var lenL = 0, lenR = 0, introOut = { x: 0, y: 0 };
  function fitLines() {
    // worked out in the opening panel's own coordinates, so it holds at any camera zoom
    try {
      var W = VW, H = VH;
      var sw = Math.min(1200, W), k = sw / 1200, sh = sw / 4;
      var left = (W - sw) / 2, top = (H - sh) / 2;
      var b = nameEl.getBBox();
      var x0 = left + b.x * k - 6, x1 = left + (b.x + b.width) * k + 6;
      var yb = top + 188 * k;
      var xR = W - 2 * G;
      var xL = W - xR;
      var r = Math.max(6, Math.min(80, (x0 - xL) * .6, (xR - x1) * .6, yb * .25));
      var dip = Math.min(14, r * .2);
      var yT = Math.min(Math.max(96, H * .16), yb - 2 * r - 20);
      var h = Math.min(xL * .9, 60);
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
        " L " + xR + " " + H);
      introOut.x = xR; introOut.y = H;
    } catch (e) {}
    lenL = lineL.getTotalLength(); lenR = lineR.getTotalLength();
    lineL.style.strokeDasharray = lenL; lineR.style.strokeDasharray = lenR;
  }
  function seg(v, a, b) { return Math.max(0, Math.min(1, (v - a) / (b - a))); }
  function ease(v) { return v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2; }
  function easeIO(v) { return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; }
  function paintIntro(s) {
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

  /* ---------- layout: place the panels, build the camera's timeline and the thread ---------- */
  var threadG = document.getElementById("wthreadSegs");
  var threadHead = document.getElementById("wthreadHead");
  var threadSvg = document.getElementById("wthread");

  /* ---------- hooks for page code (assets/pages.js) ----------
     __blend.onFrame(fn): fn({ c, holdT, panels }) runs at the end of every render().
       c = the camera pose (see pose()), holdT(i) = page i's own 0..1 rest progress (0 before, 1 once passed).
       Page code drives its scroll-linked drawing from holdT, so it reverses when you scroll back.
     __blend.onLayout(fn): fn() runs after every layout() (load, fonts ready, resize). */
  var frameFns = [], layoutFns = [];

  function layout() {
    VW = root.clientWidth; VH = window.innerHeight;
    G = Math.max(16, Math.min(48, VW * .032));
    root.style.setProperty("--vw", VW + "px");
    root.style.setProperty("--vh", VH + "px");
    var maxX = 0, maxY = 0;
    panels.forEach(function (p) {
      p._x = parseFloat(p.dataset.x) * VW; p._y = parseFloat(p.dataset.y) * VH;
      p.style.left = p._x + "px"; p.style.top = p._y + "px";
      maxX = Math.max(maxX, p._x + VW); maxY = Math.max(maxY, p._y + VH);
    });
    threadSvg.setAttribute("width", maxX + VW); threadSvg.setAttribute("height", maxY + VH);
    threadSvg.style.width = (maxX + VW) + "px"; threadSvg.style.height = (maxY + VH) + "px";

    // timeline: rest on each panel, then travel to the next
    segs = []; var at = 0;
    panels.forEach(function (p, i) {
      var hold = parseFloat(p.dataset.hold || "1") * VH;
      segs.push({ kind: "hold", i: i, a: at, b: at + hold }); at += hold;
      p._holdStart = segs[segs.length - 1].a;
      if (i < panels.length - 1) {
        var glide = p.dataset.glide === "1";
        var len = (glide ? .75 : 1.15) * VH;
        segs.push({ kind: "move", i: i, glide: glide, a: at, b: at + len }); at += len;
      }
    });
    total = at;
    spacer.style.height = (total + VH) + "px";

    fitLines();
    fitCard();
    buildThread();
    buildRuler();
    for (var h = 0; h < layoutFns.length; h++) layoutFns[h]();
  }

  /* ---------- the line (Kino's sketch, 2026-11-05) ----------
     One orange line from the end of the opening's right line to the dot by the email. It crosses
     every page behind the words and runs through the space between pages. It draws itself as you
     scroll: across a page while the camera rests there, then across the space on the way to the next.
     Each page's route is in that page's own proportions (0..1 across, 0..1 down).
     in / out: where the line crosses the page's edge (l, r, t, b) and how far along that edge.
     "stop" = through the orange full stop of the page's headline (wide screens only);
     "end" = finish on the dot by the email. */
  var DRAW_AS_YOU_SCROLL = true;   // false: the whole line is simply there
  var ROUTES = {
    "top":        { in: ["l", .55], out: ["b", .36], via: [[.2, .6], [.44, .5], [.68, .27], [.87, .3], [.9, .5], [.74, .7], [.5, .82]] },
    // Now: traced from Kino's drawing over the screenshot; its loop goes round the Sisco Solutions card (see nowRoute)
    "approach":   { in: ["t", .638], out: ["b", .83], get via() { return nowRoute(); } },
    // Drafting + The Pitch: kept off the drawings and the words (worked out per screen size, see bandRun)
    "work":       { in: ["l", .3], out: ["r", .8], get via() {
      return VW > 860 ? [[24 / VW, .42], [17 / VW, .62]].concat(bandCorner(), bandRun())   // down the left margin
        : [[.3, .275], [.62, .26], [1 - 16 / VW, .33], [1 - 13 / VW, .55], [1 - 16 / VW, .72]]; } },  // phone: above the frame, down the right edge
    "work-2":     { get in() { return ["l", VW > 860 ? .8 : pitchBand().edge]; }, get out() { return ["r", VW > 860 ? .8 : pitchBand().edge]; }, get via() {
      return VW > 860 ? bandCorner().concat(bandRun())                                     // under the title
        : pitchBand().via; } },                                                                // phone: see pitchBand
    // (phones: the same waves, their peaks drawn a little wider so the narrow page doesn't pinch them into points)
    "creative":   { in: ["l", .8], out: ["r", .78], get via() { return VW > 860 ? [[.12, .7], [.3, .86], [.55, .9], [.8, .82]] : [[.17, .72], [.4, .87], [.62, .9], [.82, .82]]; } },
    "creative-2": { in: ["l", .78], out: ["r", .764], get via() { return VW > 860 ? [[.2, .72], [.42, .88], [.7, .86], [.88, .7]] : [[.2, .73], [.42, .88], [.66, .86], [.84, .72]]; } },
    "built":      { in: ["l", .236], out: ["b", .35], via: [[.16, .2], [.4, .26], [.62, .16], [.84, .12], [.94, .26], [.82, .38], [.6, .55], [.42, .8]] },
    "built-2":    { in: ["t", .65], out: ["l", .62], via: [[.68, .16], [.82, .3], [.86, .5], [.7, .6], [.45, .56], [.22, .64]] },
    // Origins: Kino's sketch 7, drawn piece by piece (see "Origins" below)
    "origins":    { get in() { return ["r", OG.inY]; }, get out() { return ["r", OG.O.y / VH]; }, build: originsRoute },
    "contact":    { in: ["l", .2], out: "end", via: [[.18, .12], [.44, .1], [.72, .2], [.88, .36], [.84, .54], [.62, .62], [.34, .66], [.12, .72]] }
  };
  // wide screens, Drafting + The Pitch: along the clear band between the page's words and the ruler,
  // then up the right edge to the way out (the band is in pixels, so it holds at every screen height)
  // ... and the turn into it from the left margin, kept in the margin, below the title's corner
  function bandCorner() { var b = .925 - 15 / VH; return [[16 / VW, b - 32 / VH], [27 / VW, b - 6 / VH]]; }
  function bandRun() {
    // (2026-11-06: level, no hand wobble; it lifts only at the end, towards the way out)
    var b = .925 - 15 / VH, k = 3 / VH;
    return [[60 / VW, b], [.3, b], [.62, b], [.88, b - k], [1 - 44 / VW, b - 5 * k]];
  }
  // Now, wide screens (2026-11-06): the Sisco Solutions card fills the space between "02 — Now" and the headline,
  // centred in it, with room above and below for the line; the headline stays where it was
  function fitCard() {
    var p = document.getElementById("approach"), card = p && p.querySelector(".sisco-card");
    if (!card) return;
    card.style.removeProperty("--sc-h"); card.style.margin = "";
    if (VW <= 860) return;
    var kick = p.querySelector(".kicker"), head = p.querySelector(".now-left .big"), left = p.querySelector(".now-left");
    card.style.setProperty("--sc-h", "40px");
    var kb = kick.offsetTop + kick.offsetHeight, band = head.offsetTop - kb;
    var h = Math.max(84, Math.min(VH * .22, 236, band - 2 * Math.max(34, band * .16)));
    card.style.setProperty("--sc-h", h.toFixed(1) + "px");
    card.style.margin = Math.max(0, (band - card.offsetHeight) / 2 - (left.offsetTop - kb)).toFixed(1) + "px 0 auto";
  }
  // Now (2026-11-06): Kino's blue loop round the Sisco Solutions card. The line comes down past Listen, goes over the card
  // to the left, down its left side, back under it to the right, then on through the headline's full stop (wide screens).
  // Worked out from where the card and the words are, so it holds at every screen size; clear of the card by m px.
  function nowRoute() {
    var wide = VW > 860;
    var head = wide ? [[.655, .13], [.69, .31], [.66, .43]] : [[.655, .13], [.86, .3]];   // phones: down the right of the card first
    var tail = wide ? ["stop", [.56, .79], [.7, .89]] : [[.56, .79], [.7, .89]];
    var p = document.getElementById("approach"), card = p && p.querySelector(".sisco-card");
    if (!card || !card.offsetWidth) return head.concat([[.57, .455], [.46, .36], [.36, .29], [.27, .32], [.255, .43], [.29, .55], [.4, .59]], tail);
    function box(el) { var o = offsetIn(el, p); return { l: o.x - p._x, t: o.y - p._y, r: o.x - p._x + el.offsetWidth, b: o.y - p._y + el.offsetHeight }; }
    var c = box(card), above = box(wide ? p.querySelector(".kicker") : p.querySelector(".now-bg")), below = wide ? box(p.querySelector(".now-left .big")) : box(p.querySelector("#steps"));
    if (!wide) {
      // phones: the list grows upwards when a step opens; keep to where its tallest step would start
      var st = p.querySelector("#steps"), lis = st.querySelectorAll("li"), fs = parseFloat(getComputedStyle(lis[0]).fontSize), maxP = 0;
      Array.prototype.forEach.call(st.querySelectorAll("li p"), function (q) { maxP = Math.max(maxP, q.scrollHeight + 1.2 * parseFloat(getComputedStyle(q).fontSize)); });
      below.t = Math.min(below.t, below.b - (lis.length * fs + (lis.length - 1) * parseFloat(getComputedStyle(st).rowGap || 0) + maxP));
    }
    var w = c.r - c.l, h = c.b - c.t, cy = (c.t + c.b) / 2;
    var mt = Math.min(36, (c.t - above.b) * .5), mb = Math.min(36, (below.t - c.b) * .5);
    var ml = Math.max(8, Math.min(30, c.l * .6)), mr = Math.max(18, Math.min(46, (VW - c.r) * .4));
    // no room for a loop over and under it (short phones): the line passes beside the card instead
    if (mt < 12 || mb < 12) return head.concat([[c.r + mr, c.t - 4], [c.r + mr * 1.15, c.b + 6]].map(function (a) { return [a[0] / VW, a[1] / VH]; }), tail);
    var loop = [
      [c.r + mr, c.t + h * .2],                                   // right of the card, on the way in
      [c.r + mr * .3, c.t - mt], [c.l + w * .45, c.t - mt * 1.06], [c.l + w * .08, c.t - mt],   // over it, to the left
      [c.l - ml * .72, c.t - mt * .62], [c.l - ml, cy], [c.l - ml * .72, c.b + mb * .62],       // round its left end
      [c.l + w * .08, c.b + mb], [c.l + w * .5, c.b + mb * 1.05], [c.l + w * .88, c.b + mb * 1.15],   // back under it
      [c.r + mr * .5, c.b + mb * 1.5]                             // and away, down towards the full stop
    ];
    // phones: the line comes down the right of the card, so the loop runs the other way round: under it to the left,
    // up its left end, over it to the right, and down past its right side again, crossing itself, on to the list
    if (!wide) loop = [[c.r + mr * .45, c.t + h * .45], [c.r + mr * .3, c.b + mb * .8], [c.l + w * .6, c.b + mb], [c.l + w * .08, c.b + mb],
      [c.l - ml * .72, c.b + mb * .62], [c.l - ml, cy], [c.l - ml * .72, c.t - mt * .62], [c.l + w * .08, c.t - mt], [c.l + w * .55, c.t - mt],
      [c.r + mr * .3, c.t - mt * .8], [c.r + mr * 1.2, c.t + h * .7]];
    // wide screens: half way on to the full stop, so the pass under the card doesn't bow up into it on the way down
    var stp = wide && anchor(p, "stop");
    if (stp) { var aw = loop[loop.length - 1]; loop.push([(aw[0] + stp.x - p._x) / 2, (aw[1] + stp.y - p._y) / 2]); }
    return head.concat(loop.map(function (a) { return [a[0] / VW, a[1] / VH]; }), tail);
  }
  // phones, The Pitch: across the clear band between the words and the title row (kept 14px off both);
  // a short phone has no such band, so there the line runs under the title row, between it and the ruler
  function pitchBand() {
    var p = document.getElementById("work-2"), body = p.querySelector(".lv-body"), foot = p.querySelector(".proj-foot");
    var a = offsetIn(body, p).y - p._y + body.offsetHeight, b = offsetIn(foot, p).y - p._y, c = b + foot.offsetHeight;
    if (b - a >= 36) {
      var lo = (a + 14) / VH, hi = (b - 14) / VH;
      var cl = function (v) { return Math.max(lo, Math.min(hi, v)); };
      return { edge: cl(.8), via: [[.22, cl(.778)], [.5, cl(.764)], [.78, cl(.776)]] };   // one shallow arch (2026-11-06)
    }
    var y = Math.min(c + 22, VH - 50) / VH, k = 2 / VH;
    return { edge: y, via: [[.22, y], [.5, y - k], [.78, y]] };
  }

  /* ---------- Origins (Kino's sketch 7, 2026-11-05) ----------
     "the line creates a basketball hoop, then a basketball goes in, which then develops into a scoop that is
     a wave where a surfer stickman rides it before falling head first into the water, which then is the line."
     The line comes in from the right, rises across the top and draws the backboard, the rim and the net.
     The ball (assets/origins.js) arcs in from the left and drops through the net; the line drops after it,
     scoops at the water and rises into a wave that curls over to the right. A stick surfer rides down its
     face and falls head first into the water where the line stopped; then the water is drawn out of the
     splash as the line, on to the way out. (In the sketch the wave faces left; it faces right here so the
     line can run on to Today.)
     Two drawings, placed from where the words are (redone on every layout), in units of k:
       hoop h(x, y): origin H = the front of the backboard at rim height; the rim runs out to the left
       wave w(x, y): origin O = the foot of the drop, at the water (up is negative)
     OG holds the scene in page px for origins.js, and the timeline both files follow (shares of the rest). */
  var OG = { inY: .38, O: { y: .8 * 600 } };
  var OT = {
    E: [0, .08], B: [.08, .13], R: [.13, .165], N: [.165, .205],          // in, backboard, rim, net
    ball: [.15, .18], fly: [.18, .275], swish: [.275, .30], drop: [.30, .37], // the ball: appears, flies, through the net, falls away
    D: [.305, .37], W1: [.37, .425], W2: [.425, .48], W3: [.48, .58],      // the drop (after the ball), the wave's back, the curl, the face
    ride: [.5, .64], fall: [.64, .72], splash: [.72, .8], T: [.73, .96]    // the surfer rides, falls head first; the water
  };
  function originsGeo(p) {
    var phone = VW <= 860;
    var pr = p.getBoundingClientRect(), sc = pr.width / VW;
    function box(sel, all) {
      var b = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
      Array.prototype.forEach.call(all ? p.querySelectorAll(sel) : [p.querySelector(sel)], function (e) {
        // the words' own boxes (text only: assets/type.js wraps letters in boxes of their own)
        var rs = [], tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), n;
        while ((n = tw.nextNode())) { var rg = document.createRange(); rg.selectNodeContents(n); rs.push.apply(rs, rg.getClientRects()); }
        rs.forEach(function (q) {
          if (q.width < 2) return;
          b.l = Math.min(b.l, (q.left - pr.left) / sc); b.t = Math.min(b.t, (q.top - pr.top) / sc);
          b.r = Math.max(b.r, (q.right - pr.left) / sc); b.b = Math.max(b.b, (q.bottom - pr.top) / sc);
        });
      });
      return b;
    }
    var name = box(".about-name"), body = box(".about-body p", true), kick = box(".kicker");
    var statsTop = p.querySelector(".stats").offsetTop;
    var top = Math.max(kick.b + 14, 84);
    var k, Ox, Oy;
    // the drawing is 236 k wide (the drop to the splash's far side) and 266 k tall (the top of the hoop to the water)
    if (!phone) {
      // the water runs in the clear strip between the paragraphs and the stats; the drawing sits between the name and the paragraphs
      Oy = (body.b + statsTop) / 2;
      // (the splash's farthest drops reach 253 k: they may come closer to the paragraphs, but stay clear of them)
      var left = name.r + 36, right = body.l - 24, rightD = body.l - 10;
      k = Math.max(.5, Math.min((right - left) / 236, (rightD - left) / 253, (Oy - top) / 266, 1.75 * VW / 1536));
      Ox = left + Math.max(0, Math.min((right - left) - 236 * k, (rightD - left) - 253 * k)) * .35;
    } else {
      // phone: in the band above the words; the wave sits to the right of the name, the water level with its foot
      Oy = name.b - 8;
      var leftP = name.r + 26;
      k = Math.max(.45, Math.min((VW - 12 - leftP) / 236, (Oy - top) / 266, .9));
      Ox = leftP;
    }
    var drop = Math.max(160, Math.min(240, (Oy - top) / k - 106));   // rim height above the water (k)
    var H = { x: Ox + 54 * k, y: Oy - drop * k };
    var hookY = H.y - 100 * k;
    var inY = phone ? hookY + 34 * k : Math.min(hookY + .2 * VH, body.t - 44);
    return {
      // ks: the surfer's scale, kb: the ball's
      phone: phone, k: k, ks: (phone ? .95 : 1.02) * k, kb: (phone ? 1 : 1.15) * k, drop: drop, H: H, O: { x: Ox, y: Oy }, inY: Math.max(hookY, inY) / VH, T: OT,
      name: name, body: body, kick: kick,
      h: function (x, y) { return [H.x + x * k, H.y + y * k]; },
      w: function (x, y) { return [Ox + x * k, Oy + y * k]; }
    };
  }
  // the line across Origins, in world px. Since 2026-11-06 the flowing parts are knots of the one smooth line
  // (in, over the backboard; the wave and the water), and only the hoop's own corners are drawn as pieces:
  // the backboard, the rim and the net. The drop is straight (no hand wobble). Tags mark each piece's end for the pacing.
  function originsRoute(p, q, out, api) {
    var g = OG, X = p._x, Y = p._y, h = g.h, w = g.w, k = g.k;
    function P(a) { return { x: a[0] + X, y: a[1] + Y }; }
    function S(a) { return (a[0] + X).toFixed(2) + " " + (a[1] + Y).toFixed(2); }
    function C(a, b, c) { return " C " + S(a) + " " + S(b) + " " + S(c); }
    function L(a) { return " L " + S(a); }
    function mid(a, b, c, d) { return { x: (a.x + 3 * b.x + 3 * c.x + d.x) / 8, y: (a.y + 3 * b.y + 3 * c.y + d.y) / 8 }; }
    // in: from the right edge, rising across the top to just over the backboard (an S, level at both ends) ...
    var a0 = P(h(30, -100)), dx = q.x - a0.x;
    api.add(mid(q, { x: q.x - dx * .42, y: q.y }, { x: a0.x + dx * .38, y: a0.y }, a0));
    api.add(a0, "E");
    // ... and the hook over its top, into the front of the backboard
    api.add(mid(a0, P(h(14, -100.5)), P(h(0, -98)), P(h(0, -84))));
    api.add(P(h(0, -84)));
    api.end({ x: 0, y: 1 });
    // the backboard: down the front, round the bottom and up the back, then back down the front to the rim
    api.raw(L(h(0, 16)) + L(h(9.5, 16.5)) + C(h(10, -20), h(9, -60), h(9.2, -84.6)) + L(h(0, -84)) + L(h(0, 0)), "B", P(h(0, 0)));
    // the rim: a flat ring running out to the left, round and back
    api.raw(C(h(0, 3.4), h(-14.8, 6.2), h(-33, 6.2)) + C(h(-51.2, 6.2), h(-66, 3.4), h(-66, 0)) +
      C(h(-66, -3.4), h(-51.2, -6), h(-33, -6)) + C(h(-14.8, -6), h(-.6, -3.2), h(-.8, .4)), "R", P(h(-.8, .4)));
    // the net: strands from the ring to a narrower hem, each a little slack, ending at its far bottom corner
    var net = [[-.8, .4], [-10, 44], [-19, 5.6], [-25, 45.5], [-38, 6], [-40, 45], [-57, 4.2], [-54, 44]];
    api.raw(net.slice(1).map(function (n, i) {
      var a = net[i], bow = i % 2 ? -1.6 : 1.6;
      return " Q " + S(h((a[0] + n[0]) / 2 + bow, (a[1] + n[1]) / 2)) + " " + S(h(n[0], n[1]));
    }).join(""), "N", P(h(-54, 44)));
    // the drop: straight down after the ball, to just above the water (the net's last strand ends there, heading down)
    var d1 = w(0, -36);
    api.raw(L(d1), "D", P(d1));
    // the wave, drawn through its own points and the middle of each of its old strokes: the scoop at the water, the back
    // rising to the crest (W1); the lip throwing over to the right and curling under, back to the throat (W2);
    // the face coming down, hollow, into the trough (W3, which the surfer rides)
    api.begin(P(d1), { x: 0, y: 1 });
    var wave = {
      W1: [[[0, -14], [3, 4], [16, 4]], [[32, 4], [46, -30], [60, -70]], [[70, -100], [84, -124], [104, -128]]],
      W2: [[[128, -131], [154, -121], [166, -101]], [[174, -87], [168, -73], [157, -71]], [[147, -70], [140, -78], [143, -88]], [[145, -95], [134, -101], [122, -99]]],
      W3: [[[112, -97], [106, -82], [107, -62]], [[108, -36], [124, -14], [150, -5]], [[168, 0], [184, 0], [198, 0]]]
    }, at = P(d1);
    ["W1", "W2", "W3"].forEach(function (n) {
      wave[n].forEach(function (c, j) {
        var e = P(w(c[2][0], c[2][1]));
        if (k >= .7) api.add(mid(at, P(w(c[0][0], c[0][1])), P(w(c[1][0], c[1][1])), e));   // (a small wave: its stroke ends are enough)
        api.add(e, j === wave[n].length - 1 ? n : null);
        at = e;
      });
    });
    api.face(X, Y, k >= .7 ? 6 : 3);   // the face, from the throat (end of W2) to the water (end of W3), for origins.js
    // the water: out of the splash (at w(212, 0)), ripples that settle, on to the way out
    var steps = [[14, 0], [30, -2.6], [56, 2], [88, -1.3], [128, .8], [178, -.45], [240, .25]];
    steps.forEach(function (s) { var a = w(198 + s[0], s[1]); if (a[0] + X < out.x - 30 * k) api.add(P(a)); });
  }
  var SIDE = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
  var linePath = null, lineCopies = [], lineHeads = [], lineGroups = [];
  var lineLen = 1, entryLen = [], exitLen = [];
  var measurer = document.createElementNS(SVGNS, "path");
  measurer.style.visibility = "hidden";
  threadSvg.appendChild(measurer);

  function edgeAt(p, e) {
    var s = e[0], f = e[1];
    var u = s === "l" ? 0 : s === "r" ? 1 : f, v = s === "t" ? 0 : s === "b" ? 1 : f;
    return { x: p._x + u * VW, y: p._y + v * VH, nx: SIDE[s][0], ny: SIDE[s][1] };
  }
  // a mark on the page, in world coordinates (offsets ignore the camera's zoom)
  function offsetIn(el, p) {
    var x = 0, y = 0;
    while (el && el !== p) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x: p._x + x, y: p._y + y };
  }
  function anchor(p, name) {
    if (name === "stop") {
      var st = VW > 860 && p.querySelector(".big .stop");
      if (!st) return null;
      var o = offsetIn(st, p), fs = parseFloat(getComputedStyle(st).fontSize);
      return { x: o.x + st.offsetWidth / 2, y: o.y + st.offsetHeight - fs * .3 };
    }
    if (name === "end") {
      var dot = document.getElementById("endDot");
      var od = offsetIn(dot, p);
      return { x: od.x + dot.offsetWidth / 2, y: od.y + dot.offsetHeight / 2 };
    }
    return null;
  }
  /* a smooth line through the knots (2026-11-06, Kino: "smooth out the line ... do not get rid of the turns"):
     a C2 cubic spline over the distance between knots, so at every knot the direction AND the bend are the same
     on both sides (the old one matched only the direction, so the bend jumped at every point: the hand-drawn look).
     One cubic per stretch. t0 / t1: the direction at the two ends (unit), or null for a free end. */
  function spline(K, t0, t1) {
    var n = K.length - 1, h = [], segs = [];
    if (n < 1) return segs;
    for (var i = 0; i < n; i++) h.push(Math.max(.01, Math.hypot(K[i + 1].x - K[i].x, K[i + 1].y - K[i].y)));
    function solve(c) {   // the slope at every knot (tridiagonal)
      var A = [], B = [], U = [], R = [], D = [], j;
      for (j = 0; j <= n; j++) {
        if (j === 0 && t0) { A[j] = 0; B[j] = 1; U[j] = 0; R[j] = t0[c]; }
        else if (j === 0) { A[j] = 0; B[j] = 2; U[j] = 1; R[j] = 3 * (K[1][c] - K[0][c]) / h[0]; }
        else if (j === n && t1) { A[j] = 0; B[j] = 1; U[j] = 0; R[j] = t1[c]; }
        else if (j === n) { A[j] = 1; B[j] = 2; U[j] = 0; R[j] = 3 * (K[n][c] - K[n - 1][c]) / h[n - 1]; }
        else { A[j] = h[j]; B[j] = 2 * (h[j - 1] + h[j]); U[j] = h[j - 1]; R[j] = 3 * (h[j] * (K[j][c] - K[j - 1][c]) / h[j - 1] + h[j - 1] * (K[j + 1][c] - K[j][c]) / h[j]); }
      }
      for (j = 1; j <= n; j++) { var m = A[j] / B[j - 1]; B[j] -= m * U[j - 1]; R[j] -= m * R[j - 1]; }
      D[n] = R[n] / B[n];
      for (j = n - 1; j >= 0; j--) D[j] = (R[j] - U[j] * D[j + 1]) / B[j];
      return D;
    }
    var sx = solve("x"), sy = solve("y");
    for (var s = 0; s < n; s++) segs.push([K[s], { x: K[s].x + sx[s] * h[s] / 3, y: K[s].y + sy[s] * h[s] / 3 },
      { x: K[s + 1].x - sx[s + 1] * h[s] / 3, y: K[s + 1].y - sy[s + 1] * h[s] / 3 }, K[s + 1]]);
    return segs;
  }
  function f2(v) { return v.toFixed(2); }
  function pieceLen(from, d) { measurer.setAttribute("d", "M " + from.x + " " + from.y + d); return measurer.getTotalLength(); }

  function buildThread() {
    // the copies: one in the space, one inside every page after the opening
    if (!linePath) {
      linePath = document.createElementNS(SVGNS, "path");
      threadG.appendChild(linePath);
      lineCopies.push(linePath); lineHeads.push(threadHead);
      panels.forEach(function (p, i) {
        if (i === 0) return;
        var svg = document.createElementNS(SVGNS, "svg");
        svg.setAttribute("class", "pthread"); svg.setAttribute("aria-hidden", "true");
        var g = document.createElementNS(SVGNS, "g");
        var path = document.createElementNS(SVGNS, "path"), head = document.createElementNS(SVGNS, "circle");
        head.setAttribute("r", 5);
        g.appendChild(path); g.appendChild(head); svg.appendChild(g);
        p.insertBefore(svg, p.firstChild);
        lineCopies.push(path); lineHeads.push(head); lineGroups.push({ g: g, p: p });
      });
    }
    lineGroups.forEach(function (o) { o.g.setAttribute("transform", "translate(" + (-o.p._x) + " " + (-o.p._y) + ")"); });
    var og = document.getElementById("origins");
    if (og) { OG = originsGeo(og); OG.index = panels.indexOf(og); }

    var start = { x: panels[0]._x + introOut.x, y: panels[0]._y + introOut.y, nx: 0, ny: 1 };
    /* The whole line is one smooth stroke (2026-11-06): its knots run from the opening, across every page and the space
       between, to the dot by the email, and one spline goes through them all. It crosses each page's edge where it did,
       at whatever angle keeps it smooth (forcing it square to the edge put a hook in the margin); through the space it
       passes the middle of the old curve there. Origins' hoop is the only part drawn as pieces. */
    var parts = [], run = null;
    var api = {
      begin: function (pt, t0) { run = { K: [{ x: pt.x, y: pt.y }], tags: [[]], t0: t0 || null, t1: null }; parts.push(run); },
      add: function (pt, tag) {
        var K = run.K, l = K[K.length - 1];
        if (Math.hypot(pt.x - l.x, pt.y - l.y) > 1.5) { K.push({ x: pt.x, y: pt.y }); run.tags.push([]); }
        if (tag) run.tags[K.length - 1].push(tag);
      },
      end: function (t1) { run.t1 = t1 || null; run = null; },
      raw: function (d, tag, endPt) { parts.push({ d: d, tag: tag, endPt: endPt }); },
      face: function (X, Y, n) { if (run) run.face = { X: X, Y: Y, n: n, from: run.K.length - 1 - n }; }
    };
    api.begin(start, { x: 0, y: 1 });
    var prev = start;
    for (var i = 1; i < panels.length; i++) {
      var p = panels[i], r = ROUTES[p.id];
      var q = edgeAt(p, r.in), out = r.out === "end" ? anchor(p, "end") : edgeAt(p, r.out);
      // across the space, out of one page and into the next: through the middle of the old curve there (a long gap)
      var gap = Math.hypot(q.x - prev.x, q.y - prev.y), k = Math.max(40, gap * .45);
      if (gap > 150) api.add({ x: (prev.x + 3 * (prev.x + prev.nx * k) + 3 * (q.x + q.nx * k) + q.x) / 8, y: (prev.y + 3 * (prev.y + prev.ny * k) + 3 * (q.y + q.ny * k) + q.y) / 8 });
      api.add(q, "in" + i);
      // across the page
      if (r.build) r.build(p, q, out, api);
      else r.via.forEach(function (v) {
        var a = typeof v === "string" ? anchor(p, v) : { x: p._x + v[0] * VW, y: p._y + v[1] * VH };
        if (a) api.add(a);
      });
      if (r.out === "end") { api.add(out, "out" + i); api.end(null); break; }
      api.add(out, "out" + i);
      prev = out;
    }
    if (run) api.end(null);
    // one path: each run of knots as a spline, the hoop's pieces as drawn; the length at every tagged knot
    var d = "M " + f2(start.x) + " " + f2(start.y), at = 0, lens = {}, cur = start;
    parts.forEach(function (pt) {
      if (!pt.K) { at += pieceLen(cur, pt.d); d += pt.d; lens[pt.tag] = at; cur = pt.endPt; return; }
      var segs = spline(pt.K, pt.t0, pt.t1);
      pt.tags[0].forEach(function (t) { lens[t] = at; });
      segs.forEach(function (s, j) {
        var sd = " C " + f2(s[1].x) + " " + f2(s[1].y) + " " + f2(s[2].x) + " " + f2(s[2].y) + " " + f2(s[3].x) + " " + f2(s[3].y);
        at += pieceLen(cur, sd); d += sd; cur = { x: +f2(s[3].x), y: +f2(s[3].y) };
        pt.tags[j + 1].forEach(function (t) { lens[t] = at; });
      });
      if (pt.face && segs[pt.face.from]) {
        // for origins.js: the face the surfer rides (the wave's last three strokes, as drawn), in page px
        var F = pt.face, fd = "M " + f2(segs[F.from][0].x - F.X) + " " + f2(segs[F.from][0].y - F.Y);
        for (var j = F.from; j < F.from + F.n; j++) {
          fd += " C " + [1, 2, 3].map(function (c) { return f2(segs[j][c].x - F.X) + " " + f2(segs[j][c].y - F.Y); }).join(" ");
        }
        OG.faceD = fd;
      }
    });
    lineCopies.forEach(function (el) { el.setAttribute("d", d); });
    lineLen = linePath.getTotalLength();
    entryLen = [0]; exitLen = [0];
    for (var e = 1; e < panels.length; e++) { entryLen[e] = lens["in" + e]; exitLen[e] = lens["out" + e]; }
    exitLen[panels.length - 1] = lineLen;
    if (OG && OG.index > 0) {
      var oi = OG.index;
      ROUTES.origins.marks = { E: lens.E, B: lens.B, R: lens.R, N: lens.N, D: lens.D, W1: lens.W1, W2: lens.W2, W3: lens.W3, T: exitLen[oi] };
    }
    lineCopies.forEach(function (el) { el.style.strokeDasharray = (lineLen + 2) + " " + (lineLen + 2); });
  }
  // how much of the line is drawn for a camera pose
  function drawnFor(c) {
    if (!DRAW_AS_YOU_SCROLL) return lineLen;
    if (c.move >= 0) return exitLen[c.move] + c.mt * (entryLen[c.move + 1] - exitLen[c.move]);
    if (OG && c.at === OG.index && ROUTES.origins.marks) return originsDrawn(c.t);
    return entryLen[c.at] + c.t * (exitLen[c.at] - entryLen[c.at]);
  }
  // Origins keeps its own pace: each piece over its own share of the rest; the line waits while the ball
  // flies in, and again at the water while the surfer falls (reduced motion: the whole drawing at once)
  function originsDrawn(t) {
    var m = ROUTES.origins.marks, T = OT, i = OG.index;
    if (reduce) return exitLen[i];
    var knots = [[0, entryLen[i]], [T.E[1], m.E], [T.B[1], m.B], [T.R[1], m.R], [T.N[1], m.N], [T.D[0], m.N], [T.D[1], m.D],
      [T.W1[1], m.W1], [T.W2[1], m.W2], [T.W3[1], m.W3], [T.T[0], m.W3], [T.T[1], m.T], [1, m.T]];
    for (var j = 1; j < knots.length; j++) {
      if (t <= knots[j][0]) { var a = knots[j - 1], b = knots[j]; return a[1] + (b[1] - a[1]) * seg(t, a[0], b[0]); }
    }
    return m.T;
  }

  /* ---------- the ruler ---------- */
  var rulerTrack = document.getElementById("rulerTrack");
  var rulerFill = document.getElementById("rulerFill");
  var rulerDot = document.getElementById("rulerDot");
  var rulerName = document.getElementById("rulerName");
  var ruler = document.getElementById("ruler");
  function buildRuler() {
    var ticks = panels.map(function (p) {
      return "linear-gradient(currentColor,currentColor) " + (p._holdStart / total * 100).toFixed(2) + "% 50% / 1px 9px no-repeat";
    });
    rulerTrack.style.setProperty("--ticks", ticks.join(","));
  }

  /* ---------- the camera ---------- */
  function pose(p) {
    p = Math.max(0, Math.min(total, p));
    for (var k = 0; k < segs.length; k++) {
      var s = segs[k];
      if (p <= s.b || k === segs.length - 1) {
        var A = panels[s.i];
        if (s.kind === "hold") {
          return { x: A._x + VW / 2, y: A._y + VH / 2, s: 1, at: s.i, t: (p - s.a) / (s.b - s.a), move: -1, mt: 0 };
        }
        var B = panels[s.i + 1];
        var raw = (p - s.a) / (s.b - s.a), e = easeIO(raw);
        var dipAmt = reduce ? 0 : (s.glide ? .1 : .5);
        return {
          x: A._x + VW / 2 + (B._x - A._x) * e, y: A._y + VH / 2 + (B._y - A._y) * e,
          s: 1 - dipAmt * Math.sin(Math.PI * raw), at: raw < .5 ? s.i : s.i + 1,
          t: raw < .5 ? 1 : 0, move: s.i, mt: e
        };
      }
    }
  }

  var steps = document.querySelectorAll("#steps li");
  var tiles = document.querySelectorAll("#tiles .tile");
  var navLinks = document.querySelectorAll(".bar-nav a");
  var lastAt = -1;

  function render() {
    var c = pose(cur);
    var s = c.s;
    var tx = VW / 2 - c.x * s, ty = VH / 2 - c.y * s;
    world.style.transform = "translate3d(" + tx + "px," + ty + "px,0) scale(" + s + ")";
    // the dot grid moves and scales with the camera, a touch slower (depth)
    var gs = 64 * (.6 + .4 * s);
    space.style.backgroundSize = gs + "px " + gs + "px";
    space.style.backgroundPosition = (tx * .7) + "px " + (ty * .7) + "px";

    // panels: the one in front is full, neighbours fade; far ones aren't painted at all
    panels.forEach(function (p, i) {
      var px = (p._x + VW / 2 - c.x) * s, py = (p._y + VH / 2 - c.y) * s;
      var d = Math.hypot(px / VW, py / VH);
      var o = 1 - Math.min(1, Math.max(0, (d - .12) / .8)) * .7;
      var off = Math.abs(px) - VW * s / 2 > VW * .75 || Math.abs(py) - VH * s / 2 > VH * .75;
      p.style.visibility = off ? "hidden" : "visible";
      p.style.opacity = o.toFixed(3);
      p.classList.toggle("on", i === c.at);
    });

    // what happens inside the panel the camera is resting on
    var holdT = function (i) { return c.at === i ? (c.move < 0 ? c.t : (c.move === i ? 1 : 0)) : (c.at > i ? 1 : 0); };
    paintIntro(reduce ? 1 : holdT(0));
    var ia = panels.indexOf(document.getElementById("steps").closest(".st"));
    var stepI = Math.min(steps.length - 1, Math.floor(holdT(ia) * steps.length * .999));
    steps.forEach(function (li, i) { li.classList.toggle("cur", i === stepI); });
    var ic = panels.indexOf(document.getElementById("tiles").closest(".st"));
    var tileI = Math.min(tiles.length - 1, Math.floor(holdT(ic) * tiles.length * .999));
    tiles.forEach(function (tl, i) { tl.classList.toggle("cur", i === tileI); });
    panels.forEach(function (p, i) { if (p.classList.contains("st-work")) p.style.setProperty("--drift", (holdT(i) - .5).toFixed(3)); });

    // the line: drawn up to where you are; a dot leads it
    var dl = Math.max(0, Math.min(lineLen, drawnFor(c)));
    var off = (lineLen + 2 - dl).toFixed(1);
    lineCopies.forEach(function (el) { el.style.strokeDashoffset = off; });
    var showHead = dl > .5 && dl < lineLen - .5, hp;
    // Origins: no dot at the water while the surfer falls into it (the splash is there)
    if (OG && c.at === OG.index && c.move < 0 && c.t > OT.W3[1] - .005 && c.t < OT.T[0] + .01) showHead = false;
    hp = showHead ? linePath.getPointAtLength(dl) : null;
    lineHeads.forEach(function (h) {
      h.style.opacity = showHead ? 1 : 0;
      if (hp) { h.setAttribute("cx", hp.x.toFixed(1)); h.setAttribute("cy", hp.y.toFixed(1)); }
    });

    // the ruler
    var f = cur / total;
    rulerFill.style.width = (f * 100) + "%";
    rulerDot.style.left = (f * 100) + "%";
    ruler.style.opacity = c.at === 0 && c.move < 0 && c.t < .9 ? 0 : 1;
    if (c.at !== lastAt) {
      lastAt = c.at;
      rulerName.textContent = panels[c.at].dataset.no + " — " + panels[c.at].dataset.name;
      // the ruler takes the ink or paper colour of the panel in front
      ruler.style.setProperty("--ruler-c", panels[c.at].classList.contains("paper") ? "#0B0B0C" : "#F1EEE8");
      var id = panels[c.at].id;
      navLinks.forEach(function (a) {
        var h = a.getAttribute("href").slice(1);
        a.classList.toggle("cur", h === id || id.indexOf(h + "-") === 0);
      });
    }

    // page code hooked in through __blend.onFrame
    for (var fi = 0; fi < frameFns.length; fi++) frameFns[fi]({ c: c, holdT: holdT, panels: panels });
  }

  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(64, now - last) : 16; last = now;
    target = window.scrollY;
    if (reduce) cur = target;
    else cur += (target - cur) * (1 - Math.exp(-dt / 140)); // smooth, the same at any frame rate
    if (Math.abs(target - cur) < .3) cur = target;
    render();
    if (cur !== target) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  window.addEventListener("scroll", kick, { passive: true });

  /* ---------- links fly the camera to their panel ---------- */
  function scrollToPanel(id, smooth) {
    var p = document.getElementById(id);
    if (!p || panels.indexOf(p) < 0) return false;
    window.scrollTo({ top: p._holdStart + (p.id === "top" ? 0 : 2), behavior: smooth && !reduce ? "smooth" : "auto" });
    return true;
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    if (scrollToPanel(a.getAttribute("href").slice(1), true)) e.preventDefault();
  });

  /* ---------- cursor: an orange dot (fine pointers only) ---------- */
  var cursorEl = document.getElementById("cursor");
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce) {
    root.classList.add("dot-cursor");
    var mx = -100, my = -100, dx = -100, dy = -100, craf = 0;
    var follow = function () {
      dx += (mx - dx) * .35; dy += (my - dy) * .35;
      cursorEl.style.transform = "translate3d(" + dx + "px," + dy + "px,0)";
      craf = Math.abs(mx - dx) + Math.abs(my - dy) > .3 ? requestAnimationFrame(follow) : 0;
    };
    window.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (dx < -50) { dx = mx; dy = my; }
      cursorEl.classList.add("show");
      cursorEl.classList.toggle("link", !!(e.target.closest && e.target.closest("a, button")));
      if (!craf) craf = requestAnimationFrame(follow);
    }, { passive: true });
    root.addEventListener("pointerleave", function () { cursorEl.classList.remove("show"); });
  } else {
    cursorEl.style.display = "none";
  }

  /* ---------- start ---------- */
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { var f = cur / total; layout(); window.scrollTo(0, f * total); cur = target = f * total; render(); }, 120);
  });
  function start() {
    layout();
    if (location.hash && scrollToPanel(location.hash.slice(1), false)) cur = target = window.scrollY;
    else { cur = target = window.scrollY; }
    render();
  }
  // a link like /#built typed or pasted while the site is open: fly there too
  window.addEventListener("hashchange", function () { scrollToPanel(location.hash.slice(1), true); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  start();
  window.__blend = {
    pose: function () { return pose(cur); }, total: function () { return total; }, panels: panels,
    // for checking: show the whole line (true) or draw it as you scroll (false)
    wholeLine: function (on) { DRAW_AS_YOU_SCROLL = !on; render(); },
    // page code: see "hooks for page code" above. Each runs once straight away, so a late script is painted at once.
    onFrame: function (fn) { frameFns.push(fn); render(); },
    onLayout: function (fn) { layoutFns.push(fn); fn(); },
    // the Origins scene (page px) and its timeline, for assets/origins.js
    origins: function () { return OG; }
  };
})();
