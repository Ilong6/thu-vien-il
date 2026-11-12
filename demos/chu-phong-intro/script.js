(function () {
  var $ = function (id) { return document.getElementById(id); };
  var TAU = Math.PI * 2;
  function smooth(u) { return u * u * (3 - 2 * u); }
  function outQuad(u) { return 1 - (1 - u) * (1 - u); }
  function inQuart(u) { return 0.25 * u + 0.75 * u * u * u * u; }   // khởi động nhẹ rồi lao nhanh vào chỗ
  function outCubic(u) { return 1 - Math.pow(1 - u, 3); }
  function snap(u) { return 1 - Math.pow(1 - u, 4); }
  function inOut(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
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
  function around(cx, cy, tf) { return "translate(" + cx + " " + cy + ") " + tf + " translate(" + -cx + " " + -cy + ")"; }

  var BC = [220.08, 343.6];    // tâm gốc của nhóm huy hiệu lớn trong SVG
  var SC = [65, 239];          // tâm huy hiệu nhỏ ở avatar chủ phòng
  var HOST = [66, 186];        // huy hiệu bay lên trên avatar, để chữ không che tên chủ phòng
  var HEX_TO_SMALL = 24 / 108; // lục giác lớn rộng ~108px -> huy hiệu nhỏ 24px
  var BIG = 0.6;               // cỡ khi khoe (lục giác ~65px)

  // 1. mở màn: phủ tối (chừa thẻ chủ phòng), huy hiệu nhỏ ở avatar đập một nhịp
  // giữ cảnh "rọi đèn" thêm một nhịp (D) để người xem kịp nhận ra thẻ của ai
  var D = 0.4;
  var OVERLAY = [[0, 0], [0.3, 0.8], [1.95 + D, 0.8], [2.3 + D, 0]];
  var SMALL_PRE = [[0.08 + D, 1], [0.24 + D, 1.3, outCubic], [0.3 + D, 1.25]];
  // 2. huy hiệu lớn lên tại chỗ, chữ trượt ra từ hông phải
  var B_S = [[0.3 + D, HEX_TO_SMALL], [0.6 + D, BIG * 1.1, outCubic], [0.75 + D, BIG],
             [1.86 + D, BIG], [1.96 + D, BIG * 1.05], [2.25 + D, HEX_TO_SMALL, inQuart]];
  // thẻ mờ theo nhịp huy hiệu lớn lên, sáng lại ngay trước khi huy hiệu thu về avatar
  var CARD_DIM = [[0.32 + D, 0], [0.6 + D, 0.6], [1.86 + D, 0.6], [2.2 + D, 0]];
  var B_OP = [[0.28 + D, 0], [0.32 + D, 1], [2.22 + D, 1], [2.27 + D, 0]];
  var PK = 0.8;                                    // cỡ chữ so với design
  var PILL_O = [HOST[0] + 40 - 16 * PK, HOST[1] + 4 - 21.5 * PK];   // chữ bắt đầu ngay sau mép phải huy hiệu
  var P_X = [[0.52 + D, -120], [0.88 + D, 0, outCubic], [1.68 + D, 0], [1.92 + D, -120, function (u) { return u * u * u; }]];
  var P_OP = [[0.5 + D, 0], [0.56 + D, 1], [1.88 + D, 1], [1.92 + D, 0]];
  var PSHEEN0 = 0.95 + D, PSHEEN = 0.5;               // vệt sáng quét qua chữ
  // 3. chữ thu lại, huy hiệu nhỏ dần về avatar (0.3s)
  var F1 = 2.25 + D;
  var K0 = 99, KP = [61.5, 88.8], SWING = [[0, 0]];
  var SHEEN0 = 99, SHEEN = 0.4;
  // 5. huy hiệu nhỏ đáp xuống, thẻ đầu bật nền lửa
  var SMALL_S = [[F1, 1.5], [F1 + 0.22, 1, outCubic]];
  var DECO_OP = [[F1, 0], [F1 + 0.12, 1]];
  // viền vàng chạy 1 vòng (DRAW = 0.2s) từ góc trên-trái theo chiều kim đồng hồ;
  // mảng bo góc và mảng trang trí chỉ hiện khi nét viền chạy tới chỗ nó
  var DRAW = 0.2;
  var BORDER = [[F1, 0], [F1 + DRAW, 1, outQuad]];
  function reach(p) { for (var s = F1; s < F1 + DRAW; s += 0.002) if (key(s, BORDER) >= p) return s; return F1 + DRAW; }
  // mỗi mảng chỉ hiện khi nét viền đã chạy PHỦ HẾT đoạn viền bao quanh nó (mốc trên chu vi 0..1)
  var T_TOP = reach(0.46), T_R = reach(0.5), T_BOT = reach(0.64), T_L = F1 + DRAW, T_BIG = F1 + DRAW;
  var POP = 0.14;                                     // mảng bo góc bật ra trong 0.14s
  var GROW_TOP = [[T_TOP, 0], [T_TOP + 0.4, 1, outCubic]];
  var GROW_BOT = [[T_BOT, 0], [T_BOT + 0.4, 1, outCubic]];
  var GROW_BIG = [[T_BIG, 0], [T_BIG + 0.4, 1]];

  var overlay = $("overlay"), cardDim = $("cardDim"), badge = $("badge"), keyG = $("keyG"), sheen = $("sheen"), pill = $("pill"),
      small = $("small"), deco = $("deco"), border = $("border"), cornerL = $("cornerL"), cornerR = $("cornerR"),
      fTop = $("fTop"), fBot = $("fBot"), fBig = $("fBig");

  // mảng bo góc nở ra từ mép ngoài của thẻ
  function popIn(el, u, ax) {
    u = clamp(u, 0, 1);
    el.setAttribute("opacity", Math.min(1, u * 2).toFixed(3));
    el.setAttribute("transform", around(ax, 28, "scale(" + (0.5 + 0.5 * outCubic(u)).toFixed(4) + " 1)"));
  }
  function grow(el, g, ax, ay) { el.setAttribute("transform", around(ax, ay, "scale(" + Math.max(g, 0.0001).toFixed(4) + ")")); }
  // vệt sáng qua viền vàng: lần đầu sau khi nền hiện xong, rồi cứ 3.5s một lần, mỗi lần chạy chậm 2s
  var SWEEP0 = F1 + 0.9, SWEEP_EVERY = 3.5, SWEEP_DUR = 2;
  // gợn sáng phản hồi: chờ viền chạy xong mới loang ra
  // viền khép vòng xong thì thẻ bừng sáng một nhịp, loang ra từ avatar
  var T_FULL = F1 + DRAW;
  var PULSE_R = [[T_FULL, 0], [T_FULL + 0.55, 380, outCubic]], PULSE_O = [[T_FULL, 0.35], [T_FULL + 0.55, 0]];
  var cardSheen = $("cardSheen"), pulse = $("pulse"), pillSheen = $("pillSheen");

  function frame(t) {
    overlay.setAttribute("opacity", key(t, OVERLAY).toFixed(3));
    cardDim.setAttribute("opacity", key(t, CARD_DIM).toFixed(3));
    // huy hiệu lớn: tâm trượt từ avatar lên HOST theo đúng nhịp lớn lên
    var sc = key(t, B_S), k = clamp((sc - HEX_TO_SMALL) / (BIG - HEX_TO_SMALL), 0, 1);
    var bx = SC[0] + (HOST[0] - SC[0]) * k, by = SC[1] + (HOST[1] - SC[1]) * k;
    badge.setAttribute("transform", "translate(" + (bx - BC[0]).toFixed(2) + " " + (by - BC[1]).toFixed(2) + ") " + around(BC[0], BC[1], "scale(" + sc.toFixed(4) + ")"));
    badge.setAttribute("opacity", key(t, B_OP).toFixed(3));
    keyG.setAttribute("transform", around(KP[0], KP[1], "rotate(" + key(t - K0, SWING).toFixed(2) + ")"));
    var d = (t - SHEEN0) / SHEEN;
    if (d < 0 || d > 1) sheen.setAttribute("visibility", "hidden");
    else { sheen.setAttribute("visibility", "visible"); sheen.setAttribute("transform", "translate(" + (24 + 74 * smooth(d)).toFixed(2) + " 0) rotate(28 0 89)"); }
    // chữ
    pill.setAttribute("opacity", key(t, P_OP).toFixed(3));
    pill.setAttribute("transform", "translate(" + (PILL_O[0] + key(t, P_X)).toFixed(2) + " " + PILL_O[1].toFixed(2) + ") scale(" + PK + ")");
    var dp = (t - PSHEEN0) / PSHEEN;
    if (dp < 0 || dp > 1) pillSheen.setAttribute("visibility", "hidden");
    else { pillSheen.setAttribute("visibility", "visible"); pillSheen.setAttribute("transform", "translate(" + (-12 + 205 * smooth(dp)).toFixed(1) + " 0) rotate(24 0 21.5)"); }
    // huy hiệu nhỏ
    var home = t < 0.32 + D || t >= F1 - 0.02;   // huy hiệu nhỏ ở avatar trước khi lớn lên và sau khi thu về
    small.setAttribute("opacity", home ? 1 : 0);
    small.setAttribute("transform", around(SC[0], SC[1], "scale(" + (t < F1 - 0.02 ? key(t, SMALL_PRE) : key(t, SMALL_S)).toFixed(4) + ")"));
    // nền lửa
    deco.setAttribute("opacity", key(t, DECO_OP).toFixed(3));
    border.setAttribute("stroke-dasharray", key(t, BORDER).toFixed(4) + " 2");
    popIn(cornerR, (t - T_R) / POP, 392); popIn(cornerL, (t - T_L) / POP, 1);
    grow(fTop, key(t, GROW_TOP), 392, 1); grow(fBot, key(t, GROW_BOT), 318, 55);
    fBig.setAttribute("opacity", (0.15 * key(t, GROW_BIG)).toFixed(3));
    pulse.setAttribute("r", key(t, PULSE_R).toFixed(1));
    pulse.setAttribute("opacity", t < T_FULL ? 0 : key(t, PULSE_O).toFixed(3));
    var w = t - SWEEP0, ds = w < 0 ? -1 : (w % SWEEP_EVERY) / SWEEP_DUR;
    if (ds < 0 || ds > 1) cardSheen.setAttribute("visibility", "hidden");
    else { cardSheen.setAttribute("visibility", "visible"); cardSheen.setAttribute("transform", "translate(" + (-30 + 460 * smooth(ds)).toFixed(1) + " 0) rotate(24 0 28)"); }
  }

  // đồng hồ chỉ chạy từ khung hình đầu tiên thật sự được vẽ (trang ẩn thì chưa tính giờ)
  var start = null, paused = false, pauseAt = 0;
  function tick(now) {
    if (start === null) start = now;
    if (!paused) frame((now - start) / 1000);
    requestAnimationFrame(tick);
  }
  function replay() { paused = false; start = null; frame(0); }
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { paused = true; frame(5); }
  var btn = document.getElementById("replay");
  if (btn) btn.addEventListener("click", replay);
  window.__demo = {
    duration: 6000,
    seek: function (ms) { paused = true; pauseAt = performance.now(); start = pauseAt - ms; frame(ms / 1000); },
    play: function () { if (paused) { start += performance.now() - pauseAt; paused = false; } },
    replay: replay
  };
  window.__frame = frame;
  requestAnimationFrame(tick);
})();
