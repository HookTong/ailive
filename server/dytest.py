"""抖音直播间监听入口。

用法:
    python dytest.py 571821134948
    python dytest.py https://live.douyin.com/571821134948 --json
    python dytest.py 571821134948 --info   # 只看房间信息，不连 WebSocket
"""

import argparse
import json
import os
import sys

from dotenv import load_dotenv

from dy.api import LiveRoomError, get_live_info
from dy.auth import Auth
from dy.listener import DEFAULT_WS_HOST, LiveListener


def build_parser():
    p = argparse.ArgumentParser(description="抖音直播间实时监听")
    p.add_argument("room", help="房间号或 live.douyin.com 链接")
    p.add_argument("--cookie", default=None, help="登录后的 cookie，默认读 .env 的 DY_LIVE_COOKIES")
    p.add_argument("--json", action="store_true", help="以 JSON 行输出事件")
    p.add_argument("--info", action="store_true", help="只打印房间信息后退出")
    p.add_argument("--host", default=os.getenv("DY_WS_HOST", DEFAULT_WS_HOST), help="WebSocket 接入点")
    p.add_argument("--max-reconnect", type=int, default=5, help="最大重连次数，0 表示不限")
    return p


def main():
    load_dotenv()
    args = build_parser().parse_args()

    cookie = args.cookie or os.getenv("DY_LIVE_COOKIES", "")
    if not cookie.strip():
        print("提示: 未提供 cookie，可能被风控拦截。在 .env 里配置 DY_LIVE_COOKIES 更稳。", file=sys.stderr)

    auth = Auth(cookie)
    if not auth.logged_in:
        print("提示: cookie 中未发现 sessionid，属于未登录态，成功率较低。", file=sys.stderr)

    if args.info:
        try:
            info = get_live_info(auth, args.room)
        except LiveRoomError as exc:
            print(f"获取失败: {exc}", file=sys.stderr)
            return 1
        print(json.dumps(info, ensure_ascii=False, indent=2))
        return 0

    on_event = (
        (lambda e: print(json.dumps(e, ensure_ascii=False), flush=True))
        if args.json
        else None
    )
    listener = LiveListener(
        args.room,
        auth,
        on_event=on_event,
        ws_host=args.host,
        max_reconnect=args.max_reconnect,
    )
    try:
        listener.run()
    except LiveRoomError as exc:
        print(f"启动失败: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
