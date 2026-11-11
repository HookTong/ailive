# ailive 项目长期约定

React 18 + TS + Vite + PIXI.js + pixi-live2d-display + Sass 的 Live2D AI 直播工作室。组件 `src/components/<Name>/`（`index.tsx` + `index.module.scss`），状态 `contexts/`，hook `hooks/`。组件名不含 `Panel`（例外 `ModelControlPanel` / `StageControlPanel`），CSS 根 `.root`。

## 样式与主题

- 颜色只走 CSS 变量：色值只在 `styles/themes.scss`（暗 `:root` / 浅 `[data-theme='light']`），`tokens.scss` 是 `var()` 别名，**新增颜色两处都补**。Sass 拿不到 `var()` 通道，用 `color-mix(in srgb, #{$accent} 30%, transparent)` 或 `--accent-rgb` + `rgb(var(--accent-rgb) / .34)`。
- 中性叠加 `$overlay-weak|$overlay|$overlay-strong|$overlay-stronger`（暗叠白、浅叠黑），别写 `#ffffff08`。`$text-shadow`（浅 `none`）、`$glass-*`、`$shadow-*` 按主题换；气泡 `$bubble-*` 两套共用（舞台永远浅底深字）。
- 字体栈带 `PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei`；字号只用 `$fs-micro 10 / $fs-label 11 / $fs-body 12 / $fs-title 13`。
- 主题：`ThemeProvider` 只写 `<html data-theme>`；`ailive.theme` 默认 `system` 不写盘、监听 `prefers-color-scheme`；首帧由 `index.html` 内联脚本定。图标路径用 `import.meta.env.BASE_URL`；小图标别用 `box-shadow`（不占布局盒、会被裁），用 `radial-gradient`。

## 布局与间距

- 控制台纵向堆叠 `$stack-gap`（12px）；块间距唯一来源 `.block { margin-bottom: 20px }`，组件自带 `margin-top`（Slider 12px）用两级选择器压回 0。**块自己别再补 `padding-top`** —— 块顶位置由上一块的 `margin-bottom` 定，多一份 padding 就和邻居对不齐（`VoiceSetting` 曾多 2px）。
- 两个控制台面板的**第一行就是标题**（`角色控制台` / `舞台控制台`），**都是 `<h2>`**，上面没有 eyebrow 小字了；`.title` / `.intro` 都走 mixins 的 `panel-title` / `panel-intro`（**两栏并排，字号间距必须同一套，别各写一份**，曾经 25px vs 20px 悄悄跑偏）。上外边距归零，顶到面板的 `padding-top: 28px`。验证脚本定位面板用 `hasText: '舞台控制台'` / `'角色控制台'`，别再用 `STAGE CONTROL`。
- **块标题行 → 内容 = `$label-gap`（10px）**，比 `$stack-gap` 紧 2px：标题是这一组的标签，贴着自己的内容才读得出归属。**两个面板八个块全部统一**：角色控制台（`.labelRow` + 内容自己的 `margin-top: $label-gap`）和舞台控制台（`section-title` 混入的 `margin-bottom: $label-gap`）。**滚动容器自带上下 padding 的要减掉它**（`margin-top: $label-gap - $preset-pad-y`）。
- 块标题行统一：`.title` / `.labelRow` / `section-title` 都 `@include label-type`（等宽 `$fs-body`、`letter-spacing .08em`、`$text-soft`）+ `flex` + `space-between` + `align-items:center` + `gap:10px`。**颜色字号别再各写一份** —— 曾经角色控制台用 `$text-muted`、舞台用 `$text-soft`，并排一眼看得出。**右边不挂角标**（`LIVE2D` / `VOLCANO TTS` 都已删，`.tinyTag` 随之清掉）。
- `Button` 是 inline-flex，**外边距盒算进行盒高度**：下外边距归零，量间距用 `getBoundingClientRect()` 差；要特定高度别传 `size`，压 variant 用两级选择器。永不换行（nowrap + `flex-shrink:0`），省略文字包 `<span min-width:0>`，`.xs` padding 4px。
- 滚动条只在指针进容器时显形：靠 `data-scroll-hover`（Chromium 不因容器 hover 重解析 thumb）。`useHoverScrollbar` 从 `pointerover` 往上找最近滚动祖先，**遇 `position:fixed` 停**。12px 从 padding box 切走：最外层减 `padding-right`，嵌在别人留白里用 `@include scroll-bleed`，**外层右留白 ≥12px**；`scroll-thin` 必带 `scrollbar-gutter: stable`。
- 滑块 6px = `border: 3px solid transparent` + `background-clip: padding-box`，**只能写 `background-color`**。
- 预设网格 `max-height` 必须整数排：4 排 = 30×4+5×3 = **135px**（`PRESET_GRID_MAX_HEIGHT` 五处共用）；带上下 5px padding 是 157px。滚动区自己留了上下 padding 时，**和上下的间距都要减掉它**（`margin-top: $stack-gap - $preset-pad-y`）—— 否则标题行到第一排胶囊会变成 15px 而不是 12px（`VoiceSetting` 踩过）。
- `Segmented` 外层类只写 `margin`（`.modeSwitch{margin-top:12px}` 四处统一）；禁用整块 `.disabled{opacity:.5}`，别再给 `.option:disabled` 写透明度。`Tabs` 下划线 `.tab::after` 左右贴 0（别用 border，撑出 2px）。
- `Input` 步进器只在 `:focus-within` 出现；错误描边挂 `aria-invalid`；`className` 落内层 `<input>`。必填三件套：`名称<RequiredMark />` + `aria-invalid/aria-describedby` + `.fieldHint`。

