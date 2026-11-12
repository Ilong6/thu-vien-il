// Render a seekable demo (window.__frame) to an animated GIF and save it via tools/save_server.py.
// Run inside the demo page served by save_server:
//   await exportGif({ name: "x.gif", crop: "0 0 440 720", w: 440, h: 720, seconds: 6, fps: 20 })
// Each frame gets its own 255-colour palette (median cut); pixels that did not change are left
// transparent so the file stays small.
(function () {
  function medianCut(px, n) {
    var boxes = [px];
    while (boxes.length < n) {
      var bi = -1, bestRange = -1, bestCh = 0;
      boxes.forEach(function (b, i) {
        if (b.length < 2) return;
        for (var c = 0; c < 3; c++) {
          var lo = 255, hi = 0;
          for (var k = 0; k < b.length; k++) { var v = b[k][c]; if (v < lo) lo = v; if (v > hi) hi = v; }
          if (hi - lo > bestRange) { bestRange = hi - lo; bi = i; bestCh = c; }
        }
      });
      if (bi < 0 || bestRange <= 0) break;
      var box = boxes[bi].sort(function (a, b) { return a[bestCh] - b[bestCh]; });
      var mid = box.length >> 1;
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    return boxes.map(function (b) {
      var r = 0, g = 0, bl = 0;
      b.forEach(function (p) { r += p[0]; g += p[1]; bl += p[2]; });
      return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)];
    });
  }
  function lzw(indices, minSize) {
    var out = [], cur = 0, bits = 0;
    function emit(code, size) { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>= 8; bits -= 8; } }
    var clear = 1 << minSize, eoi = clear + 1, size = minSize + 1, next = eoi + 1, dict = new Map();
    emit(clear, size);
    var prefix = indices[0];
    for (var i = 1; i < indices.length; i++) {
      var c = indices[i], key = prefix * 256 + c, hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix, size);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
      else { emit(clear, size); dict.clear(); size = minSize + 1; next = eoi + 1; }
      prefix = c;
    }
    emit(prefix, size); emit(eoi, size);
    if (bits > 0) out.push(cur & 255);
    var blocks = [];
    for (var j = 0; j < out.length; j += 255) { var chunk = out.slice(j, j + 255); blocks.push(chunk.length); for (var q = 0; q < chunk.length; q++) blocks.push(chunk[q]); }
    blocks.push(0);
    return blocks;
  }
  function u16(n) { return [n & 255, (n >> 8) & 255]; }

  window.exportGif = async function (o) {
    var W = o.w, H = o.h, FPS = o.fps || 20, n = Math.round((o.seconds || 6) * FPS), delay = Math.round(100 / FPS);
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d", { willReadFrequently: true }), svg = document.getElementById("art");
    var shown = null, bytes = [];
    bytes.push.apply(bytes, [71, 73, 70, 56, 57, 97].concat(u16(W), u16(H), [0, 0, 0]));
    bytes.push.apply(bytes, [0x21, 0xFF, 11].concat("NETSCAPE2.0".split("").map(function (c) { return c.charCodeAt(0); }), [3, 1, 0, 0, 0]));
    for (var f = 0; f < n; f++) {
      window.__frame(f / FPS);
      var s = new XMLSerializer().serializeToString(svg).replace(/viewBox="[^"]+"/, 'viewBox="' + o.crop + '" width="' + W + '" height="' + H + '"');
      var im = new Image();
      await new Promise(function (r, j) { im.onload = r; im.onerror = j; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); });
      ctx.fillStyle = o.bg || "#000"; ctx.fillRect(0, 0, W, H); ctx.drawImage(im, 0, 0, W, H);
      var px = ctx.getImageData(0, 0, W, H).data;
      // changed pixels and their bounding box
      var x0 = W, y0 = H, x1 = -1, y1 = -1, changed = new Uint8Array(W * H);
      for (var i = 0, p = 0; i < W * H; i++, p += 4) {
        var d = shown ? Math.abs(px[p] - shown[p]) + Math.abs(px[p + 1] - shown[p + 1]) + Math.abs(px[p + 2] - shown[p + 2]) : 999;
        if (d > 18) { changed[i] = 1; var x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1, samples = [], step = Math.max(1, Math.floor(bw * bh / 30000));
      for (var yy = y0, cnt = 0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++, cnt++) {
        var ii = yy * W + xx; if (!changed[ii] || cnt % step) continue; var pp = ii * 4; samples.push([px[pp], px[pp + 1], px[pp + 2]]);
      }
      if (!samples.length) samples.push([0, 0, 0]);
      var pal = medianCut(samples, 255), cache = new Int16Array(32768).fill(-1), idx = new Uint8Array(bw * bh);
      if (!shown) shown = new Uint8ClampedArray(W * H * 4);
      for (var yy2 = y0, k = 0; yy2 <= y1; yy2++) for (var xx2 = x0; xx2 <= x1; xx2++, k++) {
        var i2 = yy2 * W + xx2, p2 = i2 * 4;
        if (!changed[i2]) { idx[k] = 255; continue; }
        var key = ((px[p2] >> 3) << 10) | ((px[p2 + 1] >> 3) << 5) | (px[p2 + 2] >> 3), best = cache[key];
        if (best < 0) {
          var bd = 1e9; for (var c = 0; c < pal.length; c++) { var dr = pal[c][0] - px[p2], dg = pal[c][1] - px[p2 + 1], db = pal[c][2] - px[p2 + 2], dd = dr * dr + dg * dg + db * db; if (dd < bd) { bd = dd; best = c; } }
          cache[key] = best;
        }
        idx[k] = best; shown[p2] = pal[best][0]; shown[p2 + 1] = pal[best][1]; shown[p2 + 2] = pal[best][2];
      }
      var table = []; for (var t = 0; t < 256; t++) { var col = pal[t] || [0, 0, 0]; table.push(col[0], col[1], col[2]); }
      bytes.push.apply(bytes, [0x21, 0xF9, 4, (1 << 2) | 1].concat(u16(delay), [255, 0]));
      bytes.push.apply(bytes, [0x2C].concat(u16(x0), u16(y0), u16(bw), u16(bh), [0x87]));
      for (var q = 0; q < table.length; q++) bytes.push(table[q]);
      bytes.push(8);
      var data = lzw(idx, 8); for (var z = 0; z < data.length; z++) bytes.push(data[z]);
    }
    bytes.push(0x3B);
    var file = new Uint8Array(bytes);
    var res = await fetch("/save?name=" + encodeURIComponent(o.name), { method: "POST", body: file });
    return (await res.text()) + ", " + n + " frames @" + FPS + "fps, " + W + "x" + H;
  };
})();
