# ailive 项目长期约定

React 18 + TS + Vite + PIXI.js + pixi-live2d-display + Sass 的 Live2D AI 直播工作室。
组件在 `src/components/<Name>/`（`index.tsx` + `index.module.scss`），状态走 `src/contexts/`，hook 在 `src/hooks/`。

## 命名

- 组件名里不许出现 `Panel`，例外只有 `ModelControlPanel` / `StageControlPanel`。CSS 根节点写 `.root`。

## 样式

- **字体栈必须带中文字体**（`PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei` 排在通用族前），否则汉字逐字回退、笔画对不上。
- **字号只用刻度**：`$fs-micro` 10 / `$fs-label` 11 / `$fs-body` 12 / `$fs-title` 13（`@include mono()` 默认 `$fs-label`），别写 7px / 8px。
- **要特定高度的按钮别传 `Button` 的 `size`**（写死 30–36px），在模块里自己写 `height` / `padding`；要压过 variant 类用**两级选择器**，单类对单类看打包顺序。
- **块间距只有一个来源**：控制台各块靠 `.block { margin-bottom: 20px }`，组件自带的 `margin-top`（`Slider` 12px）叠上去会变成 32px、比别处空一截。单独成块时用两级选择器（`.sizeBlock .sizeSlider`）把它压回 0 —— flex 列里 margin 不合并，别指望自动抵消。
- **`Input` 的错误描边挂 `aria-invalid`**，别传 className —— 属性选择器天然压过 `.input` / `.input:focus`。必填三件套：`名称<RequiredMark />` + `aria-invalid` / `aria-describedby` + `.fieldHint`；用 `touched` 触发，互斥提示共用一个 `id`。
- **展示名只在「添加那一刻」定下**，之后不许回填；`ModelManifest.displayName` 只当展示兜底。
- **滚动条只在指针进容器时显形，靠 `data-scroll-hover` 而不是 `:hover`**：Chromium 不会因容器 `:hover` 重解析 `::-webkit-scrollbar-thumb`（实测 `matches(':hover')` 为 true、thumb 仍 `transparent`，换个属性下一帧就画出来）。全局唯一的 `useHoverScrollbar`（`AppContent` 调用）从 `pointerover` target 往上找最近的真滚动祖先挂属性，**遇到 `position: fixed` 就停**（弹层遮罩是 fixed，不停会点亮底下列表）。
- **滑块不贴列表**：轨道 `$scrollbar-size`（12px），滑块靠 `border: 3px solid transparent` + `background-clip: padding-box` 缩成 6px。**只能写 `background-color`** —— `background` 简写会把 `background-clip` 重置回 `border-box`。
- **滚动条那 12px 是从容器 padding box 里切走的，滚动容器必须把它让出来**，否则内容右侧凭空比左侧少 12px、和同级整宽按钮也差一截。两种让位方式：自己是最外层（面板 / 抽屉 / 弹窗内容区）就把 `padding-right` 减 `$scrollbar-size`；嵌在别人留白里（预设网格、卡片里的列表、`Tabs` 面板、**抽屉里「最近回复」那种内层列表**）用 `@include scroll-bleed`（`margin-right: -$scrollbar-size`）把滚动条推进外层留白。**外层右留白必须 ≥ 12px，否则会撑出横向滚动条**（`overflow-y: auto` 会把 `overflow-x` 算成 `auto`）。
- **双层滚动（抽屉 body + 内层列表）允许两个滚动条落在同一列**：`useHoverScrollbar` 只给「指针到 target 的最近滚动祖先」挂 `data-scroll-hover`，同一时刻只有一条 thumb 显形，不会叠在一起。前提是两层的滚动条都 `scroll-bleed` 到同一片外层留白。
- **`scroll-thin` 里必须带 `scrollbar-gutter: stable`**：不溢出时也留着那 12px。不然内容「刚好放得下」时没有滚动条，上面那套让位就多让了 12px —— 胶囊反而比按钮突出去 12px。顺带消掉内容从「放得下」变「要滚」时右边突然少 12px 的抖动。
- **预设列表一律不套外框**：滚动条用 `scroll-bleed` 推进外层留白，行块左右边缘才和标题行、整宽按钮对齐。动作预设这种多行列表是「每行自己一颗宽胶囊」（`border` + `$bg-inset` + `$radius`），和预设胶囊共用同一套 hover / active 配色 —— 别再给整块套一层 `border`（`ScrollArea` 的 `framed` 变体已因此删掉）。
- **无头 Chrome 不画滚动条**，验证必须 `headless: false`；有头模式又拿不到真实 hover，所以 `:hover` 方案连截图都验不了。
- **预设网格的 `max-height` 必须是「整数排」的高度**：4 排 = 30×4 + 5×3 = **135px**（`PRESET_GRID_MAX_HEIGHT`，五处共用）。多 1px 就会在「正好 4 排」时冒出滚动条，少 1px 就把最后一排切一截；`box-sizing: border-box` 下 `max-height` **含 padding**，带上下内边距的容器（人声 5/5、行距 9）要把 padding 算进去 = 157px，别只算 `4×行高 + 3×行距`。
- **`Segmented` 外层类只能写 `margin`**（`.root` 是 `inline-flex`、`.block` 是 `display: flex; width: 100%`）；去掉可见标签后 `ariaLabel` 是唯一无障碍名称。**四个「切换方式」统一 `.modeSwitch { margin-top: 12px }`**，和上方组件隔 12px。
- **`Tabs` 的选中下划线是 `.tab::after` 且左右都贴 `0`**：标签块从内容区最左开始，下划线必须和它对齐（原来 inset 6px，比下面的文案缩进 6px）。别用 `border` 画 —— 会把 32px 定高再撑出 2px。
- **`Segmented` 的禁用态是整块变灰**（根节点挂 `.disabled { opacity: .5 }`），别再给 `.option:disabled` 也写透明度 —— 两层相乘会灰到看不见。粒子 / 滤镜关掉开关时传 `disabled={!enabled}`；但**预设胶囊不要禁用**，`handleXxxPresetChange` 本来就会顺带 `setEnabled(true)`。
- **上面那个 `Button` 的下外边距必须归零**：`Button` 是 `inline-flex`，它的**外边距盒**会算进行盒高度 —— 按钮留 `margin-bottom: 2px`，下面 Segmented 的实际间距就是 12+2=14（实测过 `margin-top: 8` + `margin-bottom: 2` 渲染成 10px 的坑）。**量间距要量 `getBoundingClientRect()` 的差，别只看 margin**。
- `VoiceSetting` 里「气泡显示」那个 Segmented 是标签 + 控件的组合（`.behaviorRow` 的 `gap: 6px`），不参与上面那条 12px 约定。
- `fr` 分配的是扣掉 `gap` 后的剩余空间，`3fr : 2fr` 恒为 6:4。
- **grid 的 `align-content` 默认 `stretch`**，列表容器（尤其 `flex: 1 1 0`）要显式 `start`。
- 图标路径用 `import.meta.env.BASE_URL`；**别用 `box-shadow` 画小图标**（不占布局盒、父级 `overflow: hidden` 会裁），改用 `radial-gradient`。
- `Input` 步进器只在 `:focus-within` 出现；外壳高度靠给 `input` 写 `display: block`；`addon` 是右侧独立方块，同高、6px 缝。

