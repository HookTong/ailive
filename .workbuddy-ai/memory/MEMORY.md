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
- **块标题行 → 内容 = `$label-gap`（10px）**，比 `$stack-gap` 紧 2px：标题是这一组的标签，贴着自己的内容才读得出归属。**两个面板八个块全部统一**：角色控制台（`.labelRow` + 内容自己的 `margin-top: $label-gap`）和舞台控制台（`section-title` 混入的 `margin-bottom: $label-gap`）。**预设网格容器一律不带上下 padding**（和「外观预设」同一盒子模型），别靠减 padding 凑数。
- 块标题行统一：`.title` / `.labelRow` / `section-title` 都 `@include label-type`（等宽 `$fs-body`、`letter-spacing .08em`、`$text-soft`）+ `flex` + `space-between` + `align-items:center` + `gap:10px`。**颜色字号别再各写一份** —— 曾经角色控制台用 `$text-muted`、舞台用 `$text-soft`，并排一眼看得出。**右边不挂角标**（`LIVE2D` / `VOLCANO TTS` 都已删，`.tinyTag` 随之清掉）。
- `Button` 是 inline-flex，**外边距盒算进行盒高度**：下外边距归零，量间距用 `getBoundingClientRect()` 差；要特定高度别传 `size`，压 variant 用两级选择器。永不换行（nowrap + `flex-shrink:0`），省略文字包 `<span min-width:0>`，`.xs` padding 4px。
- 滚动条只在指针进容器时显形：靠 `data-scroll-hover`（Chromium 不因容器 hover 重解析 thumb）。`useHoverScrollbar` 从 `pointerover` 往上找最近滚动祖先，**遇 `position:fixed` 停**。12px 从 padding box 切走：最外层减 `padding-right`，嵌在别人留白里用 `@include scroll-bleed`，**外层右留白 ≥12px**；`scroll-thin` 必带 `scrollbar-gutter: stable`。
- 滑块 6px = `border: 3px solid transparent` + `background-clip: padding-box`，**只能写 `background-color`**。
- 预设网格 `max-height` 必须整数排：30px 胶囊 + 5px 行距 → 4 排 = **135px**（`PRESET_GRID_MAX_HEIGHT`，背景/特效/滤镜/音乐/外观共用）。**音色那格行距是 9px，单独写 `147px`**（4×30+3×9），同样 4 排不多不少。**容器不要再加上下 padding** —— 加了就得把高度和上下间距全减一遍（`VoiceSetting` 曾为 5px padding 写 157px + `margin-top: $label-gap - $preset-pad-y`，现已删干净）。
- `Segmented` 外层类只写 `margin`（`.modeSwitch{margin-top:12px}` 四处统一）；禁用整块 `.disabled{opacity:.5}`，别再给 `.option:disabled` 写透明度。`Tabs` 下划线 `.tab::after` 左右贴 0（别用 border，撑出 2px）。
- `Input` 步进器只在 `:focus-within` 出现；错误描边挂 `aria-invalid`；`className` 落内层 `<input>`。必填三件套：`名称<RequiredMark />` + `aria-invalid/aria-describedby` + `.fieldHint`。

## 组件与层级

