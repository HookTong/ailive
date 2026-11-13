"""认证信息：cookie 解析、msToken 生成、csrf token 获取。"""

import random
import threading

import requests

from .signer import Signer

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
)

# 匿名访客只需要这两个 cookie：ttwid 是设备票据，msToken 是签名令牌。
# 其余一律是登录态（sessionid / sid_guard / uid_tt / bd-ticket-guard-* …）。
_GUEST_COOKIE_KEYS = ("ttwid", "msToken")


def parse_cookie(cookie_str: str) -> dict:
    cookies = {}
    for item in (cookie_str or "").split(";"):
        item = item.strip()
        if not item or "=" not in item:
            continue
        key, _, value = item.partition("=")
        cookies[key.strip()] = value.strip()
    return cookies


def gen_ms_token(length: int = 107) -> str:
    alphabet = "ABCDEFGHIGKLMNOPQRSTUVWXYZabcdefghigklmnopqrstuvwxyz0123456789="
    return "".join(random.choice(alphabet) for _ in range(length))


class Auth:
    def __init__(self, cookie_str: str = ""):
        self.cookie = parse_cookie(cookie_str)
        if not self.cookie.get("msToken"):
            self.cookie["msToken"] = gen_ms_token()
        self._csrf = None
        self._csrf_lock = threading.Lock()

    @property
    def cookie_str(self) -> str:
        return "; ".join(f"{k}={v}" for k, v in self.cookie.items())

    @property
    def guest_cookie(self) -> dict:
        """只保留匿名访客能用的那几个 cookie，**丢掉全部登录态**。

        为什么必须丢：`/webcast/im/fetch/` 只要请求里带 sessionid，就一律返回
        `200 + 空 body`，并在响应头 `x-vc-bdturing-parameters` 里要求滑块验证
        （实测 2026-11）。同一时刻用同一份 ttwid、不带登录态去请求则正常返回
        protobuf。监听只要公开弹幕，不需要账号身份，所以取初始帧一律走匿名。

        WebSocket 那条链路不受影响（带登录态也能收），见 listener.py。
        """
        return {k: v for k, v in self.cookie.items() if k in _GUEST_COOKIE_KEYS and v}

    @property
    def logged_in(self) -> bool:
        return "sessionid" in self.cookie or "sessionid_ss" in self.cookie

    def csrf_token(self):
        """获取 x-secsdk-csrf-token，失败返回 None（不带该头也能连）。"""
        with self._csrf_lock:
            if self._csrf is not None:
                return self._csrf or None
            try:
                resp = requests.head(
                    "https://www.douyin.com/service/2/abtest_config/",
                    headers={
                        "accept": "*/*",
                        "cookie": self.cookie_str,
                        "referer": "https://www.douyin.com/?recommend=1",
                        "user-agent": UA,
                        "x-secsdk-csrf-request": "1",
                        "x-secsdk-csrf-version": "1.2.22",
                    },
                    timeout=10,
                )
                raw = resp.headers.get("X-Ware-Csrf-Token", "")
                parts = raw.split(",")
                self._csrf = parts[1] if len(parts) > 1 else ""
            except Exception:
                self._csrf = ""
            return self._csrf or None


def a_bogus(query: str, data: str = "") -> str:
    return Signer.get().call("ab", query, data)


def x_bogus_signature(room_id: str, user_unique_id: str) -> str:
    import hashlib

    raw = (
        "live_id=1,aid=6383,version_code=180800,webcast_sdk_version=1.0.15,"
        f"room_id={room_id},sub_room_id=,sub_channel_id=,did_rule=3,"
        f"user_unique_id={user_unique_id},device_platform=web,device_type=,"
        "ac=,identity=audience"
    )
    stub = hashlib.md5(raw.encode("utf-8")).hexdigest()
    return Signer.get().call("xbogus", stub)