## 组件层级

- **`Modal` 放 `Drawer` 外层**（40 > 31），抽屉内容区是 `overflow: auto`。
- **`DropdownSelect` 菜单绝对定位、无 portal**，含下拉的区域不能 `overflow: auto`。
- **`Tooltip` 弹层 portal 到 `body`**：`Drawer` 用 `transform: translateX()` 做进场，**带 `transform` 的祖先会成为 `position: fixed` 的包含块** —— 留在原地会按「相对抽屉」定位、整块飘到屏幕外（实测 x 从 1177 跑到 2258）。`.popup` 的字体/颜色显式声明，挪走不掉样式。凡是可能放进抽屉的浮层都得这么处理。
- **`Button` 永不换行、不被压缩**（`nowrap` + `flex-shrink: 0`）。**`Input` 的 `className` 落在内层 `<input>`**，布局要按位置选。
- **`Button` 里文字要省略**：包一层 `<span>` 并给 `min-width: 0`。`.xs` 内边距保持 4px（5 等分栅格会把「Lo-fi」挤成省略号）。
- **`Card` 的 `headerProps` 别用 `.head` 类名**（内部已有）；只挂拖拽 `handlers`，列表区保留滚动与选中文字。
- **「直播配置」抽屉里礼物行的左右要和内容区贴边**（`padding: 5px 0`）：礼物图标对齐上方「礼物单价」文案、行尾按钮对齐底部「完成」按钮。弹幕指令那 12px 内边距是画在 `.list` 的 1px 外框**里面**的，外框本身贴边 —— 别把两者混为一谈，也别用负边距去凑（右边紧挨着 `Tabs` 面板 `scroll-bleed` 出来的滚动条）。
- **舞台浮层一律「组件自己取数」**，容器只摆放和整块拖动。卡片高度靠各自 `.root { min-height: 154px }` 对齐。
- **舞台四块浮层**：概览（左上，560 宽）、弹幕（右上，`top:16 right:16`，z-index 9）、礼物动作（左下，`bottom:46 left:24`）、弹幕指令（右下，`bottom:46 right:24`），后三块都是 268 宽 + `max-height: min(66%, 540px)` + 底色 `#09232bf2`（比 Card 更实，免得两层毛玻璃糊在一起）。开关在 `StageToolbar`，状态在 `App`。**右侧一列上下两块会重叠**（弹幕攒满会盖住指令卡顶部），这是自由摆放的已知取舍。
- **`ChatCommandCard` 的内容从 `CHAT_COMMANDS` 生成**，不手写：按 `[关键字|…]` 归组（标题另走 `FAMILY_LABEL`：外观→角色外观、音色→角色音色、背景→舞台背景、粒子→粒子特效、滤镜→舞台滤镜、音乐→背景音乐 —— 关键字要短是给观众手打的），**模板原样显示、绝不替换**（`$角色名称` 就是留给观众填的位置；替成具体值会让人以为只能发那一个）。**只列开着的指令**，全关时整块 `return null`。
- **`GiftMotionCard` 行结构跟着台上模型数变**：`modelCount === 1` 时礼物名与动作并成一行、不显示角色名。**不能按 `row.targets.length === 1` 判断**。

