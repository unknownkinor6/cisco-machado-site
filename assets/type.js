/* Text motion (2026-11-05). Kino: "in general i would like more animation within the texts etc i would like them
   to develop differently all abstractly artistically. but prioritise my descriptions".
   Each page's words develop in their own way while the camera rests there, then sit still:
     Hello      the letters bloom from thin ink to heavy (400 -> 500 -> 800), out of a blur; a reading light runs along the line below
     Now        the headline's lines are woven in from left, right, left; the paragraph is wiped open line by line, like a ruler pass
     Drafting   the title's letters rise off a ground line like elevations; the caption is measured in from the left
     The Pitch  a spotlight sweeps across the title; the lede rises out of blur, then the sentences land one at a time
     Artwork    the letters tumble down in a loose order and settle, like paint drops; the caption is a focus pull from the middle
     Garments   alternate letters are sewn from the top and from the bottom; the caption is a running stitch
     Built      the headline turns from orange handwriting into type, letter by letter; the labels type; each tile's words
                light up as the orange tile reaches it (type.css)
     The vote   an orange echo of each line is there first, then the words register onto it ("they saw it before I did");
                the line above is a tally, marks first, then letters; the body's words arrive at random, the last sentence last
     Origins    the name is pulled in from the right, where the line comes in, and the year counts up to 2013;
                the paragraphs drift in from the right, line by line
     Today      the headline gathers from a scatter, centre first; the line above rises; an orange wave runs along the email
   Driven by the page's rest (holdT) through __blend.onFrame: p = 0..1 over the first 35% of the rest, so it runs
   backwards as you scroll back, and from there on the words are still and whole. If you stop as you arrive, the words
   finish on their own within 1.5 s (TEXT_AUTOPLAY); leaving a page backwards un-develops them over half a second.
   Reduced motion: nothing is split or moved.
   Words are split into spans for show only. Each split element keeps its text for screen readers (aria-label on headings
   and links, a hidden copy on paragraphs); at rest no inline motion styles are left, the boxes are the same as before
   (kerning kept with small margins) and the drawings, the line, the ledger, the steps and the tile are not touched. */
