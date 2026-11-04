# server — 抖音直播间监听（dy-live）

从 [cvv-cat/Douyin_Spider](https://github.com/cvv-cat/Douyin_Spider) 抽出的**直播间监听**部分，独立可跑。

只做一件事：连上某个抖音直播间的 WebSocket，把弹幕、礼物、进场、点赞、关注、房间热度实时吐出来。

## 与上游的区别

上游是「爬虫 + 直播 + 私信」三合一的仓库，`dy_apis/douyin_api.py` 有两千行、四十多个接口，还依赖 `PyExecJS` 每次调用 fork 一个 Node。这里只保留监听链路，并修掉了几个会导致跑不起来的问题：

| 问题 | 上游 | 这里 |
| --- | --- | --- |
| 签名调用 | PyExecJS，每次 call 都 fork Node（~80ms） | 常驻 Node 进程，行分隔 JSON 通信，签名脚本只加载一次 |
| 签名脚本报错 | `console.log` 打在执行路径上，污染 PyExecJS 的 JSON 解析 | Node 侧 stub 掉 console，走独立协议 |
| 未开播 / 解析失败 | `get_live_info` 返回 `(None, None, None)`，调用方 `room_info['room_id']` 直接崩 | 抛 `LiveRoomError`，带明确原因 |
| 关播后 | `on_close` 无条件 `self.start_ws()`，无限重连 | 指数退避 + 重连前先查开播状态 + 最大次数 |
| 心跳线程 | `while True` + `sleep(5)`，连接关闭后线程泄漏 | `threading.Event.wait()`，可中断 |
| 指纹 | UA 是 Firefox 117，`sec-ch-ua` 是 Edge 125，自相矛盾 | 统一 Chrome 138 |
| TLS | 全局 `verify=False` | 正常校验 |
| 输出 | 直接 print 到 stdout，不可编程 | `on_event` 回调，支持 `--json` 输出 |
| `/webcast/im/fetch/` 签名 | 带 `a_bogus`，实际返回 200 + 空 body | 先不带（实测可用），失败再带一次兜底 |
| 解帧压缩 | 按 `payloadEncoding == 'gzip'` 判断，但该字段值是 `'pb'`，永远解不开 | 按 gzip 魔数 `1f 8b` 判断 |

## 目录

```
server/
├── dytest.py               # CLI 入口
├── dy/
│   ├── auth.py             # cookie / msToken / csrf / 签名封装
│   ├── api.py              # 取房间标识、拉初始 IM 帧
│   ├── listener.py         # WebSocket 监听、解帧、事件分发
│   ├── signer.py           # 常驻 Node 签名进程的客户端
│   ├── main.py             # SSE 桥接服务（python -m dy.main）
│   ├── signer.js           # 签名服务（行分隔 JSON）
│   ├── dy_ab.js            # a_bogus / req_sign / ree_key
│   ├── dy_live_sign.js     # 直播间 X-Bogus
│   └── proto/              # Live / Request / Response 的 .proto 与 pb2
├── requirements.txt
└── package.json
```

## 安装

需要 Python 3.9+ 和 Node 18+（Node 只用来算签名）。

```bash
cd server
python -m pip install -r requirements.txt
npm install
```

## 使用

```bash
# 只看房间信息，不连 WebSocket
python dytest.py 571821134948 --info

# 监听（房间号或完整链接都行）
python dytest.py https://live.douyin.com/571821134948

# 输出 JSON 行，方便管道处理
python dytest.py 571821134948 --json
```

配置 cookie（**强烈建议**，未登录态很容易被风控）：

```bash
cp .env.example .env
# 打开 live.douyin.com 登录，F12 → Network → 任一请求 → 复制完整 cookie 到 DY_LIVE_COOKIES
```

作为库调用：

```python
from dy.auth import Auth
from dy.listener import LiveListener

def on_event(e):
    if e["type"] == "chat":
        print(e["user"]["nickname"], "说:", e["content"])
    elif e["type"] == "gift":
        print(e["user"]["nickname"], "送出", e["gift"], "x", e["count"])

LiveListener("571821134948", Auth(cookie_str), on_event=on_event).run()
```

事件类型：`chat` / `gift` / `member` / `like` / `follow` / `room_stats`。

## 实测踩到的两个坑

抽离过程中这两个问题会让监听**完全收不到消息**，而且都不报错，只表现为「连上了但没数据」：

1. **`/webcast/im/fetch/` 不能带 `a_bogus`**。带上会返回 `200` + 空 body + `content-type: application/json`，属于静默拒绝；不带则正常返回几百 KB 的 protobuf 初始帧。上游那份 `a_bogus` 算法对这个接口已经失效。
2. **`PushFrame.payloadEncoding` 的值是 `'pb'`，但 payload 其实是 gzip 压缩的**（首字节 `1f 8b`）。按字段名判断 `== 'gzip'` 永远不成立，于是把压缩数据直接丢给 protobuf 解析，报 `Wire format was corrupt`。现在按魔数判断。

## 接入前端（桥接服务）

浏览器**不能**直连抖音：监听需要登录态 cookie，放进前端等于公开 sessionid；浏览器 WebSocket 也无法自定义 Cookie 头、绕不过 Origin 校验。所以中间必须有一层本地服务。

```
浏览器 (React)
   │  SSE  /api/rooms/{rid}/stream
   ▼
dy.main  ← cookie 只存在这里
   │  WebSocket + 签名
   ▼
抖音直播间
```

启动：

```bash
cd server
python -m dy.main --port 8787
```

### 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 服务状态 + 已订阅房间列表 |
| GET | `/api/rooms/{web_rid}` | 房间信息（同 `--info`） |
| GET | `/api/rooms/{web_rid}/stream` | SSE 事件流 |

SSE 消息体三种：

```jsonc
{"type":"status","state":"live","room":{...}}          // connecting/live/reconnecting/offline/closed/error
{"type":"room","room":{"room_id":"...","room_title":"...","room_status":2}}
{"type":"event","event":{"type":"chat","user":{"nickname":"..."},"content":"..."}}
```

`event.event.type` 取值：`chat` / `gift` / `member` / `like` / `follow` / `room_stats`。

设计要点：

- **一个房间一个监听器**，多个前端连接共享同一份事件流，不会因为开三个标签页就被抖音踢。
- 最后一个连接断开后 30 秒才停止监听，避免刷新页面触发重连风暴。
- 每 15 秒发一次 `: ping` 注释行保活，防止中间代理掐断空闲连接。
- 慢消费者会丢弃最旧的事件，不会阻塞监听线程。

### 前端侧（本仓库）

`src/hooks/useLiveServer/api.ts`（协议 + EventSource 封装）、`src/hooks/useLiveServer/index.ts`（订阅 hook，400ms 批量提交避免高频 setState）、`src/components/LiveChat/index.tsx`（弹幕面板）。`vite.config.ts` 里把 `/api` 代理到 `127.0.0.1:8787`。

## 已知限制

- **依赖抖音前端结构**。`api.py` 用正则从直播间页面的内联 JSON 里抠 `roomId`，改版就失效，会抛「页面结构解析失败」。
- **签名会过期**。`dy/` 下的两个混淆 JS 是从线上 bundle 反混淆出来的，抖音换算法就得换文件，Python 层不用动。
- **`requests` 的 TLS 指纹可被识别**。实测 `live.douyin.com/webcast/feed/` 这类接口会直接返回 444，直播间 HTML 页面则不拦。如果后续要调更多接口，建议换 `curl_cffi` 伪装浏览器指纹。
- **未开播的房间**：`/webcast/im/fetch/` 返回 200 + 空 body，不是错误码，所以启动前必须先查 `room_status`（2 为直播中，4 为未开播）。
- **礼物事件的 `to_user` 常为空**。服务端只在部分礼物消息里下发 `toUser`，其余情况需要按「送礼即送主播」处理。
- 单进程只能稳定盯几个房间。要上规模得把签名进程和连接池拆开，加账号池和限速。

## 合规

这是通过逆向签名绕过平台风控读取直播间数据，**违反《抖音用户服务协议》**，采集的昵称 / sec_uid 属于个人信息，受《个人信息保护法》约束。仅限个人学习与技术研究，不要用于商业产品或批量采集。账号风险自负。