## 数据与状态

- 持久化统一 `localStorage`，键前缀 `ailive.`；写入放 `useEffect`，updater 保持纯函数。**只存配过的项 / 非默认值**（弹幕指令只存被关掉的），空值删键。
- 「打开抽屉时同步草稿」用 `wasOpenRef` 判上升沿。`LiveDataProvider` 通过 `useLiveServer` 持有唯一一条 SSE；`MIN_REPLY_INTERVAL_MS = 6000`。
- **自定义项 = 内置数组 + 用户数组**（背景 / 音乐 / 滤镜），靠 `id.startsWith('custom:')` 区分可删。
- **胶囊的 hover 和 active 必须是两种颜色**：hover 走中性提亮（`$bg-hover` + `$border-strong` + `$text`），active 才是绿底（`$accent-chip-fill`）。外观预设这种「再点一次取消」的多选组，两者同色就分不清哪个是真选中的。选中项被悬停时由 `.chip.active:hover:not(:disabled)`（比 `.chip:hover:not(:disabled)` 多一个类）保持绿色、只把底色提亮到 `$accent-fill-hover`，否则会看着像刚被取消。
- **`PresetChip` 自带 `Tooltip`**（外层是 block 触发器，所以胶囊要 `width: 100%` 才撑满栅格）。调用点**不要再套一层** `Tooltip`，否则弹两个气泡；`ChipRemove` 上的 `data-tooltip-ignore` 负责让删除角标不弹提示。名字被省略号截断时，提示是看全名的唯一入口。
- **预设胶囊统一 `PresetChip`**（背景 / 滤镜 / 音乐 / 人声 / 粒子 / 外观），`onRemove` 决定有没有角标；角标是 `ChipRemove`：`span + role="button"` 套在 `<button>` 里，要 `stopPropagation`、空格 `preventDefault`、带 `data-tooltip-ignore`，hover 铺 `rgba(255,255,255,.12)` 半透明白。**带角标的胶囊要文字真居中，左侧补 `&::before { flex: 0 0 14px }`**，只写 `text-align: center` 会偏左（代价是长名字更早截断）。`active` 要同步 `aria-pressed`。**外观预设是多选**，同一排可以同时亮好几个。**胶囊里的长文字必须包一层 `.label`** —— `Button` 是 `inline-flex`，直接给它写 `text-overflow` 对匿名 flex 子项无效。
- **小图标里的「×」不要用字符**（基线偏移调不平）：两条 `7px × 1px` 细线 + `grid-area: 1 / 1` + `place-items: center` + ±45°。
- **删「正在用的那一个」必须同时收掉使用方**：背景退回默认底图、滤镜退回「标准」、音乐暂停 + 清 `audioRef` + 退回默认曲目。`blob:` **先停播放再 revoke**。
- **播放/轮播里要读最新列表用 `ref`**（`tracksRef.current = allTracks`），稳定引用的 `useCallback` 闭包拿不到新列表。
- **返回 `Promise<boolean>` 的上下文方法不要顺手设全局 error**，提示交给调用方。
- **试听必须独立播放器**（独立 `audio` + `analyser` + 状态），借用主播放器会让舞台「正在播放」卡片跟着变。`beginPreview` 在 `pause()` 前读 `playing`、挡重复调用；`endPreview(false)` = 已有新曲目、别恢复外面播放；关窗 `stopPreview()` 清干净。
- 礼物目录外的礼物行来源 = `giftPrices` ∪ 本次 `giftTotals` − 内置目录。**`blob:` 不能持久化**，读和写两边都过滤；**交给别处的对象 URL 不能再 revoke**（`committedRef`）。
- **礼物图标 = `public/gifts/<icon>.svg` + `src/data/gifts.ts` 的 `DOUYIN_GIFTS`**（OpenMoji，72×72 + 黑 2px 描边）。目录按**单价升序**排，新礼物插到对应价位，别一律追加到末尾（`GiftMotionCard` 也照这个顺序）。目录外礼物渲染成 `?`，补法 = 下一张图 + 加一条目录。`giftPrice()` 先查用户 `prices` 再落默认值，加目录不会覆盖用户改过的价。
- **挑图标要按实际尺寸（列表里 22px）和已有图标并排比**：只看 64px 大图会选到撞脸的（「你最好看」用带闪光的粉心 = 和「小心心」分不出，改成心形眼笑脸）。
- **「无背景」只控制渲染、不清数据**：`backgroundMode === 'none'` 跳过 `backgroundImage`；点预设 / 添加背景要顺手切回 `fixed`。**胶囊选中态要写 `backgroundMode !== 'none' && backgroundUrl === url`**。
- **背景换图是交叉淡入淡出**：旧图保持 `opacity: 1` 垫底、新图 0→1（两层同时淡会透底色、像闪）。新图先 `new Image()` 预载；旧层用 `setTimeout` 卸载（动画被关掉时 `animationend` 不会来），`BACKGROUND_FADE_MS` 与 `$background-fade` 手动对齐。
- **「固定 / 循环 / 随机」四处共用 `PresetRotateMode`**（`StageProvider/presets.ts`，间隔 `PRESET_ROTATE_INTERVAL_MS = 12000`）。`pickNextIndex` 的随机分支偏移取 `[1, length-1]` —— `Math.random() * length` 有 1/n 概率连着同一个，看着像没切换。
- **自动切换的 effect 依赖里带当前预设**（换完重跑、计时重置，手动点也不会「刚点完就被换走」）；配套要求 `handleXxxPresetChange` 必须 `useCallback`，每次渲染换新函数会让计时器永远重启。**关掉粒子 / 滤镜时要暂停**（`!enabled` 直接 return），否则重新打开会看到一个没选过的效果。
- **粒子和滤镜的胶囊都写 `active={enabled && preset === id}`**：关掉整排都该灭（两处已统一，别只给粒子加 `enabled &&`）。
- **开关只管「渲染与否」，不许顺手改选中项**：`filterEnabled` 关掉时 `filterPreset` 和那套参数原样留着，重新打开要回到关掉前的样子 —— 旧代码在 `onEnabledChange` 里 `handleFilterPresetChange('standard')`，一关一开用户选的滤镜就没了。**只有选中项已经指不到东西（自定义滤镜被删）才退回「标准」**；删预设时也**只退参数和选中项、不动开关**（关着的时候删一个不能自己弹回开启）。