(function () {
  "use strict";
  var B = window.__blend;
  if (!B || !B.onFrame) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var root = document.documentElement;
  var TEXT_AUTOPLAY = true, AUTO_S = 1.5, BACK_S = .5, SETTLE = .35;
  var AUTO = TEXT_AUTOPLAY, VW = root.clientWidth;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(v, a, b) { return clamp01((v - a) / (b - a)); }
  function lerp(a, b, e) { return a + (b - a) * e; }
  function f3(v) { return v.toFixed(3); }
  var E = {
    lin: function (x) { return x; },
    eO: function (x) { return 1 - Math.pow(1 - x, 3); },
    eX: function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    eB: function (x) { return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); },
    eIO: function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  };
  function rnd(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(n, seed) {
    var a = [], r = rnd(seed), i, j, s;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); s = a[i]; a[i] = a[j]; a[j] = s; }
    return a;
  }

  /* ---------- splitting ----------
     mode "c" letters, "w" words (both inline-block, so they can move), "ci" letters that only change colour (inline),
     "wi" words left readable as they are (inline, for the tiles' CSS ripple). */
  var report = [];
  function scaleOf(el) { var st = el.closest(".st") || el; return st.getBoundingClientRect().width / (st.offsetWidth || 1) || 1; }
  function split(el, mode, opt) {
    opt = opt || {};
    var chars = mode.charAt(0) === "c", inline = mode.length > 1, hide = mode !== "wi";
    var pre = [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight];
    var label = el.textContent.replace(/\s+/g, " ").trim();
    // 1. where every unit starts, before anything changes
    var nodes = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nd;
    while ((nd = tw.nextNode())) nodes.push(nd);
    var rg = document.createRange(), rects = new Map();
    nodes.forEach(function (node) {
      var map = {}, re = /\S+/g, m;
      while ((m = re.exec(node.data))) {
        var count = chars ? m[0].length : 1;
        for (var k = 0; k < count; k++) {
          rg.setStart(node, m.index + k); rg.setEnd(node, m.index + k + 1);
          var r = rg.getBoundingClientRect(); map[m.index + k] = { x: r.left, y: r.top, w: r.width };
        }
      }
      rects.set(node, map);
    });
    // 2. the spans
    var units = [], word = 0, sent = 0, newSent = false;
    function unit(text, parent, o) {
      var s = document.createElement("span");
      s.className = "t-u " + (chars ? "t-c" : (mode === "wi" ? "t-x" : "t-w")) + (inline ? " t-i" : "");
      s.textContent = text;
      if (hide) s.setAttribute("aria-hidden", "true");
      parent.appendChild(s);
      units.push({ el: s, i: units.length, w: word, s: sent, ch: text, o: o, last: -1, keys: null });
      return s;
    }
    function walk(node) {
      var pend = null;
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment(), map = rects.get(c) || {}, at = 0;
          pend = null;
          c.data.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s/.test(part)) {
              frag.appendChild(document.createTextNode(part)); pend = null; word++;
              if (newSent) { sent++; newSent = false; }
            } else if (chars) {
              var g = document.createElement("span"); g.className = "t-g";
              for (var k = 0; k < part.length; k++) unit(part.charAt(k), g, map[at + k]);
              frag.appendChild(g); pend = g;
            } else {
              pend = unit(part, frag, map[at]);
            }
            if (/[.!?]$/.test(part)) newSent = true;
            at += part.length;
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1) {
          if (c.tagName === "BR") { pend = null; word++; return; }
          // "consultancy" + <i class="stop">.</i>: keep them on one line, as they were
          if (pend && /^\S/.test(c.textContent)) { pend.appendChild(c); if (!chars) { pend = null; return; } }
          pend = null;
          walk(c);
        }
      });
    }
    walk(el);
    // 3. screen readers get the words once
    if (hide && !opt.quiet) {
      if (/^(H[1-6]|A)$/.test(el.tagName)) el.setAttribute("aria-label", label);
      // the hidden copy goes just before the element, not inside it: the Origins drawing measures the words' own boxes
      else { var sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = label; el.parentNode.insertBefore(sr, el); }
    }
    // 4. kerning: a box per letter loses the pair spacing; put it back as a margin, so every unit sits where it was
    var sc = scaleOf(el), fs = parseFloat(getComputedStyle(el).fontSize) || 16, resid = 0;
    if (mode !== "wi") {
      units.forEach(function (u) { var r = u.el.getBoundingClientRect(); u.nx = r.left; });
      var prev = null;
      units.forEach(function (u) {
        if (u.o && prev && prev.o && Math.abs(u.o.y - prev.o.y) < 2 && u.o.w > 0) {
          var m = ((u.o.x - prev.o.x) - (u.nx - prev.nx)) / sc;
          if (Math.abs(m) > .05) u.el.style.marginLeft = (m / fs).toFixed(4) + "em";
        }
        prev = u;
      });
      units.forEach(function (u) { if (u.o && u.o.w > 0) resid = Math.max(resid, Math.abs(u.el.getBoundingClientRect().left - u.o.x) / sc); });
    }
    // 5. letters whose weight or face changes keep the width of their final look
    if (opt.lock) units.forEach(function (u) {
      if (opt.lock !== true && !opt.lock(u)) return;
      var w = u.el.getBoundingClientRect().width / sc;
      u.el.style.width = (w / fs).toFixed(4) + "em"; u.el.style.textAlign = "center";
    });
    var post = [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight];
    report.push({ sel: opt.name || el.className, mode: mode, units: units.length, pre: pre.join(","), post: post.join(","), resid: +resid.toFixed(2), label: label, aria: el.getAttribute("aria-label") ? "aria-label" : (el.previousSibling && el.previousSibling.className === "sr-only" ? "sr-only" : "plain") });
    return units;
  }

  /* ---------- writing styles ---------- */
  var writes = 0;
  function put(u, k, v) { if (!u.keys) u.keys = {}; u.keys[k] = 1; u.el.style[k] = v; writes++; }
  function text(u, t) { if (u.el.textContent !== t) { u.el.textContent = t; u.texted = true; writes++; } }
  function clear(u) {
    if (u.keys) { for (var k in u.keys) u.el.style[k] = ""; u.keys = null; writes++; }
    if (u.texted) { u.el.textContent = u.ch; u.texted = false; }
  }

  /* ---------- pages and their pieces ----------
     A piece: units, timing (a, b, d, ease, slot order) and set(u, e, x) for 0 <= x < 1 (e = eased, x = linear).
     Unit i of n starts at a + (b - a - d - R) * k / (n - 1) (+ a small ripple j * rj, at most R), k = its slot. */
  var pages = [];
  function pageOf(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    for (var i = 0; i < pages.length; i++) if (pages[i].el === el) return pages[i];
    var pg = { el: el, idx: B.panels.indexOf(el), pieces: [], p: -1, auto: 0 };
    pages.push(pg);
    return pg;
  }
  function piece(id, sel, mode, cfg, opt) {
    var pg = pageOf(id); if (!pg) return null;
    var els = pg.el.querySelectorAll(sel); if (!els.length) return null;
    var units = [];
    Array.prototype.forEach.call(els, function (el) { units = units.concat(split(el, mode, Object.assign({ name: id + " " + sel }, opt || {}))); });
    units.forEach(function (u, i) { u.i = i; });
    cfg.units = units; cfg.page = pg;
    cfg.a = cfg.a || 0; cfg.b = cfg.b == null ? 1 : cfg.b; cfg.ease = E[cfg.ease || "eO"];
    pg.pieces.push(cfg);
    return cfg;
  }

  // metrics + slots, redone on every layout (font sizes follow the screen)
  function measure(pc) {
    pc.units.forEach(function (u) {
      u.x = u.el.offsetLeft; u.y = u.el.offsetTop; u.w = u.el.offsetWidth; u.h = u.el.offsetHeight;
      u.fs = parseFloat(getComputedStyle(u.el).fontSize) || 16; u.last = -1;
    });
    var order = pc.order || "read", us = pc.units, n = us.length;
    if (order === "read") us.forEach(function (u) { u.k = u.i; u.j = 0; });
    else if (order === "line") {
      var lines = [];
      us.slice().sort(function (a, b) { return a.y - b.y || a.i - b.i; }).forEach(function (u) {
        var L = lines[lines.length - 1];
        if (!L || Math.abs(u.y - L.y) > u.fs * .3) { L = { y: u.y, l: 1e9, r: -1e9, us: [] }; lines.push(L); }
        u.k = lines.length - 1; u.j = L.us.length; L.us.push(u);
        L.l = Math.min(L.l, u.x); L.r = Math.max(L.r, u.x + u.w);
      });
      pc.lines = lines; n = lines.length;
    } else if (order === "sent") {
      var cnt = {};
      us.forEach(function (u) { u.k = u.s; u.j = cnt[u.s] = (cnt[u.s] || 0); cnt[u.s]++; });
      n = us.length ? us[us.length - 1].s + 1 : 0;
    } else if (order === "ctr") {
      us.slice().sort(function (a, b) { return Math.abs(a.i - (n - 1) / 2) - Math.abs(b.i - (n - 1) / 2) || a.i - b.i; })
        .forEach(function (u, r) { u.k = r; u.j = 0; });
    } else if (Array.isArray(order)) us.forEach(function (u) { u.k = order.indexOf(u.i); u.j = 0; });
    pc.n = n;
    if (pc.layout) pc.layout(pc);
  }
  function startOf(pc, u) {
    if (pc.start) return pc.start(u, pc);
    var R = pc.R || 0;
    return pc.a + (pc.b - pc.a - pc.d - R) * (pc.n > 1 ? u.k / (pc.n - 1) : 0) + Math.min(R, (u.j || 0) * (pc.rj || 0));
  }
  function paintPiece(pc, p) {
    if (pc.paint) return pc.paint(pc, p);
    for (var q = 0; q < pc.units.length; q++) {
      var u = pc.units[q], s = startOf(pc, u), x = seg(p, s, s + (u.d || pc.d));
      if (x === u.last) continue;
      u.last = x;
      if (x >= 1) clear(u); else pc.set(u, pc.ease(x), x, pc);
    }
  }
  function blurPx(u, em) { return "blur(" + (em * u.fs).toFixed(2) + "px)"; }

  /* ---------- 01 Hello: thin ink that thickens ---------- */
  function buildAll() {
    piece("top", "h1.giant", "c", {
      a: 0, b: .75, d: .4, ease: "eO",
      set: function (u, e, x) {
        var tr = "translateY(" + f3(.4 * (1 - e)) + "em)";
        if (u.stop) tr += " scale(" + f3(lerp(2.2, 1, E.eB(x))) + ")";
        put(u, "transform", tr);
        put(u, "opacity", f3(seg(x, 0, .35)));
        put(u, "filter", blurPx(u, .06 * (1 - e)));
        put(u, "fontWeight", x < .3 ? "400" : x < .6 ? "500" : "800");
      }
    }, { lock: true });
    piece("top", ".hero-foot p", "w", {            // a reading light along the sentence
      a: .3, b: 1, d: .22, ease: "lin",
      set: function (u, e) { put(u, "opacity", f3(lerp(.16, 1, e))); }
    });

    /* ---------- 02 Now: a loom, then a ruler pass ---------- */
    piece("approach", ".now-left h2.big", "w", {
      a: 0, b: .7, d: .5, ease: "eIO", order: "line",
      set: function (u, e, x) {
        var dir = u.k % 2 ? 1 : -1, r = 1 - e;
        put(u, "transform", "translateX(" + (dir * .14 * VW * r).toFixed(1) + "px) skewX(" + (dir * 9 * r).toFixed(2) + "deg)");
        put(u, "filter", "blur(" + (5 * r).toFixed(2) + "px)");
        put(u, "opacity", f3(seg(x, 0, .5)));
      }
    });
    piece("approach", ".now-bg", "w", {
      a: .25, b: 1, d: .4, ease: "eIO", order: "line",
      set: function (u, e, x, pc) {
        var L = pc.lines[u.k], wx = lerp(L.l, L.r, e), cut = u.x + u.w - wx;
        put(u, "opacity", f3(seg(x, 0, .4)));
        put(u, "clipPath", cut <= 0 ? "none" : cut >= u.w ? "inset(0 100% 0 0)" : "inset(-.3em " + cut.toFixed(1) + "px -.3em -.3em)");
      }
    });
    /* the Sisco Solutions card (2026-11-06): the window's frame draws itself, its bar opens and the three dots pop,
       the address types, the picture of the home page wipes in from the top like a page loading; then the label types
       and the name rises. At rest nothing is left on it (the link and its picture as written). */
    var card = document.querySelector("#approach .sisco-card"), ap = pageOf("approach");
    if (card && ap) {
      var cu = [];
      var cunit = function (sel, role, j) { var el = typeof sel === "string" ? card.querySelector(sel) : sel; if (el) cu.push({ el: el, i: cu.length, last: -1, keys: null, ch: el.textContent, role: role, j: j || 0 }); };
      cunit(".sc-edge rect", "edge"); cunit(".sc-bar", "bar");
      Array.prototype.forEach.call(card.querySelectorAll(".sc-dot"), function (d, j) { cunit(d, "dot", j); });
      cunit(".sc-addr", "addr"); cunit(".sc-view", "view"); cunit(".sc-label", "label"); cunit(".sc-name", "name");
      var CT = { edge: [0, .42], bar: [.26, .46], dot: [.38, .5], addr: [.46, .7], view: [.34, .74], label: [.56, .8], name: [.62, 1] };
      ap.pieces.push({
        units: cu, page: ap, a: 0, b: 1, d: 1, ease: E.lin, order: "read",
        paint: function (pc, p) {
          pc.units.forEach(function (u) {
            var w = CT[u.role], x = u.role === "dot" ? seg(p, w[0] + .05 * u.j, w[1] + .05 * u.j) : seg(p, w[0], w[1]);
            var key = u.role === "addr" || u.role === "label" ? Math.round(x * u.ch.length) / u.ch.length : x;
            if (key === u.last) return;
            u.last = key;
            if (x >= 1) { clear(u); return; }
            var e = E.eIO(x);
            if (u.role === "edge") put(u, "strokeDashoffset", f3(1 - e));
            else if (u.role === "bar") put(u, "clipPath", "inset(0 " + (100 * (1 - E.eO(x))).toFixed(1) + "% 0 0)");
            else if (u.role === "dot") { put(u, "transform", "scale(" + f3(Math.max(0, E.eB(x))) + ")"); put(u, "opacity", f3(seg(x, 0, .3))); }
            else if (u.role === "addr" || u.role === "label") { text(u, u.ch.slice(0, Math.round(x * u.ch.length))); put(u, "opacity", x > 0 ? "1" : "0"); }
            else if (u.role === "view") { put(u, "clipPath", "inset(0 0 " + (100 * (1 - e)).toFixed(1) + "% 0)"); put(u, "opacity", f3(seg(x, 0, .2))); }
            else if (u.role === "name") {
              var r = 1 - E.eO(x);
              put(u, "transform", "translateY(" + f3(.55 * r) + "em)"); put(u, "opacity", f3(seg(x, 0, .5))); put(u, "filter", "blur(" + (3 * r).toFixed(2) + "px)");
            }
          });
        }
      });
      report.push({ sel: "approach .sisco-card", mode: "card", units: cu.length, label: card.getAttribute("aria-label"), aria: "aria-label" });
    }

    /* ---------- 03 Drafting: elevations rising off a ground line; a dimension line ---------- */
    var dr = piece("work", ".proj-name", "c", {
      a: 0, b: .7, d: .45, ease: "eO",
      set: function (u, e, x) {
        put(u, "transform", "scaleY(" + f3(lerp(.02, 1, e)) + ")");
        put(u, "opacity", f3(seg(x, 0, .25)));
      }
    });
    if (dr) dr.units.forEach(function (u) { u.el.style.transformOrigin = "50% 100%"; });
    piece("work", ".frame figcaption", "w", {
      a: .3, b: 1, d: .3, ease: "eX",
      set: function (u, e, x) {
        put(u, "transform", "translateX(" + f3(-1.1 * (1 - e)) + "em)");
        put(u, "opacity", f3(seg(x, 0, .6)));
      }
    });

    /* ---------- 03 The Pitch: a spotlight; points in a talk ---------- */
    var pitch = pageOf("work-2"), pt = pitch && pitch.el.querySelector(".proj-name");
    if (pt) {
      pt.style.transformOrigin = "0 50%";
      pitch.pieces.push({
        units: [{ el: pt, i: 0, last: -1, keys: null, ch: null }], page: pitch, a: 0, b: .75, d: .75, ease: E.eIO,
        set: function (u, e) {
          var m = lerp(-25, 125, e), g = "linear-gradient(90deg, #000 " + (m - 25).toFixed(1) + "%, transparent " + m.toFixed(1) + "%)";
          put(u, "webkitMaskImage", g); put(u, "maskImage", g);
          put(u, "transform", "translateX(" + f3(-1.5 * (1 - e)) + "%) scale(" + f3(lerp(.97, 1, e)) + ")");
        }
      });
    }
    piece("work-2", ".lv-lede", "w", {
      a: .15, b: .85, d: .35, ease: "eO",
      set: function (u, e, x) {
        put(u, "transform", "translateY(" + f3(.55 * (1 - e)) + "em)");
        put(u, "filter", blurPx(u, .13 * (1 - e)));
        put(u, "opacity", f3(seg(x, 0, .5)));
      }
    });
    piece("work-2", ".lv-body", "w", {
      a: .35, b: 1, d: .3, ease: "eO", order: "sent", R: .06, rj: .012,
      set: function (u, e, x) {
        put(u, "transform", "translateY(" + f3(.5 * (1 - e)) + "em)");
        put(u, "opacity", f3(seg(x, 0, .6)));
      }
    });

    /* ---------- 04 Artwork: paint drops; a focus pull ---------- */
    var ar = piece("creative", ".proj-name", "c", {
      a: 0, b: .8, d: .35, ease: "eB", order: [3, 0, 5, 2, 6, 1, 4],
      set: function (u, e, x) {
        put(u, "transform", "translateY(" + f3(-.9 * (1 - e)) + "em) rotate(" + (u.rot * (1 - e)).toFixed(2) + "deg)");
        put(u, "opacity", f3(seg(x, 0, .3)));
      }
    });
    if (ar) { var rr = rnd(7); ar.units.forEach(function (u) { u.rot = (rr() < .5 ? -1 : 1) * (7 + 9 * rr()); }); }
    piece("creative", ".frame figcaption", "w", {
      a: .3, b: 1, d: .35, ease: "eO", order: "ctr",
      set: function (u, e, x) {
        put(u, "filter", "blur(" + (10 * (1 - e)).toFixed(2) + "px)");
        put(u, "transform", "scale(" + f3(lerp(1.06, 1, e)) + ")");
        put(u, "opacity", f3(seg(x, 0, .7)));
      }
    });

    /* ---------- 04 Garments: a weave; a running stitch ---------- */
    piece("creative-2", ".proj-name", "c", {
      a: 0, b: .7, d: .4, ease: "eO",
      set: function (u, e) {
        var even = u.i % 2 === 0, pad = .14 * u.fs, cut = ((1 - e) * (u.h + 2 * pad) - pad).toFixed(1), P = (-pad).toFixed(1) + "px";
        put(u, "clipPath", even ? "inset(" + P + " " + P + " " + cut + "px " + P + ")" : "inset(" + cut + "px " + P + " " + P + " " + P + ")");
        put(u, "transform", "translateY(" + f3((even ? -.25 : .25) * (1 - e)) + "em)");
      }
    });
    var gc = piece("creative-2", ".frame figcaption", "c", {
      a: .05, b: .91, d: .16, ease: "eO",
      start: function (u, pc) { var m = pc.pass[u.i % 3]; return .05 + .28 * (u.i % 3) + .14 * (m > 1 ? u.j / (m - 1) : 0); },
      layout: function (pc) { pc.pass = [0, 0, 0]; pc.units.forEach(function (u) { u.j = pc.pass[u.i % 3]++; }); },
      set: function (u, e) {
        put(u, "opacity", f3(e));
        put(u, "filter", "blur(" + (2 * (1 - e)).toFixed(2) + "px)");
      }
    });

    /* ---------- 05 What built me: handwriting into type; a typewriter; the tiles (type.css) ---------- */
    piece("built", "h2.big", "c", {
      a: 0, b: .75, d: .35, ease: "eIO",
      set: function (u, e) {
        var hand = e < .5;
        put(u, "fontFamily", hand ? "var(--serif)" : "");
        put(u, "fontStyle", hand ? "italic" : "");
        put(u, "fontWeight", hand ? "400" : "");
        put(u, "letterSpacing", hand ? "0" : "");
        put(u, "color", hand ? "#FF4D1A" : "");
        put(u, "transform", "translateY(" + (hand ? .12 : 0) + "em) scale(" + f3(1 + .1 * Math.sin(Math.PI * e)) + ")");
      }
    }, { lock: true });
    var lbls = document.querySelectorAll("#built .tiles-lbl");
    Array.prototype.forEach.call(lbls, function (el, k) {
      el.setAttribute("data-t-k", k);
      piece("built", '.tiles-lbl[data-t-k="' + k + '"]', "c", {
        a: k ? .25 : .05, b: k ? .6 : .45, d: .06, ease: "lin",
        set: function (u, e) { put(u, "opacity", f3(e)); }
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("#tiles .tile span"), function (el) {
      split(el, "wi", { name: "built .tile span" }).forEach(function (u, k) { u.el.style.setProperty("--i", k); });
    });

    /* ---------- 05 The vote: the echo first; a tally; the votes come in ---------- */
    var vote = pageOf("built-2"), vh = vote && vote.el.querySelector(".giant");
    if (vh) {
      var vlabel = vh.textContent.replace(/\s+/g, " ").trim();
      var vstop = vh.querySelector(".stop");
      var stopUnits = vstop ? split(vstop, "c", { quiet: true, name: "built-2 .giant .stop" }) : [];
      vh.setAttribute("aria-label", vlabel);
      var vl = Array.prototype.map.call(vh.querySelectorAll(".ln > span"), function (el, i) {
        el.setAttribute("aria-hidden", "true");
        return { el: el, i: i, last: -1, keys: null, ch: null };
      });
      report.push({ sel: "built-2 .giant", mode: "lines", units: vl.length + stopUnits.length, label: vlabel, aria: "aria-label" });
      vote.pieces.push({
        units: vl, page: vote, a: 0, b: .8, d: .5, ease: E.lin, order: "read",
        set: function (u, e, x) {
          // the orange echo of the line is there first, at its place; my words come in a little off and register onto it
          var g = .92 * seg(x, 0, .16) * (1 - seg(x, .55, 1));
          var a = seg(x, .2, .72);
          var off = 1 - E.eO(seg(x, .18, 1));
          var dx = (u.i % 2 ? 1 : -1) * .1 * u.fs * off, dy = .14 * u.fs * off;
          put(u, "transform", "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)");
          put(u, "color", "rgba(241,238,232," + f3(a) + ")");
          put(u, "textShadow", (-dx).toFixed(1) + "px " + (-dy).toFixed(1) + "px 0 rgba(255,77,26," + f3(g) + ")");
        }
      });
      if (stopUnits.length) vote.pieces.push({
        units: stopUnits, page: vote, a: .62, b: .9, d: .28, ease: E.lin,
        set: function (u, e, x) {
          put(u, "transform", "scale(" + f3(lerp(2, 1, E.eB(x))) + ")");
          put(u, "opacity", f3(seg(x, 0, .3)));
        }
      });
      stopUnits.forEach(function (u) { u.el.style.transformOrigin = "50% 70%"; });
    }
    piece("built-2", ".ceo-fact", "c", {
      // the tally: marks arrive at random, then each turns into its letter, left to right
      paint: function (pc, p) {
        pc.units.forEach(function (u) {
          var a = seg(p, u.sA, u.sA + .1), r = p >= u.sR, key = a + (r ? 2 : 0);
          if (key === u.last) return;
          u.last = key;
          if (a >= 1 && r) { clear(u); return; }
          put(u, "opacity", f3(a));
          text(u, r ? u.ch : "|");
        });
      },
      layout: function (pc) {
        var n = pc.units.length, ord = shuffle(n, 11);
        pc.units.forEach(function (u) { u.sA = .4 * ord.indexOf(u.i) / Math.max(1, n - 1); u.sR = .22 + .48 * u.i / Math.max(1, n - 1); });
      }
    });
    piece("built-2", ".ceo-body", "w", {
      a: .2, b: 1, d: .2, ease: "eO",
      start: function (u, pc) { return u.s < 3 ? .2 + .5 * pc.rank[u.i] / Math.max(1, pc.nr - 1) : .74 + .016 * u.j; },
      layout: function (pc) {
        var early = pc.units.filter(function (u) { return u.s < 3; }), ord = shuffle(early.length, 5);
        pc.rank = {}; pc.nr = early.length;
        early.forEach(function (u, k) { pc.rank[u.i] = ord[k]; });
        var j = 0; pc.units.forEach(function (u) { if (u.s >= 3) u.j = j++; });
      },
      set: function (u, e, x) {
        if (u.s < 3) {
          put(u, "transform", "translateY(" + f3(.28 * (1 - e)) + "em)");
          put(u, "opacity", f3(seg(x, 0, .6)));
        } else {
          // the last sentence lands last, a little larger first, and brighter on the way in
          put(u, "transform", "scale(" + f3(lerp(1.08, 1, e)) + ")");
          put(u, "opacity", f3(seg(x, 0, .45)));
          var c = Math.sin(Math.PI * e);
          put(u, "color", "rgb(" + Math.round(lerp(214, 255, c * .3)) + "," + Math.round(lerp(211, 248, c * .3)) + "," + Math.round(lerp(205, 240, c * .3)) + ")");
        }
      }
    });

    /* ---------- 06 Origins: pulled in from the right; the year counts up ---------- */
    var on = piece("origins", ".about-name", "c", {
      a: 0, b: .75, d: .4, ease: "eX",
      layout: function (pc) {
        var k = 0, n = pc.units.filter(function (u) { return !u.digit; }).length;
        pc.units.forEach(function (u) { if (!u.digit) { u.k = k++; u.reach = 1 + .35 * u.k / Math.max(1, n - 1); } });
        pc.n = n;
      },
      paint: function (pc, p) {
        var yr = Math.round(lerp(2000, 2013, E.eO(seg(p, .15, .7)))), ys = String(yr), dk = 0;
        pc.units.forEach(function (u) {
          if (u.digit) {
            var d = u.dk = dk++, xo = seg(p, .08, .2), key = p >= .7 ? 1 : xo + yr * 10;
            if (key === u.last) return;
            u.last = key;
            if (p >= .7) { clear(u); return; }
            put(u, "opacity", f3(xo));
            text(u, ys.charAt(d));
            return;
          }
          var s = startOf(pc, u), x = seg(p, s, s + pc.d);
          if (x === u.last) return;
          u.last = x;
          if (x >= 1) { clear(u); return; }
          var e = E.eX(x);
          put(u, "transform", "translateX(" + (.12 * VW * u.reach * (1 - e)).toFixed(1) + "px)");
          put(u, "filter", "blur(" + (4 * (1 - e)).toFixed(2) + "px)");
          put(u, "opacity", f3(seg(x, 0, .3)));
        });
      }
    }, { lock: function (u) { return /\d/.test(u.ch); } });
    if (on) on.units.forEach(function (u) { u.digit = /\d/.test(u.ch); });
    piece("origins", ".about-body p", "w", {
      a: .3, b: 1, d: .3, ease: "eO", order: "line",
      set: function (u, e, x) {
        put(u, "transform", "translateX(" + (.03 * VW * (1 - e)).toFixed(1) + "px)");
        put(u, "opacity", f3(x));
      }
    });

    /* ---------- 07 Today: gathered from a scatter; a rise; an orange wave ---------- */
    piece("contact", ".giant", "c", {
      a: 0, b: .7, d: .5, ease: "eX",
      layout: function (pc) {
        var lines = [];
        pc.units.forEach(function (u) {
          var L = lines[lines.length - 1];
          if (!L || Math.abs(u.y - L.y) > u.fs * .3) { L = { y: u.y, l: 1e9, r: -1e9, us: [] }; lines.push(L); }
          L.us.push(u); L.l = Math.min(L.l, u.x); L.r = Math.max(L.r, u.x + u.w);
        });
        lines.forEach(function (L) { var cx = (L.l + L.r) / 2; L.us.forEach(function (u) { u.dist = u.x + u.w / 2 - cx; }); });
        pc.units.slice().sort(function (a, b) { return Math.abs(a.dist) - Math.abs(b.dist) || a.i - b.i; }).forEach(function (u, r) { u.k = r; });
        pc.n = pc.units.length;
      },
      set: function (u, e, x) {
        var r = 1 - e;
        put(u, "transform", "translate(" + (u.dist * .75 * r).toFixed(1) + "px," + f3((u.i % 2 ? .15 : -.15) * r) + "em)");
        put(u, "filter", blurPx(u, .045 * r));
        put(u, "opacity", f3(seg(x, 0, .4)));
      }
    });
    piece("contact", ".contact-now", "w", {
      a: .2, b: 1, d: .4, ease: "eO", order: "line",
      set: function (u, e) {
        var d = 1.05 * u.h * (1 - e);
        put(u, "transform", "translateY(" + d.toFixed(1) + "px)");
        put(u, "clipPath", "inset(-.3em -.3em " + d.toFixed(1) + "px -.3em)");
      }
    });
    // Instagram and LinkedIn (2026-11-06): each rises out of a little blur, one after the other, after the line above
    var socs = document.querySelectorAll("#contact .socials .soc"), ct = pageOf("contact");
    if (socs.length && ct) {
      ct.pieces.push({
        units: Array.prototype.map.call(socs, function (el, j) { return { el: el, i: j, last: -1, keys: null, ch: null }; }),
        page: ct, a: .3, b: .9, d: .45, ease: E.eO, order: "read",
        set: function (u, e, x) {
          put(u, "transform", "translateY(" + f3(.7 * (1 - e)) + "em)");
          put(u, "opacity", f3(seg(x, 0, .5)));
          put(u, "filter", "blur(" + (3 * (1 - e)).toFixed(2) + "px)");
        }
      });
    }
    piece("contact", ".contact-big", "ci", {
      a: .35, b: 1, d: .25, ease: "lin",
      set: function (u, e) {
        var c = e < .5 ? [lerp(241, 255, e * 2), lerp(238, 77, e * 2), lerp(232, 26, e * 2), lerp(.2, 1, e * 2)]
          : [lerp(255, 241, e * 2 - 1), lerp(77, 238, e * 2 - 1), lerp(26, 232, e * 2 - 1), 1];
        put(u, "color", "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + f3(c[3]) + ")");
      }
    });

    // the full stops that get their own flourish
    pages.forEach(function (pg) { pg.pieces.forEach(function (pc) { pc.units.forEach(function (u) { u.stop = !!(u.el.parentNode && u.el.parentNode.closest && u.el.parentNode.closest(".stop")); }); }); });
  }

  /* ---------- driving it ---------- */
  var F = null, ready = false, suspended = false, lastNow = 0, raf = 0;
  var stats = { ticks: 0, ms: 0, max: 0, maxWrites: 0, painted: 0 };
  function relayout() {
    VW = root.clientWidth;
    pages.forEach(function (pg) { pg.p = -1; pg.pieces.forEach(measure); });
  }
  function clearAll() {
    pages.forEach(function (pg) { pg.p = -1; pg.pieces.forEach(function (pc) { pc.units.forEach(function (u) { clear(u); u.last = -1; }); }); });
  }
  function tick() {
    if (!ready || !F) return;
    var now = performance.now(), dt = Math.min(100, Math.max(0, now - (lastNow || now))) / 1000, again = false;
    lastNow = now; writes = 0;
    var c = F.c;
    for (var q = 0; q < pages.length; q++) {
      var pg = pages[q], i = pg.idx, ht = F.holdT(i), pS = seg(ht, 0, SETTLE);
      if (AUTO) {
        if (c.at === i && c.move < 0) { if (pg.auto < 1) { pg.auto = Math.min(1, pg.auto + dt / AUTO_S); again = true; } }
        else if (ht <= 0 && pg.auto > 0) { pg.auto = Math.max(0, pg.auto - dt / BACK_S); again = true; }
      } else pg.auto = 0;
      var p = Math.max(pS, pg.auto);
      if (suspended || pg.el.style.visibility === "hidden") continue;
      if (p === pg.p) continue;   // units whose own progress didn't change are skipped below
      pg.p = p; stats.painted++;
      for (var k = 0; k < pg.pieces.length; k++) paintPiece(pg.pieces[k], p);
    }
    var ms = performance.now() - now;
    stats.ticks++; stats.ms += ms; stats.max = Math.max(stats.max, ms); stats.maxWrites = Math.max(stats.maxWrites, writes);
    if (again && !raf) raf = requestAnimationFrame(function () { raf = 0; tick(); });
  }
  B.onFrame(function (f) { F = f; tick(); });
  B.onLayout(function () { if (!ready) return; relayout(); suspended = false; });
  // a resize re-measures the words (the Origins drawing, the Drafting frame): show them at rest first
  window.addEventListener("resize", function () { if (!ready) return; suspended = true; clearAll(); });

  function init() {
    if (ready) return;
    root.classList.add("type-on");
    try { buildAll(); } catch (err) { root.classList.remove("type-on"); throw err; }
    ready = true;
    relayout();
    tick();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();

  // for checking: autoplay off/on, what was split, per-frame cost
  window.__type = {
    autoplay: function (on) { AUTO = !!on; pages.forEach(function (pg) { pg.auto = 0; pg.p = -1; }); tick(); },
    info: function () {
      var sel = window.getSelection();
      return {
        ready: ready, pages: pages.map(function (pg) {
          var n = 0; pg.pieces.forEach(function (pc) { n += pc.units.length; });
          return { id: pg.el.id, animated: n, pieces: pg.pieces.length };
        }),
        splits: report.map(function (r) { return r; }),
        copy: ["#top h1.giant", "#approach .now-bg", "#creative-2 figcaption", "#built-2 .ceo-fact", "#origins .about-name", "#contact .contact-big"].map(function (s) {
          var el = document.querySelector(s); if (!el) return s + ": none";
          var r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r);
          var t = sel.toString().replace(/\s+/g, " ").trim(); sel.removeAllRanges(); return s + ": " + t;
        })
      };
    },
    stats: function (reset) {
      if (reset) stats = { ticks: 0, ms: 0, max: 0, maxWrites: 0, painted: 0 };
      return { ticks: stats.ticks, painted: stats.painted, avgMs: +(stats.ms / Math.max(1, stats.ticks)).toFixed(3), maxMs: +stats.max.toFixed(2), maxWrites: stats.maxWrites };
    }
  };
})();
