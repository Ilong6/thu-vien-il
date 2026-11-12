(function () {
  function smooth(u) { return u * u * (3 - 2 * u); }
  function outCubic(u) { return 1 - Math.pow(1 - u, 3); }   // vào nhanh, dừng êm
  function lerp(a, b, s) { return a + (b - a) * s; }
  // nội suy qua các mốc [thời điểm, giá trị, kiểu ease của đoạn tới mốc đó]
  function key(t, ks) {
    if (t <= ks[0][0]) return ks[0][1];
    for (var k = 1; k < ks.length; k++) if (t <= ks[k][0]) {
      var a = ks[k - 1], b = ks[k];
      return a[1] + (b[1] - a[1]) * (b[2] || smooth)((t - a[0]) / (b[0] - a[0]));
    }
    return ks[ks.length - 1][1];
  }
  var P = 2.0;                // độ dài vòng lặp theo các mốc bên dưới
  var SLOW = 1.2;             // giãn thời gian: vòng lặp thật = 2.4s
  var HIT_T = 0.3;            // khoảnh khắc đóng dấu
  // huy hiệu: co lại lấy đà -> đập lên 112% -> dội nhẹ 97% -> đứng yên
  var BADGE = [[0, 1], [0.16, 0.86], [HIT_T, 1.12, outCubic], [0.42, 0.97], [0.54, 1], [P, 1]];
  // dấu tick: hiện "chát" ngay sau cú đập; cuối vòng mờ dần để vòng sau đóng dấu lại
  var TICK = [[0, 0], [HIT_T - 0.02, 0], [0.44, 1, outCubic], [P, 1]];
  var TICK_O = [[0, 1], [1.72, 1], [1.92, 0], [P, 0]];
  // nền + người rung nhẹ theo cú đập
  var HIT = [[0, 0], [HIT_T - 0.02, 0], [0.34, 1.5, outCubic], [0.48, -0.3], [0.62, 0], [P, 0]];
  // vệt sáng quét qua huy hiệu ngay khi tick xong
  var SWEEP0 = 0.44, SWEEP = 0.32;
  // người: tick xong thì từ từ ngẩng lên, nghiêng đầu và cười tươi, giữ rồi thả (không nhún, không bật)
  var HEAD_Y = [[0, 0], [0.48, 0], [0.8, -2], [1.35, -2], [1.68, 0], [P, 0]];
  var HEAD_R = [[0, 0], [0.48, 0], [0.82, -4], [1.35, -4], [1.68, 0], [P, 0]];
  var GRIN = [[0, 0], [0.48, 0], [0.76, 1], [1.35, 1], [1.68, 0], [P, 0]];
  // miệng: chỉ là nét cong, không há — cười thì nét dài ra về hai bên và cong sâu hơn một chút
  // [điểm nghỉ (đúng design), điểm khi cười]
  var A = [[71, 82], [69.6, 80.6]], B = [[89, 77], [90.4, 75.4]];
  var B1 = [[76.79, 83.95], [76.3, 85.6]], B2 = [[86.04, 82.61], [86.7, 84]];

  var $ = function (id) { return document.getElementById(id); };
  var badge = $("badge"), tick = $("tickPath"), tickShape = $("tick"), sheen = $("sheen"),
      hex = $("hex"), wrap = $("personWrap"), head = $("head"), mouth = $("mouth");
  function pt(p, s) { return lerp(p[0][0], p[1][0], s).toFixed(2) + " " + lerp(p[0][1], p[1][1], s).toFixed(2); }
  function around(cx, cy, tf) { return "translate(" + cx + " " + cy + ") " + tf + " translate(" + -cx + " " + -cy + ")"; }

  function frame(t) {
    var u = (t / SLOW) % P;
    badge.setAttribute("transform", around(104.5, 113, "scale(" + key(u, BADGE).toFixed(4) + ")"));
    var p = key(u, TICK);
    tick.setAttribute("stroke-dasharray", p.toFixed(4) + " 2");
    tick.setAttribute("visibility", p < 0.002 ? "hidden" : "visible");
    tickShape.setAttribute("opacity", key(u, TICK_O).toFixed(3));
    var d = (u - SWEEP0) / SWEEP;
    if (d < 0 || d > 1) sheen.setAttribute("visibility", "hidden");
    else {
      sheen.setAttribute("visibility", "visible");
      sheen.setAttribute("transform", "translate(" + (76 + 58 * smooth(d)).toFixed(2) + " 0) rotate(28 0 115)");
    }
    var nudge = "translate(0 " + key(u, HIT).toFixed(3) + ")";
    hex.setAttribute("transform", nudge); wrap.setAttribute("transform", nudge);
    head.setAttribute("transform", "translate(0 " + key(u, HEAD_Y).toFixed(3) + ") " + around(80, 98, "rotate(" + key(u, HEAD_R).toFixed(2) + ")"));
    var s = key(u, GRIN);
    mouth.setAttribute("d", "M" + pt(A, s) + "C" + pt(B1, s) + " " + pt(B2, s) + " " + pt(B, s));
  }

  var start = performance.now(), paused = false, pauseAt = 0;
  function tick_(now) { if (!paused) frame((now - start) / 1000); requestAnimationFrame(tick_); }
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { paused = true; frame(1.7 * SLOW); }
  window.__demo = {
    duration: 2400,
    seek: function (ms) { paused = true; pauseAt = performance.now(); start = pauseAt - ms; frame(ms / 1000); },
    play: function () { if (paused) { start += performance.now() - pauseAt; paused = false; } }
  };
  window.__frame = frame;
  requestAnimationFrame(tick_);
})();