## 触发动作（Live2D）

- 礼物动作**按模型分别配**（`giftMotions: Record<礼物, Record<模型 id, 动作名>>`），到达时遍历 `modelSources` 逐个 `updateCharacter`；旧格式靠 `GIFT_MOTION_ANY_MODEL = '*'` 兜底。
- **`activeMotion` 只归用户所有**（`ModelControlPanel` 里点的那一下），它同时是列表选中态、说话触发动作和舞台字幕。礼物等外部触发走 `overrideMotion` + `overrideNonce`（一次性、不回写选中）—— 否则送一次礼物就把用户选的预设顶掉。`Live2D` 里三档优先级：换预设 > 一次性动作 > 开口重播预设，必须是同一条 `else` 链。
- 礼物动作走**队列**：`queuedGiftIdRef` 记最大已入队 id（`feed` 变空 = 重连，归零），`giftTick` 推进，播放窗口用 `setTimeout`。**窗口定时器绝不能放 effect 的 cleanup**，否则队列卡死。
- 礼物动作**优先级高于说话**：`motionHoldUntil` 用时间戳（布尔没人清会永久锁死）。**坑**：`applyModelProps` 里先赋值后判断，守卫必须读 `next.motionHoldUntil`。
- 弹幕驱动的 effect 依赖要带 `characterStates`（模型比礼物晚到约 2.8s），并用 `ref` 防重放。多模型 manifest 并行加载：`pendingModelsRef` 记没就绪的，重跑时只补这几个。
- **说话触发动作 = 动作预设里选中的那一项**，没有独立的 `speakingMotion` / `speakMotion` 字段（都删了）：`applyModelProps` 里「开始说话」直接用 `next.motion` 重播一次，且必须是 `else if` —— 切预设和开口撞在同一帧时 `if` 分支已经播过，再调一次会把动作从头重启。
- `LiveFeedItem['id']` 是 `number`。舞台字幕反映的就是 `activeMotion`，说话时重播同一个动作，所以字幕不用额外标注「说话中」；**礼物动作不会改它**。

