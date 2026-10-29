"""Build the GitHub Pages copy of the library.

index.html is written without <!doctype>/<html>/<body> so it can also be
published as a Claude artifact (which adds that skeleton itself). For the
standalone site we add the skeleton here and write docs/index.html.

Run from the repo root:  python3 tools/build.py
"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = (root / "index.html").read_text(encoding="utf-8")
head_end = src.index("</style>") + len("</style>")

page = (
    "<!doctype html>\n<html lang=\"vi\">\n<head>\n"
    + src[:head_end]
    + "\n</head>\n<body>\n"
    + src[head_end:].lstrip("\n")
    + "\n</body>\n</html>\n"
)

out = root / "docs"
out.mkdir(exist_ok=True)
(out / "index.html").write_text(page, encoding="utf-8")
(out / ".nojekyll").write_text("", encoding="utf-8")
print(f"wrote {out / 'index.html'} ({len(page):,} bytes)")
