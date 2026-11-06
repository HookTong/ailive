# ailive 项目长期约定

React 18 + TypeScript + Vite + PIXI.js + pixi-live2d-display + Sass 的 Live2D AI 直播工作室。
组件在 `src/components/<Name>/`（`index.tsx` + `index.module.scss`），状态走 `src/contexts/`，hook 在 `src/hooks/`。

## 样式

- **字体栈必须显式带中文字体**。`Manrope` / `DM Mono` 都没有中文字形，只写 `monospace` 的话汉字会逐字回退到系统默认字体（Windows 上从 Consolas 再掉一层），笔画粗细和拉丁部分对不上，小字号时特别糊。现在 `$font-ui` / `$font-mono` 都把 `PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei` 排在通用族前面。顺带的好处：Google Fonts 加载失败时也有正经的中文观感。
- **字号刻度在 `tokens.scss`**：`$fs-micro` 10 / `$fs-label` 11 / `$fs-body` 12 / `$fs-title` 13，`@include mono()` 的默认值取 `$fs-label`。界面里大量标签是 mono 小字，**别写 7px / 8px**，普通屏上根本看不清。

- **要特定高度的按钮不要传 `Button` 的 `size`**。传了会写死 30/32/34/36px；模块类与 `Button` 的 `.sm` 是同级选择器，谁生效取决于打包后的样式表顺序。正确做法：不传 `size`，在模块里自己写 `height` / `padding`。
- **要压过 `Button` 的 variant 类，用两级选择器**（如 `.giftList .motionButtonOn`），单类对单类不可靠，原因同上。
- **`fr` 分配的是扣掉 `gap` 之后的剩余空间**，所以 `3fr : 2fr` 在任意容器宽度下都严格等于 6:4，不需要 `calc()`。
- **`display: grid` 的 `align-content` 默认是 `normal`，对 grid 容器表现为 `stretch`** —— 行数少时多余高度被平摊给每一行，卡片会被拉高。列表类容器（尤其带 `flex: 1 1 0` 的）要显式写 `align-content: start`，`li` 自己是 grid 的也要写。
- 删掉标题上方的 `eyebrow` 小字时，要同步改 `.header` 的 `align-items`（`flex-start` → `center`）和 `.title` 的 `margin-top`（`8px` → `0`），那 8px 是给 eyebrow 让位的。
- 图标路径用 `import.meta.env.BASE_URL` 拼，兼容非根路径部署。
- **别用 `box-shadow` 画小图标/点阵**：阴影不占布局盒子，父级有 `overflow: hidden`（例如带 `@include ellipsis` 的标题）时会被裁掉一半。改用 `background-image: radial-gradient(...)` + `background-size` 铺在有实际宽高的元素上。
- `Input` 的步进器（数字框上下箭头）只在聚焦时出现，靠 `.wrap:focus-within` 切 `opacity` / `pointer-events`；右内边距也跟着在聚焦时让出来（带 0.12s 过渡），平时不白占位。
- **外壳高度不能指望 `display: flex`**：调用方一条 `.field > span { display: block }` 就能压回去。要让外壳高度严格等于输入框，给 `input` 自己写 `display: block`，别加 `!important`。
- `Input` 的 `addon` 是输入框右侧的独立方块（单位文字之类），和输入框同高、留 6px 缝。

## 组件层级

- **`Modal` 要放在 `Drawer` 外层**：抽屉内容区是 `overflow: auto`，嵌在里面的弹窗会被裁掉。层级用 `Modal zIndex={40}` > `Drawer 31` > 常规卡片。
- **`DropdownSelect` 的菜单是绝对定位、没有 portal**，所以含下拉的区域不能加 `overflow: auto`，否则菜单被祖先裁掉。宁让弹窗自然变高。
- 气泡的 `z-index: 5` 在 `.live2d`（z-index 3）的层叠上下文里，永远压在 LiveOverview 卡片（z-index 8）下面。
- **`Card` 的 `headerProps` 里别用叫 `.head` 的类**：`Card` 内部已经有一个 `.head`（`margin-bottom: 12px`），两边都是单类选择器，谁生效取决于 CSS 打包顺序。换个名字（如 `.dragHead`），要改间距就用 `.panel .dragHead` 两级选择器。
- **`Card` 的 `headerProps` 可以只把拖拽 `handlers` 挂在标题栏上**（`useDragPosition` 的 `handlers` 直接展开进去），列表区域就能保留滚动和选中文字；整块拖动会和滚动打架。

## 数据与状态

- 持久化统一 `localStorage`，键名前缀 `ailive.`（如 `ailive.gift-prices`、`ailive.gift-motions`）。写入放在 `useEffect` 里，保持 setState updater 是纯函数。
- 只存配过的项，空串/空值在保存时**删键**，不留无用条目。
- 「打开抽屉时同步草稿」的 effect 用 `wasOpenRef` 判断上升沿，避免每次依赖变化都覆盖用户正在编辑的内容。
- `LiveDataProvider` 通过 `useLiveServer` 持有唯一一条 SSE 连接，舞台卡片和弹幕面板共享；`MIN_REPLY_INTERVAL_MS = 6000`。
- 礼物目录外的自定义礼物要能持久显示：行来源是 `Object.keys(giftPrices) ∪ 本次出现过的 giftTotals`，再减去内置目录。

## 触发动作（Live2D）

- 礼物动作是**按模型分别配**的：`giftMotions: Record<礼物, Record<模型 id, 动作名>>`。舞台同时渲染所有模型，所以礼物到达时要遍历 `modelSources` 逐个 `updateCharacter(id, …)`，不能只改 `updateActiveCharacter`。
- 旧格式（`Record<礼物, 动作名>`）靠通配键 `GIFT_MOTION_ANY_MODEL = '*'` 兜底：解析时 `entry[modelId] ?? entry['*']`，用户在弹窗里确认一次就展开成具体模型。
- `CharacterState.motionNonce` 是重放计数器。**同一个动作值没变时 Live2D 不会重播**，靠 nonce 自增绕过；`Live2D` 的 `applyModelProps` 里 `motionReplay = (next.motionNonce ?? 0) !== entry.motionNonce`，和 `motionChanged` 取或。
- 由弹幕驱动的 effect，依赖里必须带 `characterStates`（模型加载约 2.8s，比礼物晚到），同时用 `ref` 记已处理的 `id` 防止配置一改就重放上一条。
- 多模型时还有一层：manifest 并行加载，先就绪的模型不能把礼物「用掉」。用 `pendingModelsRef` 记没就绪的模型，effect 重跑时只补这几个。
- `LiveFeedItem['id']` 是 `string | number`，`useRef` 的类型要写全。

## 构建与验证

- `tsc -b` 必须加 `--force`。
- 沙箱里 `vite build` 删 `dist` 会报 `[safe-delete]`，先 `mv dist /tmp/...` 再 build。
- 本机 dev server 只监听 `[::1]:5173`，Playwright 必须用 `http://localhost:5173/`；重负载页面（Live2D + swiftshader）约 17fps，固定延迟采样抓不准，要用页面内 `setInterval` / `rAF` 采样器。
- Playwright 在 `C:\Users\Lenovo\AppData\Local\Temp\pwcheck`，`channel: 'chrome'`，`--use-gl=angle --use-angle=swiftshader`。
- CSS 模块类名会被哈希化（`_grid_f1nvh_19`），不要用 `[class*="..."]` 定位，改用 `aria-label` 或 `role`。
- 应用挂载约需 2.8s，mock EventSource 的计时从「组件挂载后」才开始，别用 `goto` 后的绝对时间戳判断。
