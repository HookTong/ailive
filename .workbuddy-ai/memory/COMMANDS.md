# 弹幕指令 & 自然语言控制

配套 `src/data/actions.ts`（动作表，唯一真相）、`hooks/useChatCommand`（执行）、`hooks/useActionRouter`（自然语言路由）、`components/ChatCommandSetting`（配置面板）、`components/ChatCommandCard`（舞台速查卡）。

## 格式与真相源

- 格式 `[固定值|固定值]变量>变量` —— **方括号里全是固定值（一字不差），方括号外面全是变量（走模糊匹配）**。`ParsedAction = { id, fixed, vars }`。
- 动作表 `ACTIONS`（由 `ACTION_SPECS.map(spec => ({...spec, template: buildTemplate(spec)}))` 生成）：字段 `match` / `tool` / `params` / `scope` / `label` / `description` / `group?`。**新增动作只往表里加一条**，解析器、面板、LLM 工具表、执行器全部自动跟随。
- **解析器不手写 switch**：`match` 只有 `keyword` + `qualifier`（方括号第 2 段），逐条比「段数 + 每段字 + 变量个数 = `params.length`」，每条动作入口唯一。
- **形状严格照模板**：`[背景]电影` ✓、`[背景|电影]` ✗、`[外观|鲸鱼]清除` ✗、`[外观]鲸鱼` ✗。

## 匹配

- **只有 `$` 变量走模糊匹配**（`utils/matchName`）：NFKC + 去空白/标点 + 小写；相等 1 / 子串 `0.6+0.4×短/长` / 编辑距离≤1 且不短于 3 字 / 阈值 0.6；**两字名字错一个就认不出**。
- **固定值一字不差**：`parseAction` 只精确比；写进变量槽时 `findFixedAction` 报模板、`closestFixedValue` 报近似。

## 执行与播报

- **动作立刻执行、反馈进队列**；优先级 `gift30 > member20 > command15 > chat10`，共用节流；`COMMAND_USER_COOLDOWN_MS = 3000` 每人节流（动作和反馈一起挡）。
- 不依赖 `autoReply`：`!autoActive` 时 `pickNext` 只挑 command。
- 模型指令由点名角色说（`speakerFor`），舞台指令轮转（`nextSpeaker`）；反馈是执行结果本身、不经 LLM。**失败播报就一句话**：不列可选值、**不写角色名**（`modelId` 已指定谁来说），实测 16 字左右。
- `play` / `pause` 这类**幂等**动作：已经处在目标状态时照实说（「音乐正在播放」），别硬报「已开始播放」。

## 拦截顺序（feed 循环）

1. `looksLikeCommand`（`[…]` 且方括号第 1 段是认识的 keyword）→ 只走指令，**不管匹配成败都 `continue`**（形状不对、指令被关掉、在冷却里都如此），不交给自然语言控制也不当普通弹幕；`[doge]` 这种关键字不认识的表情包照常聊天。
2. `parseAiControl`（`[AI控制]` 前缀）→ **只有这种写法才送模型理解**；剥掉前缀再入队，空内容整条忽略，写了前缀但关掉 / 冷却中也 `continue`，不落普通回复。
3. 否则自动回复 —— 没写前缀的弹幕**永远不会**触发 AI 理解。

## 配置面板

