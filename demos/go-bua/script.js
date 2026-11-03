/* Gõ búa Navi: Navi follows the cursor with its face, curious and smiling.
   The hammer button turns the cursor into a hammer; hitting Navi squashes it,
   it cries for a moment, then laughs it off. Esc puts the hammer down. */
(function () {
  var svg = document.getElementById('art');
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  // getBBox reads as empty while the page sits in a hidden frame, so wait for a real size
  function measurable() {
    try { return svg.querySelector('[data-eye]').getBBox().width > 0; } catch (e) { return false; }
  }
  (function boot() { if (measurable()) main(); else setTimeout(boot, 100); })();

  function main() {

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function prog(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function sstep(a, b, v) { return smooth(clamp((v - a) / (b - a), 0, 1)); }
  function easeIn(t) { return t * t; }
  // damped spring from `from` to `to`, p in 0..1
  function settle(from, to, p) { return to + (from - to) * Math.cos(p * Math.PI * 2.5) * Math.pow(1 - p, 2.2); }
  // eases v toward target at `rate` per second, frame-rate independent
  function follow(v, target, rate, dt) { return lerp(v, target, 1 - Math.exp(-rate * dt)); }

  var stage = $('stage'), tool = $('tool'), hammer = $('hammer'), hint = $('hint');
  var navi = $('navi'), shadow = $('shadow'), back = $('back'), screen = $('screen'),
      faceG = $('face'), eyesG = $('eyes'), shut = $('shut'), tears = $('tears'), fx = $('fx');
  // body parts used to decide whether the hammer landed on Navi
  var hitParts = [navi.querySelector('#torso > path'), screen.firstElementChild].concat(
    [].slice.call(navi.firstElementChild.querySelectorAll('path')));

  function centre(els) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    els.forEach(function (e) {
      var b = e.getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    });
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  }

  /* ---------- puppet: the torso outlines are bent point by point ----------
     Feet stay planted. The side flaps (Navi's arms) swing on their shoulders,
     the body turns toward where the face looks and bobs up and down,
     squashing toward the hips. The spine bend is left at zero so the body
     never sways sideways. */
  var NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g;
  var paths = [].map.call(svg.querySelectorAll('[data-pts]'), function (el) {
    var d = el.getAttribute('d');
    return { el: el, nums: d.match(NUM).map(Number), parts: d.split(NUM) };
  });

  var HIP = 156, SHOULDER_L = [54, 76], SHOULDER_R = [146, 76];
  var rig = { bend: 0, bob: 0, armL: 0, armR: 0, turn: 0, nod: 0 };

  /* the folder screen is a thick slab: its dark side is the screen outline
     swept back along the depth direction, drawn as stacked copies */
  var face0 = screen.firstElementChild, SLICES = 12, slices = [];
  for (var i = 0; i < SLICES; i++) {
    var sl = document.createElementNS(NS, 'path');
    sl.setAttribute('fill', '#262626'); sl.setAttribute('stroke', '#262626'); sl.setAttribute('stroke-width', '.8');
    back.appendChild(sl); slices.push(sl);
  }
  function extrude(ox, oy, dx, dy) {
    var d = face0.getAttribute('d');
    slices.forEach(function (sl, i) {
      var t = (i + 1) / SLICES;
      sl.setAttribute('d', d);
      sl.setAttribute('transform', 'translate(' + (ox + dx * t) + ' ' + (oy + dy * t) + ')');
    });
  }

  function rot(x, y, cx, cy, deg) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }
  function warp(x, y) {
    var h = clamp((HIP - y) / 136, 0, 1), p;
    // arms first, as rigid flaps weighted toward their outer, lower edge
    var wl = sstep(68, 24, x) * sstep(55, 115, y), wr = sstep(132, 176, x) * sstep(55, 115, y);
    if (wl) { p = rot(x, y, SHOULDER_L[0], SHOULDER_L[1], rig.armL * wl); x = p[0]; y = p[1]; }
    if (wr) { p = rot(x, y, SHOULDER_R[0], SHOULDER_R[1], -rig.armR * wr); x = p[0]; y = p[1]; }
    // turning toward the cursor: treat the body as a round cone, so the front
    // (middle) slides toward the look while the silhouette edges stay put and the
    // near side bunches up; nodding tips the top forward a little
    // perspective: the side Navi turns toward shrinks a touch, the far side swells a touch
    var dx = x - 100;
    x = 100 + dx * (1 - 0.06 * rig.turn * clamp(dx / 90, -1, 1));
    var hw = lerp(10, 92, clamp((y - 20) / 130, 0, 1)), u = clamp((x - 100) / hw, -1, 1);
    x += rig.turn * 6 * Math.cos(u * Math.PI / 2);
    y += rig.nod * 3 * h * h;
    // knee bob: shorter and a touch wider
    y = HIP - (HIP - y) * (1 - rig.bob);
    x = 100 + (x - 100) * (1 + rig.bob * 0.5);
    // spine: the higher the point, the further it bends
    return rot(x, y, 100, HIP, rig.bend * Math.pow(h, 1.4));
  }
  function deform() {
    paths.forEach(function (p) {
      var n = p.nums, out = p.parts[0];
      for (var i = 0; i < n.length; i += 2) {
        var q = warp(n[i], n[i + 1]);
        out += q[0].toFixed(2) + p.parts[i + 1] + q[1].toFixed(2) + p.parts[i + 2];
      }
      p.el.setAttribute('d', out);
    });
  }

  /* ---------- face: one pair of eyes that stays, the mouth changes ---------- */
  var eyes = [].map.call(svg.querySelectorAll('[data-eye]'), function (e) {
    var c = centre([e]);
    return { el: e, x: c.x, y: c.y };
  });
  var mouths = {};
  [].forEach.call(svg.querySelectorAll('[data-mouth]'), function (g) {
    var c = centre([g]);
    mouths[g.getAttribute('data-mouth')] = { el: g, x: c.x, y: c.y, w: 0, base: g.getAttribute('transform') || '' };
  });
  mouths.curious.w = 1;
  var eye = { open: 1, lift: 0, shut: 0 }, eyesBase = eyesG.getAttribute('transform') || '';
  var nextBlink = performance.now() + 2500, blinkAt = -1e9, blinks = 1;

  // the old mouth closes toward its centre first, then the new one opens with a little pop
  function mouthTo(name, dt) {
    var others = 0;
    for (var k in mouths) if (k !== name) others = Math.max(others, mouths[k].w);
    for (k in mouths) {
      var m = mouths[k];
      m.w = k === name ? (others < 0.2 ? Math.min(1, m.w + dt / 0.17) : m.w)
                       : Math.max(0, m.w - dt / 0.11);
      var grow = k === name && m.w < 1, s;
      if (!m.w) { m.el.style.visibility = 'hidden'; continue; }
      s = grow ? 1 + Math.sin(m.w * Math.PI) * 0.12 - (1 - m.w) * 0.8 : 0.2 + 0.8 * m.w;
      m.el.style.visibility = '';
      m.el.style.opacity = Math.min(1, m.w * 2.5);
      m.el.setAttribute('transform', m.base + ' translate(' + m.x + ' ' + m.y + ') scale(' + Math.max(0.05, s) + ') translate(' + -m.x + ' ' + -m.y + ')');
    }
  }

  /* ---------- pointer & hammer ---------- */
  var ptr = { x: innerWidth / 2, y: innerHeight / 2, in: false };
  var look = { x: 0, y: 0 };
  var armed = false, swingAt = -1e9, struck = true;
  var REST = 30, SWING = 80, BACK = 260;

  function arm(on) {
    armed = on;
    stage.classList.toggle('armed', on);
    tool.setAttribute('aria-pressed', on ? 'true' : 'false');
    hint.textContent = on ? 'Gõ vào Navi · Esc để bỏ búa' : 'Bấm nút búa rồi gõ vào Navi · Esc để bỏ búa';
  }
  tool.addEventListener('click', function (e) { e.stopPropagation(); arm(!armed); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') arm(false); });

  addEventListener('pointermove', function (e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true; });
  document.addEventListener('pointerleave', function () { ptr.in = false; });
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.tool')) return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true;
    if (armed) { swingAt = performance.now(); struck = false; }
    else {
      var f = onFoot(e.clientX, e.clientY);
      if (f) { kick(f, performance.now()); play('laugh', performance.now()); }   // a poke on a foot tickles: it jumps and giggles
      else if (onNavi(e.clientX, e.clientY)) play('laugh', performance.now());   // a poke makes it giggle
    }
  });

  /* feet: a poke makes that foot jerk up, curl its toes, hold, then rest it back on the ground */
  var feetEls = { L: [], R: [] }, footAt = { L: -1e9, R: -1e9 };
  [].forEach.call(svg.querySelectorAll('[data-foot]'), function (e) { feetEls[e.getAttribute('data-foot')].push(e); });
  var FOOT_PIVOT = { L: [96, 160], R: [104, 160] };
  function inFill(p, cx, cy) {
    var m = p.getScreenCTM();
    if (!m) return false;
    var pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return p.isPointInFill(pt) || p.isPointInStroke(pt);
  }
  function onFoot(cx, cy) {
    for (var s in feetEls) if (feetEls[s].some(function (p) { return inFill(p, cx, cy); })) return s;
    return null;
  }
  function kick(side, now) { footAt[side] = now; }
  function footCurve(t) {
    if (t < 0 || t > 650) return 0;
    if (t < 90) return 1 - Math.pow(1 - t / 90, 3);               // jerks up fast
    if (t < 320) return 1;                                        // holds it up
    return 1 - smooth((t - 320) / 330);                           // lowers it and rests it on the ground
  }

  function onNavi(cx, cy) {
    return hitParts.some(function (p) {
      var m = p.getScreenCTM();
      if (!m) return false;
      var pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
      return p.isPointInFill(pt) || (p.isPointInStroke && p.isPointInStroke(pt));
    });
  }
  function toSvg(cx, cy) {
    return new DOMPoint(cx, cy).matrixTransform(svg.getScreenCTM().inverse());
  }

  function placeHammer(now) {
    var sc = svg.getBoundingClientRect().width / 200 * 0.95;
    // hammer drawing: head bottom-centre (18,47), grip (112,23), viewBox starts at -1
    var t = now - swingAt, a = REST;
    if (t < SWING) a = lerp(REST, -6, easeIn(t / SWING));
    else if (t < SWING + BACK) a = settle(-6, REST, (t - SWING) / BACK);
    var s = hammer.style;
    s.width = 125 * sc + 'px'; s.height = 49 * sc + 'px';
    s.transformOrigin = 113 * sc + 'px ' + 24 * sc + 'px';
    s.transform = 'translate(' + (ptr.x - 19 * sc) + 'px,' + (ptr.y - 48 * sc) + 'px) rotate(' + a + 'deg)';
    if (!struck && t >= SWING) { struck = true; if (onNavi(ptr.x, ptr.y)) hit(ptr.x, ptr.y); }
  }

  /* ---------- moods ----------
     Curious is home. Now and then Navi smiles or laughs for a moment; a hammer
     blow makes it cry, and it laughs it off straight after. */
  var mood = 'curious', moodAt = 0, moodLen = 0, nextMood = performance.now() + 6000;
  var CRY = 1500, LEN = { smile: 2600, laugh: 1500, cry: CRY };
  var hitAt = -1e9, power = 1;
  var drops = [], lastDrop = 0;

  function play(m, now) { mood = m; moodAt = now; moodLen = LEN[m]; }

  function hit(cx, cy) {
    var now = performance.now();
    power = now - hitAt < CRY ? 0.75 : 1;     // a second blow while crying squashes a bit less
    hitAt = now;
    play('cry', now);
    var f = onFoot(cx, cy);
    if (f) kick(f, now);
    var p = toSvg(cx, cy);
    burst(p.x, p.y);
  }

  function burst(x, y) {
    var g = document.createElementNS(NS, 'g');
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + (i - 3) * 0.42, l = document.createElementNS(NS, 'path');
      l.setAttribute('d', 'M' + Math.cos(a) * 9 + ' ' + Math.sin(a) * 9 + 'L' + Math.cos(a) * 17 + ' ' + Math.sin(a) * 17);
      l.setAttribute('stroke', i % 2 ? '#FBBF24' : '#FEF08A');
      l.setAttribute('stroke-width', '2.4'); l.setAttribute('stroke-linecap', 'round');
      g.appendChild(l);
    }
    var star = document.createElementNS(NS, 'path');
    star.setAttribute('d', 'M0 -7L2 -2L7 -2L3 1.5L4.5 6.5L0 3.5L-4.5 6.5L-3 1.5L-7 -2L-2 -2Z');
    star.setAttribute('fill', '#FEF08A'); star.setAttribute('stroke', '#0A0A0A'); star.setAttribute('stroke-width', '.8');
    star.setAttribute('stroke-linejoin', 'round');
    g.appendChild(star);
    fx.appendChild(g);
    g.animate([{ transform: 'translate(' + x + 'px,' + y + 'px) scale(.4)', opacity: 1 },
               { transform: 'translate(' + x + 'px,' + y + 'px) scale(1.25)', opacity: 1, offset: .35 },
               { transform: 'translate(' + x + 'px,' + y + 'px) scale(1.4)', opacity: 0 }],
              { duration: 380, easing: 'ease-out' }).onfinish = function () { g.remove(); };
  }

  var last = performance.now();
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (armed) placeHammer(now);

    if (mood !== 'curious' && now - moodAt > moodLen) {
      if (mood === 'cry') play('laugh', now);                        // laughs it off right away
      else { mood = 'curious'; nextMood = now + 7000 + Math.random() * 6000; }
    }
    if (mood === 'curious' && now > nextMood) play(Math.random() < 0.6 ? 'smile' : 'laugh', now);
    var t = now - moodAt, crying = mood === 'cry';

    // where Navi looks: from the middle of its face screen toward the cursor (or the hammer head)
    var r = screen.getBoundingClientRect(), w = svg.getBoundingClientRect().width;
    var tx = 0, ty = 0;
    if (ptr.in && !crying) {
      var dx = ptr.x - (r.left + r.width / 2), dy = ptr.y - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy), k = Math.min(1, d / (w * 0.6)) / (d || 1);
      tx = dx * k; ty = dy * k;
    }
    if (crying) ty = 0.3;                                            // head hangs a little
    look.x = follow(look.x, tx, crying ? 10 : 5, dt); look.y = follow(look.y, ty, crying ? 10 : 5, dt);
    var lx = look.x, ly = look.y;

    /* body: only a soft up-and-down bob; the arms swing left-right very slightly */
    var ph = now / 1600 * Math.PI * 2;                               // one bob every 1.6 s
    var bend = 0;
    var bob = 0.018 * (1 - Math.cos(ph)) / 2;
    var swing = Math.sin(now / 3200 * Math.PI * 2 - 0.6) * 1.2;      // both arms the same way, slower than the bob
    var armL = swing + bob * 20, armR = -swing + bob * 20;           // arms lift a touch as the body dips
    if (mood === 'laugh') {                                          // arms flap with each chuckle
      var e = Math.sin(prog(t, 0, moodLen) * Math.PI);
      var flap = Math.abs(Math.sin(t / 1000 * Math.PI * 5)) * 4 * e;
      armL += flap; armR += flap; bob += Math.abs(Math.sin(t / 1000 * Math.PI * 5)) * 0.025 * e;
    } else if (mood === 'smile') {
      var u = Math.sin(prog(t, 0, moodLen) * Math.PI);
      armL += 2 * u; armR += 2 * u;
    } else if (crying) {                                             // arms droop in and shiver
      var c = prog(t, 0, 200) * (1 - prog(t, CRY - 300, CRY));
      armL = lerp(armL, -4 + Math.sin(t / 55) * 1.2, c); armR = lerp(armR, -4 + Math.sin(t / 55 + 1) * 1.2, c);
      bob = lerp(bob, 0.03 + Math.sin(t / 85) * 0.012, c);          // sobbing
    }
    var startle = 0;
    for (var side in feetEls) {
      var c = footCurve(now - footAt[side]), fp = FOOT_PIVOT[side];
      startle = Math.max(startle, Math.max(0, c));
      var tr = 'translate(0 ' + (-5 * c) + ') rotate(' + (side === 'L' ? 16 : -16) * c + ' ' + fp[0] + ' ' + fp[1] + ')';
      feetEls[side].forEach(function (e) { e.setAttribute('transform', tr); });
    }
    bob -= 0.03 * startle;                                           // the body jolts up with it
    rig.bend = follow(rig.bend, bend, 8, dt); rig.bob = bob; rig.turn = lx; rig.nod = ly;
    rig.armL = follow(rig.armL, armL, 12, dt); rig.armR = follow(rig.armR, armR, 12, dt);
    deform();

    // the blow squashes the whole of Navi into the floor, then it springs back
    var sx = 1, sy = 1, tHit = now - hitAt;
    if (tHit < 900) {
      var squash = 0.3 * power;
      sy = tHit < 70 ? lerp(1, 1 - squash, tHit / 70) : settle(1 - squash, 1, prog(tHit, 70, 900));
      sx = 1 + (1 - sy) * 0.7;
    }
    navi.setAttribute('transform', 'translate(100 178) scale(' + sx + ' ' + sy + ') translate(-100 -178)');
    shadow.setAttribute('transform', 'translate(100 178) scale(' + sx + ' 1) translate(-100 -178)');

    // the screen slides with parallax (screen < face, as drawn in Figma). Its depth
    // points down-right at rest; turning toward the cursor swings the depth the
    // other way, so looking down the thickness thins below and shows over the top
    var sx0 = 3 * lx, sy0 = 5 * ly;                               // on top of the body's own turn
    screen.setAttribute('transform', 'translate(' + sx0 + ' ' + sy0 + ')');
    extrude(sx0, sy0, 2.5 - 5.5 * lx, 5.5 - 9 * ly);
    // the face rides on the bent body like a pinned layer
    var p0 = warp(100, 95), p1 = warp(112, 95), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
    faceG.setAttribute('transform', 'translate(' + p0[0] + ' ' + p0[1] + ') rotate(' + ang + ') translate(-100 -95) translate(' + 11 * lx + ' ' + 11 * ly + ')');
    eyesG.setAttribute('transform', eyesBase + ' translate(' + 1.5 * lx + ' ' + 1.2 * ly + ')');   // pupils lead the face a hair

    /* eyes: always the same pair; they blink, squint when smiling, squeeze shut when crying */
    if (now > nextBlink) { blinkAt = now; blinks = Math.random() < 0.25 ? 2 : 1; nextBlink = now + 2800 + Math.random() * 2600; }
    var bt = now - blinkAt, blink = 1;
    if (bt < 150 * blinks) blink = 1 - Math.sin((bt % 150) / 150 * Math.PI) * 0.92;
    var open = mood === 'laugh' ? 0.55 : mood === 'smile' ? 0.8 : crying ? 0.08 : 1;
    var lift = mood === 'laugh' ? -1.2 : mood === 'smile' ? -0.6 : 0;
    eye.open = follow(eye.open, open, crying ? 30 : 10, dt);
    eye.lift = follow(eye.lift, lift, 10, dt);
    eye.shut = follow(eye.shut, crying ? 1 : 0, crying ? 25 : 12, dt);
    var b = Math.min(eye.open, blink) * (1 + 0.22 * startle);      // eyes pop wide when a foot jumps
    eyes.forEach(function (e) {
      e.el.setAttribute('transform', 'translate(' + e.x + ' ' + (e.y + eye.lift) + ') scale(1 ' + b + ') translate(' + -e.x + ' ' + -e.y + ')');
    });
    eyesG.style.opacity = 1 - eye.shut;
    shut.style.opacity = eye.shut;
    shut.style.visibility = eye.shut > 0.01 ? '' : 'hidden';

    /* mouth: curious "o" breathes a little; other moods swap it */
    mouthTo(mood === 'laugh' ? 'happy' : mood, dt);
    var mc = mouths.curious;
    if (mc.w === 1) {
      var ms = 1 + Math.sin(now / 600) * 0.06;
      mc.el.setAttribute('transform', mc.base + ' translate(' + mc.x + ' ' + mc.y + ') scale(' + (1.5 - ms / 2) + ' ' + ms + ') translate(' + -mc.x + ' ' + -mc.y + ')');
    }

    if (crying && now - lastDrop > 120 && t > 120) { lastDrop = now; dropTear(); }
    updateTears(now, dt);
    requestAnimationFrame(tick);
  }

  // tears roll from the outer corners of the shut eyes
  var side = 0;
  function dropTear() {
    side ^= 1;
    var x = (side ? 75 : 124) + (Math.random() - 0.5) * 2, y = 95;
    var e = document.createElementNS(NS, 'path');
    e.setAttribute('fill', '#BFDBFE'); e.setAttribute('stroke', '#0A0A0A'); e.setAttribute('stroke-width', '.5');
    e.setAttribute('d', 'M0 -2.6C1.4 -0.6 1.9 0.4 1.9 1.1A1.9 1.9 0 0 1 -1.9 1.1C-1.9 0.4 -1.4 -0.6 0 -2.6Z');
    tears.appendChild(e);
    drops.push({ el: e, x: x, y: y, vx: (side ? -1 : 1) * (6 + Math.random() * 6), vy: -10, born: performance.now() });
  }
  function updateTears(now, dt) {
    drops = drops.filter(function (d) {
      d.vy += 160 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      var age = (now - d.born) / 700;
      if (age >= 1) { d.el.remove(); return false; }
      d.el.setAttribute('transform', 'translate(' + d.x + ' ' + d.y + ')');
      d.el.setAttribute('opacity', String(1 - age * age));
      return true;
    });
  }

  requestAnimationFrame(tick);
  }
})();
