// Render a seekable badge demo (window.__frame) to a transparent animated WebP and save it via tools/save_server.py.
// Run inside the demo page served by save_server:
//   await exportWebp({ name: "x.webp", crop: "149 60 160 160", size: 360, fps: 60, q: 0.94 })
// One loop of window.__demo.duration; every frame is a full keyframe (no blend), so it loops seamlessly.
(function () {
  function u24(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255]; }
  function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; }
  function cat(parts) {
    var n = 0; parts.forEach(function (p) { n += p.length; });
    var out = new Uint8Array(n), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out;
  }
  function chunk(tag, body) {
    var pad = body.length & 1, out = new Uint8Array(8 + body.length + pad);
    for (var i = 0; i < 4; i++) out[i] = tag.charCodeAt(i);
    out.set(u32(body.length), 4); out.set(body, 8); return out;
  }
  // keep the ALPH + VP8/VP8L chunks of a still WebP
  function frameChunks(b) {
    var keep = [], o = 12;
    while (o < b.length) {
      var tag = String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
      var len = b[o + 4] | (b[o + 5] << 8) | (b[o + 6] << 16) | (b[o + 7] << 24), end = o + 8 + len + (len & 1);
      if (tag === "ALPH" || tag === "VP8 " || tag === "VP8L") keep.push(b.subarray(o, end));
      o = end;
    }
    return cat(keep);
  }
  function mux(frames, w, h, durs) {
    var parts = [chunk("VP8X", new Uint8Array([0x12, 0, 0, 0].concat(u24(w - 1), u24(h - 1)))),   // alpha + animation
                 chunk("ANIM", new Uint8Array([0, 0, 0, 0, 0, 0]))];                              // clear bg, loop forever
    frames.forEach(function (f, i) {
      parts.push(chunk("ANMF", cat([new Uint8Array([].concat(u24(0), u24(0), u24(w - 1), u24(h - 1), u24(durs[i]), [0x03])), f])));
    });
    var body = cat(parts);
    return cat([new Uint8Array([82, 73, 70, 70].concat(u32(body.length + 4), [87, 69, 66, 80])), body]);
  }

  window.exportWebp = async function (o) {
    var S = o.size || 360, FPS = o.fps || 60, Q = o.q || 0.94;
    var dur = window.__demo.duration, n = Math.round(dur / 1000 * FPS);
    var cv = document.createElement("canvas"); cv.width = cv.height = S;
    var ctx = cv.getContext("2d"), svg = document.getElementById("art") || document.querySelector("svg"), frames = [], durs = [];
    for (var i = 0; i < n; i++) {
      window.__frame(i * dur / n / 1000);
      var s = new XMLSerializer().serializeToString(svg).replace(/viewBox="[^"]+"/, 'viewBox="' + o.crop + '" width="' + S + '" height="' + S + '"');
      var im = new Image();
      await new Promise(function (r, j) { im.onload = r; im.onerror = j; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); });
      ctx.clearRect(0, 0, S, S); ctx.drawImage(im, 0, 0, S, S);
      var blob = await new Promise(function (r) { cv.toBlob(r, "image/webp", Q); });
      frames.push(frameChunks(new Uint8Array(await blob.arrayBuffer())));
      durs.push(Math.round((i + 1) * dur / n) - Math.round(i * dur / n));
    }
    var file = mux(frames, S, S, durs);
    var res = await fetch("/save?name=" + encodeURIComponent(o.name), { method: "POST", body: file });
    return (await res.text()) + ", " + n + " frames @" + FPS + "fps, " + S + "x" + S;
  };
})();
