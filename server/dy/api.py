"""只保留直播间监听必需的接口：取房间标识、拉取初始 IM 帧。"""

import json
import re
import urllib.parse

import requests

from .auth import UA, a_bogus

LIVE_URL = "https://live.douyin.com"
WEB_URL = "https://www.douyin.com"

_session = requests.Session()
_session.verify = True  # 不再全局关闭 TLS 校验


class LiveRoomError(RuntimeError):
    pass


def normalize_web_rid(value: str) -> str:
    """接受纯数字房间号或 live.douyin.com 链接。"""
    value = (value or "").strip()
    if not value:
        raise LiveRoomError("房间号为空")
    if value.startswith("http"):
        m = re.search(r"live\.douyin\.com/(\d+)", value)
        if not m:
            raise LiveRoomError(f"无法从链接中解析房间号: {value}")
        return m.group(1)
    if not value.isdigit():
        raise LiveRoomError(f"房间号应为纯数字: {value}")
    return value


def _pick(text: str, *patterns):
    for p in patterns:
        m = re.search(p, text)
        if m:
            return m.group(1)
    return None


def get_live_info(auth, web_rid: str) -> dict:
    """打开直播间页面，从内联 JSON 里取出 room_id / user_unique_id / 开播状态。

    注意：这里依赖页面内联脚本结构，抖音改版会失效——所以失败时给出明确报错，
    而不是像原项目那样返回 (None, None, None) 让调用方在下一步崩掉。
    """
    web_rid = normalize_web_rid(web_rid)
    resp = _session.get(
        f"{LIVE_URL}/{web_rid}",
        headers={
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,"
                      "image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "zh-CN,zh;q=0.9",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "referer": "https://live.douyin.com/?from_nav=1",
            "user-agent": UA,
        },
        cookies=auth.cookie,
        timeout=15,
    )
    if resp.status_code != 200:
        raise LiveRoomError(f"直播间页面返回 {resp.status_code}，房间可能不存在或已下架")

    html = resp.text
    ttwid = resp.cookies.get("ttwid") or auth.cookie.get("ttwid")
    if ttwid:
        # 页面下发的是最新设备票据，后面的取帧请求跟着用这一份
        auth.cookie["ttwid"] = ttwid

    room_id = _pick(html, r'\\"roomId\\":\\"(\d+)\\"', r'"roomId":"(\d+)"')
    user_unique_id = _pick(
        html, r'\\"user_unique_id\\":\\"(\d+)\\"', r'"user_unique_id":"(\d+)"'
    )
    if not room_id or not user_unique_id:
        if "验证" in html or "captcha" in html.lower():
            raise LiveRoomError("被风控拦截（出现验证码），请更换 IP 或稍后重试")
        raise LiveRoomError("页面结构解析失败：没找到 roomId / user_unique_id，抖音可能已改版")

    status = _pick(
        html,
        r'\\"roomInfo\\":\{\\"room\\":\{\\"id_str\\":\\".*?\\",\\"status\\":(\d+)',
        r'"status":(\d+),"status_str"',
    )
    title = _pick(
        html,
        r'\\"roomInfo\\":\{\\"room\\":\{\\"id_str\\":\\".*?\\",\\"status\\":\d+,'
        r'\\"status_str\\":\\".*?\\",\\"title\\":\\"(.*?)\\"',
        r'"title":"(.*?)","cover"',
    )

    return {
        "web_rid": web_rid,
        "room_id": room_id,
        "user_unique_id": user_unique_id,
        "anchor_id": _pick(html, r'\\"anchor\\":\{\\"id_str\\":\\"(\d+)\\"'),
        "sec_uid": _pick(html, r'\\"sec_uid\\":\\"(.*?)\\"'),
        "room_status": int(status) if status else None,
        "room_title": title,
        "ttwid": ttwid,
    }


def _needs_verify(resp) -> bool:
    """抖音风控：200 + 空 body，响应头里点名要滑块验证。

    `x-vc-bdturing-parameters` 形如 `{"code":"10000","type":"verify",
    "subtype":"slide",...}`。看到这个就不是「房间没开播」，是请求本身被拦了。
    """
    raw = resp.headers.get("x-vc-bdturing-parameters")
    if not raw:
        return False
    try:
        return json.loads(raw).get("type") == "verify"
    except (ValueError, AttributeError):
        return False


def fetch_initial_frame(auth, room_id: str, user_unique_id: str, referer: str) -> bytes:
    """GET /webcast/im/fetch/ 拿到 cursor 和 internal_ext（protobuf 响应）。

    两个维度各试一遍，共 4 次：
      · 身份：**先匿名，后登录**。带 sessionid 会被风控要求滑块验证（见 auth.guest_cookie），
        匿名则正常返回；登录态留作兜底，万一平台以后改了规则也不用手改代码。
      · 签名：先不带 a_bogus，再带一次。实测（2026-11）这个接口**不能**带 a_bogus，
        带上会 200 + 空 body + content-type: application/json，属于静默拒绝。
    """
    params = {
        "resp_content_type": "protobuf",
        "did_rule": "3",
        "device_id": "",
        "app_name": "douyin_web",
        "endpoint": "live_pc",
        "support_wrds": "1",
        "user_unique_id": str(user_unique_id),
        "identity": "audience",
        "need_persist_msg_count": "15",
        "insert_task_id": "",
        "live_reason": "",
        "room_id": str(room_id),
        "version_code": "180800",
        "last_rtt": "0",
        "live_id": "1",
        "aid": "6383",
        "fetch_rule": "1",
        "cursor": "",
        "internal_ext": "",
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
        "msToken": auth.cookie.get("msToken", ""),
    }

    headers = {
        "accept": "application/x-protobuf",
        "accept-language": "zh-CN,zh;q=0.9",
        "content-type": "application/x-protobuf",
        "origin": LIVE_URL,
        "referer": referer,
        "user-agent": UA,
    }
    csrf = auth.csrf_token()
    if csrf:
        headers["x-secsdk-csrf-token"] = csrf

    last_error = None
    blocked = False
    for label, cookies in (("匿名", auth.guest_cookie), ("登录", auth.cookie)):
        for signed in (False, True):
            query = dict(params)
            if signed:
                query["a_bogus"] = a_bogus(urllib.parse.urlencode(params), "")
            try:
                resp = _session.get(
                    f"{LIVE_URL}/webcast/im/fetch/",
                    headers=headers,
                    params=query,
                    cookies=cookies,
                    timeout=15,
                )
            except requests.RequestException as exc:
                last_error = f"网络错误: {exc}"
                continue

            if resp.status_code != 200:
                last_error = f"{label}请求 HTTP {resp.status_code}"
                continue
            if resp.content:
                return resp.content
            # 200 + 空 body：要么被风控点名验证，要么房间没开播
            if _needs_verify(resp):
                blocked = True
                last_error = f"{label}请求被风控要求滑块验证"
            else:
                last_error = f"{label}请求返回空响应"

    if blocked:
        raise LiveRoomError(
            "被抖音风控拦截：/webcast/im/fetch/ 返回 200 但 body 为空，"
            "响应头要求滑块验证（x-vc-bdturing-parameters: type=verify）。"
            "不是房间没开播 —— 换个网络重试，或在浏览器里打开该直播间过一次验证。"
        )
    raise LiveRoomError(
        f"拉取初始帧失败（{last_error}）。常见原因：房间未开播、cookie 失效、或被风控。"
    )