- `Modal` 在 `Drawer` 外层（40>31）；抽屉内容区 `overflow:auto`；`scrollable={false}` 时内容自己撑满。`DropdownSelect` 菜单绝对定位无 portal，含下拉的区域不能 `overflow:auto`。
- `Tooltip` portal 到 body（Drawer 的 `transform` 会成为 `fixed` 包含块）；`.popup` 显式声明字体颜色；`title` 是 `ReactNode`，多行用 `.tipLine + .tipLine { border-top }`。
- 直播配置抽屉：礼物行 `padding: 5px 0` 贴边；弹幕指令那 12px 内边距画在 `.list` 边框**里面**，别用负边距。`Card` 的 `headerProps` 别用 `.head`。
- 舞台浮层自己取数，容器只摆放和整块拖动；卡片 `.root { min-height:154px }`。四块：概览（左上）、弹幕（右上 `top:16 right:16` z9）、礼物动作（左下）、弹幕指令（右下）；右侧两块重叠是已知取舍。**拖过哪张哪张排最前**：`useDragPosition` 里模块级 `topZIndex`（起始 9）在 `pointerdown` 时 `++` 写进内联 `zIndex`，松手不还原（一放手就缩回邻居底下等于白拖），`resetToken` 变化时清成 `undefined` 落回 CSS 的 8/9。计数器必须放模块级，四张卡要共享同一个顺序；赋值点在 `INTERACTIVE` 守卫之后 —— 点卡片里的按钮不算拖这张卡。
- 四块浮层的**大小是等比缩放**（直播用手机看要能看清字），用 `zoom` 不用 `transform: scale()`：`zoom` 是布局级缩放，文字按放大后尺寸重新栅格化**不糊**，padding/圆角/图标/行高一起放大。倍数存 `StageContext.overlayScales`（`overview|giftMotion|chat|chatCommand`，0.6~2，默认 1，`ailive.stage-console` 落盘），`Stage` 在 `.preview` 上内联下发 `--overlay-zoom-overview/-gift/-chat/-command`，四张卡各写一行 `zoom: var(--overlay-zoom-xxx, 1)`。**宽度/max-height 仍写死**（268 / `min(66%, 540px)` / 560 / 220），别再引回档位变量。
- **四块卡片各占一个操作区**（舞台控制台里，背景音乐之后、重置舞台之前，顺序 = 舞台摆放顺序：直播概览 / 礼物动作 / 直播弹幕 / 弹幕指令）。每区 = 标题行（卡片名 + `variant="bare"` 的「复位」 + `Switch`）+「大小」「透明度」两根滑块（`aria-label` 是 `${卡片名}卡片大小` / `...卡片透明度`）。**顶栏工具条已删除**，显隐开关原来在那儿；**全屏按钮挪到 `TopBar`**，全屏的是 `.stagePanel`，节点由 `App` 用 `stagePanelRef` 传下去（别用 `querySelector` 猜）。所以 `Stage` 不再收 `show*` props，直接从 `useStage()` 读 `overlayVisible`。
- 显隐存 `StageContext.overlayVisible`（`OverlayVisibility`，默认全 `true`，落 `ailive.stage-console` 的 `overlayVisible`，有一块藏起来就整组写）。**开关只管渲染**，大小 / 透明度 / 位置全部原样留着。
- 「复位」**每块一个、各管各的**：`resetOverlayCard(key)` = 这一块的大小 + 透明度回默认、位置归零，**不动开关**（显隐有旁边那个 Switch，复位顺手把藏起来的卡片放出来会很意外）。位置在各卡自己的 `useDragPosition` 局部 state 里，面板够不着，只能靠令牌单向通知 —— 令牌是**每块一份**的 `overlayResetTokens`（`Record<OverlayScaleKey, number>`），卡片传 `useDragPosition({ resetToken: overlayResetTokens.chat })` 这样，数字一变就 `translate(0,0)`；只增不减、**不落盘**。做成四份而不是一份：复位一块时不该把另外三张拖到别处的卡片也弹回原位。`resetStage()`（重置舞台）会把四块的大小 / 透明度 / 显隐 / 位置一起复位。文字按钮静止就得用 `$accent-text`，灰字会被当成说明标签。
- **卡片被隐藏时，该区的两根滑块和「复位」全部 `disabled`**（`const visible = overlayVisible[key]`）。灰态 `cx(styles.overlaySliders, !visible && styles.cardDisabled)`（`opacity: .42`，和粒子 / 滤镜同一档）**只加在滑块那一组**——套整个 `section` 会把标题行的 `Switch` 一起变灰，看着像关掉就再也打不开。`复位` 是 `variant="bare"` 而 `.bare` 没有禁用态，光给 `disabled` 属性它还是那颗 `$accent-text` 绿字，必须在 `.resetOverlay` 里补 `&:disabled { color: $text-faint; cursor: not-allowed }`。
- 浮层**透明度**和大小完全同一套：`overlayOpacities`（`OVERLAY_OPACITY_MIN 0.2 ~ 1`，默认 1，落 `ailive.stage-console` 的 `overlayOpacities`），`Stage` 下发 `--overlay-alpha-overview/-gift/-chat/-command`，卡片写 `opacity: var(--overlay-alpha-xxx, 1)`。下限 0.2 而不是 0：再低手指找不到落点，真要隐藏用每块自己的开关。
- 「全部」统一滑块那套（`UnifiedState` / `mixed` / `展开单独调节` / `OVERLAY_SLIDERS`）**已经删掉**：四块各管各的，没有总控。`resetOverlayScales` / `resetOverlayOpacities` 也一并删了，别再引回来。
- **`zoom` 的三个坑**：① `offsetLeft` / `offsetWidth` 是**布局值**，`clientWidth` / `getBoundingClientRect()` 是**屏幕值**，差一个 zoom 倍数；`transform: translate` 里的 px 还会被浏览器再乘一次 zoom —— `useDragPosition` 全部换算到布局坐标（`stage.clientWidth / zoom`、`(clientX - stageRect.left) / zoom`）。② `zoom` 不改布局尺寸，**ResizeObserver 看不到**，必须靠显式 `scale` 参数 + `useEffect` 依赖触发 clamp。③ 百分比已折算（Chromium 先把包含块除以 zoom），`calc(100% - 20px)` 照旧写，别自己再除一次。
- `useDragPosition` 的「尺寸变了把位置夹回舞台」观察器**绑在第一次 pointerdown 里，不是 effect**：`GiftMotionCard` / `ChatCommandCard` 没配内容时整块 `return null`，挂载那一刻 `ref` 还是 null，`useEffect(..., [])` 只跑一次就永远绑不上（实测拖到边上再切大档会溢出 44px）。且只认**宽度**变化 —— 高度是内容驱动的（弹幕一多就长高），跟着夹会每条弹幕跳一下。
- 小标签分两种：静态字面量用 `Tag`（`tone` accent 浮起底 / neutral 描边、`as` 默认 code、**不可点**、单行省略）；能点的用 `PresetChip`（自带 Tooltip，调用点别套）。`ChipRemove` 要 `stopPropagation` + `data-tooltip-ignore`；带角标胶囊补 `&::before { flex:0 0 14px }` 才真居中；`active` 同步 `aria-pressed`；长文字包 `.label`；「×」用两条 7×1 细线 + `grid-area:1/1` + ±45°。
- 胶囊 hover 中性提亮（`$bg-hover` + `$border-strong`）、active 才是绿底；多选组里选中项 hover 用 `.chip.active:hover:not(:disabled)`。

