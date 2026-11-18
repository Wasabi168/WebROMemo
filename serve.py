"""Local static server that keeps the port to itself on Windows."""
import socket
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class ExclusiveHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        # Python's built-in HTTPServer sets SO_REUSEADDR. On Windows that lets
        # a second server bind the same port, and the browser can land on a
        # stuck process that accepts the connection but sends nothing.
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        self.socket.bind(self.server_address)
        self.server_address = self.socket.getsockname()


def main():
    if len(sys.argv) != 2:
        print("usage: python serve.py PORT", file=sys.stderr)
        sys.exit(2)
    port = int(sys.argv[1])
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        server = ExclusiveHTTPServer(("127.0.0.1", port), handler)
    except OSError as exc:
        print(f"無法綁定 127.0.0.1:{port}（{exc}）", file=sys.stderr)
        sys.exit(1)
    host, bound_port = server.server_address[:2]
    print(
        f"Serving HTTP on {host} port {bound_port} (http://{host}:{bound_port}/) ...",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
