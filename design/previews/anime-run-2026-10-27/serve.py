"""Serve only this preview and the installed Three.js package, on loopback."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent
THREE = ROOT.parents[2] / 'node_modules' / 'three'

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = unquote(urlsplit(path).path)
        base, relative = (THREE, path[7:]) if path.startswith('/three/') else (ROOT, path.lstrip('/'))
        candidate = (base / relative).resolve()
        if not candidate.is_relative_to(base.resolve()):
            return str(ROOT / '__not_found__')
        return str(candidate)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    print('http://127.0.0.1:8767/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8767), Handler).serve_forever()