## 数据与状态

- localStorage 前缀 `ailive.`，只存配过的/非默认值（弹幕指令只存关掉的），空值删键；写入放 `useEffect`，updater 保持纯函数。
- 三份 console storage：`ailive.model-console` / `ailive.stage-console` / `ailive.music-console`。`DEFAULT_*` 是默认值唯一来源；`loadX` 逐项校验、读不懂退默认；`saveX` 只写差异、全默认 `removeItem`；`lastWritten` 比对载荷。
- 恢复配置必须在 `useState(懒初始化)` 里做（放 effect 会先渲染默认背景再换图）；读回值要校验「还在不在」（背景 URL / 滤镜 id / 模型 id 在不在列表里），粒子滑杆初值取 `configs[存储预设]`。粒子参数按预设分别记（`particleOverrides`）；音乐只恢复选中不恢复播放。
- 抽屉草稿同步用 `wasOpenRef` 判上升沿，**面板改的是草稿、点「完成」才提交**。`LiveDataProvider` 持有唯一 SSE。回复间隔已改成可调（`throttle.replyIntervalMs`，默认 6s），代码里没有 `MIN_REPLY_INTERVAL_MS` 这个常量了。
- **抽屉里放 `Tabs` 必须 `scrollable={false}`**（标签页自己管滚动：标签栏定高、panel 自己滚）。AI 配置抽屉分「配置参数 / 回复历史」两页，**`draft` 在 `Tabs` 外面**，切标签不会丢改动；每次打开回到第一页。回复历史那页靠 `.historyPane { min-height: 100% }` 撑满 panel（`box-sizing: border-box`，不用减 panel 的 14px 上内边距），列表再 `flex: 1 1 0` 自己滚。**「当前状态」那行（含 `error`）在历史页底部**、是 `flex: 0 0 auto` 的状态条，列表滚它不动；只给 `margin-top: 10px`、**不画分隔线** —— 抽屉 `.actions` 自带 `border-top`，挨这么近会成双线。
- **回复历史最多 50 条**（`REPLY_RECORD_LIMIT = 50`，两处 `setReplies` 都挂 `.slice(0, …)`）。不封顶时抽屉打开期间每次新回复都要重渲染整张列表，长跑一整天能攒上千条而没人会翻。**常量与抽屉空态文案里的「最近 50 条」是两处 50，改一个要改另一个。**
- 每条记录带回复时间（`formatReplyTime` 手写 `HH:MM:SS`，别用 `toLocaleTimeString`），挤在提问那行右侧。**`.historyList` 和 `li` 两个 grid 都要写 `grid-template-columns: minmax(0, 1fr)`**：默认 `auto` 列会被 `min-content` 撑开，一句长弹幕就能把全部卡片顶到 666px（面板 556），横向滚动条 + 提问省略号一起失效。
- **AI 队列必须跟着连接状态走**：只有 `douyinRoom.state === 'live'` 才算「有人在看」。三处缺一不可 —— `pushQueue` 开头 `if (!liveRef.current) return false`（挡住断开瞬间还在路上的 flush）、`!liveConnected` 的 effect 清空 `queueRef`/`routeQueueRef` + `setPendingCount(0)`、`await createDoubaoChatReply` 之后 `if (!liveRef.current) return`（**在途那一条已经出队，清队列拦不住它**）。漏掉任何一处，点了「断开」台上还会继续对着空气回弹幕。
- 断开时**不要 `stopSpeaking()`**：用户明确要求「把最后一条回复说完再结束」。边界是「已经在说的」vs「还没开口的」—— 正在播放的那句让它自然说完（`speak` 在 `onended` 时 resolve，说完才写记录），还在请求路上的那条仍然丢弃。两件事分开处理。
- 弹幕冷却别按「时间窗屏蔽」写：`CHAT_USER_COOLDOWN_MS` 曾是 45s，等于「回他一句、然后 45 秒里他说的十几条全静默」（实测 18 条只回 2 条，间隔精确 45.0s）。现在 6s（= 全局节流，等于不额外限制同一个人），**「别让一个人占满队列」改由 `enqueue` 里「队列已有他的 chat 就先不加」挡**。总闸始终是 `MIN_REPLY_INTERVAL_MS`，改小每人冷却只是决定名额分给谁、不多花 token。`SAME_TEXT_WINDOW_MS` 60s → 30s（短句全站一分钟只答一次太伤）。
- 自定义项 = 内置 + 用户数组，`id.startsWith('custom:')` 区分可删。删「正在用的那一个」要同时收使用方（背景退默认、滤镜退标准、音乐暂停 + 清 `audioRef` + 退默认）；`blob:` 先停播再 revoke。
- 播放/轮播读最新列表用 `ref`；返回 `Promise<boolean>` 的上下文方法别顺手设全局 error；试听必须独立播放器（独立 audio + analyser + 状态）。`MusicContext` 的 `toggle` 只给按钮（按一下切一次），**指令走幂等的 `play()` / `pause()`** —— 连发两次「播放」不该把歌停掉。
- 礼物目录外 = `giftPrices` ∪ 本次 `giftTotals` − 内置；`blob:` 不能持久化，读写都过滤；交出去的对象 URL 不再 revoke（`committedRef`）。图标 = `public/gifts/<icon>.svg` + `src/data/gifts.ts`（OpenMoji 72×72 + 2px 描边），按单价升序插；目录外渲染 `?`；`giftPrice()` 先查用户价。
- 背景换图交叉淡入：旧图垫底、新图 0→1；新图先 `new Image()` 预载；旧层 `setTimeout` 卸载（动画关掉时 `animationend` 不来）；`BACKGROUND_FADE_MS` 与 `$background-fade` 对齐。
- 「固定/循环/随机」共用 `PresetRotateMode`（间隔 12s）；`pickNextIndex` 随机偏移取 `[1, length-1]`（否则可能连着同一个）；自动切换 effect 依赖带当前预设 + handler 必须 `useCallback`；关掉粒子/滤镜要暂停。
- 粒子和滤镜胶囊写 `active={preset === id}`（选中态只跟预设走、不跟开关走：关掉时那颗照样亮着），关掉时另加 `disabled`（`PresetChip` 透传给 `Button`，`.chip:disabled` 只剩 `opacity:.55`）；「展开细粒度控制」也跟着禁用（展开只会看到一排灰滑杆）。开关只管渲染不改选中项；只有选中项指不到东西（自定义被删）才退回「标准」；删预设只退参数和选中项、不动开关。

