// Puppet-style rig for the three Navi.
// Every path of a character is bent each frame around a soft "spine", so the body,
// face, mouth, hat and headset squash, stretch and sway as one piece instead of
// sliding layers. Arms rotate at the shoulder first and are then bent with the body.
(function () {
  var svg = document.getElementById("art");
  var LOOP = 4500; // ms; the main Navi stands, crouches, jumps once and lands back

  /* ---------- path parsing ---------- */
  // turns any path into absolute M/L/C/Q/Z segments so every point can be moved
  function parse(d) {
    var toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g), i = 0, cmd = "", out = [];
    var x = 0, y = 0, sx = 0, sy = 0;
    function n() { return parseFloat(toks[i++]); }
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === "Z") { out.push({ c: "Z", p: [] }); x = sx; y = sy; continue; }
      if (C === "M" || C === "L") {
        var px = n() + (rel ? x : 0), py = n() + (rel ? y : 0);
        out.push({ c: C, p: [[px, py]] }); x = px; y = py;
        if (C === "M") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
      } else if (C === "H") { x = n() + (rel ? x : 0); out.push({ c: "L", p: [[x, y]] }); }
      else if (C === "V") { y = n() + (rel ? y : 0); out.push({ c: "L", p: [[x, y]] }); }
      else if (C === "C") {
        var a = [n(), n(), n(), n(), n(), n()];
        if (rel) { a[0] += x; a[1] += y; a[2] += x; a[3] += y; a[4] += x; a[5] += y; }
        out.push({ c: "C", p: [[a[0], a[1]], [a[2], a[3]], [a[4], a[5]]] }); x = a[4]; y = a[5];
      } else if (C === "Q") {
        var q = [n(), n(), n(), n()];
        if (rel) { q[0] += x; q[1] += y; q[2] += x; q[3] += y; }
        out.push({ c: "Q", p: [[q[0], q[1]], [q[2], q[3]]] }); x = q[2]; y = q[3];
      } else { throw new Error("Unsupported path command " + cmd); }
    }
    return out;
  }
  function write(segs, f) {
    var s = "";
    for (var k = 0; k < segs.length; k++) {
      var g = segs[k]; s += g.c;
      for (var j = 0; j < g.p.length; j++) { var q = f(g.p[j][0], g.p[j][1]); s += (j ? " " : "") + q[0].toFixed(2) + " " + q[1].toFixed(2); }
    }
    return s;
  }

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(u) { return u * u * (3 - 2 * u); }
  // smooth interpolation through [time, value] keys
  function key(t, ks) {
    if (t <= ks[0][0]) return ks[0][1];
    for (var k = 1; k < ks.length; k++) if (t <= ks[k][0]) {
      var a = ks[k - 1], b = ks[k], u = (t - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * ease(u);
    }
    return ks[ks.length - 1][1];
  }
  var TAU = Math.PI * 2, sin = Math.sin;
  function rot(x, y, cx, cy, deg) {
    var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }

  /* ---------- poses over time (t in seconds) ---------- */
  var POSE = {
    // calmer pass: 4.5s loop, ~2s standing, a smaller jump, softer squash and slower waves
    hero: function (t) {
      t = t % 4.5;
      var idle = 1 - key(t, [[1.9, 0], [2.1, 1], [3.55, 1], [3.85, 0]]);
      var sy = key(t, [[0, 1], [2.0, 1], [2.3, 0.93], [2.46, 1.05], [2.75, 1.01], [3.02, 1.02], [3.16, 0.93], [3.36, 1.025], [3.56, 0.995], [3.75, 1]]);
      sy += idle * 0.008 * sin(TAU * t / 0.75);
      return {
        lift: key(t, [[0, 0], [2.32, 0], [2.55, -9], [2.75, -13], [2.95, -8], [3.1, 0]]),
        sy: sy, sx: 1 + (1 - sy) * 0.6,
        bend: idle * 0.022 * sin(TAU * t / 1.5) + key(t, [[2.0, 0], [2.3, -0.025], [2.7, 0.03], [3.0, 0.01], [3.18, -0.02], [3.5, 0.008], [3.75, 0]]),
        armA: -4 + 12 * sin(TAU * t / 0.75),
        armB: idle * 2 * sin(TAU * t / 1.5) + key(t, [[2.0, 0], [2.32, 5], [2.72, -13], [3.1, 4], [3.4, 0]]),
        mouth: 1 + idle * 0.03 * Math.abs(sin(TAU * t / 0.75)) + key(t, [[2.35, 0], [2.72, 0.09], [3.15, 0]]),
        blink: Math.min(key(t, [[2.42, 1], [2.58, 0.4], [2.92, 0.4], [3.1, 1]]), key(t, [[0.9, 1], [0.96, 0.15], [1.04, 1]])),
        spark: 1 + key(t, [[2.45, 0], [2.75, 0.2], [2.95, 0.05], [3.25, 0]]),
        tuck: key(t, [[2.32, 0], [2.55, 8], [2.95, 8], [3.1, 0]])
      };
    },
    n1: function (t) {
      var sy = 1 + 0.015 * sin(TAU * t / 0.75);
      return {
        lift: -0.6 * Math.max(0, sin(TAU * t / 0.75)), sy: sy, sx: 1 + (1 - sy) * 0.6,
        bend: 0.03 * sin(TAU * t / 1.5),
        armA: -3 + 11 * sin(TAU * t / 0.8), armB: 0,
        mouth: 1 + 0.05 * Math.abs(sin(TAU * t / 0.8)),
        blink: key(t % 3.2, [[1.8, 1], [1.86, 0.15], [1.94, 1]]), spark: 1, tuck: 0
      };
    },
    n2: function (t) {
      t += 0.4;
      var sy = 1 + 0.015 * sin(TAU * t / 0.7);
      return {
        lift: -0.55 * Math.max(0, sin(TAU * t / 0.7)), sy: sy, sx: 1 + (1 - sy) * 0.6,
        bend: -0.03 * sin(TAU * t / 1.4),
        armA: 2 - 10 * sin(TAU * t / 0.76), armB: 2.5 * sin(TAU * t / 1.4),
        mouth: 1 + 0.05 * Math.abs(sin(TAU * t / 0.76)),
        blink: key(t % 3.6, [[1.1, 1], [1.16, 0.15], [1.24, 1]]), spark: 1, tuck: 0
      };
    }
  };
  // where each body stands (base y), how tall it is, and its centre line
  var BODY = { hero: { base: 174, H: 82, cx: 128 }, n1: { base: 108, H: 56, cx: 38 }, n2: { base: 92, H: 47, cx: 160 } };
  var ACC_LAG = { hero: 0, n1: 0.12, n2: 0.11 }; // seconds the hat / headset trails the body

  function deformer(name, p) {
    var b = BODY[name];
    return function (x, y) {
      var h = clamp((b.base - y) / b.H, -0.2, 1.5);
      var sx = p.sx + (p.sx - 1) * 0.5 * (1 - h);   // squash spreads most at the bottom
      return [b.cx + (x - b.cx) * sx + p.bend * b.H * h * h, b.base - (b.base - y) * p.sy + p.lift];
    };
  }

  /* ---------- collect rig parts ---------- */
  var parts = [], follows = [];
  svg.querySelectorAll("[data-rig]").forEach(function (rig) {
    var name = rig.dataset.rig;
    rig.querySelectorAll("path").forEach(function (el) {
      if (el.closest("[data-nodeform]") || el.hasAttribute("data-follow")) return;
      var arm = el.closest("[data-arm]"), mouth = el.closest("[data-mouth]"), spark = el.closest("[data-spark]");
      var part = {
        el: el, rig: name, segs: parse(el.getAttribute("d")),
        acc: !!el.closest("[data-acc]") || el.hasAttribute("data-acc"),
        arm: arm ? arm.dataset.arm : null, armEl: arm, pivot: arm ? arm.dataset.pivot.split(" ").map(Number) : null,
        mouth: mouth ? mouth.dataset.mouth.split(" ").map(Number) : null,
        spark: spark ? spark.dataset.spark.split(" ").map(Number) : null
      };
      if (spark) {
        // each spark line grows from its end nearest the head, one after another
        part.line = [].indexOf.call(spark.querySelectorAll("path"), el);
        var head = [part.spark[0] + 2, part.spark[1] + 10], best = null, bd = 1e9;
        part.segs.forEach(function (g) { g.p.forEach(function (q) { var dd = Math.hypot(q[0] - head[0], q[1] - head[1]); if (dd < bd) { bd = dd; best = q; } }); });
        part.anchor = best;
      }
      parts.push(part);
    });
    rig.querySelectorAll("[data-follow],[data-eyes]").forEach(function (el) {
      var bb = el.getBBox();
      follows.push({ el: el, rig: name, c: [bb.x + bb.width / 2, bb.y + bb.height / 2],
        acc: !!el.closest("[data-acc]"), eyes: el.dataset.eyes ? el.dataset.eyes.split(" ").map(Number) : null });
    });
  });
  // arm reach = farthest point from the shoulder; used to keep the shoulder glued to the body
  var reach = new Map();
  parts.forEach(function (pt) {
    if (!pt.armEl) return;
    var r = reach.get(pt.armEl) || 0;
    pt.segs.forEach(function (g) { g.p.forEach(function (q) { r = Math.max(r, Math.hypot(q[0] - pt.pivot[0], q[1] - pt.pivot[1])); }); });
    reach.set(pt.armEl, r);
  });
  // soft skinning: no turn at the shoulder, full turn from ~70% of the arm outwards,
  // so a raised arm never opens a gap that shows the body underneath
  function bendArm(x, y, pv, ang, L) {
    var w = ease(clamp((Math.hypot(x - pv[0], y - pv[1]) - 0.12 * L) / (0.58 * L), 0, 1));
    return rot(x, y, pv[0], pv[1], ang * w);
  }
  var footL = document.getElementById("foot-l"), footR = document.getElementById("foot-r"), shadow = document.getElementById("shadow");

  /* ---------- draw one frame ---------- */
  function render(ms) {
    var t = ms / 1000, cache = {};
    function pose(name, lag) { var k = name + lag; return cache[k] || (cache[k] = POSE[name](Math.max(0, t - lag))); }
    for (var i = 0; i < parts.length; i++) {
      var pt = parts[i], p = pose(pt.rig, 0), dp = pt.acc ? pose(pt.rig, ACC_LAG[pt.rig]) : p;
      var D = deformer(pt.rig, dp), pre = null; // reset: `var` would keep the previous part's arm rotation
      if (pt.arm) { var ang = pt.arm === "a" ? p.armA : p.armB, pv = pt.pivot, L = reach.get(pt.armEl); pre = function (x, y) { return bendArm(x, y, pv, ang, L); }; }
      else if (pt.mouth) { var m = pt.mouth, s = p.mouth; pre = function (x, y) { return [m[0] + (x - m[0]) * (1 + (s - 1) * 0.6), m[1] + (y - m[1]) * s]; }; }
      else if (pt.spark) {
        // twinkle: lines pulse in turn (0.4s apart), on top of the bigger pop at the jump
        var an = pt.anchor, pulse = Math.max(0, sin(TAU * (t / 1.2 - pt.line / 3)));
        var k = p.spark * (0.82 + 0.3 * pulse * pulse);
        pre = function (x, y) { return [an[0] + (x - an[0]) * k, an[1] + (y - an[1]) * k]; };
      }
      pt.el.setAttribute("d", write(pt.segs, pre ? function (x, y) { var q = pre(x, y); return D(q[0], q[1]); } : D));
    }
    for (var j = 0; j < follows.length; j++) {
      var f = follows[j], fp = pose(f.rig, f.acc ? ACC_LAG[f.rig] : 0), to = deformer(f.rig, fp)(f.c[0], f.c[1]);
      var tr = "translate(" + (to[0] - f.c[0]).toFixed(2) + " " + (to[1] - f.c[1]).toFixed(2) + ")";
      if (f.eyes) { var e = f.eyes; tr += " translate(" + e[0] + " " + e[1] + ") scale(1 " + fp.blink.toFixed(3) + ") translate(" + -e[0] + " " + -e[1] + ")"; }
      f.el.setAttribute("transform", tr);
    }
    // feet: planted while standing, spread a little in a squash, tucked in the air
    var hp = pose("hero", 0), spread = (hp.sx - 1) * 14;
    footL.setAttribute("transform", "translate(" + (-spread).toFixed(2) + " " + hp.lift.toFixed(2) + ") rotate(" + (-hp.tuck).toFixed(2) + " 116 172)");
    footR.setAttribute("transform", "translate(" + spread.toFixed(2) + " " + hp.lift.toFixed(2) + ") rotate(" + hp.tuck.toFixed(2) + " 133 173)");
    var sh = 1 + hp.lift / 55;
    shadow.setAttribute("transform", "translate(121.5 188.5) scale(" + (sh * (0.9 + 0.1 * hp.sx)).toFixed(3) + " " + sh.toFixed(3) + ") translate(-121.5 -188.5)");
    shadow.setAttribute("fill-opacity", (0.4 * (0.55 + 0.45 * sh)).toFixed(3));
  }

  /* ---------- clock (seekable, so the demo can be exported frame by frame) ---------- */
  var start = performance.now(), paused = false, now = 0;
  function frame(ts) { if (!paused) { now = (ts - start) % LOOP; render(now); } requestAnimationFrame(frame); }
  window.__demo = {
    duration: LOOP,
    seek: function (ms) { paused = true; now = ms; render(ms); },
    play: function () { paused = false; start = performance.now() - now; }
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) render(0);
  else requestAnimationFrame(frame);
})();
