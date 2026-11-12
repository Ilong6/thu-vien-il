(function () {
  var TAU = Math.PI * 2;
  var PIVOT = [61.5, 88.8];   // tâm viên ngọc = trục xoay
  var HEX_C = [80, 82];       // tâm nền lục giác
  function smooth(u) { return u * u * (3 - 2 * u); }
  function snap(u) { return 1 - Math.pow(1 - u, 4); }   // bật nhanh, phanh gấp
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // nội suy qua các mốc [thời điểm, giá trị, kiểu ease của đoạn tới mốc đó]
  function key(t, ks) {
    if (t <= ks[0][0]) return ks[0][1];
    for (var k = 1; k < ks.length; k++) if (t <= ks[k][0]) {
      var a = ks[k - 1], b = ks[k];
      return a[1] + (b[1] - a[1]) * (b[2] || smooth)((t - a[0]) / (b[0] - a[0]));
    }
    return ks[ks.length - 1][1];
  }
  var P = 2.0;                // một nhịp (giây)
  // vặn khoá: lấy đà 0.35s -> vặn nhanh 0.14s -> "cạch" khựng lại, giữ -> nhả về rồi nghỉ
  var CLICK = 0.49;
  var SWING = [[0, 0], [0.35, -6], [CLICK, 11, snap], [0.55, 9.6], [0.6, 10], [0.95, 10], [1.35, 0], [P, 0]];
  var PUNCH = [[0, 1], [0.35, 0.975], [CLICK, 1.045, snap], [0.72, 1], [P, 1]];
  // nền lục giác nhún khi chìa khoá bật trúng
  var HIT = [[0, 0], [0.46, 0], [0.54, 1, snap], [0.7, -0.25], [0.86, 0], [P, 0]];

  // vệt sáng: mỗi nhịp một lần (2s), chạy ngay sau cú bật
  var SWEEP = 0.4, FIRE = 0.5;
  var keyG = document.getElementById("keyG"), hex = document.getElementById("hex"), sheen = document.getElementById("sheen");

  function frame(t) {
    var u = t % P;
    // thở nhẹ trong lúc nghỉ, tắt dần về 0 trước nhịp sau
    var env = clamp((u - 1.4) / 0.2, 0, 1) * clamp((P - 0.05 - u) / 0.3, 0, 1);
    var breath = Math.sin((u - 1.4) / 0.6 * TAU) * env;
    var a = key(u, SWING) + breath * 1.2, sc = key(u, PUNCH), by = -breath * 1;
    keyG.setAttribute("transform", "translate(" + PIVOT[0] + " " + (PIVOT[1] + by).toFixed(3) + ") rotate(" + a.toFixed(3) + ") scale(" + sc.toFixed(4) + ") translate(" + -PIVOT[0] + " " + -PIVOT[1] + ")");
    var h = key(u, HIT);
    hex.setAttribute("transform", "translate(" + HEX_C[0] + " " + (HEX_C[1] + 1.2 * h).toFixed(3) + ") scale(" + (1 + 0.012 * h).toFixed(4) + " " + (1 - 0.022 * h).toFixed(4) + ") translate(" + -HEX_C[0] + " " + -HEX_C[1] + ")");
    var d = (u - FIRE + P) % P;
    if (d > SWEEP) { sheen.setAttribute("visibility", "hidden"); return; }
    sheen.setAttribute("visibility", "visible");
    sheen.setAttribute("transform", "translate(" + (24 + 74 * smooth(d / SWEEP)).toFixed(2) + " 0) rotate(28 0 89)");
  }

  var start = performance.now(), paused = false, pauseAt = 0;
  function tick(now) { if (!paused) frame((now - start) / 1000); requestAnimationFrame(tick); }
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { paused = true; frame(1.2); }
  window.__demo = {
    duration: 2000,
    seek: function (ms) { paused = true; pauseAt = performance.now(); start = pauseAt - ms; frame(ms / 1000); },
    play: function () { if (paused) { start += performance.now() - pauseAt; paused = false; } }
  };
  window.__frame = frame;
  requestAnimationFrame(tick);
})();