## 弹幕指令

- 格式 `[关键字|限定词…]内容`。元数据 + 解析在 `src/data/chatCommands.ts`，执行在 `src/hooks/useChatCommand`，排队发声在 `AiChatProvider`。
- **动作立刻执行，反馈进 AI 队列**。优先级 `gift 30 > member 20 > command 15 > chat 10`，共用 `MIN_REPLY_INTERVAL_MS`。绕开弹幕冷却与「同内容只答一次」，但有 `COMMAND_USER_COOLDOWN_MS = 3000` 的每人节流，**动作和反馈一起挡**。
- **不依赖 `autoReply` 开关**：`pickNext(allowAi)` 在 `!autoActive` 时只挑 command，没配 Key 也能用；被关掉的指令当普通弹幕交给 AI。
- 模型指令由**点名角色**说（`speakerFor`），舞台指令走 `nextSpeaker()` 轮转。反馈文案是执行结果本身，**不经过 LLM**，失败也要说「没有找到…」。
- **切换方式也做成指令**：`[粒子|固定 / 循环切换 / 随机切换]`、`[滤镜|…]`（共 6 条，模板写成无变量的 `[粒子|固定]`）。执行时**顺带打开对应开关**，否则关着的时候设了模式什么也看不见。
- **已知不一致（未修）**：`parseChatCommand` 注释里「`[背景|电影]` 和 `[背景]电影` 两种写法都收」是假的 —— 名字放在 `|` 后面时 `payload` 为空、直接 `return null`。实测 `[背景|电影]` 不动、`[背景]赛博` 正常。
- 配置面板每条模板下面列「现在能填哪些名字」。**模板里的变量一律以「名称」结尾**（`$角色名称` / `$外观名称` / `$音色名称` / `$背景名称` / `$特效名称` / `$滤镜名称` / `$音乐名称`），和示例行的真实值 `[外观|DS 鲸鱼娘]love` 一眼分开；**模板不做任何替换**，示例行才用真实值。
- **提示只列「台上看得见的模型」**（`modelVisible !== false`）；**外观 / 外观清除两条再筛掉没有外观的模型**（`manifest.expressions` 为空），清空后返回空数组，渲染端用 `hint.length > 0` 兜住。**音色不筛外观**。
- **提示行是结构化的**：`HintLine = { label, value }[]`，一段一个「标签 + 内容」，标签 `$text-faint` / 内容 `$text-soft` —— 一行能填好几个名字，同色看不出哪段是键。**段间只留间距不加分隔符**（`.optionPart + .optionPart { margin-left: 10px }`）。
- **`Tooltip` 的 `title` 是 `ReactNode` 不是 `string`**（分色、分段只能靠节点）；传字符串的老调用方不受影响。**多行用 `.tipLine + .tipLine { border-top }` 隔开**（多个角色 = 多行），两处复用同一组 `.optionPart / .optionLabel / .optionValue`（CSS Module 类名是全局的，portal 出去也不掉样式）。
- **标题行里的说明图标**（「动作预设 ⓘ」）：内联 SVG（`currentColor` + `aria-hidden`，别用字符 `ⓘ`，基线会飘）+ `.labelWithHint { inline-flex; align-items: center; gap: 4px }` 兜住垂直居中；图标加 `role="img"` + `aria-label` + **`tabIndex={0}`**，否则 `<span>` 收不到 `onFocus`、键盘用户看不到提示。平时 `$text-faint`、hover / `:focus-visible` 提到 `$text-muted`，`cursor: help`。

