// Render a seekable badge demo (window.__frame) to an H.264 MP4 with WebCodecs and a tiny built-in MP4 muxer,
// then save it via tools/save_server.py. Run inside the demo page served by save_server:
//   await exportMp4({ name: "x.mp4", crop: "0 0 160 160", loops: 4 })
//   portrait/full frame: await exportMp4({ name: "x.mp4", crop: "0 0 440 720", w: 880, h: 1440, art: "fill", seconds: 8 })
(function () {
  var TS = 90000;   // track timescale
  function u8(n) { return [n & 255]; }
  function u16(n) { return [(n >> 8) & 255, n & 255]; }
  function u32(n) { return [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function str(s) { return s.split("").map(function (c) { return c.charCodeAt(0); }); }
  function cat(parts) {
    var n = 0; parts.forEach(function (p) { n += p.length; });
    var out = new Uint8Array(n), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out;
  }
  function box(type) {
    var body = cat([].slice.call(arguments, 1).map(function (p) { return p instanceof Uint8Array ? p : new Uint8Array(p); }));
    return cat([new Uint8Array(u32(body.length + 8).concat(str(type))), body]);
  }
  function full(type, v, flags) { return box.apply(null, [type, [v].concat(u32(flags).slice(1))].concat([].slice.call(arguments, 3))); }
  var MATRIX = [].concat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));

  function mux(samples, avcC, w, h, frameDur) {
    var total = samples.length * frameDur, sizes = samples.map(function (s) { return s.data.length; });
    var keys = []; samples.forEach(function (s, i) { if (s.key) keys.push(i + 1); });
    var ftyp = box("ftyp", str("isom"), u32(512), str("isomiso2avc1mp41"));
    function moov(mdatOffset) {
      var stbl = box("stbl",
        full("stsd", 0, 0, u32(1), box("avc1", [0, 0, 0, 0, 0, 0], u16(1), new Array(16).fill(0), u16(w), u16(h),
          u32(0x480000), u32(0x480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xffff), box("avcC", avcC))),
        full("stts", 0, 0, u32(1), u32(samples.length), u32(frameDur)),
        full("stss", 0, 0, u32(keys.length), [].concat.apply([], keys.map(u32))),
        full("stsc", 0, 0, u32(1), u32(1), u32(samples.length), u32(1)),
        full("stsz", 0, 0, u32(0), u32(samples.length), [].concat.apply([], sizes.map(u32))),
        full("stco", 0, 0, u32(1), u32(mdatOffset)));
      var minf = box("minf", full("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)),
        box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, 1))), stbl);
      var mdia = box("mdia", full("mdhd", 0, 0, u32(0), u32(0), u32(TS), u32(total), u16(0x55c4), u16(0)),
        full("hdlr", 0, 0, u32(0), str("vide"), u32(0), u32(0), u32(0), str("VideoHandler"), [0]), minf);
      var tkhd = full("tkhd", 0, 3, u32(0), u32(0), u32(1), u32(0), u32(total), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0),
        MATRIX, u32(w << 16), u32(h << 16));
      var mvhd = full("mvhd", 0, 0, u32(0), u32(0), u32(TS), u32(total), u32(0x10000), u16(0x100), new Array(10).fill(0),
        MATRIX, new Array(24).fill(0), u32(2));
      return box("moov", mvhd, box("trak", tkhd, mdia));
    }
    var probe = moov(0), offset = ftyp.length + probe.length + 8;   // moov before mdat (fast start)
    var mdatBody = cat(samples.map(function (s) { return s.data; }));
    return cat([ftyp, moov(offset), new Uint8Array(u32(mdatBody.length + 8).concat(str("mdat"))), mdatBody]);
  }

  window.exportMp4 = async function (o) {
    var W = o.w || o.size || 1080, H = o.h || o.size || 1080, FPS = 60, BG = o.bg || "#111113";
    var fill = o.art === "fill", AW = fill ? W : (o.art || 720), AH = fill ? H : (o.art || 720);
    var dur = o.seconds ? o.seconds * 1000 : window.__demo.duration * (o.loops || 4), n = Math.round(dur / 1000 * FPS);
    var samples = [], avcC = null;
    var enc = new VideoEncoder({
      output: function (c, m) {
        var d = new Uint8Array(c.byteLength); c.copyTo(d);
        samples.push({ data: d, key: c.type === "key" });
        if (m && m.decoderConfig && m.decoderConfig.description) avcC = new Uint8Array(m.decoderConfig.description);
      },
      error: function (e) { console.error(e); }
    });
    enc.configure({ codec: W * H > 1920 * 1088 / 2 ? "avc1.64002A" : "avc1.640028", width: W, height: H, bitrate: 8e6, framerate: FPS, avc: { format: "avc" } });
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d"), svg = document.getElementById("art"), ox = (W - AW) / 2, oy = (H - AH) / 2;
    for (var i = 0; i < n; i++) {
      window.__frame(i / FPS);
      var s = new XMLSerializer().serializeToString(svg).replace(/viewBox="[^"]+"/, 'viewBox="' + o.crop + '" width="' + AW + '" height="' + AH + '"');
      var im = new Image();
      await new Promise(function (r, j) { im.onload = r; im.onerror = j; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s); });
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); ctx.drawImage(im, ox, oy);
      var f = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(f, { keyFrame: i % FPS === 0 }); f.close();
      if (enc.encodeQueueSize > 20) await new Promise(function (r) { setTimeout(r, 5); });
    }
    await enc.flush();
    var file = mux(samples, avcC, W, H, TS / FPS);
    var res = await fetch("/save?name=" + encodeURIComponent(o.name), { method: "POST", body: file });
    return (await res.text()) + ", " + samples.length + " frames, " + (dur / 1000) + "s";
  };
})();
