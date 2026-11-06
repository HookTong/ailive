# ailive 项目长期约定

React 18 + TypeScript + Vite + PIXI.js + pixi-live2d-display + Sass 的 Live2D AI 直播工作室。
组件在 `src/components/<Name>/`（`index.tsx` + `index.module.scss`），状态走 `src/contexts/`，hook 在 `src/hooks/`。

## 命名

- **组件名里不许出现 `Panel`**，只有「角色控制面板」`ModelControlPanel` 和「舞台控制面板」`StageControlPanel` 两个例外。其余组件用语义名（`GiftMotion`、`LiveChat`、`LiveOverview`、`StageToolbar`）。模块内部的 CSS 类同理，根节点写 `.root` 而不是 `.panel`。
- 例外只有这两个，新建组件时不要因为「看起来像个面板」就起名 `XxxPanel`。

## 样式

- **字体栈必须显式带中文字体**。`Manrope` / `DM Mono` 都没有中文字形，只写 `monospace` 的话汉字会逐字回退到系统默认字体（Windows 上从 Consolas 再掉一层），笔画粗细和拉丁部分对不上，小字号时特别糊。现在 `$font-ui` / `$font-mono` 都把 `PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei` 排在通用族前面。顺带的好处：Google Fonts 加载失败时也有正经的中文观感。
- **字号刻度在 `tokens.scss`**：`$fs-micro` 10 / `$fs-label` 11 / `$fs-body` 12 / `$fs-title` 13，`@include mono()` 的默认值取 `$fs-label`。界面里大量标签是 mono 小字，**别写 7px / 8px**，普通屏上根本看不清。

- **要特定高度的按钮不要传 `Button` 的 `size`**。传了会写死 30/32/34/36px；模块类与 `Button` 的 `.sm` 是同级选择器，谁生效取决于打包后的样式表顺序。正确做法：不传 `size`，在模块里自己写 `height` / `padding`。
- **要压过 `Button` 的 variant 类，用两级选择器**（如 `.giftList .motionButtonOn`），单类对单类不可靠，原因同上。
- **要给 `Input` 加错误/警告描边，挂 `aria-invalid` 就行，别再传 className**。`Input` 自己的 scss 里有 `input[aria-invalid='true'], input[aria-invalid='true']:focus { border-color: $warn }`，属性选择器（0,1,1 / 0,2,1）天然压过 `.input`（0,1,0）和 `.input:focus`（0,2,0）。早先靠 `className={styles.invalid}` 的写法每个调用方都得写 `input.xxx, input.xxx:focus` 两条，还特别容易漏掉 `:focus`（输入时输入框一直是聚焦的）。
- **必填字段的三件套**：标签写 `名称<RequiredMark />`、`Input` 挂 `aria-invalid` + `aria-describedby`、提示用 `.fieldHint { @include field-hint }`。不要一打开就飘红，用 `touched`（blur 时置 true）或「其他条件都满足了」来触发。四条添加类弹窗（背景 / 音乐 / 滤镜 / 模型）已全部统一，新加字段照抄。
- **校验提示互斥时共用一个 `id` 和一个 `.fieldHint`**：模型弹窗的「请填写模型名称」和「该名称已被使用」不会同时出现，算一个 `nameHint` 字符串、渲染一个 div 就行，别开两个 id 让 `aria-describedby` 二选一。
- **展示名只在「添加那一刻」由用户定下，之后谁都不许改**。原来线上模型有两条回填路径（加载预览时读 `model3.json` 的 `Name`、manifest 加载完用 `useConfigName` 覆盖 `name`），名字会被悄悄顶掉；现在名称必填，两条都删了。`ModelManifest.displayName` 只当展示兜底（`manifest?.displayName ?? modelSource?.name`），不写回 `name`。
- **`Segmented` 收 `className`，但别用外层 class 覆盖它的 `display`**：`.root` 是 `inline-flex`、`.block` 是 `display: flex; width: 100%`。想把「标签 + 控件」的壳拆掉、只留间距时，外层类里**只能写 `margin`**，跟着搬 `display: flex; flex-direction: column` 过去会把三段挤成竖排。可见标签一旦去掉，`ariaLabel` 就是唯一的无障碍名称，不能跟着删。
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
- **`Button` 永远不换行、不被压缩**：`.button` 上写了 `white-space: nowrap` + `flex-shrink: 0`。放进「输入框 + 按钮」这种 flex 行时，少几个像素就会把「设置」折成上下两行；`flex-shrink: 0` 让输入框先让位。
- **`Input` 的 `className` 落在内层 `<input>` 上，不是外层 `.wrap` 外壳**。所以 `.urlInput { flex: 1 }` 这种布局类其实一直没生效 —— 真正参与 flex 布局的是外壳。要在行里控制宽度只能按位置选（`.urlRow > :first-child`），别指望传 className。
- **`Button` 的 `@include ellipsis` 对胶囊不起作用**：`Button` 是 `inline-flex`，直接写在里面的文字是匿名 flex 子项，`text-overflow` 只对块级/内联级盒子里的文本生效。要让胶囊文字省略，得把文字包一层 `<span>`，而且**必须给这个 span 写 `min-width: 0`** —— flex 子项的自动最小尺寸是 `min-content`，`white-space: nowrap` 的文字缩不下来，省略号永远不会出现。
- **`Button` 的 `.xs` 内边距保持 4px**：预设胶囊用它，舞台背景那行是 5 等分栅格，每边多 2px 就会把「Lo-fi」挤成省略号。
- **`Card` 的 `headerProps` 里别用叫 `.head` 的类**：`Card` 内部已经有一个 `.head`（`margin-bottom: 12px`），两边都是单类选择器，谁生效取决于 CSS 打包顺序。换个名字（如 `.dragHead`），要改间距就用 `.panel .dragHead` 两级选择器。
- **`Card` 的 `headerProps` 可以只把拖拽 `handlers` 挂在标题栏上**（`useDragPosition` 的 `handlers` 直接展开进去），列表区域就能保留滚动和选中文字；整块拖动会和滚动打架。
- **舞台浮层一律「组件自己取数」**：`NowPlayingCard` / `IncomeCard` / `GiftRankCard` 都从上下文直接拿数据，不收 props。容器（`LiveOverview`）只负责摆放和整块拖动，这样把某张卡单独挪到舞台别处不用改调用方。
- 卡片高度对齐靠各自 `.root { min-height: 154px }`，不靠容器统一给 —— 拆成独立组件后，容器再统一加类就变成耦合了。