## 粒子特效（Atmosphere）

- **`public/vendor/particles.js` 是未打补丁的原版**：`tmp` 是空对象，`createSvgImg` 里 `count_svg++` 把 `undefined` 变 **NaN**，`draw()` 的 `count_svg >= N` 永远 false —— 所以 `shape: 'image'` 一个粒子都画不出来，画布停在「still loading」。真要做实物形状必须先在本地补两处：`tmp: { count_svg: 0 }`、门槛改成 `>= pJS.particles.array.length`（原版比 `number.value`，但 density 会按面积删粒子，`array.length` 永远更小）。诊断靠 `window.pJSDom[0].pJS` 读内部状态，`countSvg` 显示成 `null` 就是 `JSON.stringify(NaN)`。
- 实物形状（水滴/绒毛/树叶/花朵/卡通人物/表情/雪花）做过一版又**按用户要求整版移除**了，代码不在库里。真要重做，除了上面两处补丁，还有四个配置约束别照几何形状抄：① `sizeRandom: false`（半径是 `Math.random() * size`，一半图形小到认不出）；② `opacity: 1` 且关 `opacityRandom`（还要再乘强度 0.55）；③ `size` 要倒推 —— 真实半径 = `size × 面板大小滑杆(初值 2.5)`，SVG 图形又只占画布一部分，直接写 7/9/11 就是 35～55px 大贴图；④ `shape.image` 的 `width`/`height` 必须给（缺了 ratio 是 NaN）。图片路径末尾必须是 `.svg`（库靠最后三个字符判断 svg/png），且 SVG 里只写白色 —— 库会把所有 `#hex` 替换成粒子色。
- SVG 画法三条：同一形状**合并成一条 path 走 nonzero**，别用多个 `<circle>` 叠（同色叠两次更实、接缝发亮）；「洞」（眼睛 / 挖空）用**反向绕向**，**别用 `fill-rule="evenodd"`** —— 它会把头与身体的交叠也减掉，脖子上多一道黑线；相邻预设的形状必须能区分（正着放的尖头圆底和水滴一模一样，树叶得斜放 + 带叶柄）。尺寸目标 20～26px：鼓包振幅不到 1px 会被抗锯齿抹平成正圆，别用「实心球 + 放射短线」（看着像太阳 / 海胆）。

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
- **节流参数可在「AI 自动回复设置」抽屉里调**（`settings.throttle`：`replyIntervalMs` / `userCooldownMs` / `sameTextWindowMs`，存毫秒、面板按秒调，范围在 `AI_THROTTLE_LIMITS` 里和落盘校验共用）。provider 里三处读 `settingsRef.current.throttle.*`，别再把它们写回常量。出错退避取 `max(ERROR_BACKOFF_MS, 间隔)` —— 否则用户把间隔调到 60s，退避反而让重试更快。
- 三项的影响范围别记错：`replyIntervalMs` 是**全局总闸**（指令反馈也排队受它管）；`userCooldownMs` **只管弹幕**，而且冷却在「这条排进队列」时记（`pushQueue` 之后才 `cooldowns.set`），不是说完话才记；礼物答谢 8s、进场欢迎 10 分钟写死，不跟这三项走。抽屉里每根滑块下面都写了一行 `scope · hint`，改文案别把这几条说反。复位只改草稿（和抽屉其它字段一致），保存才写回。
- 自然语言理解**很贵**：单次固定 ≈2450 token（工具表 1740 + 快照 500 + 提示 170），是普通回复的 3.7 倍。所以**只有 `[AI控制]+一句话` 才送模型**（`parseAiControl`），没前缀的弹幕一律当普通聊天；`MIN_ROUTE_INTERVAL_MS`（全局 2s，只有真调接口才占名额）兜上限。别再按「总弹幕密度」判刷屏 —— 加了前缀之后会误伤忙房间里的正常控制。

## 直播桥接服务（server/）

- 前端只连 `127.0.0.1:8787`（vite 代理 `/api`），cookie 只在 `server/.env` 的 `DY_LIVE_COOKIES`。
- **取初始帧不能带登录态 cookie**：`/webcast/im/fetch/` 见到 `sessionid` 就回 200 + 空 body，响应头 `x-vc-bdturing-parameters` 点名滑块验证。取帧走 `Auth.guest_cookie`（只 `ttwid` + `msToken`），登录态只留给 WebSocket。改完要重启桥接进程才生效。

## 构建与验证

- **做法细节全在 `VERIFY.md`**（同目录）：Playwright 选择器、mock 直播流 / TTS / 模型请求、Node 侧 esbuild 探针、浅色主题要另开 page。要跑验证先读它。
- 底线：`tsc -b --force`（增量会漏报）；`vite build` 前先 `mv dist /tmp/...`。