- **按操作区域分组**（`buildPanelGroups`，区域 = `match.keyword`）：外观 2 / 音色 1 / 背景 3 / 特效 3 / 滤镜 3 / 音乐 3，**不按控制台切**；组头 = 区域名 + 小字控制台（决定谁来说）+ `已启用 N / M`。
- 每行两句：`label` → 模板（等宽主色、不铺底；可用名字挂 Tooltip，虚线下划线）。**标题右边不挂说明**，`description` 只留给 LLM 的 tool 描述。变量以「名称」结尾、**模板生成不手写、显示不替换**，示例行才用真实值。
- **组内合成一行**：`ActionMeta.group` + `ACTION_GROUPS`，相邻同组并成一条模板、共用一个开关（`every` 判开、`forEach` 一起切）。两种组：`*Mode` 是几种互斥轮换（固定 / 循环 / 随机），`*Power` 是同一件事的两头（**开启 / 关闭**，id `backgroundOn`/`Off`、`particleOn`/`Off`、`filterOn`/`Off`；音乐是 `musicPlayback` → **播放 / 暂停**，`play_music`/`pause_music`）。合并串由 `modeGroupTemplate` 拼、面板与速查卡共用。面板 27 条 → **15 行**；速查卡 15 个 Tag。
- **限定词和控制台控件一字不差**：背景 / 特效 / 滤镜两字（`固定` / `循环` / `随机` / `开启` / `关闭`），音乐四字（`单曲循环` / `列表循环` / `随机播放`）—— 「单曲」「列表」离了「循环」说不清是什么。`循环切换` / `随机切换` 不认（指令写法解析不出 → 被 `looksLikeCommand` 吞掉，不播报）。改文案要三处一起：`qualifier`、`PRESET_ROTATE_OPTIONS` / `MUSIC_LOOP_OPTIONS`、播报里引号中的模式名。
- 提示只列可见模型（`modelVisible !== false`）；外观再筛有 `expressions` 的。`HintLine = {label, value}[]`，段间只留间距。`HintIcon` 统一（内联 SVG + `role="img"` + `tabIndex={0}` + `$text-faint`→hover `$text-muted`）；面板里 `placement="right"`。

## 自然语言控制

- **只有 `[AI控制]换个赛博背景` 这种写法才请求 AI 理解**（`parseAiControl`，正则 `^\[\s*AI\s*控制\s*\]` 忽略大小写和空格）。没写前缀的弹幕一律当普通聊天 —— 理解单次要重发一整张工具表 + 状态快照，不该为每条闲聊都付一遍。前缀不是动作、不进 `ACTIONS`。
- 链路：`useActionRouter` 把**剥掉前缀后的那句话** + **状态快照** + **按启用项生成的工具表**（`buildActionTools`）发给模型，`tool_calls` 转 `ParsedAction`，交给同一个 `useChatCommand` 执行 —— 模糊匹配、失败播报全部复用。
- 开关 `AiChatSettings.nlControl`（默认 true，AI 配置抽屉），**和 `autoReply` 独立**。工具参数**不放 enum**；**关掉的动作根本不进工具表**，也不进状态快照（`can(...)` 按族裁剪），执行前还要按 `chatCommands` 再挡一次（60s 缓存期间可能关掉）。
- 路由队列**串行**：上限 4 条，超了当普通弹幕；同文本 60s 缓存；失败 30s 退避；每人 3s 冷却用 `route:` 前缀，**和 `command:` 额度分开**。一句话最多 3 个动作，反馈合成一句（`；` 连接），`modelId` 取第一个非空。
- `MIN_ROUTE_INTERVAL_MS = 2000`：全局最小间隔，只有真打接口才占名额（命中缓存的不算）。**别按「总弹幕密度」做刷屏判定** —— 试过一版按 10s/25 条停用，加了前缀之后反而会误伤：忙房间里少数几条 `[AI控制]` 会被无差别挡掉。
- 单次理解固定开销 ≈ 2450 token（实测请求体 6281 字符）：27 个工具定义 ≈1740 + 状态快照 ≈500 + 系统提示 ≈170，**和弹幕长短无关**；普通回复稳态 ≈660 token（首条 ≈160），所以理解单次约是回复的 3.7 倍。砍工具表最省钱：只开背景+音乐 12 个 → 708 token，只开背景 6 个 → 366 token。
- 系统提示第一行要写清能做什么（换背景 / 特效 / 滤镜 / 音乐、播放或暂停音乐、换角色外观或音色、清除外观）。
- `useAiChat/api.ts` 的 `postChatCompletions` 是回复和路由共用的请求层（代理 / 错误信封 / 鉴权只写一处），路由 `temperature 0.1`。
