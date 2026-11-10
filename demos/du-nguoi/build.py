# Ghép Navi SVG vào index.html -> page.html (dùng base.png) và standalone.html (ảnh nền nhúng sẵn)
import re, base64, pathlib
d = pathlib.Path(__file__).parent
inner = lambda f: re.sub(r'^\s*<svg[^>]*>|</svg>\s*$', '', (d / f).read_text(encoding='utf-8'))
html = (d / 'index.html').read_text(encoding='utf-8')
html = html.replace('{{NAVI_L}}', inner('navi-trai.svg')).replace('{{NAVI_R}}', inner('navi-phai.svg')).replace('{{TITLE}}', (d / 'title.svg').read_text(encoding='utf-8'))
(d / 'page.html').write_text(html, encoding='utf-8')
uri = lambda f: 'data:image/png;base64,' + base64.b64encode((d / f).read_bytes()).decode()
(d / 'standalone.html').write_text(html.replace('href="base.png"', 'href="' + uri('base.png') + '"').replace('href="layers/card.png"', 'href="' + uri('layers/card.png') + '"'), encoding='utf-8')
print('ok', len(html), 'standalone', (d / 'standalone.html').stat().st_size)

# Bản cho Thư viện IL: chỉ khung thẻ (ảnh nhúng sẵn) + css + js, ghép vào ../../index.html qua src-du-nguoi-*
full = (d / 'standalone.html').read_text(encoding='utf-8')
stage = full[full.index('  <div class="stage">'):full.index('  <div class="bar">')].strip()
js = full[full.index('<script>') + 8:full.rindex('</script>')].strip()
css = """html,body{height:100%;margin:0}
body{background:#0B0B0C;display:grid;place-items:center;padding:16px;box-sizing:border-box}
.stage{width:min(100%,440px,calc((100vh - 32px) * 440 / 670));aspect-ratio:440/670;border-radius:14px;overflow:hidden;background:#000}
.stage svg{display:block;width:100%;height:100%}"""
(d / 'lib.html').write_text(stage, encoding='utf-8')
(d / 'lib.css').write_text(css, encoding='utf-8')
(d / 'lib.js').write_text(js, encoding='utf-8')
print('lib', len(stage), len(js))
