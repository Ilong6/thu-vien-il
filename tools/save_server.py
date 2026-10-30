"""Tiny local server for exports: serves the repo folder and saves POSTed files.

    python3 tools/save_server.py 5179
    POST /save?name=navi-ket-ban.webp   (body = file bytes) -> exports/navi-ket-ban.webp

Binds to 127.0.0.1 only.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "exports"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_POST(self):
        url = urlparse(self.path)
        name = Path(parse_qs(url.query).get("name", ["export.bin"])[0]).name  # no path tricks
        if url.path != "/save" or not name:
            self.send_error(404)
            return
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        OUT.mkdir(exist_ok=True)
        (OUT / name).write_bytes(data)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(f"saved {name} {len(data)} bytes".encode())
        print(f"saved {OUT / name} ({len(data)} bytes)", flush=True)


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5179
ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
