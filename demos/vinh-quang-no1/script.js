// Victory "NO.1" reveal — timeline in ms, built on the Web Animations API (no library)
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return document.querySelectorAll(s); };
var anims = [], timers = [];
var EASE_OUT = "cubic-bezier(.2,.8,.2,1)";
var STAMP = "cubic-bezier(.3,1.4,.5,1)";

// later passes on an element use fill "forwards" so they do not override the earlier pass while waiting
function A(el, keyframes, delay, duration, easing, fill, extra) {
  var opt = { delay: delay, duration: duration, easing: easing || EASE_OUT, fill: fill || "both" };
  for (var k in extra) opt[k] = extra[k];
  var a = el.animate(keyframes, opt);
  anims.push(a);
  return a;
}
function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

/* ---------- particles: burst sparks, star glints and rising embers ---------- */
var cv = $("#sparks"), ctx = cv.getContext("2d"), parts = [], embers = false, dpr = 1;
function size() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
}
function centre() {
  var r = $(".crest").getBoundingClientRect();
  return { x: (r.left + r.width / 2) * dpr, y: (r.top + r.height / 2) * dpr };
}
function burst(n) {
  var c = centre();
  for (var i = 0; i < n; i++) {
    var ang = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 11) * dpr;
    parts.push({ x: c.x, y: c.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 0.07 * dpr, drag: 0.93,
      r: (1 + Math.random() * 2.6) * dpr, life: 50 + Math.random() * 70, age: 0, hue: 36 + Math.random() * 16,
      star: Math.random() < 0.18 });
  }
}
function ember() {
  parts.push({ x: Math.random() * cv.width, y: cv.height * (0.7 + Math.random() * 0.35), vx: (Math.random() - 0.5) * 0.3 * dpr,
    vy: -(0.4 + Math.random() * 1.2) * dpr, g: 0, drag: 1, r: (0.8 + Math.random() * 2) * dpr,
    life: 120 + Math.random() * 140, age: 0, hue: 34 + Math.random() * 16, star: Math.random() < 0.06 });
}
function drawStar(p, a) {
  var L = p.r * 7;
  ctx.strokeStyle = "hsla(" + p.hue + ",100%,92%," + a + ")";
  ctx.lineWidth = Math.max(1, p.r * 0.5);
  ctx.beginPath(); ctx.moveTo(p.x - L, p.y); ctx.lineTo(p.x + L, p.y); ctx.moveTo(p.x, p.y - L); ctx.lineTo(p.x, p.y + L); ctx.stroke();
}
function tick() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = "lighter";
  if (embers && Math.random() < 0.6) ember();
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i];
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.age++;
    var t = p.age / p.life;
    if (t >= 1) { parts.splice(i, 1); continue; }
    var a = (t < 0.15 ? t / 0.15 : 1 - t) * (0.65 + Math.random() * 0.35);
    var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.4);
    grd.addColorStop(0, "hsla(" + p.hue + ",100%,90%," + a + ")");
    grd.addColorStop(0.4, "hsla(" + p.hue + ",100%,70%," + a * 0.6 + ")");
    grd.addColorStop(1, "hsla(" + p.hue + ",100%,55%,0)");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, Math.PI * 2); ctx.fill();
    if (p.star) drawStar(p, a * 0.8);
  }
  requestAnimationFrame(tick);
}

