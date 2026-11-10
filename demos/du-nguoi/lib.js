(function () {
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
  var NS = "http://www.w3.org/2000/svg";
  function smooth(u) { return u * u * (3 - 2 * u); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // nội suy mượt qua các mốc [thời điểm, giá trị]
  function key(t, ks) {
    if (t <= ks[0][0]) return ks[0][1];
    for (var k = 1; k < ks.length; k++) if (t <= ks[k][0]) {
      var a = ks[k - 1], b = ks[k];
      return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
    }
    return ks[ks.length - 1][1];
  }
  function rot(x, y, cx, cy, deg) {
    var r = deg * Math.PI / 180, c = cos(r), s = sin(r), dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }

  /* ---------- đọc path thành đoạn tuyệt đối để uốn từng điểm (giống rig Navi kết bạn) ---------- */
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

  /* ---------- màn xuất hiện: stage bung ra, tiêu đề đập xuống, bảng 4/4 nảy lên, Navi mọc ra, thẻ đồng đội trồi lên ---------- */
  // mốc thời gian (giây)
  var T = { title: 0.05, box: 0.22, naviL: 0.42, naviR: 0.5, mem: 0.5, sheen: 1.2 };
  var NAVI_DUR = 0.45;
  function $(id) { return document.getElementById(id); }
  function scaleAt(cx, cy, sx, sy, extra) {
    return "translate(" + cx + " " + cy + ") " + (extra || "") + " scale(" + sx.toFixed(4) + " " + sy.toFixed(4) + ") translate(" + (-cx) + " " + (-cy) + ")";
  }
  function setOp(e, o) { if (o >= 1) e.removeAttribute("opacity"); else e.setAttribute("opacity", Math.max(0, o).toFixed(3)); }
  var shadows = [document.getElementById("shL"), document.getElementById("shR")];
  var titleG = $("titleG"), boxG = $("boxG"), shakeG = $("shake");
  var naviG = [$("naviL"), $("naviR")], mems = document.querySelectorAll(".mem");
  var FOOT = [[121, 150.5], [319, 150]];          // điểm chân của 2 Navi: mọc ra từ đây
  var MEM_C = [[220.5, 237], [220.5, 351], [220.5, 465], [220.5, 579]];
  // rung khung rất nhẹ đúng nhịp bảng 4/4 chạm
  var HITS = [[0.43, 1.2]];

  function drawIntro(t) {
    // tiêu đề: hơi to -> hạ xuống, lún nhẹ rồi về
    var u = clamp((t - T.title) / 0.38, 0, 1);
    var s = key(u, [[0, 1.45], [0.6, 0.97], [1, 1]]);
    titleG.setAttribute("transform", scaleAt(220.5, 52, s, s));
    setOp(titleG, key(u, [[0, 0], [0.35, 1]]));

    // bảng 4/4: nảy từ 0 lên quá cỡ, xoay nhẹ rồi khoá lại
    u = clamp((t - T.box) / 0.45, 0, 1);
    s = key(u, [[0, 0.3], [0.5, 1.1], [0.78, 0.98], [1, 1]]);
    var r = key(u, [[0, -6], [0.5, 1.5], [1, 0]]);
    boxG.setAttribute("transform", scaleAt(220.5, 121, s, s, "rotate(" + r.toFixed(2) + ")"));
    setOp(boxG, key(u, [[0, 0], [0.3, 1]]));

    // Navi mọc ra từ chân: vươn cao, bè ra khi đáp, rồi về dáng
    ["naviL", "naviR"].forEach(function (k, i) {
      var v = clamp((t - T[k]) / NAVI_DUR, 0, 1);
      var sy = key(v, [[0, 0], [0.5, 1.12], [0.75, 0.94], [1, 1]]);
      var sx = key(v, [[0, 0], [0.5, 0.92], [0.75, 1.05], [1, 1]]);
      naviG[i].setAttribute("transform", scaleAt(FOOT[i][0], FOOT[i][1], sx, sy));
      shadows[i].style.opacity = key(v, [[0, 0], [0.5, 1]]);
    });

    // 4 thẻ đồng đội: trồi lên lần lượt, cùng kiểu nảy
    mems.forEach(function (m, i) {
      var v = clamp((t - T.mem - i * 0.08) / 0.45, 0, 1);
      var ty = key(v, [[0, 18], [0.6, -2], [1, 0]]), sc = key(v, [[0, 0.94], [0.6, 1.01], [1, 1]]);
      m.setAttribute("transform", "translate(0 " + ty.toFixed(2) + ") " + scaleAt(MEM_C[i][0], MEM_C[i][1], sc, sc));
      setOp(m, key(v, [[0, 0], [0.4, 1]]));
    });

    // rung khung
    var dx = 0, dy = 0;
    HITS.forEach(function (h) {
      var d = t - h[0]; if (d < 0 || d > 0.35) return;
      var a = h[1] * Math.exp(-d * 14);
      dy += a * sin(d * 70); dx += a * 0.5 * cos(d * 55);
    });
    if (dx || dy) shakeG.setAttribute("transform", "translate(" + dx.toFixed(2) + " " + dy.toFixed(2) + ")");
    else shakeG.removeAttribute("transform");
  }

  /* ---------- vệt sáng bảng 4/4: overlay, quét 1 chiều, mỗi 2,3s một lần ---------- */
  var sheen = document.getElementById("sheen");
  var BOX_L = 168.5, BOX_W = 104;
  function drawSheen(t) {
    t -= T.sheen;
    if (t < 0) { sheen.setAttribute("transform", "translate(-200 0)"); return; }
    var u = clamp((t % 2.3) / 0.75, 0, 1);            // 0.75s quét, nghỉ tới hết 2,3s
    var x = BOX_L - 40 + (BOX_W + 80) * smooth(u);    // từ ngoài mép trái ra ngoài mép phải
    sheen.setAttribute("transform", "translate(" + x.toFixed(2) + " 0) rotate(18 0 121)");
  }

  /* ---------- rig hai Navi ---------- */
  // toạ độ trong khung của từng Navi: chân đế, chiều cao thân, trục giữa, vai, mắt, miệng, chân
  var RIG = {
    L: { base: 71.5, H: 62, cx: 44, armA: [63, 48], ampA: 1, wing: [13, 62], armB: null,
         eye1: [47.8, 39.2], eye2: [52.8, 39.2], mouth: [47, 46], footL: [30, 72], footR: [57, 72], phase: 0 },
    R: { base: 62, H: 60, cx: 48, armA: [66, 23], ampA: 0.55, wing: null, armB: [35, 35],
         eye1: [37.5, 28.8], eye2: [32.1, 28.7], mouth: [36, 36], footL: [35, 62], footR: [51, 62], phase: 0.5 }
  };
  var PERIOD = 1.1, LAG = 0.07;   // tay trễ theo thân một chút

  function pose(t, cfg) {
    var c = t / PERIOD + cfg.phase, n = Math.floor(c), u = c - n;
    var ca = (t - LAG) / PERIOD + cfg.phase, ua = ca - Math.floor(ca);
    var side = n % 2 ? 1 : -1;
    var sy = key(u, [[0, 1], [0.16, 0.92], [0.3, 1.07], [0.48, 1.01], [0.7, 0.93], [0.82, 1.025], [0.93, 0.996], [1, 1]]);
    return {
      lift: key(u, [[0, 0], [0.16, 0], [0.33, -6.5], [0.48, -9], [0.62, -4], [0.7, 0], [1, 0]]),
      sy: sy, sx: 1 + (1 - sy) * 0.6,
      bend: side * key(u, [[0, 0], [0.16, -0.012], [0.48, 0.035], [0.72, -0.015], [1, 0]]),
      armA: key(ua, [[0, 0], [0.16, 7], [0.46, -16], [0.72, 6], [0.88, -1.5], [1, 0]]),
      armB: key(ua, [[0, 0], [0.16, -6], [0.46, 14], [0.72, -5], [0.88, 1], [1, 0]]),
      mouth: key(u, [[0.12, 1], [0.24, 0.94], [0.44, 1.22], [0.62, 1.08], [0.8, 1]]),
      blink: n % 2 ? 1 : key(u, [[0.6, 1], [0.67, 0.22], [0.78, 0.22], [0.88, 1]]),
      tuck: key(u, [[0.26, 0], [0.42, 11], [0.58, 9], [0.7, 0]])
    };
  }

  function deformer(b, p) {
    return function (x, y) {
      var h = clamp((b.base - y) / b.H, -0.2, 1.5);
      var sx = p.sx + (p.sx - 1) * 0.5 * (1 - h);      // nhún thì phần dưới bè ra nhiều nhất
      return [b.cx + (x - b.cx) * sx + p.bend * b.H * h * h, b.base - (b.base - y) * p.sy + p.lift];
    };
  }
  // xoay mềm: sát vai không xoay, ra tới ~70% cánh tay thì xoay đủ, nên vai không bị hở
  function bendArm(x, y, pv, ang, L) {
    var w = smooth(clamp((Math.hypot(x - pv[0], y - pv[1]) - 0.12 * L) / (0.58 * L), 0, 1));
    return rot(x, y, pv[0], pv[1], ang * w);
  }
  // tay nhỏ dính liền thân của Navi trái: điểm càng ra mép trái càng xoay theo
  function bendWing(x, y, pv, ang) {
    var w = smooth(clamp((pv[0] + 1 - x) / 12, 0, 1)) * smooth(clamp((y - 40) / 12, 0, 1));
    return rot(x, y, pv[0], pv[1], ang * w);
  }

  var rigs = [];
  document.querySelectorAll("[data-navi]").forEach(function (root) {
    var cfg = RIG[root.dataset.navi], items = [], reach = { armA: 0, armB: 0 };
    root.querySelectorAll("[data-p]").forEach(function (el) {
      var role = el.dataset.p, it = { el: el, role: role };
      if (el.tagName === "path") it.segs = parse(el.getAttribute("d"));
      else {
        // chấm tròn / elip: chỉ dời theo tâm, giữ nguyên transform gốc
        var m = el.transform.baseVal.consolidate(), cx = +el.getAttribute("cx"), cy = +el.getAttribute("cy");
        it.base = el.getAttribute("transform") || "";
        it.c = m ? [m.matrix.a * cx + m.matrix.c * cy + m.matrix.e, m.matrix.b * cx + m.matrix.d * cy + m.matrix.f] : [cx, cy];
      }
      if ((role === "armA" || role === "armB") && it.segs) {
        var pv = cfg[role];
        it.segs.forEach(function (g) { g.p.forEach(function (q) { reach[role] = Math.max(reach[role], Math.hypot(q[0] - pv[0], q[1] - pv[1])); }); });
      }
      items.push(it);
    });
    rigs.push({ cfg: cfg, items: items, reach: reach });
  });

  function mapper(r, it, p) {
    var b = r.cfg, D = deformer(b, p), role = it.role, pre = null;
    if (role === "armA") { var a = p.armA * b.ampA, L = r.reach.armA; pre = function (x, y) { return bendArm(x, y, b.armA, a, L); }; }
    else if (role === "armB") { var a2 = p.armB, L2 = r.reach.armB; pre = function (x, y) { return bendArm(x, y, b.armB, a2, L2); }; }
    else if (role === "body" && b.wing) { var aw = p.armB; pre = function (x, y) { return bendWing(x, y, b.wing, aw); }; }
    else if (role === "eye1" || role === "eye2") { var e = b[role], k = p.blink; pre = function (x, y) { return [x, e[1] + (y - e[1]) * k]; }; }
    else if (role === "mouth") { var mc = b.mouth, s = p.mouth; pre = function (x, y) { return [mc[0] + (x - mc[0]) * (1 + (s - 1) * 0.55), mc[1] + (y - mc[1]) * s]; }; }
    else if (role === "footL" || role === "footR") {
      // chân: dính đất khi đứng, bè ra khi nhún, co lên khi bay
      var fp = b[role], dir = role === "footL" ? -1 : 1, spread = (p.sx - 1) * 12 * dir, tk = -p.tuck * dir;
      return function (x, y) { var q = rot(x, y, fp[0], fp[1] - 6, tk); return [q[0] + spread, q[1] + p.lift]; };
    }
    return pre ? function (x, y) { var q = pre(x, y); return D(q[0], q[1]); } : D;
  }

  function drawNavis(t) {
    rigs.forEach(function (r, i) {
      // chỉ nhảy sau khi đã mọc xong
      var p = pose(Math.max(0, t - T[i ? "naviR" : "naviL"] - NAVI_DUR), r.cfg);
      r.items.forEach(function (it) {
        var f = mapper(r, it, p);
        if (it.segs) it.el.setAttribute("d", write(it.segs, f));
        else { var to = f(it.c[0], it.c[1]); it.el.setAttribute("transform", "translate(" + (to[0] - it.c[0]).toFixed(2) + " " + (to[1] - it.c[1]).toFixed(2) + ") " + it.base); }
      });
      var sh = shadows[i], air = clamp(-p.lift / 9, 0, 1), cx = sh.getAttribute("cx"), cy = sh.getAttribute("cy");
      var s = (1 - 0.3 * air) * (0.92 + 0.08 * p.sx);
      sh.setAttribute("transform", "translate(" + cx + " " + cy + ") scale(" + s.toFixed(3) + " 1) translate(" + (-cx) + " " + (-cy) + ")");
      sh.setAttribute("fill-opacity", (0.4 * (1 - 0.45 * air)).toFixed(3));
    });
  }

  /* ---------- pháo màu (bắn 1 lần): giấy bung ra từ sau bảng 4/4 ---------- */
  var COLORS = ["#FFE500"];   // giấy pháo chỉ một màu vàng
  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var FIRE = 0.43, K = 5, G = 600;     // cản lớn: bung rất nhanh rồi khựng lại, giấy lơ lửng trong khung
  var BOX = { x: 172, y: 84, w: 97, h: 74, cx: 220.5, cy: 121 };
  var bits = [];
  var confettiG = document.getElementById("confetti");

  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var a in attrs) e.setAttribute(a, attrs[a]); parent.appendChild(e); return e; }
  function makeBit(x0, y0, ang, spd, delay) {
    var shape = rnd(), c = COLORS[Math.floor(rnd() * COLORS.length)], e;
    if (shape < 0.45) e = el("rect", { x: -4, y: -6, width: 8, height: 12, rx: 1.2 }, confettiG);
    else if (shape < 0.75) e = el("rect", { x: -2, y: -9, width: 4, height: 18, rx: 2 }, confettiG);
    else if (shape < 0.88) e = el("circle", { r: 3.6 }, confettiG);
    else e = el("path", { d: "M0 -6.5 L1.8 -1.8 L6.5 0 L1.8 1.8 L0 6.5 L-1.8 1.8 L-6.5 0 L-1.8 -1.8Z" }, confettiG);
    e.setAttribute("fill", c); e.setAttribute("opacity", 0);
    bits.push({ el: e, x0: x0, y0: y0, vx: cos(ang) * spd, vy: sin(ang) * spd, delay: delay,
      spin: (rnd() - 0.5) * 1100, rot0: rnd() * 360, flip: 7 + rnd() * 8, wob: 2 + rnd() * 3, wph: rnd() * TAU, life: 2.3 + rnd() * 0.7 });
  }
  function buildConfetti() {
    // mỗi mảnh xuất phát ở một chỗ ngẫu nhiên bên trong bảng (khuất sau bảng),
    // bay toả ra theo hướng từ tâm bảng tới chỗ đó, thiên về phía trên
    for (var i = 0; i < 36; i++) {
      var x = BOX.x + rnd() * BOX.w, y = BOX.y + rnd() * BOX.h;
      var ang = Math.atan2((y - BOX.cy) * 0.6 - 18, x - BOX.cx) + (rnd() - 0.5) * 0.5;
      makeBit(x, y, ang, 620 + rnd() * 260, rnd() * 0.06);
    }
  }
  function drawConfetti(t) {
    var tt = t - FIRE;
    bits.forEach(function (b) {
      var s = tt - b.delay;
      if (s <= 0 || s > b.life) { b.el.setAttribute("opacity", 0); return; }
      var e = 1 - Math.exp(-K * s);
      var x = b.x0 + b.vx / K * e + b.wob * sin(s * 5 + b.wph) * Math.min(1, s);
      var y = b.y0 + b.vy / K * e + G / K * s - G / (K * K) * e;
      var r = b.rot0 + b.spin * s, f = cos(s * b.flip);
      var op = clamp((b.life - s) / 0.5, 0, 1);
      b.el.setAttribute("opacity", op.toFixed(3));
      b.el.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + r.toFixed(1) + ") scale(1 " + f.toFixed(3) + ")");
    });
  }

  buildConfetti();
  function frame(t) { drawIntro(t); drawSheen(t); drawNavis(t); drawConfetti(t); }
  window.__frame = frame;

  /* ---------- chạy (tua được từng khung để xuất video) ---------- */
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var start = performance.now(), paused = false, pauseAt = 0;
  function loop(now) { if (!paused) frame((now - start) / 1000); requestAnimationFrame(loop); }
  if (reduce) frame(4); else requestAnimationFrame(loop);
  window.__demo = {
    duration: 4600,
    seek: function (ms) { paused = true; pauseAt = performance.now(); start = pauseAt - ms; frame(ms / 1000); },
    play: function () { if (paused) { paused = false; start += performance.now() - pauseAt; } }
  };

  var pauseBtn = document.getElementById("pause"), replayBtn = document.getElementById("replay");
  if (replayBtn) replayBtn.addEventListener("click", function () {
    start = performance.now();
    if (paused) { paused = false; pauseBtn.textContent = "Tạm dừng"; pauseBtn.setAttribute("aria-pressed", "false"); }
    if (reduce) frame(4);
  });
  if (pauseBtn) pauseBtn.addEventListener("click", function () {
    var now = performance.now();
    if (!paused) { paused = true; pauseAt = now; pauseBtn.textContent = "Chạy tiếp"; pauseBtn.setAttribute("aria-pressed", "true"); }
    else { paused = false; start += now - pauseAt; pauseBtn.textContent = "Tạm dừng"; pauseBtn.setAttribute("aria-pressed", "false"); }
  });
})();