"""签名服务客户端：维护一个常驻 Node 进程，通过行分隔 JSON 调用签名函数。

相比 PyExecJS 的优势：
- 不每次调用都 fork 进程（Node 启动约 80ms，弹幕场景下这是致命的）
- 签名脚本只加载一次，JS 引擎里的状态可复用
- 进程崩了自动重启
"""

import json
import os
import shutil
import subprocess
import threading

PKG_DIR = os.path.dirname(os.path.abspath(__file__))
SIGNER_JS = os.path.join(PKG_DIR, "signer.js")


class SignError(RuntimeError):
    pass


class Signer:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self._proc = None
        self._io_lock = threading.Lock()
        self._start()

    @classmethod
    def get(cls) -> "Signer":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _start(self):
        node = shutil.which("node")
        if not node:
            raise SignError("找不到 node，可执行文件必须在 PATH 中（需要 Node 18+）")
        if not os.path.exists(SIGNER_JS):
            raise SignError(f"签名脚本不存在: {SIGNER_JS}")
        self._proc = subprocess.Popen(
            [node, SIGNER_JS],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            cwd=PKG_DIR,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )
        hello = self._proc.stdout.readline()
        if not hello:
            raise SignError("签名进程启动失败")
        resp = json.loads(hello)
        if not resp.get("ok"):
            raise SignError(f"签名进程启动失败: {resp.get('error')}")

    def call(self, fn, *args):
        with self._io_lock:
            if self._proc is None or self._proc.poll() is not None:
                self._start()
            payload = json.dumps({"fn": fn, "args": list(args)}, ensure_ascii=False)
            try:
                self._proc.stdin.write(payload + "\n")
                self._proc.stdin.flush()
                line = self._proc.stdout.readline()
            except (BrokenPipeError, OSError) as exc:
                self._proc = None
                raise SignError(f"签名进程通信失败: {exc}") from exc
            if not line:
                self._proc = None
                raise SignError("签名进程意外退出")
            resp = json.loads(line)
            if not resp.get("ok"):
                raise SignError(f"{fn} 失败: {resp.get('error')}")
            return resp.get("data")

    def close(self):
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.stdin.close()
                self._proc.terminate()
            except Exception:
                pass
        self._proc = None