/* ---------- timeline ---------- */
function play() {
  anims.forEach(function (a) { a.cancel(); }); anims = [];
  timers.forEach(clearTimeout); timers = [];
  parts = []; embers = false;

  // 0–300 background fades in
  A($(".bg"), [{ opacity: 0 }, { opacity: 1 }], 0, 300, "linear");
  // 300–950 diamond window opens with a bright rim, then overshoots past the screen edges
  var dia = [
    { clipPath: "polygon(50% 50%,50% 50%,50% 50%,50% 50%)" },
    { clipPath: "polygon(50% 8%,82% 50%,50% 92%,18% 50%)", offset: 0.55 },
    { clipPath: "polygon(50% -130%,230% 50%,50% 230%,-130% 50%)" }
  ];
  var rim = [
    { clipPath: "polygon(50% 49%,51% 50%,50% 51%,49% 50%)" },
    { clipPath: "polygon(50% 5%,85% 50%,50% 95%,15% 50%)", offset: 0.55 },
    { clipPath: "polygon(50% -134%,234% 50%,50% 234%,-134% 50%)" }
  ];
  A($(".reveal-rim"), rim, 300, 650, "cubic-bezier(.6,0,.3,1)");
  A($(".reveal"), dia, 300, 650, "cubic-bezier(.6,0,.3,1)");
  // 650 trophy and light from above
  A($(".cup"), [{ opacity: 0, transform: "translate(-50%,-44%) scale(.94)" }, { opacity: 0.8, transform: "translate(-50%,-52%) scale(1)" }], 650, 500);
  A($(".godrays"), [{ opacity: 0 }, { opacity: 0.8 }], 650, 900, "ease-out");
  $$(".godrays i").forEach(function (g, i) {
    var base = getComputedStyle(g).transform;
    anims.push(g.animate([{ transform: base }, { transform: base + " rotate(" + (i % 2 ? -3 : 3) + "deg)" }, { transform: base }],
      { duration: 5000 + i * 700, iterations: Infinity, easing: "ease-in-out" }));
  });
  // 1000 badge stamps down, shockwave and wings
  A($(".badge"), [
    { opacity: 0, transform: "scale(2.4)", filter: "blur(8px)" },
    { opacity: 1, transform: "scale(.93)", filter: "blur(0)", offset: 0.7 },
    { opacity: 1, transform: "scale(1)", filter: "blur(0)" }
  ], 1000, 340, STAMP);
  A($(".ring"), [{ opacity: 1, transform: "scale(.4)" }, { opacity: 0, transform: "scale(2.6)" }], 1120, 700, "cubic-bezier(.1,.7,.3,1)");
  A($(".wing.right"), [{ opacity: 0, transform: "scaleX(0) rotate(-18deg)" }, { opacity: 1, transform: "scaleX(1.08) rotate(3deg)", offset: 0.65 }, { opacity: 1, transform: "scaleX(1) rotate(0)" }], 1100, 520, "cubic-bezier(.2,.9,.3,1)");
  A($(".wing.left"), [{ opacity: 0, transform: "scaleX(0) rotate(18deg)" }, { opacity: 1, transform: "scaleX(1.08) rotate(-3deg)", offset: 0.65 }, { opacity: 1, transform: "scaleX(1) rotate(0)" }], 1100, 520, "cubic-bezier(.2,.9,.3,1)");
  // 1150 flash, lens streak, bokeh, rays and spark burst
  A($(".flash"), [{ opacity: 0, transform: "scale(.25)" }, { opacity: 1, transform: "scale(.7)", offset: 0.22 }, { opacity: 0, transform: "scale(1.5)" }], 1150, 700, "ease-out");
  A($(".streak"), [{ opacity: 0, transform: "scaleX(.2)" }, { opacity: 1, transform: "scaleX(1)", offset: 0.25 }, { opacity: 0, transform: "scaleX(1.2)" }], 1150, 800, "ease-out");
  $$(".orbs i").forEach(function (o, i) {
    A(o, [{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1)", offset: 0.3 }, { opacity: 0, transform: "scale(1.4)" }],
      1150 + i * 45, 1000 + i * 70, "ease-out");
  });
  A($(".rays"), [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0.6 }], 1150, 1300, "ease-out");
  A($(".sunburst"), [{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.05)", offset: 0.4 }, { opacity: 0.75, transform: "translate(-50%,-50%) scale(1)" }], 1150, 900);
  A($(".halo"), [{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], 1150, 600);
  at(1150, function () { burst(180); });
  at(1350, function () { burst(60); });
  at(1500, function () { embers = true; });
  // 1350+ metallic shine sweeps across the badge, then repeats
  // (endDelay does not apply between iterations, so the pause is part of the keyframes)
  A($(".shine"), [{ backgroundPosition: "160% 0" }, { backgroundPosition: "-60% 0", offset: 0.3 }, { backgroundPosition: "-60% 0" }], 1350, 3100, "ease-in-out", "forwards", { iterations: Infinity });
  // 1500+ star glints twinkle around the crest
  $$(".glint").forEach(function (g, i) {
    A(g, [{ opacity: 0, transform: "scale(0) rotate(0)" }, { opacity: 1, transform: "scale(1) rotate(45deg)", offset: 0.22 }, { opacity: 0, transform: "scale(0) rotate(90deg)", offset: 0.45 }, { opacity: 0, transform: "scale(0) rotate(90deg)" }],
      1500 + i * 330, 1700 + i * 120, "ease-in-out", "forwards", { iterations: Infinity });
  });
  // 1800+ halo breathes
  at(1800, function () {
    anims.push($(".halo").animate([{ opacity: 1 }, { opacity: 0.6 }, { opacity: 1 }], { duration: 1800, iterations: Infinity, easing: "ease-in-out" }));
  });
  // 2700 result panel slides up; crest lifts and shrinks, trophy fades
  A($(".panel"), [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], 2700, 450);
  A($(".crest"), [{ top: "44%", transform: "translate(-50%,-50%) scale(1)" }, { top: "33%", transform: "translate(-50%,-50%) scale(.82)" }], 2700, 450, null, "forwards");
  A($(".rays"), [{ top: "44%" }, { top: "33%" }], 2700, 450, null, "forwards");
  A($(".cup"), [{ opacity: 0.8 }, { opacity: 0 }], 2700, 400, null, "forwards");
  A($(".score"), [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], 2950, 350);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    anims.forEach(function (a) { if (a.effect.getTiming().iterations !== Infinity) a.finish(); });
  }
}

window.addEventListener("resize", size);
$("#replay").addEventListener("click", play);
size();
requestAnimationFrame(tick);
play();
