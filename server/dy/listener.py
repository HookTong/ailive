"""直播间 WebSocket 监听。

协议：wss://<host>/webcast/im/push/v2/
帧：gzip 压缩的 protobuf（PushFrame），解出 LiveResponse 后按 method 分发。
"""

import gzip
import zlib
import threading
import time
import urllib.parse

from websocket import WebSocketApp

from .api import LiveRoomError, fetch_initial_frame, get_live_info
from .auth import UA, x_bogus_signature
from .proto import Live_pb2

DEFAULT_WS_HOST = "webcast100-ws-web-hl.douyin.com"
LIVE_ORIGIN = "https://live.douyin.com"

ROOM_STATUS_LIVE = 2


class LiveListener:
    def __init__(
        self,
        web_rid: str,
        auth,
        on_event=None,
        on_status=None,
        ws_host: str = DEFAULT_WS_HOST,
        max_reconnect: int = 5,
        verbose: bool = True,
    ):
        self.web_rid = web_rid
        self.auth = auth
        self.on_event = on_event or self._default_event
        self.on_status = on_status
        self.ws_host = ws_host
        self.max_reconnect = max_reconnect
        self.verbose = verbose

        self._ws = None
        self._stop = threading.Event()
        self._hb_thread = None
        self._reconnects = 0

    # ---------- 生命周期 ----------

    def run(self):
        try:
            self._connect()
            while not self._stop.is_set():
                time.sleep(0.5)
        except KeyboardInterrupt:
            self._log("收到中断，正在退出")
        finally:
            self.stop()

    def stop(self):
        self._stop.set()
        if self._ws is not None:
            try:
                self._ws.close()
            except Exception:
                pass

    # ---------- 连接 ----------

    def _connect(self):
        info = get_live_info(self.auth, self.web_rid)
        status = info.get("room_status")
        if status is not None and status != ROOM_STATUS_LIVE:
            raise LiveRoomError(
                f"主播当前未开播（room_status={status}，2 为直播中，4 为未开播）"
            )

        room_id = info["room_id"]
        user_unique_id = info["user_unique_id"]
        referer = f"{LIVE_ORIGIN}/{self.web_rid}"
        self._log(
            f"房间 {room_id} | {info.get('room_title') or '无标题'} | "
            f"主播 {info.get('sec_uid') or '未知'}"
        )

        raw = fetch_initial_frame(self.auth, room_id, user_unique_id, referer)
        initial = Live_pb2.LiveResponse()
        initial.ParseFromString(raw)

        params = {
            "app_name": "douyin_web",
            "version_code": "180800",
            "webcast_sdk_version": "1.0.15",
            "update_version_code": "1.0.15",
            "compress": "gzip",
            "device_platform": "web",
            "cookie_enabled": "true",
            "screen_width": "1707",
            "screen_height": "960",
            "browser_language": "zh-CN",
            "browser_platform": "Win32",
            "browser_name": "Chrome",
            "browser_version": "138.0.0.0",
            "browser_online": "true",
            "tz_name": "Asia/Shanghai",
            "cursor": initial.cursor,
            "internal_ext": initial.internalExt,
            "host": LIVE_ORIGIN,
            "aid": "6383",
            "live_id": "1",
            "did_rule": "3",
            "endpoint": "live_pc",
            "support_wrds": "1",
            "user_unique_id": str(user_unique_id),
            "im_path": "/webcast/im/fetch/",
            "identity": "audience",
            "need_persist_msg_count": "15",
            "insert_task_id": "",
            "live_reason": "",
            "room_id": room_id,
            "heartbeatDuration": "0",
            "signature": x_bogus_signature(room_id, user_unique_id),
        }
        url = f"wss://{self.ws_host}/webcast/im/push/v2/?{urllib.parse.urlencode(params)}"

        self._ws = WebSocketApp(
            url=url,
            header={
                "Pragma": "no-cache",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "User-Agent": UA,
                "Upgrade": "websocket",
                "Cache-Control": "no-cache",
                "Connection": "Upgrade",
            },
            cookie=self.auth.cookie_str,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close,
            on_open=self._on_open,
        )
        self._ws.run_forever(origin=LIVE_ORIGIN)

    # ---------- 回调 ----------

    def _on_open(self, ws):
        self._reconnects = 0
        self._log("已连接，开始接收直播间消息")
        self._status("live")
        self._hb_thread = threading.Thread(
            target=self._heartbeat, args=(ws,), daemon=True
        )
        self._hb_thread.start()

    def _heartbeat(self, ws):
        while not self._stop.is_set() and self._ws is ws:
            frame = Live_pb2.PushFrame()
            frame.payloadType = "hb"
            try:
                ws.send(frame.SerializeToString(), opcode=0x02)
            except Exception:
                return
            # 用 wait 代替 sleep，退出时能立即结束
            if self._stop.wait(5):
                return

    def _on_message(self, ws, message):
        try:
            frame = Live_pb2.PushFrame()
            frame.ParseFromString(message)
            if not frame.payload or frame.payloadType == "hb":
                return

            # 注意：payloadEncoding 字段是 'pb'，但 payload 实际是 gzip（魔数 1f 8b）。
            # 上游按字段名判断 'gzip'，所以永远解不开——这里按魔数判断。
            body = frame.payload
            if body[:2] == b"\x1f\x8b":
                body = gzip.decompress(body)
            elif body[:1] == b"\x78":
                body = zlib.decompress(body)

            response = Live_pb2.LiveResponse()
            response.ParseFromString(body)

            if response.needAck and response.internalExt:
                ack = Live_pb2.PushFrame()
                ack.payloadType = "ack"
                ack.payload = response.internalExt.encode("utf-8")
                ack.logId = frame.logId
                try:
                    ws.send(ack.SerializeToString(), opcode=0x02)
                except Exception:
                    pass

            for item in response.messagesList:
                self._dispatch(item)
        except Exception as exc:  # 单帧解析失败不该断开整条连接
            self._log(f"解析消息失败: {exc}", error=True)

    def _dispatch(self, item):
        method = item.method
        handler = _HANDLERS.get(method)
        if handler is None:
            return
        proto_cls, build = handler
        msg = proto_cls()
        msg.ParseFromString(item.payload)
        event = build(msg)
        if event:
            self.on_event(event)

    def _on_error(self, ws, error):
        if self._stop.is_set():
            return
        self._log(f"连接错误: {error}", error=True)
        self._status("error", message=str(error))

    def _on_close(self, ws, code, reason):
        if self._stop.is_set():
            return
        self._log(f"连接关闭 (code={code})", error=True)
        if self.max_reconnect and self._reconnects >= self.max_reconnect:
            self._log("达到最大重连次数，停止")
            self._status("closed", message="达到最大重连次数")
            self.stop()
            return
        self._reconnects += 1
        backoff = min(2 ** self._reconnects, 60)
        self._log(f"{backoff}s 后第 {self._reconnects} 次重连")
        self._status("reconnecting", attempt=self._reconnects, backoff=backoff)
        if self._stop.wait(backoff):
            return
        try:
            # 先确认还在播，避免关播后无限重连
            info = get_live_info(self.auth, self.web_rid)
            if info.get("room_status") not in (None, ROOM_STATUS_LIVE):
                self._log("主播已下播，停止监听")
                self._status("offline", message="主播已下播")
                self.stop()
                return
            self._connect()
        except Exception as exc:
            self._log(f"重连失败: {exc}", error=True)
            self._on_close(None, None, None)

    def _status(self, state, **extra):
        if self.on_status is None:
            return
        try:
            self.on_status({"state": state, **extra})
        except Exception:
            pass

    def _default_event(self, event):
        self._log(_format_event(event))

    def _log(self, text, error=False):
        if self.verbose:
            print(("\033[31m" if error else "\033[0m") + text + "\033[0m", flush=True)