## 组件与层级

- `Modal` 在 `Drawer` 外层（40>31）；抽屉内容区 `overflow:auto`；`scrollable={false}` 时内容自己撑满。`DropdownSelect` 菜单绝对定位无 portal，含下拉的区域不能 `overflow:auto`。
- `Tooltip` portal 到 body（Drawer 的 `transform` 会成为 `fixed` 包含块）；`.popup` 显式声明字体颜色；`title` 是 `ReactNode`，多行用 `.tipLine + .tipLine { border-top }`。
- 直播配置抽屉：礼物行 `padding: 5px 0` 贴边；弹幕指令那 12px 内边距画在 `.list` 边框**里面**，别用负边距。`Card` 的 `headerProps` 别用 `.head`。
- 舞台浮层自己取数，容器只摆放和整块拖动；卡片 `.root { min-height:154px }`。四块：概览（左上 560）、弹幕（右上 `top:16 right:16` z9）、礼物动作（左下）、弹幕指令（右下）；后三 268 宽 + `max-height:min(66%,540px)` + 底 `#09232bf2`，右侧两块重叠是已知取舍。
- 小标签分两种：静态字面量用 `Tag`（`tone` accent 浮起底 / neutral 描边、`as` 默认 code、**不可点**、单行省略）；能点的用 `PresetChip`（自带 Tooltip，调用点别套）。`ChipRemove` 要 `stopPropagation` + `data-tooltip-ignore`；带角标胶囊补 `&::before { flex:0 0 14px }` 才真居中；`active` 同步 `aria-pressed`；长文字包 `.label`；「×」用两条 7×1 细线 + `grid-area:1/1` + ±45°。
- 胶囊 hover 中性提亮（`$bg-hover` + `$border-strong`）、active 才是绿底；多选组里选中项 hover 用 `.chip.active:hover:not(:disabled)`。

## 数据与状态

- localStorage 前缀 `ailive.`，只存配过的/非默认值（弹幕指令只存关掉的），空值删键；写入放 `useEffect`，updater 保持纯函数。
- 三份 console storage：`ailive.model-console` / `ailive.stage-console` / `ailive.music-console`。`DEFAULT_*` 是默认值唯一来源；`loadX` 逐项校验、读不懂退默认；`saveX` 只写差异、全默认 `removeItem`；`lastWritten` 比对载荷。
- 恢复配置必须在 `useState(懒初始化)` 里做（放 effect 会先渲染默认背景再换图）；读回值要校验「还在不在」（背景 URL / 滤镜 id / 模型 id 在不在列表里），粒子滑杆初值取 `configs[存储预设]`。粒子参数按预设分别记（`particleOverrides`）；音乐只恢复选中不恢复播放。
- 抽屉草稿同步用 `wasOpenRef` 判上升沿，**面板改的是草稿、点「完成」才提交**。`LiveDataProvider` 持有唯一 SSE；`MIN_REPLY_INTERVAL_MS = 6000`。
- 自定义项 = 内置 + 用户数组，`id.startsWith('custom:')` 区分可删。删「正在用的那一个」要同时收使用方（背景退默认、滤镜退标准、音乐暂停 + 清 `audioRef` + 退默认）；`blob:` 先停播再 revoke。
- 播放/轮播读最新列表用 `ref`；返回 `Promise<boolean>` 的上下文方法别顺手设全局 error；试听必须独立播放器（独立 audio + analyser + 状态）。`MusicContext` 的 `toggle` 只给按钮（按一下切一次），**指令走幂等的 `play()` / `pause()`** —— 连发两次「播放」不该把歌停掉。
- 礼物目录外 = `giftPrices` ∪ 本次 `giftTotals` − 内置；`blob:` 不能持久化，读写都过滤；交出去的对象 URL 不再 revoke（`committedRef`）。图标 = `public/gifts/<icon>.svg` + `src/data/gifts.ts`（OpenMoji 72×72 + 2px 描边），按单价升序插；目录外渲染 `?`；`giftPrice()` 先查用户价。
- 背景换图交叉淡入：旧图垫底、新图 0→1；新图先 `new Image()` 预载；旧层 `setTimeout` 卸载（动画关掉时 `animationend` 不来）；`BACKGROUND_FADE_MS` 与 `$background-fade` 对齐。
- 「固定/循环/随机」共用 `PresetRotateMode`（间隔 12s）；`pickNextIndex` 随机偏移取 `[1, length-1]`（否则可能连着同一个）；自动切换 effect 依赖带当前预设 + handler 必须 `useCallback`；关掉粒子/滤镜要暂停。
- 粒子和滤镜胶囊写 `active={preset === id}`（选中态只跟预设走、不跟开关走：关掉时那颗照样亮着），关掉时另加 `disabled`（`PresetChip` 透传给 `Button`，`.chip:disabled` 只剩 `opacity:.55`）；「展开细粒度控制」也跟着禁用（展开只会看到一排灰滑杆）。开关只管渲染不改选中项；只有选中项指不到东西（自定义被删）才退回「标准」；删预设只退参数和选中项、不动开关。

