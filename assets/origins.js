/* Origins (Kino's sketch 7, 2026-11-05): the pieces that are not the line.
   The line itself draws the hoop, the net, the drop, the wave and the water (blend.js, ROUTES.origins).
   Here: the basketball that arcs in from the left and drops through the net, the stick surfer who rides
   down the wave's face and falls head first into the water, his board, and the splash.
   Everything follows the page's own rest (holdT) and the timeline shared with the line (OG.T), so it all
   runs backwards when you scroll back. Reduced motion: the finished scene, still.
   The pieces sit under the line (inserted before the page's .pthread) and under all the words. */
(function () {
  "use strict";
  var B = window.__blend;
  var page = document.getElementById("origins");
  if (!B || !B.origins || !page) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";
  function mk(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    for (var a in attrs) el.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(v, w) { return clamp01((v - w[0]) / (w[1] - w[0])); }   // w = [from, to]
  function lerp(a, b, e) { return a + (b - a) * e; }
  function easeIn(v) { return v * v; }
  function easeOut(v) { return 1 - (1 - v) * (1 - v); }
  function easeIO(v) { return v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2; }
  function rot(x, y, deg) { var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c]; }
  function quad(a, c, b, u) { var v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }
  function f1(v) { return v.toFixed(1); }
  function show(el, o) { el.style.opacity = o > 0.001 ? o.toFixed(3) : "0"; }

  /* ---------- the scene: one svg under the line ---------- */
  var svg = mk("svg", { "class": "pscene", "aria-hidden": "true" });
  page.insertBefore(svg, page.querySelector(".pthread") || page.firstChild);
  var clipRect = mk("rect", { x: -5000, y: -5000, width: 20000, height: 5000 },
    mk("clipPath", { id: "ogWater", clipPathUnits: "userSpaceOnUse" }, mk("defs", {}, svg)));
  var measure = mk("path", { "class": "og-measure" }, svg);
  // the ball and its speed lines (Kino drew three)
  var trail = [0, 1, 2].map(function () { return mk("path", { "class": "og-trail" }, svg); });
  var ballG = mk("g", {}, svg);
  mk("circle", { "class": "og-ball", cx: 0, cy: 0, r: 14 }, ballG);
  mk("path", { d: "M0 -14 V14 M-14 0 H14 M-9.9 -9.9 Q-4.5 0 -9.9 9.9 M9.9 -9.9 Q4.5 0 9.9 9.9" }, ballG);
  // the board, then the surfer: clipped at the water, so his head goes under
  var boardG = mk("g", {}, svg);
  mk("path", { d: "M-24 -1 C-12 3.4 12 3.2 26 -3.6 C13 -1.4 -10 -2.6 -24 -1 Z" }, boardG);
  var surfG = mk("g", { "clip-path": "url(#ogWater)" }, svg);
  var limbs = mk("path", {}, surfG), head = mk("circle", { r: 5 }, surfG);
  // the splash: a ring on the water, rays thrown up, drops
  var splG = mk("g", {}, svg);
  var ring = mk("ellipse", {}, splG);
  // [degrees from upright, length]: thrown up round his legs, leaving them clear
  var RAYS = [[-80, 11], [-60, 17], [-40, 21], [40, 21], [60, 17], [80, 11]];
  var rays = RAYS.map(function () { return mk("path", {}, splG); });
  var DROPS = [[-34, -32], [-16, -45], [7, -50], [26, -40], [41, -21]];
  var drops = DROPS.map(function () { return mk("circle", { "class": "og-drop", r: 1.8 }, splG); });

  /* ---------- the surfer's poses: joints around his hip, in figure units (ks), facing right, up = -y ---------- */
  // shoulder, head, front elbow + hand, back elbow + hand (legs are worked out from where his feet are)
  var UPPER_RIDE = { sh: [3, -15], hd: [4.6, -21.5], ef: [9.5, -11], hf: [17, -13.5], eb: [-4, -18], hb: [-11.5, -15] };
  var DIVE = { fb: [-1.5, 21.5], kb: [-1, 10.7], ff: [2, 21.8], kf: [1.6, 10.9],
    sh: [1.5, -15], hd: [2.5, -21.6], ef: [5, -22], hf: [6, -30], eb: [2.6, -22.6], hb: [3.2, -30.5] };
  var LEGS_UP = { fb: [-11, 18.2], kb: [-3.2, 10.6], ff: [8.6, 19.4], kf: [5.4, 9.4] };
  var JOINTS = ["fb", "kb", "ff", "kf", "sh", "hd", "ef", "hf", "eb", "hb"];
  function knee(f, fwd) {
    // two-bone leg (thigh = shin = 11): the knee bends forward
    var d = Math.hypot(f[0], f[1]), h = d < 22 ? Math.sqrt(121 - d * d / 4) : 0;
    return [f[0] / 2 + f[1] / d * h * fwd, f[1] / 2 - f[0] / d * h * fwd];
  }

  var G = null, k = 1, ks = 1, kb = 1, faceLen = 1, Lstart = 0, Lend = 1, I = [0, 0];
  var ball = {}, last = -2;

  function faceAt(L) {
    L = Math.max(0, Math.min(faceLen, L));
    var a = measure.getPointAtLength(Math.max(0, L - .8)), b = measure.getPointAtLength(Math.min(faceLen, L + .8));
    var p = measure.getPointAtLength(L);
    return { x: p.x, y: p.y, a: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
  }

  // standing on his board at length L down the face
  function rideAt(L, t) {
    var f = faceAt(L), ba = Math.max(-6, Math.min(48, f.a));
    var n = rot(0, -2.4, ba), bc = [f.x + n[0], f.y + n[1]];
    var wob = 2.5 * Math.sin(t * 70);
    var body = ba * .3 + wob;                             // he stays more upright than his board
    var hb = rot(-1.5 * ks, -2 * ks, ba), up = rot(0, -16.5 * ks, body);
    var hip = [bc[0] + hb[0] + up[0], bc[1] + hb[1] + up[1]];
    var P = {};
    [["fb", -9.5], ["ff", 9.5]].forEach(function (ft) {
      var o = rot(ft[1] * ks, -2.2 * ks, ba), fx = bc[0] + o[0] - hip[0], fy = bc[1] + o[1] - hip[1];
      P[ft[0]] = rot(fx / ks, fy / ks, -body);
    });
    P.kb = knee(P.fb, 1); P.kf = knee(P.ff, 1);
    for (var j in UPPER_RIDE) P[j] = UPPER_RIDE[j].slice();
    P.hf[1] += wob * .6; P.hb[1] -= wob * .5;
    return { hip: hip, ang: body, P: P, board: { x: bc[0], y: bc[1], a: ba } };
  }
  function drawFigure(hip, ang, P, scale) {
    var s = ks * scale;
    function at(q) { var r = rot(q[0] * s, q[1] * s, ang); return f1(hip[0] + r[0]) + " " + f1(hip[1] + r[1]); }
    var H0 = f1(hip[0]) + " " + f1(hip[1]);
    limbs.setAttribute("d",
      "M " + at(P.fb) + " L " + at(P.kb) + " L " + H0 + " L " + at(P.kf) + " L " + at(P.ff) +   // legs
      " M " + H0 + " L " + at(P.sh) +                                                              // body
      " M " + at(P.hf) + " L " + at(P.ef) + " L " + at(P.sh) + " L " + at(P.eb) + " L " + at(P.hb)); // arms
    var hd = rot(P.hd[0] * s, P.hd[1] * s, ang);
    head.setAttribute("cx", f1(hip[0] + hd[0])); head.setAttribute("cy", f1(hip[1] + hd[1]));
    head.setAttribute("r", f1(5 * s));
  }
  function drawBoard(x, y, a, scale) {
    boardG.setAttribute("transform", "translate(" + f1(x) + " " + f1(y) + ") rotate(" + a.toFixed(1) + ") scale(" + (ks * scale).toFixed(3) + ")");
  }

  /* ---------- layout ---------- */
  function layout() {
    G = B.origins();
    if (!G || !G.faceD) return;
    k = G.k; ks = G.ks; kb = G.kb || G.k;
    measure.setAttribute("d", G.faceD);
    faceLen = measure.getTotalLength();
    // he can stand on the face once it is under 58 degrees
    Lstart = faceLen * .35;
    for (var L = 0; L < faceLen; L += 1.5) { if (faceAt(L).a < 58) { Lstart = L; break; } }
    Lend = faceLen - 30 * k;
    I = G.w(212, 0);
    clipRect.setAttribute("height", f1(5000 + G.O.y + .6));
    // the ball: from the left, up over the top, down into the rim; through the net; falls away
    var r = 14 * kb, nm = G.name, top = Math.max(G.kick.b + 14, 84);
    ball.r = r;
    ball.E = G.h(-33, -16);
    ball.S = [Math.max(nm.l + r + 24, G.H.x - 330 * k), Math.min(G.H.y + 40 * k, nm.t - r - 14)];
    var yA = Math.max(top + r + 6, Math.min(ball.S[1], ball.E[1]) - 150 * k);
    ball.C = [lerp(ball.S[0], ball.E[0], .7), yA - Math.sqrt(Math.max(0, (ball.S[1] - yA) * (ball.E[1] - yA)))];
    ball.N = G.h(-33, 52);
    ball.F = G.h(-33, 52 + (G.phone ? 44 : 70));
    // the board comes to rest at the foot of the face
    var rest = faceAt(faceLen - 56 * k), rn = rot(0, -2.6, rest.a);
    ball.rest = { x: rest.x + rn[0], y: rest.y + rn[1], a: Math.max(-8, Math.min(14, rest.a)) };
    last = -2;
  }

  /* ---------- paint at t (0..1 through the page's rest) ---------- */
  function paint(t) {
    var T = G.T;
    // the ball
    var r = ball.r, bx, by, ba = 0, sy = 1, bo = 1;
    if (reduce) { var nb = G.h(-33, 40); bx = nb[0]; by = nb[1]; ba = -35; }
    else if (t < T.fly[0]) { bx = ball.S[0]; by = ball.S[1]; bo = easeOut(seg(t, T.ball)); }
    else if (t < T.swish[0]) { var u = seg(t, T.fly), p = quad(ball.S, ball.C, ball.E, u); bx = p[0]; by = p[1]; ba = -560 * u; }
    else if (t < T.drop[0]) { var u2 = easeIn(seg(t, T.swish)); bx = ball.E[0]; by = lerp(ball.E[1], ball.N[1], u2); ba = -560 - 50 * u2; sy = 1 - .09 * Math.sin(Math.PI * u2); }
    else { var u3 = seg(t, T.drop); bx = ball.N[0]; by = lerp(ball.N[1], ball.F[1], easeIn(u3)); ba = -610 - 60 * u3; bo = 1 - seg(u3, [.2, 1]); }
    var bs = t < T.fly[0] && !reduce ? .6 + .4 * bo : 1;
    ballG.setAttribute("transform", "translate(" + f1(bx) + " " + f1(by) + ") rotate(" + ba.toFixed(1) + ") scale(" + (kb * bs).toFixed(3) + " " + (kb * bs * sy).toFixed(3) + ")");
    show(ballG, bo);
    // its speed lines, along the way it came
    var uf = reduce ? 0 : seg(t, T.fly), to = (t >= T.fly[0] && t < T.swish[0]) ? .8 * seg(uf, [.02, .16]) * (1 - seg(uf, [.62, .86])) : 0;
    trail.forEach(function (el, j) {
      show(el, to);
      if (!to) return;
      var off = [-.55, 0, .55][j] * r, from = Math.max(0, uf - (j === 1 ? .2 : .14)), till = Math.max(0, uf - .07), d = "";
      for (var s = 0; s <= 6; s++) {
        var v = lerp(from, till, s / 6), a = quad(ball.S, ball.C, ball.E, v), b = quad(ball.S, ball.C, ball.E, Math.min(1, v + .01));
        var nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1;
        d += (s ? " L " : "M ") + f1(a[0] + nx / nl * off) + " " + f1(a[1] + ny / nl * off);
      }
      el.setAttribute("d", d);
    });

    // the surfer: rides down the face behind the line's tip, then falls head first into the water
    // he drops in only once the line has drawn the face past where he stands
    var tip = faceLen * seg(t, T.W3);
    var so = reduce || t >= T.fall[0] ? 1 : clamp01((tip - 16 * k - Lstart) / (12 * k));
    show(surfG, so); show(boardG, so);
    if (so > 0) {
      if (!reduce && t < T.fall[0]) {
        var L = Math.max(Lstart, Math.min(lerp(Lstart, Lend, easeIn(seg(t, T.ride))), tip - 16 * k));
        var R = rideAt(L, t), pop = .78 + .22 * easeOut(so);
        drawFigure(R.hip, R.ang, R.P, pop);
        drawBoard(R.board.x, R.board.y, R.board.a, pop);
      } else {
        var u4 = reduce ? 1 : seg(t, T.fall);
        var R0 = rideAt(Lend, T.fall[0]);
        // the pose: from riding to diving (arms past his head, legs together), and his legs apart once he's in
        var P = {}, e1 = easeOut(seg(u4, [0, .45])), e2 = seg(u4, [.8, 1]);
        JOINTS.forEach(function (j) {
          var a = R0.P[j], b = DIVE[j];
          P[j] = [lerp(a[0], b[0], e1), lerp(a[1], b[1], e1)];
          if (LEGS_UP[j]) { P[j][0] = lerp(P[j][0], LEGS_UP[j][0], e2); P[j][1] = lerp(P[j][1], LEGS_UP[j][1], e2); }
        });
        // thrown forward over the nose: up, round and head first into the water just in front of the line
        var TH = 172, hd = rot(DIVE.hd[0] * ks, DIVE.hd[1] * ks, TH);
        var hipF = [I[0] - hd[0], I[1] + 4.5 * ks - hd[1]];
        var ctrl = [(R0.hip[0] + hipF[0]) / 2 + 6 * k, Math.min(R0.hip[1], hipF[1]) - 36 * k];
        var hp = quad(R0.hip, ctrl, hipF, u4);
        drawFigure(hp, lerp(R0.ang, TH, easeIO(u4)), P, 1);
        // the board: the nose digs in, it flips up behind him and lands at the foot of the wave, bobbing
        var u5 = reduce ? 1 : seg(t, [T.fall[0], T.fall[1] + .02]), br = ball.rest;
        var bp = quad([R0.board.x, R0.board.y], [R0.board.x + 6 * k, Math.min(R0.board.y, br.y) - 40 * k], [br.x, br.y], easeIO(u5));
        var bob = reduce ? 0 : 1.2 * k * Math.sin(Math.max(0, t - T.fall[1] - .02) * 44) * (1 - seg(t, [.9, 1]));
        drawBoard(bp[0], bp[1] + bob, lerp(R0.board.a, br.a + 360, easeIO(u5)), 1);
      }
    }

    // the splash where his head goes in
    var e = reduce ? 1 : seg(t, [T.splash[0] - .012, T.splash[1]]);
    show(splG, e > 0 ? 1 : 0);
    if (e > 0) {
      var er = easeOut(seg(e, [0, .6]));
      ring.setAttribute("cx", f1(I[0])); ring.setAttribute("cy", f1(I[1] + .8));
      ring.setAttribute("rx", f1(Math.max(.1, 23 * k * er))); ring.setAttribute("ry", f1(Math.max(.1, 4.6 * k * er)));
      var back = .42 * easeIO(seg(e, [.55, 1]));   // the rays draw out, then settle to their outer half
      RAYS.forEach(function (ry, i) {
        var dx = Math.sin(ry[0] * Math.PI / 180), dy = -Math.cos(ry[0] * Math.PI / 180), r0 = 13 * k, len = ry[1] * k;
        var a = r0 + len * back, b = r0 + len * easeOut(seg(e, [0, .55]));
        rays[i].setAttribute("d", "M " + f1(I[0] + dx * a) + " " + f1(I[1] + dy * a) + " L " + f1(I[0] + dx * Math.max(a, b)) + " " + f1(I[1] + dy * Math.max(a, b)));
      });
      DROPS.forEach(function (dp, i) {
        var ex = easeOut(seg(e, [.05, .8])), ey = easeOut(seg(e, [.05, .62])) - .2 * easeIn(seg(e, [.62, 1]));
        drops[i].setAttribute("cx", f1(I[0] + dp[0] * k * ex)); drops[i].setAttribute("cy", f1(I[1] - 5 * k + dp[1] * k * ey));
        show(drops[i], seg(e, [.05, .15]));
      });
    }
  }

  B.onLayout(layout);
  B.onFrame(function (f) {
    if (!G) return;
    var t = reduce ? 1 : f.holdT(G.index);
    if (t === last) return;
    last = t;
    paint(t);
  });
})();