## 数据与状态

- 持久化统一 `localStorage`，键名前缀 `ailive.`（如 `ailive.gift-prices`、`ailive.gift-motions`）。写入放在 `useEffect` 里，保持 setState updater 是纯函数。
- 只存配过的项，空串/空值在保存时**删键**，不留无用条目。
- 「打开抽屉时同步草稿」的 effect 用 `wasOpenRef` 判断上升沿，避免每次依赖变化都覆盖用户正在编辑的内容。
- `LiveDataProvider` 通过 `useLiveServer` 持有唯一一条 SSE 连接，舞台卡片和弹幕面板共享；`MIN_REPLY_INTERVAL_MS = 6000`。
- **自定义项一律「内置数组 + 用户数组」合成**：背景 `[...BACKGROUND_PRESETS, ...customBackgrounds]`、音乐 `[...MUSIC_PRESETS, ...customTracks]`。面板和轮播/列表循环都吃这个合成数组，不要在两处各拼一次。合成之后靠 `id.startsWith('custom:')` 区分能不能删 —— id 前缀是这套约定的唯一凭据。
- **预设胶囊统一用 `PresetChip`**（舞台背景 / 舞台滤镜 / 背景音乐三处）：`label / active / onSelect / onRemove?`，不传 `onRemove` 就没有删除角标。角标本身是 `ChipRemove`（`PresetChip` 和 `VoiceSetting` 共用）：平时透明只留一根灰 ×，`:hover` / `:focus-visible` 才铺圆底。它是 `span + role="button"` 套在 `<button>` 里（HTML 其实不允许），`onClick` / `onKeyDown` 都必须 `stopPropagation`，空格还要 `preventDefault`，外面可能套 Tooltip 所以要带 `data-tooltip-ignore`。
- **小图标里的「×」不要用字符**：字体基线偏移在 14px 的圆里肉眼可见，`line-height` 怎么调都只是把偏差挪个方向。用 `::before` / `::after` 两条 `7px × 1px` 的细线，`grid-area: 1 / 1` 叠在同一格、`place-items: center` 居中后各转 ±45°，bar 自己的盒中心就是单元格中心，旋转不改变中心 —— 几何上精确居中。
- **删除「正在用的那一个」必须同时收掉它的使用方**：背景要退回默认底图、滤镜要退回「标准」并重算参数、音乐要暂停 + 清 `audioRef` + 退回默认曲目。只从数组里 filter 掉会留下一个指向已删项的引用，本地文件的 `blob:` 还会在被回收后变成哑巴。回收 `blob:` 的顺序是**先停播放再 revoke**。
- **播放/轮播里要读最新列表时用 `ref`**：`startSource` 是稳定引用的 `useCallback`，闭包里只能拿到首次渲染的列表，自定义项永远接不上。写 `tracksRef.current = allTracks` 每帧同步。
- **返回 `Promise<boolean>` 的上下文方法不要顺手设全局 error**：调用方（弹窗）要自己显示错误，两处都设会在面板和弹窗同时飘两条。`addTrack` / `previewUrl` 就是只返回成败。
- **试听必须用独立播放器，不能借主播放器**：`MusicProvider` 里 `preview` 是一整套独立的 `audio` 元素 + `analyser` + `track/playing/currentTime/duration`。借用主播放器（哪怕把现场扣下来备份）会让舞台那张「正在播放」卡片跟着试听一起变 —— 用户只是想听一下地址对不对，台面上的歌不该被顶掉。现在 `beginPreview()` 只做两件事：记住外面在不在放（`previewWasPlayingRef`）、`pause()`；`endPreview()` 清空试听 + 原本在放的 `play()` 一下，位置和频谱节点全在，无缝续上。`playing` 要在 `pause()` 之前读（`paused` 同步翻转）；`beginPreview` 要挡重复调用（StrictMode 双跑）；「添加成功」那条分支关窗时传 `endPreview(false)`，否则刚加的那首会被外面的播放盖掉。
- **试听状态在关窗时一并清掉**（`endPreview` 里调 `stopPreview`），下次打开是一张空卡片（`等待试听 / 尚未选择音乐 / 0:00 / --:--`），不留上一首的残影。没有可播内容时 `NowPlayingCard` 不传 `onToggle`，圆环退回纯装饰。
- 礼物目录外的自定义礼物要能持久显示：行来源是 `Object.keys(giftPrices) ∪ 本次出现过的 giftTotals`，再减去内置目录。
- **`blob:` URL 不能持久化**，刷新后必然失效。写 `localStorage` 和读 `localStorage` 两边都要过滤（`!url.startsWith('blob:')`），只写过滤不够 —— 老数据里可能已经存进去了。
- **交给别处的对象 URL 不能再 revoke**：弹窗里预览本地图会 `URL.createObjectURL`，关闭时 revoke 是对的；但一旦点「确定」把地址交给了别的组件，revoke 会让那边变空白。用 `committedRef` 标记「已交付」，cleanup 里跳过。
- 「无背景」这类开关**只控制渲染，不清数据**：`backgroundMode === 'none'` 时跳过 `backgroundImage`，`backgroundUrl` 留着，切回「固定」立刻恢复。点预设 / 添加背景要顺手从 `none` 切回 `fixed`，否则用户点了看不见东西。**正因为数据留着，胶囊的选中态不能只看 URL**：要写 `backgroundMode !== 'none' && backgroundUrl === url`，否则台上空了、胶囊还绿着，看着像「既没背景又选了那张」。
- **`PresetChip` 的 `active` 要同步 `aria-pressed`**：`Button` 的 `active` 只加了个 CSS 类，选中态纯粹是颜色差异，读屏用户完全摸不到。三处预设列表都走 `PresetChip`，在它里面传一次就够。