## 构建与验证

- `tsc -b` 必须 `--force`；`vite build` 前先 `mv dist /tmp/...`（沙箱 safe-delete）。
- **沙箱里 `cdn.jsdelivr.net` 被 SSL 拦（`schannel: failed to receive handshake`），但 `raw.githubusercontent.com` 通** —— 要素材（OpenMoji 等）直接 `curl https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg/<CODE>.svg`。
- Playwright 在 `C:\Users\Lenovo\AppData\Local\Temp\pwcheck`，`channel: 'chrome'`，`--use-gl=angle --use-angle=swiftshader`，访问 `http://localhost:5173/`。重负载页面约 17fps，用页面内采样器。
- **CSS 模块类名会哈希化**，别用 `[class*="..."]`，改用 `aria-label` / `role` / `data-*`。**`Segmented` 是 `radiogroup` + `radio`**（`aria-checked`）；**`Modal` 是 `<section role="dialog">`**，标题用 `h2`；**`Switch` 是原生 `<input type="checkbox" role="switch">`**，`aria-checked` 属性不存在，用 `getByRole('switch').isChecked()`。
- 应用挂载约 2.8s。mock 直播流：`page.addInitScript` 替换 `window.EventSource` 并暴露 `__push`，feed 每 400ms flush，推完等 600ms。
- **验 Live2D 真被调了哪个动作**：拿 `performance.getEntriesByType('resource')` 里 `pixi-live2d-display` 那条**带 `?v=` 的完整 URL** 去 `page.evaluate` 里 `import()`，得到同一个模块实例，改 `Live2DModel.prototype.motion` 记参数即可。
- **没配 Key 也能驱动「说话」**：`addInitScript` 种 `ailive.volcengine-tts-config`（假 apiKey），`page.route('**/volcengine-tts')` 回一行 `{code:20000000, data:<base64>}` 的 NDJSON。`useTts` 在 `await audio.play()` 之前就 `setSpeakingModel()`，blob 解不出音频（控制台报 "no supported source"）也足够让 `speaking` 翻一次 true。
- **抽屉 `scrollable={false}` 时内容要自己撑满高度**：`Tabs` 的 `.root` 是 `height: 100%`、`.panel` 自己滚。
- **读「哪个胶囊被选中」用 `aria-pressed`**（`PresetChip` 同步的），别只看背景色 —— 悬停那一颗也有提亮背景。要读颜色就先 `page.mouse.move(2, 2)` 并等 200ms 以上。
