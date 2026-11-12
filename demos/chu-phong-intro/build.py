# Ghép template.html + huy hiệu chìa khoá (từ demos/chia-khoa/lib.html) + chữ + ảnh nền -> standalone.html và lib.* cho Thư viện IL
import re, base64, pathlib
d = pathlib.Path(__file__).parent
key = (d.parent / 'chia-khoa' / 'lib.html').read_text(encoding='utf-8')
defs = key[key.index('<defs>') + 6:key.index('</defs>')].strip()
inner = key[key.index('<g transform="translate(149 60)">') + len('<g transform="translate(149 60)">'):key.rindex('    </g>\n  </svg>')]
pill = re.sub(r'^\s*<svg[^>]*>|</svg>\s*$', '', (d / 'pill.svg').read_text(encoding='utf-8'))
uri = lambda f: 'data:image/png;base64,' + base64.b64encode((d / 'src' / f).read_bytes()).decode()
html = (d / 'template.html').read_text(encoding='utf-8')
html = (html.replace('{{BADGE_DEFS}}', defs).replace('{{BADGE}}', inner).replace('{{PILL}}', pill)
            .replace('{{BASE}}', uri('base.png')).replace('{{CONTENT}}', uri('content.png')).replace('{{SMALL}}', uri('small.png')))
css = (d / 'style.css').read_text(encoding='utf-8'); js = (d / 'script.js').read_text(encoding='utf-8')
(d / 'lib.html').write_text(html, encoding='utf-8'); (d / 'lib.css').write_text(css, encoding='utf-8'); (d / 'lib.js').write_text(js, encoding='utf-8')
(d / 'standalone.html').write_text('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chủ phòng uy tín: màn mở</title><style>' + css + '</style></head><body>' + html + '<script>' + js + '</script></body></html>', encoding='utf-8')
print('ok', (d / 'standalone.html').stat().st_size)
