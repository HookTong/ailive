"""直播间事件桥接服务。

把 dy 的监听结果用 SSE 推给前端，浏览器永远拿不到 cookie。

    python -m dy.main --port 8787

接口：
    GET /api/health                    服务与房间状态
    GET /api/rooms/{web_rid}           房间信息（JSON）
    GET /api/rooms/{web_rid}/stream    SSE 事件流
"""

import argparse
import json
import os
import queue
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

from .api import LiveRoomError, get_live_info
from .auth import Auth
from .listener import LiveListener

IDLE_STOP_SECONDS = 30  # 最后一个订阅者离开后，多久停止监听
HEARTBEAT_SECONDS = 15


class RoomHub:
    """一个直播间对应一个监听器，多个前端连接共享同一份事件流。"""

    def __init__(self, web_rid: str, auth: Auth):
        self.web_rid = web_rid
        self.auth = auth
        self.subscribers: set[queue.Queue] = set()
        self.lock = threading.Lock()
        self.listener: LiveListener | None = None
        self.thread: threading.Thread | None = None
        self.room: dict | None = None
        self.status = {"state": "idle"}
        self._idle_timer: threading.Timer | None = None

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=5000)
        with self.lock:
            self.subscribers.add(q)
            if self._idle_timer is not None:
                self._idle_timer.cancel()
                self._idle_timer = None
            already_running = self.thread is not None and self.thread.is_alive()
            if not already_running:
                self.thread = threading.Thread(target=self._run, daemon=True)
                self.thread.start()
        if already_running:
            # 新连接立刻拿到当前状态；首个连接由 _run 自己广播
            q.put({"type": "status", **self.status, "room": self.room})
        return q

    def unsubscribe(self, q: queue.Queue):
        with self.lock:
            self.subscribers.discard(q)
            if self.subscribers or self._idle_timer is not None:
                return
            self._idle_timer = threading.Timer(IDLE_STOP_SECONDS, self._shutdown)
            self._idle_timer.daemon = True
            self._idle_timer.start()

    def _shutdown(self):
        with self.lock:
            self._idle_timer = None
            if self.subscribers:
                return
        if self.listener is not None:
            self.listener.stop()
        self.thread = None
        self.status = {"state": "idle"}

    def _emit(self, payload: dict):
        with self.lock:
            targets = list(self.subscribers)
        for q in targets:
            try:
                q.put_nowait(payload)
            except queue.Full:
                try:
                    q.get_nowait()  # 丢掉最旧的，保证不阻塞监听线程
                    q.put_nowait(payload)
                except queue.Empty:
                    pass

    def _on_status(self, payload: dict):
        self.status = payload
        self._emit({"type": "status", **payload, "room": self.room})

    def _run(self):
        self._on_status({"state": "connecting"})
        try:
            self.room = get_live_info(self.auth, self.web_rid)
            self._emit({"type": "room", "room": self.room})
            self.listener = LiveListener(
                self.web_rid,
                self.auth,
                on_event=lambda e: self._emit({"type": "event", "event": e}),
                on_status=self._on_status,
                verbose=False,
            )
            self.listener.run()
        except LiveRoomError as exc:
            self._on_status({"state": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self._on_status({"state": "error", "message": f"{type(exc).__name__}: {exc}"})
        finally:
            self.listener = None
            if self.status.get("state") not in ("error", "offline"):
                self._on_status({"state": "closed"})


class HubRegistry:
    def __init__(self, auth: Auth):
        self.auth = auth
        self.hubs: dict[str, RoomHub] = {}
        self.lock = threading.Lock()

    def get(self, web_rid: str) -> RoomHub:
        with self.lock:
            hub = self.hubs.get(web_rid)
            if hub is None:
                hub = RoomHub(web_rid, self.auth)
                self.hubs[web_rid] = hub
            return hub

    def summary(self) -> list[dict]:
        with self.lock:
            return [
                {"web_rid": rid, "status": hub.status.get("state"), "subscribers": len(hub.subscribers)}
                for rid, hub in self.hubs.items()
            ]


REGISTRY: HubRegistry | None = None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"
    server_version = "dy-live-bridge/1.0"

    def log_message(self, fmt, *args):
        if os.getenv("DY_BRIDGE_VERBOSE"):
            print(f"[bridge] {self.address_string()} {fmt % args}")

    # ---------- 工具 ----------

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")

    def _json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _route(self):
        path = urlparse(self.path).path
        parts = [unquote(p) for p in path.strip("/").split("/") if p]
        return parts

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parts = self._route()
        try:
            if parts == ["api", "health"]:
                return self._json({"ok": True, "rooms": REGISTRY.summary()})
            if len(parts) >= 3 and parts[0] == "api" and parts[1] == "rooms":
                web_rid = parts[2]
                if len(parts) == 3:
                    return self._json(get_live_info(REGISTRY.auth, web_rid))
                if len(parts) == 4 and parts[3] == "stream":
                    return self._stream(web_rid)
            self._json({"error": "not found"}, 404)
        except LiveRoomError as exc:
            self._json({"error": str(exc)}, 400)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:  # noqa: BLE001
            self._json({"error": f"{type(exc).__name__}: {exc}"}, 500)

    # ---------- SSE ----------

    def _stream(self, web_rid: str):
        hub = REGISTRY.get(web_rid)
        q = hub.subscribe()

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self._cors()
        self.end_headers()

        def write(text: str) -> bool:
            try:
                self.wfile.write(text.encode("utf-8"))
                self.wfile.flush()
                return True
            except (BrokenPipeError, ConnectionResetError, OSError):
                return False

        if not write("retry: 3000\n\n"):
            hub.unsubscribe(q)
            return

        try:
            while True:
                try:
                    payload = q.get(timeout=HEARTBEAT_SECONDS)
                except queue.Empty:
                    if not write(": ping\n\n"):
                        break
                    continue
                line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                if not write(f"data: {line}\n\n"):
                    break
        finally:
            hub.unsubscribe(q)


def main():
    parser = argparse.ArgumentParser(description="抖音直播间事件桥接服务")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--cookie", default=None, help="默认读 .env 的 DY_LIVE_COOKIES")
    args = parser.parse_args()

    load_dotenv()
    cookie = args.cookie or os.getenv("DY_LIVE_COOKIES", "")
    if not cookie.strip():
        print("警告: 没有 cookie，大概率会被风控。请在 .env 配置 DY_LIVE_COOKIES。")

    global REGISTRY
    REGISTRY = HubRegistry(Auth(cookie))

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    print(f"桥接服务已启动: http://{args.host}:{args.port}")
    print(f"  SSE 示例: curl -N http://{args.host}:{args.port}/api/rooms/<房间号>/stream")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在关闭...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