# ---------- 消息 -> 事件 ----------

def _user(u):
    if u is None:
        return {"id": None, "nickname": None, "sec_uid": None}
    return {
        "id": u.id or None,
        "nickname": u.nickname or None,
        "sec_uid": u.sec_uid or None,
        "level": u.level or None,
    }


def _chat(m):
    return {"type": "chat", "user": _user(m.user), "content": m.content}


def _gift(m):
    return {
        "type": "gift",
        "user": _user(m.user),
        "to_user": _user(m.toUser),
        "gift": m.gift.name,
        "gift_id": m.giftId,
        "count": m.comboCount,
    }


def _member(m):
    return {"type": "member", "user": _user(m.user), "member_count": m.memberCount}


def _like(m):
    return {"type": "like", "user": _user(m.user), "count": m.count, "total": m.total}


def _social(m):
    if m.action != 1:
        return None
    return {"type": "follow", "user": _user(m.user), "follow_count": m.followCount}


def _stats(m):
    return {
        "type": "room_stats",
        "display": m.displayLong or m.displayMiddle or m.displayShort,
        "total": m.total,
    }


_HANDLERS = {
    "WebcastChatMessage": (Live_pb2.ChatMessage, _chat),
    "WebcastGiftMessage": (Live_pb2.GiftMessage, _gift),
    "WebcastMemberMessage": (Live_pb2.MemberMessage, _member),
    "WebcastLikeMessage": (Live_pb2.LikeMessage, _like),
    "WebcastSocialMessage": (Live_pb2.SocialMessage, _social),
    "WebcastRoomStatsMessage": (Live_pb2.RoomStatsMessage, _stats),
}

_LABELS = {
    "chat": "弹幕",
    "gift": "礼物",
    "member": "进场",
    "like": "点赞",
    "follow": "关注",
    "room_stats": "房间",
}


def _format_event(e: dict) -> str:
    label = _LABELS.get(e["type"], e["type"])
    user = e.get("user") or {}
    name = user.get("nickname") or user.get("sec_uid") or "?"
    if e["type"] == "chat":
        return f"[{label}] {name}: {e['content']}"
    if e["type"] == "gift":
        to = (e.get("to_user") or {}).get("nickname") or "主播"
        return f"[{label}] {name} 送给 {to} {e['gift']} x {e['count']}"
    if e["type"] == "member":
        return f"[{label}] {name} 进入直播间"
    if e["type"] == "like":
        return f"[{label}] {name} 点赞 x {e['count']}（总计 {e['total']}）"
    if e["type"] == "follow":
        return f"[{label}] {name} 关注了主播"
    if e["type"] == "room_stats":
        return f"[{label}] {e['display']}"
    return f"[{label}] {e}"