## 舞台背景开关

- 「舞台背景」标题右边的 `Switch`（`backgroundMode === 'none'`，标题行不带角标）只控制渲染不清数据：图、轮换方式、预设选中项全留着。
- `backgroundModeBeforeOff`（**在 `StageProvider` 里，不是面板局部 state**）记住关之前那一种方式；`setBackgroundMode` 包装成 useCallback，**非 none 时同步记进去** —— 关掉后分段控件禁用，但指令 `[背景|随机]` 还能发，那一下也得算进「下次打开回到哪儿」。`setBackgroundVisible(visible)` 只切 `none` 这一档，面板开关和 `[背景|开启]`/`[背景|关闭]` 共用它。
- 关掉时：分段控件照旧亮 `backgroundModeBeforeOff` 但整块 `disabled`，预设胶囊 `active` 只看 `backgroundUrl === url`（那张仍亮着）且 `disabled`，「＋ 添加背景」也 `disabled`（`.ghost:disabled` 是 `.45`，胶囊 `.55`、分段 `.5`，同屏看不出差别）。

## Live2D 与舞台

- 礼物动作按模型配 `giftMotions[礼物][模型 id]`，旧格式靠 `GIFT_MOTION_ANY_MODEL='*'` 兜底。`activeMotion` 只归用户；外部触发走 `overrideMotion` + `overrideNonce`（一次性、不回写）。优先级：换预设 > 一次性 > 开口重播预设，必须是同一条 `else` 链。
- 礼物动作走队列：`queuedGiftIdRef` 记最大已入队 id（feed 空 = 重连归零），`giftTick` 推进，窗口定时器**不能**放 effect cleanup（否则队列卡死）。礼物动作优先于说话：`motionHoldUntil` 用时间戳，守卫读 `next.motionHoldUntil`。
- 弹幕 effect 依赖带 `characterStates`（模型比礼物晚到 ~2.8s），用 ref 防重放；多模型并行加载用 `pendingModelsRef` 只补没就绪的。说话触发动作 = 选中的那一项，`applyModelProps` 里 `else if` 重播。
- 名牌在 `Live2D` 内，和气泡共用 `updateOverlays`（每 4 帧，`getBounds()` 只算一次）。位置靠 `measureSilhouette` 遍历 Cubism drawable 顶点算 `bottomTrim`/`topTrim`（只统计 visible 且 opacity>0），**别用 `renderer.extract.pixels()`**（`getLocalBounds()` 返回画布原尺寸，实测 66MB 卡死）；顶点未 update 时范围离谱就当没量到、退回包围盒；初始 `visibility:hidden`。
- 气泡底边 = 内容顶边 − `BUBBLE_TAIL_DROP × scale` − 4（13.7 = 尾巴伸出距离，改 SCSS 同步改）；top 夹 ≥0。`--bubble-scale` 别在 ref 里缓存「上次写入值」（气泡和名牌挂载时机不同会互相跳过），和 `element.style.getPropertyValue()` 比。
- `CharacterDisplaySetting`：气泡常显 → 名牌显示 → 模型大小，三行左标签右控件；`BubbleMode` 两态直接映射开关；Slider `margin-top:0` 要两级选择器。「名牌显示」按角色（`nameplateVisible` 默认 false，不落盘）；别和全局 `showNames` 混。

## 弹幕指令 & 自然语言控制

- **细节全在 `COMMANDS.md`（同目录）**：格式 `[固定值|固定值]变量>变量`、`ACTIONS` 动作表、匹配规则、拦截顺序、面板分组、LLM 工具表与路由队列。动这块先读它。
- 只需记住三条底线：① 动作表 `src/data/actions.ts` 是唯一真相，新增动作只加一条；② **方括号里全是固定值（一字不差），外面全是变量（模糊匹配）**；③ 指令写法的弹幕不管成败都只走指令，不落自动回复。

## 构建与验证

- **做法细节全在 `VERIFY.md`**（同目录）：Playwright 选择器、mock 直播流 / TTS / 模型请求、Node 侧 esbuild 探针、浅色主题要另开 page。要跑验证先读它。
- 底线：`tsc -b --force`（增量会漏报）；`vite build` 前先 `mv dist /tmp/...`。