## 触发动作（Live2D）

- 礼物动作是**按模型分别配**的：`giftMotions: Record<礼物, Record<模型 id, 动作名>>`。舞台同时渲染所有模型，所以礼物到达时要遍历 `modelSources` 逐个 `updateCharacter(id, …)`，不能只改 `updateActiveCharacter`。
- 旧格式（`Record<礼物, 动作名>`）靠通配键 `GIFT_MOTION_ANY_MODEL = '*'` 兜底：解析时 `entry[modelId] ?? entry['*']`，用户在弹窗里确认一次就展开成具体模型。
- `CharacterState.motionNonce` 是重放计数器。**同一个动作值没变时 Live2D 不会重播**，靠 nonce 自增绕过；`Live2D` 的 `applyModelProps` 里 `motionReplay = (next.motionNonce ?? 0) !== entry.motionNonce`，和 `motionChanged` 取或。
- 礼物动作走**队列**，不是「最新礼物决定当前动作」：`useLiveServer` 每 400ms flush 一次，一个窗口里可能挤进好几条礼物，只认 feed 末尾那条会丢掉其余。入队认 `douyinRoom.feed`（靠 `queuedGiftIdRef` 记最大已入队 id 挑新的，`feed` 变空说明重连过，id 计数要归零），出队认 `giftTick` 计数器，播放窗口用 `setTimeout` 推进。
- **播放窗口的定时器绝不能放 effect 的 cleanup**：cleanup 每次依赖变化都执行，会把「窗口结束」信号提前吃掉，队列直接卡死。
- 礼物动作**优先级高于说话动作**：开播时给 `CharacterState.motionHoldUntil` 写 `Date.now() + 1200`，`Live2D` 里 `speakingStarted` 触发 `speakMotion` 前比一下。用时间戳而不是布尔标志 —— 说话可能持续好几秒，布尔标志没人清会永久锁死后续说话动作。
- **坑**：`applyModelProps` 里 `entry.motionHoldUntil = next.motionHoldUntil` 在判断之前赋值，守卫必须读 `next.motionHoldUntil`（或在赋值前算好），读 `entry` 拿到的是刚被覆盖的新值。
- 由弹幕驱动的 effect，依赖里必须带 `characterStates`（模型加载约 2.8s，比礼物晚到），同时用 `ref` 防止配置一改就重放上一条。
- 多模型时还有一层：manifest 并行加载，先就绪的模型不能把礼物「用掉」。用 `pendingModelsRef` 记没就绪的模型，effect 重跑时只补这几个。
- `LiveFeedItem['id']` 是 `number`，`useRef` 的类型要写全。
- **舞台字幕只反映 `activeMotion` 状态，看不到说话动作**：`speakMotion` 是 `Live2D` 内部直接调 `model.motion()`，不经过 React state。要观测它只能在运行时 hook 模型类或加临时探针。

