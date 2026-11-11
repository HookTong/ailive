# ailive 构建与验证手册

`MEMORY.md` 里只留指针，做法细节全在这（改代码后要跑验证时先读这一页）。

## 构建

- `tsc -b` 必须 `--force`（增量缓存会漏报）；`vite build` 前先 `mv dist /tmp/...`，否则 dist 里旧产物混着。
- 沙箱里 `cdn.jsdelivr.net` 被 SSL 拦，`raw.githubusercontent.com` 通。

## Playwright

- 脚本在 `%TEMP%\pwcheck`，`channel: 'chrome'`，args `--use-gl=angle --use-angle=swiftshader`，访问 `localhost:5173`；重负载页 ~17fps。
- CSS 模块类名哈希化：**只用 `aria-label` / `role` / `data-*` 定位**。`Segmented` = `radiogroup` + `radio`（`aria-checked`）；`Modal` = `section[role=dialog]`；`Switch` = 原生 checkbox `role=switch`（用 `isChecked()`，**没有 `aria-checked`**）。
- 挂载 ~2.8s（Live2D 模型更晚，~2.8s 后才 ready）。
- mock 直播流：`addInitScript` 替换 `EventSource`，按 `delay` 定时 `onmessage`。
- **假的 `EventSource.close()` 必须把定时器清掉**（`this.closed = true; timers.forEach(clearTimeout)`）。StrictMode 会建两个实例，第一个实例的 cleanup 调 `close()`；如果 `close(){}` 是空的，两条时间线都会跑完 —— 每条弹幕被派发两次，第二次撞上 `route:` 3 秒冷却会掉进自动回复，看起来像「命中路由还回了一句」的 bug。
- **断言状态变化用 `waitForFunction` 轮询 localStorage / DOM，别按绝对时间采样** —— goto + 挂载有几百毫秒漂移，按固定时刻采样会错位一格。
- 读「当前选中项」用 `[role="radio"][aria-checked="true"]`；读落盘值时注意**默认值按约定不写盘**（如 `backgroundMode` 默认 `fixed`、`music.loopMode` 默认 `single`），断言要写成 `(值 ?? 默认)`。

## 让模型「说话」而不接真服务

- 种 `ailive.volcengine-tts-config`（假 apiKey）+ 替换 `window.fetch` 拦 `/volcengine-tts`，记 `JSON.parse(init.body).req_params.text`，回 `{code:20000000,data:''}`。
- 播报走回复队列 `MIN_REPLY_INTERVAL_MS = 6000`，**断言前要等队列排空**（N 条播报 ≈ 6N 秒）。
- 拦模型请求用 `page.route('**/volcengine-ark/**')`，把 `route.request().postData()` 存下来即可断言「这条弹幕有没有进模型」。

## 验 Live2D 动作

- 从 `performance.getEntriesByType('resource')` 拿 `pixi-live2d-display?v=` 的完整 URL，在页面里 `import()`，改 `Live2DModel.prototype.motion` 记参数。
- 滚动条要 `headless: false` 才画得出来。

## Node 侧探针（解析器 / 动作表）

- 用项目自带的 `node_modules/.bin/esbuild` 打包成 ESM 再 import，别用 `npx esbuild`（沙箱拉不到）：
  `node_modules/.bin/esbuild src/data/actions.ts --bundle --format=esm --platform=node --outfile=<tmp>/actions-bundle.mjs`
- entry point 必须写 Windows 盘符形式 `E:/GitHub/ailive/src/data/actions`（`/e/...` 解析不了）。

## 主题

- 浅色主题要**另开一个 page** 单独 `addInitScript` 写 `ailive.theme='light'`：`addInitScript` 每次导航都重跑，`location.reload()` 会把刚写进 localStorage 的值冲掉。
