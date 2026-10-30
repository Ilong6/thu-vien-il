/* Mở quà: the box shakes, the lid flips open on its back hinge, gifts burst out
   and Navi flings its arms out in surprise. Everything is driven from one clock so the
   loop can be seeked frame by frame (window.__demo) for video/WebP export. */
(function () {
  var LOOP = 6000, TAU = Math.PI * 2;
  var svg = document.getElementById('art');
  var NS = 'http://www.w3.org/2000/svg';

  // Everything below measures the artwork (getBBox), which reads as empty while
  // the page sits in a hidden frame, so wait until the drawing has a real size.
  function measurable() {
    try {
      return [].every.call(svg.querySelectorAll('[data-item]'), function (e) { return e.getBBox().width > 0; });
    } catch (e) { return false; }
  }
  // (setTimeout, not requestAnimationFrame: a hidden frame gets no animation frames)
  (function boot() { if (measurable()) main(); else setTimeout(boot, 100); })();

  function main() {

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function prog(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function ease(t) { return t * t * (3 - 2 * t); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  function easeOutBack(t) { var c = 1.7; t -= 1; return 1 + t * t * ((c + 1) * t + c); }
  function easeInBack(t) { var c = 1.7; return t * t * ((c + 1) * t - c); }
  // damped spring from `from` to `to`, p in 0..1
  function settle(from, to, p) { return to + (from - to) * Math.cos(p * Math.PI * 2.2) * Math.pow(1 - p, 2); }
  function mix(c1, c2, t) {
    var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16), r = '#';
    for (var s = 16; s >= 0; s -= 8) r += ('0' + Math.round(lerp(a >> s & 255, b >> s & 255, t)).toString(16)).slice(-2);
    return r;
  }

  /* ---------- Navi: one drawing cut into parts, puppeted ----------
     Each point first gets its part's own motion (arm swings on the shoulder
     as one rigid piece, foot tips on the ankle, eye/mouth scale about
     their centre), then the whole body's spine motion (tilt about the feet,
     lean, squash, hop). */
  var NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g;
  function nums(str) { return str.match(NUM).map(Number); }
  var naviG = svg.getElementById('navi');
  var BASE = 178, CX = 62, HN = 84;                 // feet line, body centre, body height
  var JOINT = {
    armL: { at: [38.5, 138], len: 33 }, armR: { at: [88, 137], len: 31 },
    footL: { at: [57, 170] }, footR: { at: [65, 170] }
  };
  var parts = [].map.call(naviG.querySelectorAll('[data-pts]'), function (el) {
    var d = el.getAttribute('d'), r = el.closest('[data-role]');
    return { el: el, role: r ? r.getAttribute('data-role') : 'body', parts: d.split(NUM), v: nums(d) };
  });
  // centres for scaling eyes and mouths
  var centre = {};
  parts.forEach(function (p) {
    var c = centre[p.role] || (centre[p.role] = [Infinity, Infinity, -Infinity, -Infinity]);
    for (var i = 0; i < p.v.length; i += 2) {
      c[0] = Math.min(c[0], p.v[i]); c[1] = Math.min(c[1], p.v[i + 1]);
      c[2] = Math.max(c[2], p.v[i]); c[3] = Math.max(c[3], p.v[i + 1]);
    }
  });
  for (var k in centre) centre[k] = [(centre[k][0] + centre[k][2]) / 2, (centre[k][1] + centre[k][3]) / 2];
  var pins = [].map.call(naviG.querySelectorAll('[data-pin]'), function (el) {
    return { el: el, attr: 'transform', role: el.closest('[data-role]').getAttribute('data-role'), at: nums(el.getAttribute('data-pin')), tf: el.getAttribute('transform') || '' };
  }).concat([].map.call(svg.querySelectorAll('[data-gt]'), function (el) {
    var tf = el.getAttribute('data-gt'), v = nums(tf);
    return { el: el, attr: 'gradientTransform', role: 'body', at: /^matrix/.test(tf) ? [v[4], v[5]] : [v[0], v[1]], tf: tf };
  }));
  var mouthS = naviG.querySelector('[data-role="mouthS"]'), mouthB = naviG.querySelector('[data-role="mouthB"]');
  var armTrim = naviG.querySelector('[data-arm-trim]');

  function rot(x, y, cx, cy, a) {
    var c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }
  function local(role, x, y, P) {
    var J = JOINT[role];
    if (role === 'armL' || role === 'armR') {
      // rigid swing on the shoulder; the root is tucked inside the body
      return rot(x, y, J.at[0], J.at[1], P[role]);
    }
    if (role === 'footL' || role === 'footR') {
      var q = rot(x, y, J.at[0], J.at[1], P[role]);
      return [q[0], q[1] - (role === 'footR' ? P.kick : 0)];
    }
    if (role === 'eyeL' || role === 'eyeR' || role === 'mouthS' || role === 'mouthB') {
      var c = centre[role], m = role.slice(0, 3) === 'eye' ? P.eye : P[role];
      return [c[0] + (x - c[0]) * m[0], c[1] + (y - c[1]) * m[1]];
    }
    return [x, y];
  }
  function deform(x, y, P) {
    var h = clamp((BASE - y) / HN, 0, 1);
    var dy = (BASE - y) * P.sy, dx = (x - CX) * P.sx;
    // tilt is rigid above the ankles; bend adds a curve that grows toward the top
    var a = P.tilt * clamp((BASE - y) / 12, 0, 1) + P.bend * Math.pow(h, 1.4);
    var c = Math.cos(a), s = Math.sin(a);
    return [CX + dx * c + dy * s, BASE - dy * c + dx * s - P.lift];
  }
  function drawNavi(P) {
    parts.forEach(function (n) {
      var v = n.v, out = n.parts[0];
      for (var i = 0; i < v.length; i += 2) {
        var l = local(n.role, v[i], v[i + 1], P), p = deform(l[0], l[1], P);
        out += (+p[0].toFixed(2)) + n.parts[i + 1] + (+p[1].toFixed(2)) + n.parts[i + 2];
      }
      n.el.setAttribute('d', out);
    });
    pins.forEach(function (n) {
      var l = local(n.role, n.at[0], n.at[1], P), p = deform(l[0], l[1], P);
      var sc = n.role === 'mouthS' ? ' translate(' + n.at[0] + ' ' + n.at[1] + ') scale(' + P.mouthS[0].toFixed(3) + ' ' + P.mouthS[1].toFixed(3) + ') translate(' + (-n.at[0]) + ' ' + (-n.at[1]) + ')' : '';
      n.el.setAttribute(n.attr, 'translate(' + (p[0] - n.at[0]).toFixed(2) + ' ' + (p[1] - n.at[1]).toFixed(2) + ')' + sc + ' ' + n.tf);
    });
    mouthS.style.display = P.wow ? 'none' : '';
    mouthB.style.display = P.wow ? '' : 'none';
    // hanging down, the arm lies over the body and needs its whole outline; raised (15°→35°) it is trimmed
    armTrim.setAttribute('fill-opacity', clamp((P.armL * 180 / Math.PI - 15) / 20, 0, 1).toFixed(2));
  }

  var KNOT = [164, 151];                       // where the ribbon is tied on the open box

  /* ---------- Lid: a slab hinged on its back edge ----------
     Corners F0 F1 (front edge) B1 B0 (hinge). Closed and open positions are the
     designed lids from Figma; in between the front edge swings on an ellipse
     (cos/sin of the hinge angle) so it reads as a real 3D rotation. */
  var C = { F0: [73.53, 155.36], F1: [147.22, 168.93], B1: [189.8, 150.3], B0: [122.82, 138.72] };
  var O = { F0: [107.5, 72.2], F1: [171, 61], B1: [170.7, 117.44], B0: [108.3, 120.06] };
  var NC = { F0: [-0.22, 7.76], F1: [-0.31, 9.82], B1: [0.12, 8.38], B0: [0, 8.2] };  // thickness, closed
  var NO = { F0: [7.65, 3.1], F1: [6.65, 4.6], B1: [6.2, 1], B0: [6.85, 0.35] };  // thickness, open
  // the shut lid on the tipped box (the first design), used while the box tips
  var CO = { F0: [65, 157.5], F1: [139.5, 149.5], B1: [175, 119.5], B0: [107.5, 127.5] };
  var NCO = { F0: [2, 7.5], F1: [2.5, 9.5], B1: [2.5, 8], B0: [2.5, 8] };
  var K = ['F0', 'F1', 'B1', 'B0'];
  // painted in this order. `on` is the range of hinge angle (0 shut, 1 upright) where the face
  // turns toward the viewer: we look from the front at about 40° above, so the outside of the
  // lid hides and the inside shows once it passes ~40°.
  var FACES = [
    { key: 'hinge', pts: [['o', 'B1'], ['o', 'B0'], ['i', 'B0'], ['i', 'B1']], fill: '#5B21B6', on: [0.55, 9] },
    { key: 'left',  pts: [['o', 'B0'], ['o', 'F0'], ['i', 'F0'], ['i', 'B0']], fill: '#581C87', on: [0.5, 9] },
    { key: 'inner', pts: [['i', 'F0'], ['i', 'F1'], ['i', 'B1'], ['i', 'B0']], fill: '#E879F9', on: [0.45, 9] },
    { key: 'top',   pts: [['o', 'F0'], ['o', 'F1'], ['o', 'B1'], ['o', 'B0']], fill: '#F675FF', on: [-9, 0.45] },
    { key: 'front', pts: [['o', 'F0'], ['o', 'F1'], ['i', 'F1'], ['i', 'F0']], fill: '#E356F8', on: [-9, 9] },
    { key: 'right', pts: [['o', 'F1'], ['o', 'B1'], ['i', 'B1'], ['i', 'F1']], fill: '#581C87', on: [-9, 9] }
  ];

  // a: hinge angle (0 shut, 1 upright). hk: how far the box has tipped toward us
  // (0 flat as in state 1, 1 as in state 2); the hinge rides on the box's back rim.
  function lidCorners(a, lift, hk) {
    var th = a * Math.PI / 2, c = Math.cos(th), s = Math.sin(th), k = hk;
    var o = {}, i = {};
    K.forEach(function (n) {
      var b = n[0] === 'B' ? n : 'B' + n[1];
      // hinge: on the back rim of the box (flat or tipped), rising a little as the lid swings up
      var bs = [lerp(C[b][0], CO[b][0], k), lerp(C[b][1], CO[b][1], k)], ka = ease(clamp(a, 0, 1));
      var B = [lerp(bs[0], O[b][0], ka), lerp(bs[1], O[b][1], ka) - lift];
      // the shut lid's depth follows the box from flat to tipped as well
      var dc = [lerp(C[n][0] - C[b][0], CO[n][0] - CO[b][0], k), lerp(C[n][1] - C[b][1], CO[n][1] - CO[b][1], k)];
      var p = n[0] === 'B' ? B : [B[0] + c * dc[0] + s * (O[n][0] - O[b][0]),
                                  B[1] + c * dc[1] + s * (O[n][1] - O[b][1])];
      o[n] = p;
      var nc = [lerp(NC[n][0], NCO[n][0], k), lerp(NC[n][1], NCO[n][1], k)];
      i[n] = [p[0] + c * nc[0] + s * NO[n][0], p[1] + c * nc[1] + s * NO[n][1]];
    });
    return { o: o, i: i };
  }
  function area(p) {
    var s = 0;
    for (var j = 0; j < p.length; j++) { var q = p[(j + 1) % p.length]; s += p[j][0] * q[1] - q[0] * p[j][1]; }
    return s;
  }
  function facePts(f, L) { return f.pts.map(function (r) { return L[r[0]][r[1]]; }); }

  var lidBack = svg.getElementById('lidBack'), lidFront = svg.getElementById('lidFront');
  var lidEls = FACES.map(function (f) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('stroke', '#0A0A0A');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('fill', f.fill);
    return p;
  });
  var lidHost = null;
  function drawLid(a, lift, light, hk) {
    var L = lidCorners(a, lift, hk);
    // once the front edge has swung above the hinge the lid sits behind the box body
    var front = (L.o.F0[1] + L.o.F1[1]) / 2 > (L.o.B0[1] + L.o.B1[1]) / 2 - 4;
    var host = front ? lidFront : lidBack;
    if (host !== lidHost) { lidEls.forEach(function (e) { host.appendChild(e); }); lidHost = host; }
    FACES.forEach(function (f, j) {
      var p = facePts(f, L), el = lidEls[j];
      if (a < f.on[0] || a > f.on[1] || Math.abs(area(p)) < 1) { el.setAttribute('d', ''); return; }
      el.setAttribute('d', 'M' + p.map(function (q) { return q[0].toFixed(2) + ' ' + q[1].toFixed(2); }).join('L') + 'Z');
      if (f.key === 'front') el.setAttribute('fill', mix('#E356F8', '#FEF08A', clamp(light, 0, 1)));
      if (f.key === 'inner') el.setAttribute('fill', mix('#F675FF', '#E879F9', clamp(a, 0, 1)));
    });
  }

  /* ---------- gifts ---------- */
  var MOUTH = [140, 138];                      // where gifts leave the box
  var items = [].map.call(svg.querySelectorAll('[data-item]'), function (el, i) {
    var b = el.getBBox();
    return { el: el, coin: el.getAttribute('data-item') === 'coin', c: [b.x + b.width / 2, b.y + b.height / 2], i: i };
  });
  // fly order: closest to the box first
  items.sort(function (p, q) { return Math.hypot(p.c[0] - MOUTH[0], p.c[1] - MOUTH[1]) - Math.hypot(q.c[0] - MOUTH[0], q.c[1] - MOUTH[1]); });
  items.forEach(function (it, k) { it.k = k; });
  var cards = [].slice.call(svg.querySelectorAll('[data-card]'));
  var glow = svg.getElementById('glow'), box = svg.getElementById('box');
  var naviShadow = svg.getElementById('naviShadow'), innerLight = svg.getElementById('innerLight');

  /* ---------- coins: spinning discs with a real rim ----------
     Each designed coin is read for its size, tilt and colours, then redrawn as
     a disc turning on its long axis: the face narrows to an edge while the rim
     between front and back faces widens, so the coin has thickness. */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function shade(c, k) { return mix(c, '#000000', k); }
  var coins = items.filter(function (it) { return it.coin; }).map(function (it, i) {
    var e = it.el.querySelector('ellipse');
    var rx = +e.getAttribute('rx'), ry = +e.getAttribute('ry');
    var m = nums(e.getAttribute('transform') || 'matrix(1 0 0 1 0 0)');
    var ax = ry >= rx ? [m[2], m[3]] : [m[0], m[1]];
    var plainV = e.getAttribute('fill') === '#262626';      // the big coin with the V logo
    var logo = plainV ? it.el.querySelector('g') : null;
    var R = Math.max(rx, ry) * Math.hypot(ax[0], ax[1]);
    // centre on the face: the plain coins' face ellipse, the V coin's purple face (the logo sits on it)
    var fb = plainV ? it.el.children[1].getBBox() : null;
    var fc = plainV ? [fb.x + fb.width / 2, fb.y + fb.height / 2] : [m[0] * rx + m[2] * ry + m[4], m[1] * rx + m[3] * ry + m[5]];
    if (plainV) R = Math.max(fb.width, fb.height) / 2 * 0.97;
    // hide the drawn coin only after measuring it (a hidden element has an empty box)
    [].forEach.call(it.el.children, function (c) { if (c !== logo) c.style.display = 'none'; });
    var root = el('g', { transform: 'translate(' + fc[0].toFixed(2) + ' ' + fc[1].toFixed(2) + ') rotate(' + (Math.atan2(ax[1], ax[0]) * 180 / Math.PI - 90).toFixed(2) + ')' });
    it.el.insertBefore(root, it.el.firstChild);
    var face = plainV ? '#A259FF' : '#D0F500', rim = plainV ? '#581C87' : '#A259FF';
    return {
      it: it, fc: fc, R: R, face: face, logo: logo, root: root, tilt: Math.atan2(ax[1], ax[0]) * 180 / Math.PI - 90,
      a0: Math.acos(Math.min(rx, ry) / Math.max(rx, ry)), phase: i * 1.7,
      rim: el('path', { fill: rim, stroke: '#0A0A0A', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, root),
      disc: el('ellipse', { stroke: '#0A0A0A', 'stroke-width': 0.6 }, root),
      ring: el('ellipse', { fill: 'none', stroke: '#0A0A0A', 'stroke-opacity': 0.3, 'stroke-width': 0.5 }, root),
      shine: el('path', { fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.85, 'stroke-width': 0.9, 'stroke-linecap': 'round' }, root)
    };
  });
  function drawCoin(C, phi) {
    var c = Math.cos(phi), s = Math.sin(phi), R = C.R;
    var a = Math.max(R * Math.abs(c), 0.05), off = R * 0.16 * s, fx = (c >= 0 ? 1 : -1) * off;
    var x1 = -Math.abs(off), x2 = Math.abs(off), f = function (v) { return v.toFixed(2); };
    C.rim.setAttribute('d', 'M' + f(x1) + ' ' + f(-R) + 'A' + f(a) + ' ' + f(R) + ' 0 0 0 ' + f(x1) + ' ' + f(R) +
      'L' + f(x2) + ' ' + f(R) + 'A' + f(a) + ' ' + f(R) + ' 0 0 0 ' + f(x2) + ' ' + f(-R) + 'Z');
    var show = Math.abs(c) > 0.06;
    [C.disc, C.ring].forEach(function (e, k) {
      var r = k ? 0.68 : 1;
      e.setAttribute('cx', f(fx)); e.setAttribute('rx', f(a * r)); e.setAttribute('ry', f(R * r));
      e.style.display = show ? '' : 'none';
    });
    // the back face is the same disc in shadow
    C.disc.setAttribute('fill', c >= 0 ? C.face : shade(C.face, 0.28));
    var lit = Math.abs(c) > 0.3, t0 = 3.55, t1 = 4.25;
    C.shine.style.display = lit ? '' : 'none';
    if (lit) C.shine.setAttribute('d', 'M' + f(fx + a * 0.78 * Math.cos(t0)) + ' ' + f(R * 0.78 * Math.sin(t0)) +
      'A' + f(a * 0.78) + ' ' + f(R * 0.78) + ' 0 0 1 ' + f(fx + a * 0.78 * Math.cos(t1)) + ' ' + f(R * 0.78 * Math.sin(t1)));
    if (C.logo) {
      var k = c / Math.cos(C.a0), cx = C.fc[0], cy = C.fc[1];
      C.logo.style.display = c > 0.2 ? '' : 'none';
      C.logo.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') rotate(' + C.tilt.toFixed(2) + ') translate(' + f(fx) + ' 0) scale(' + k.toFixed(3) + ' 1) rotate(' + (-C.tilt).toFixed(2) + ') translate(' + (-cx) + ' ' + (-cy) + ')');
    }
  }

  /* ---------- light: soft beams fanning out of the open box ---------- */
  var BEAM_FROM = [128, 142];
  svg.querySelector('defs').insertAdjacentHTML('beforeend',
    '<filter id="beamBlur" x="0" y="0" width="200" height="200" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="2.6"/></filter>' +
    '<filter id="haloBlur" x="0" y="0" width="200" height="200" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="5"/></filter>' +
    '<radialGradient id="beamGrad" gradientUnits="userSpaceOnUse" cx="' + BEAM_FROM[0] + '" cy="' + BEAM_FROM[1] + '" r="105">' +
      '<stop offset="0" stop-color="#FFF7C2" stop-opacity="0.95"/><stop offset="0.35" stop-color="#FFE600" stop-opacity="0.55"/><stop offset="1" stop-color="#FFE600" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="haloGrad"><stop offset="0" stop-color="#FFFBE0" stop-opacity="0.9"/><stop offset="0.5" stop-color="#FFE600" stop-opacity="0.45"/><stop offset="1" stop-color="#FFE600" stop-opacity="0"/></radialGradient>');
  var beamsG = svg.getElementById('beams');
  beamsG.setAttribute('style', 'mix-blend-mode:plus-lighter');
  var halo = el('ellipse', { cx: BEAM_FROM[0], cy: BEAM_FROM[1] - 4, rx: 46, ry: 20, fill: 'url(#haloGrad)', filter: 'url(#haloBlur)' }, beamsG);
  var beamWrap = el('g', { filter: 'url(#beamBlur)' }, beamsG);
  var BEAMS = [[-152, 66, 5], [-130, 84, 4], [-110, 96, 6.5], [-91, 104, 3.5], [-72, 98, 6], [-52, 86, 4], [-30, 70, 5]].map(function (b) {
    return { ang: b[0], len: b[1], hw: b[2], el: el('path', { fill: 'url(#beamGrad)' }, beamWrap) };
  });
  function drawBeams(t, light, grow) {
    beamsG.setAttribute('opacity', clamp(light, 0, 1.3).toFixed(3));
    halo.setAttribute('rx', (46 * (0.6 + 0.4 * grow)).toFixed(1));
    BEAMS.forEach(function (b, j) {
      var a = (b.ang + 3 * Math.sin(TAU * t / 2600 + j * 1.3)) * Math.PI / 180, w = b.hw * Math.PI / 180;
      var L = b.len * grow * (0.92 + 0.08 * Math.sin(TAU * t / 1300 + j));
      var p = function (ang, r) { return (BEAM_FROM[0] + r * Math.cos(ang)).toFixed(2) + ' ' + (BEAM_FROM[1] + r * Math.sin(ang)).toFixed(2); };
      b.el.setAttribute('d', 'M' + p(a - w * 0.3, 2) + 'L' + p(a - w, L) + 'L' + p(a + w, L) + 'L' + p(a + w * 0.3, 2) + 'Z');
      b.el.setAttribute('opacity', (0.55 + 0.45 * Math.sin(TAU * t / 1700 + j * 1.9)).toFixed(3));
    });
  }

  /* ---------- box body: flat when shut (state 1), tipped toward us when open (state 2) ---------- */
  var bodyPaths = [].map.call(svg.querySelectorAll('#body [data-d2]'), function (el) {
    var d = el.getAttribute('d');
    return { el: el, ribbon: el.hasAttribute('data-ribbon'), parts: d.split(NUM), a: nums(d), b: nums(el.getAttribute('data-d2')) };
  });
  var KNOT_SHUT = [170, 176];
  /* box shadow, same treatment as Navi's (flat #0A0A0A at 40%, no outline).
     It lies on the floor and stays put: the box's footprint (its bottom corners
     front-right, front-left, back-left, back-right), grown a little and nudged
     away from the light. */
  var SHADOW_SHUT = (function () {
    var q = [[147.2, 201.8], [77.5, 185.4], [118.4, 162.1], [188.1, 178.5]];
    var c = [0, 0]; q.forEach(function (p) { c[0] += p[0] / 4; c[1] += p[1] / 4; });
    return q.map(function (p) { return [c[0] + (p[0] - c[0]) * 1.16 + 5, c[1] + (p[1] - c[1]) * 1.16 + 2.5]; });
  })();
  var boxShadow = document.createElementNS(NS, 'path');
  boxShadow.setAttribute('fill', '#0A0A0A');
  boxShadow.setAttribute('stroke', '#0A0A0A');
  boxShadow.setAttribute('stroke-width', '3');
  boxShadow.setAttribute('stroke-linejoin', 'round');
  boxShadow.setAttribute('opacity', '0.4');
  svg.getElementById('ground').appendChild(boxShadow);
  var SHADOW_C = [0, 0]; SHADOW_SHUT.forEach(function (p) { SHADOW_C[0] += p[0] / 4; SHADOW_C[1] += p[1] / 4; });
  // it stays on the floor; as the box lifts off it, the shadow shrinks and fades a little
  function drawBoxShadow(up) {
    var sc = 1 - 0.14 * up;
    boxShadow.setAttribute('transform', 'translate(' + SHADOW_C[0].toFixed(2) + ' ' + SHADOW_C[1].toFixed(2) + ') scale(' + sc.toFixed(3) + ') translate(' + (-SHADOW_C[0]).toFixed(2) + ' ' + (-SHADOW_C[1]).toFixed(2) + ')');
    boxShadow.setAttribute('opacity', (0.4 - 0.13 * up).toFixed(3));
  }
  boxShadow.setAttribute('d', 'M' + SHADOW_SHUT.map(function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('L') + 'Z');
  // the light inside was drawn for the tipped box; this affine carries it onto the
  // flat box (fitted on three corners of the shut lid in both drawings)
  var TO_FLAT = (function () {
    var src = [[65, 157.5], [139.5, 149.5], [175, 119.5]], dst = [[73.53, 155.36], [147.22, 168.93], [189.8, 150.3]];
    var x1 = src[1][0] - src[0][0], y1 = src[1][1] - src[0][1], x2 = src[2][0] - src[0][0], y2 = src[2][1] - src[0][1];
    var u1 = dst[1][0] - dst[0][0], v1 = dst[1][1] - dst[0][1], u2 = dst[2][0] - dst[0][0], v2 = dst[2][1] - dst[0][1];
    var det = x1 * y2 - x2 * y1;
    var a = (u1 * y2 - u2 * y1) / det, c = (u2 * x1 - u1 * x2) / det, b = (v1 * y2 - v2 * y1) / det, d = (v2 * x1 - v1 * x2) / det;
    return [a, b, c, d, dst[0][0] - a * src[0][0] - c * src[0][1], dst[0][1] - b * src[0][0] - d * src[0][1]];
  })();
  function lightTransform(k) {
    var m = TO_FLAT, id = [1, 0, 0, 1, 0, 0];
    return 'matrix(' + m.map(function (v, i) { return lerp(v, id[i], k).toFixed(4); }).join(' ') + ')';
  }
  function drawBody(k, t, gust) {
    var knot = [lerp(KNOT_SHUT[0], KNOT[0], k), lerp(KNOT_SHUT[1], KNOT[1], k)];
    bodyPaths.forEach(function (r) {
      var a = r.a, b = r.b, out = r.parts[0];
      for (var i = 0; i < a.length; i += 2) {
        var x = lerp(a[i], b[i], k), y = lerp(a[i + 1], b[i + 1], k);
        if (r.ribbon) {
          // only the very tips of the ribbon stir
          var d = Math.hypot(x - knot[0], y - knot[1]);
          var w = Math.pow(clamp((d - 24) / 12, 0, 1), 2), ph = TAU * t / 1800 - d * 0.08, amp = 0.7 + 0.6 * gust;
          x += 0.6 * amp * w * Math.sin(ph * 0.8 + 1);
          y += amp * w * Math.sin(ph);
        }
        out += (+x.toFixed(2)) + r.parts[i + 1] + (+y.toFixed(2)) + r.parts[i + 2];
      }
      r.el.setAttribute('d', out);
    });
  }

  /* ---------- timeline ---------- */
  var OPEN = 1500, CLOSE = 4500;

  function frame(t) {
    t = ((t % LOOP) + LOOP) % LOOP;

    // box: two curious rattles, a squash, the pop, and a thud when it shuts
    var rot = 0, sy = 1, lidA = 0, lidLift = 0;
    [[380, 260, 1.2, 0.03], [860, 320, 2.2, 0.07], [1180, 260, 1.6, 0.05]].forEach(function (r) {
      var p = prog(t, r[0], r[0] + r[1]);
      if (p > 0 && p < 1) {
        var w = Math.sin(p * Math.PI);
        rot += r[2] * Math.sin(p * TAU * 2) * w;
        lidA += r[3] * w;
        lidLift += 2.2 * w * Math.abs(Math.sin(p * TAU * 1.5));
      }
    });
    var pre = prog(t, 1300, OPEN);
    sy *= 1 - 0.07 * ease(pre) * (t < OPEN ? 1 : 0);
    var pop = prog(t, OPEN, OPEN + 380);
    if (t >= OPEN && t < OPEN + 900) {
      sy = settle(1.08, 1, prog(t, OPEN, OPEN + 600));
      lidA = t < OPEN + 380 ? 1.14 * easeOut(pop) : settle(1.14, 1, prog(t, OPEN + 380, OPEN + 900));
      lidLift = 6 * Math.sin(pop * Math.PI);
    } else if (t >= OPEN + 900 && t < CLOSE + 450) {
      lidA = 1 + 0.015 * Math.sin(TAU * (t - OPEN) / 1800);
    } else if (t >= CLOSE + 450) {
      var cl = prog(t, CLOSE + 450, CLOSE + 860);
      lidA = 1 - easeIn(cl);
      var thud = prog(t, CLOSE + 860, CLOSE + 1200);
      if (thud > 0) {
        lidA = 0.06 * Math.sin(thud * Math.PI) * (1 - thud);
        sy = settle(0.93, 1, thud);
      }
    }
    // shut, the box sits flat on the ground; it tips toward us as it pops so we can see inside
    var k = t < OPEN ? easeOut(prog(t, OPEN - 120, OPEN)) * 0.35 : t < CLOSE + 450 ? Math.min(1, 0.35 + 0.65 * easeOutBack(prog(t, OPEN, OPEN + 320))) : 1 - easeIn(prog(t, CLOSE + 450, CLOSE + 860));   // drops flat as the lid slams, same beat
    k = clamp(k, 0, 1.06);
    box.setAttribute('transform', 'translate(125 184) rotate(' + rot.toFixed(2) + ') scale(' + (1 + (1 - sy) * 0.5).toFixed(4) + ' ' + sy.toFixed(4) + ') translate(-125 -184)');

    // light from inside the box
    var light = 0;
    if (t < OPEN) light = lidA * 4;
    else if (t < CLOSE + 760) light = t < OPEN + 450 ? 1.35 * easeOut(prog(t, OPEN, OPEN + 160)) - 0.35 * prog(t, OPEN + 160, OPEN + 450) : 0.9 + 0.1 * Math.sin(TAU * t / 900);
    // the glow inside stays until the lid is shut (the beams are pulled in earlier, with the gifts)
    else light = (0.9 + 0.1 * Math.sin(TAU * t / 900)) * (1 - prog(t, CLOSE + 760, CLOSE + 860));
    glow.setAttribute('opacity', clamp(light * (t < OPEN ? k : 1), 0, 1).toFixed(3));
    drawLid(lidA, lidLift, light, k);
    drawBoxShadow(clamp(k, 0, 1.1));
    var seen = t < OPEN ? clamp(k, 0, 1) : 1;   // before the pop the box is still shut; after, the light rides the box down
    innerLight.setAttribute('opacity', (seen * clamp(light * 1.1, 0, 1)).toFixed(3));
    var lt = lightTransform(clamp(k, 0, 1));
    innerLight.setAttribute('transform', lt);
    glow.setAttribute('transform', lt);
    beamsG.setAttribute('transform', lt);

    // gifts fly out on an arc, bob while out, then get sucked back in
    items.forEach(function (it) {
      var out = easeOutBack(prog(t, OPEN + 60 + it.k * 55, OPEN + 600 + it.k * 55));
      var back = easeInBack(prog(t, CLOSE + (items.length - it.k) * 25, CLOSE + 260 + (items.length - it.k) * 25));
      var p = out * (1 - back);
      if (p <= 0.001) { it.el.setAttribute('opacity', 0); return; }
      it.el.removeAttribute('opacity');
      var hold = prog(t, OPEN + 600, OPEN + 900) * (1 - back);
      var bob = 1.6 * Math.sin(TAU * t / 1500 + it.i * 1.3) * hold;
      var x = lerp(MOUTH[0], it.c[0], p), y = lerp(MOUTH[1], it.c[1], p) - 14 * Math.sin(Math.PI * clamp(p, 0, 1)) * (1 - hold) + bob;
      var sc = 0.3 + 0.7 * p, r = (1 - p) * (it.k % 2 ? -40 : 40);
      if (!it.coin) r += 4 * Math.sin(TAU * t / 2100 + it.i) * hold;
      it.el.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') rotate(' + r.toFixed(2) + ') scale(' + sc.toFixed(3) + ') translate(' + (-it.c[0]) + ' ' + (-it.c[1]) + ')');
    });
    // coins spin fast while flying, then settle into a lazy turn
    coins.forEach(function (C) {
      var fly = prog(t, OPEN, OPEN + 900);
      drawCoin(C, C.a0 + C.phase + TAU * (t / 1400) + TAU * 1.5 * easeOut(fly));
    });
    drawBeams(t, light * (t < OPEN ? clamp(k, 0, 1) : 1), t < OPEN ? 0.25 + 2 * lidA : easeOutBack(prog(t, OPEN + 20, OPEN + 420)) * (1 - easeIn(prog(t, CLOSE, CLOSE + 460))));

    cards.forEach(function (el, j) {
      var up = easeOutBack(prog(t, OPEN + 90 + j * 90, OPEN + 640 + j * 90));
      var down = easeIn(prog(t, CLOSE + 40 * j, CLOSE + 300 + 40 * j));
      var p = up * (1 - down), sway = 3 * Math.sin(TAU * t / 1700 + j * 1.7) * prog(t, OPEN + 700, OPEN + 1000);
      var cx = j ? 133 : 150, cy = 160;
      el.setAttribute('transform', 'translate(0 ' + (50 * (1 - p)).toFixed(2) + ') rotate(' + ((1 - p) * (j ? -12 : 12) + sway).toFixed(2) + ' ' + cx + ' ' + cy + ')');
    });

    drawBody(k, t, Math.max(lidA * 3, t >= OPEN ? Math.exp(-(t - OPEN) / 500) * (t < CLOSE + 860 ? 1 : 0) : 0, t >= CLOSE + 860 ? Math.exp(-(t - CLOSE - 860) / 400) : 0));

    // Navi. Curious: leans in, blinks, little "o" mouth, a hand reaching toward
    // the box. Pop: flinch, a small hop for joy with the mouth wide open, arms
    // waving on the ground, and calms down as the lid shuts.
    var P = { sy: 1 + 0.012 * Math.sin(TAU * t / 1600), sx: 1, tilt: 0, bend: 0.03, lift: 0,
              armL: 0, armR: 0, footL: 0, footR: 0, kick: 0, eye: [1, 1], mouthS: [1, 1], mouthB: [1, 1], wow: false };
    var D = Math.PI / 180;
    // blinks
    [180, 2900, 3900].forEach(function (b) { var p = prog(t, b, b + 160); if (p > 0 && p < 1) P.eye = [1, 1 - 0.9 * Math.sin(p * Math.PI)]; });
    if (t < OPEN) {
      var lean = ease(prog(t, 300, 700)) * 0.05 + ease(prog(t, 1100, 1400)) * 0.05;
      P.bend += lean;
      P.armR = -14 * D * ease(prog(t, 500, 820)) * (1 - ease(prog(t, 840, 960)));          // reaches toward the lid…
      P.armR += -8 * D * ease(prog(t, 1000, 1300));                                         // …and again, more carefully
      [[380, 260], [860, 320], [1180, 260]].forEach(function (r) {                          // tiny start at each rattle
        var p = prog(t, r[0], r[0] + r[1]);
        if (p > 0 && p < 1) { var w = Math.sin(p * Math.PI); P.sy *= 1 - 0.03 * w; P.mouthS = [1 + 0.35 * w, 1 + 0.35 * w]; P.eye = [1 + 0.12 * w, 1 + 0.18 * w]; }
      });
      var fl = prog(t, 1420, OPEN);                                                         // flinch as the lid strains
      P.sy *= 1 - 0.06 * ease(fl);
    } else if (t < OPEN + 90) {
      var f = Math.sin(prog(t, OPEN, OPEN + 90) * Math.PI / 2);
      P.sy *= 0.94 - 0.08 * f; P.bend = 0.13 - 0.1 * f;
      P.eye = [1.05, 1 - 0.55 * f]; P.armL = -10 * D * f; P.armR = 12 * D * f;
    } else if (t < CLOSE + 860) {
      // jumps for joy and hangs there while the gifts are out, lands as the lid shuts
      P.wow = true;
      // a small hop that hangs just above the ground, then drops as the lid shuts
      // one small happy hop, then stays on the ground waving, bouncing at the knees
      var hop = prog(t, OPEN + 90, OPEN + 430);
      P.lift = hop < 1 ? 7 * Math.sin(Math.PI * hop) : 0;
      var beat = Math.sin(TAU * (t - OPEN) / 650);
      var fling = prog(t, OPEN + 90, OPEN + 600);
      P.sy *= hop < 1 ? settle(1.1, 1, hop) : settle(0.92, 1, prog(t, OPEN + 430, OPEN + 750)) * (1 - 0.02 * Math.abs(beat) * fling);
      var joy = beat;
      P.tilt = settle(-0.24, -0.1, fling) + 0.03 * Math.sin(TAU * (t - OPEN) / 1300) * fling;
      P.bend = 0.01;
      // both arms wave up and down together, mirrored (left raises with +, right with -)
      var flap = 10 * D * beat * fling;
      P.armL = settle(62, 44, fling) * D + flap;
      P.armR = settle(-50, -34, fling) * D - flap;
      var pop = prog(t, OPEN + 90, OPEN + 450);
      var m = settle(0.35, 1, pop) * (1 + 0.07 * joy * fling);
      P.mouthB = [m, m];
      if (P.eye[1] === 1) { var e = settle(1.4, 1.1, pop); P.eye = [e, e * (1 - 0.12 * fling)]; }  // wide, then a happy squint
      // arms come in a little as the gifts go home and the lid closes
      var down = ease(prog(t, CLOSE + 300, CLOSE + 860));
      P.armL *= 1 - 0.6 * down; P.armR *= 1 - 0.6 * down; P.tilt *= 1 - 0.6 * down;
      P.mouthB = [m * (1 - 0.3 * down), m * (1 - 0.45 * down)];
    } else {
      // arms down with the thud of the lid, then back to curious
      var back = prog(t, CLOSE + 860, CLOSE + 1300), e2 = ease(back);
      P.armL = 19 * D * (1 - e2); P.armR = -15 * D * (1 - e2); P.tilt = -0.05 * (1 - e2);
      P.bend = 0.03 + 0.04 * Math.sin(Math.PI * back);                                  // peeks at the shut box
      P.mouthS = [1 + 0.4 * (1 - e2), 1 + 0.4 * (1 - e2)];
      P.sy *= settle(0.95, 1, prog(t, CLOSE + 860, CLOSE + 1140));
    }
    P.sx = 1 + (1 - P.sy) * 0.6;
    drawNavi(P);
    var sh = 1 - P.lift * 0.02;
    naviShadow.setAttribute('transform', 'translate(61.5 181.5) scale(' + sh.toFixed(3) + ' 1) translate(-61.5 -181.5)');
  }

  var start = performance.now(), playing = true, raf = null;
  function tick(now) { frame(now - start); raf = requestAnimationFrame(tick); }
  window.__demo = {
    duration: LOOP,
    seek: function (ms) { playing = false; if (raf) cancelAnimationFrame(raf); raf = null; frame(ms); },
    play: function () { if (!playing) { playing = true; start = performance.now(); raf = requestAnimationFrame(tick); } }
  };
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) frame(OPEN + 1400);
  else raf = requestAnimationFrame(tick);
  }
})();