## 构建与验证

- `tsc -b` 必须加 `--force`。
- 沙箱里 `vite build` 删 `dist` 会报 `[safe-delete]`，先 `mv dist /tmp/...` 再 build。
- 本机 dev server 只监听 `[::1]:5173`，Playwright 必须用 `http://localhost:5173/`；重负载页面（Live2D + swiftshader）约 17fps，固定延迟采样抓不准，要用页面内 `setInterval` / `rAF` 采样器。
- Playwright 在 `C:\Users\Lenovo\AppData\Local\Temp\pwcheck`，`channel: 'chrome'`，`--use-gl=angle --use-angle=swiftshader`。
- CSS 模块类名会被哈希化（`_grid_f1nvh_19`），不要用 `[class*="..."]` 定位，改用 `aria-label` 或 `role`。
- **`Segmented` 不是 button**：容器是 `role="radiogroup"`、每一段是 `role="radio"`，`getByRole('button', { name: '无背景' })` 会一直等到超时，要用 `getByRole('radio', ...)`。当前选中项靠 `aria-checked="true"` 读。
- **`Modal` 的标题容器是 `.header` + `<h2>`**，类名被哈希化，Playwright 里 `dialog.locator('header')` 会超时，用 `h2` 定位。弹窗面板本身是 `<section role="dialog">`，**不是原生 `<dialog>` 元素** —— `waitForSelector('dialog')` 会一直等到超时，要用 `[role="dialog"]`；注意这个面板自己就是 `section`，所以面板内 `.locator('section')` 取到的是内容里的 `Card`（如 `NowPlayingCard`），不是面板本身。
- 应用挂载约需 2.8s，mock EventSource 的计时从「组件挂载后」才开始，别用 `goto` 后的绝对时间戳判断。
