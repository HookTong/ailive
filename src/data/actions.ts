/**
 * 控制台动作表 —— 观众 / AI 能远程触发的每一个动作，只在这里声明一次。
 *
 * 三处都从这张表生成，别再各写一份：
 * - 弹幕解析（`match` + `params`）：`[固定值|固定值]变量>变量` 怎么拆
 * - 直播配置里的开关列表（`id` / `scope` / `template` / `description`）
 * - AI 工具调用（`tool` / `label` / `params`）：自然语言路由下一步接的就是它
 *
 * 指令的形状只有一条规则：**方括号里全是固定值，方括号外面全是变量**。
 * `[外观|清除]$角色名称` —— `外观`、`清除` 一字不差，`$角色名称` 随便填（见 `parseAction`）。
 *
 * 这里只描述「有哪些动作、参数长什么样」，真正改状态的是 hooks/useChatCommand。
 */

import { findClosestMatch } from '../utils/matchName'

export type ActionId =
  | 'expression'
  | 'expressionClear'
  | 'voice'
  | 'background'
  | 'backgroundFixed'
  | 'backgroundCycle'
  | 'backgroundRandom'
  | 'backgroundOn'
  | 'backgroundOff'
  | 'particle'
  | 'particleFixed'
  | 'particleCycle'
  | 'particleRandom'
  | 'particleOn'
  | 'particleOff'
  | 'filter'
  | 'filterFixed'
  | 'filterCycle'
  | 'filterRandom'
  | 'filterOn'
  | 'filterOff'
  | 'music'
  | 'musicSingle'
  | 'musicList'
  | 'musicShuffle'
  | 'musicPlay'
  | 'musicPause'

/** 动作属于哪一侧的控制台：决定「谁来说这句反馈」 */
export type ActionScope = 'model' | 'stage'

/** 参数取值从哪份运行时数据来 —— 执行前用它把名字换成真实对象 */
export type ActionParamSource =
  | 'models'
  | 'expressions'
  | 'voices'
  | 'backgrounds'
  | 'particles'
  | 'filters'
  | 'tracks'

/**
 * 一个参数的声明。**顺序就是模板里变量的顺序**（先角色、再外观 / 音色），
 * 模板和 tool schema 都从它生成，执行器也按这个顺序从 `ParsedAction.vars` 里取。
 */
export type ActionParamSpec = {
  /** 参数名（英文，给 tool schema 用） */
  name: string
  /** 中文名，写进 tool 描述，并拼成模板里的 `$xxx名称` */
  label: string
  type: 'model' | 'preset' | 'enum' | 'number' | 'boolean'
  /** 取值来源；enum 用 values 直接给 */
  source?: ActionParamSource
  values?: readonly string[]
  min?: number
  max?: number
  required?: boolean
}

/**
 * 方括号里的**固定值**。解析器按它一字不差地比对；方括号外的变量由 `params` 描述。
 *
 * - `keyword`：第 1 段，也是唯一的入口关键字
 * - `qualifier`：第 2 段（`[背景|固定]` / `[外观|清除]`）；不填就表示方括号里只有关键字
 *
 * 段数必须和这里一致：`[背景|电影]` 不是 `[背景]电影`，多一段少一段都不算指令。
 */
export type ActionMatch = {
  keyword: string
  qualifier?: string
}

export type ActionMeta = {
  id: ActionId
  scope: ActionScope
  /** 工具调用名（英文，给 LLM） */
  tool: string
  /** 动作名，用于日志与 tool 描述 */
  label: string
  /**
   * 展示用的指令模板，**由 `match` + `params` 生成、不手写**（见 `buildTemplate`），
   * 原样显示、不做替换 —— 方括号里的固定值照抄，`$xxx名称` 是留给观众填的地方。
   */
  template: string
  /**
   * 一句话说明这条指令做什么。界面上紧跟在 `label` 后面显示，
   * 所以**别重复 label 里的动词** —— 「切换背景 · 切换舞台背景」读起来像结巴。
   */
  description: string
  params: readonly ActionParamSpec[]
  match: ActionMatch
  /**
   * 同一功能的几条指令在配置面板上**合成一行、共用一个开关**。
   *
   * 两种收法：`*Mode` 是几种互斥的轮换方式（固定 / 循环 / 随机），
   * `*Power` 是同一个开关的两头（开启 / 关闭）。拆成一行一条会让人以为能同时开两个。
   */
  group?: ActionGroupId
}

/**
 * 组的 id，决定面板上哪些动作并成一行、速查卡上哪些并成一条斜杠写法。
 *
 * - `*Mode`：同一功能的几种互斥轮换方式（`[背景|固定]` / `[背景|循环]` / `[背景|随机]`）
 * - `*Power` / `musicPlayback`：同一件事的两头（`[背景|开启]` / `[背景|关闭]`、
 *   `[音乐|播放]` / `[音乐|暂停]`）
 */
export type ActionGroupId =
  | 'backgroundMode'
  | 'backgroundPower'
  | 'particleMode'
  | 'particlePower'
  | 'filterMode'
  | 'filterPower'
  | 'musicMode'
  | 'musicPlayback'

/** 组在面板上的标题（组员各自的 label / description 仍然给 LLM 用） */
export const ACTION_GROUPS: Record<ActionGroupId, string> = {
  backgroundMode: '背景模式',
  backgroundPower: '背景开关',
  particleMode: '特效模式',
  particlePower: '特效开关',
  filterMode: '滤镜模式',
  filterPower: '滤镜开关',
  musicMode: '音乐模式',
  musicPlayback: '音乐播放',
}

/**
 * 同一组的合并写法：`[背景|固定/循环/随机]`、`[背景|开启/关闭]`。
 *
 * 组里几条共用一行、一个开关，展示时也并成一条 —— 四条并排摆着既占地方，
 * 又像是四条互不相干的指令。斜杠表示**任选一个**填进去。
 *
 * 注意这串**不是能直接发的指令**：解析器只认单个限定词（`[背景|循环]`），
 * 它只是这一组的摘要。配置面板和舞台速查卡都用它，别各拼一份。
 */
export function modeGroupTemplate(actions: readonly ActionMeta[]): string {
  const keyword = actions[0]?.match.keyword ?? ''
  return `[${keyword}|${actions.map((action) => action.match.qualifier ?? '').join('/')}]`
}

const MODEL_PARAM: ActionParamSpec = {
  name: 'model', label: '角色', type: 'model', source: 'models', required: true,
}

const NAME_ONLY: readonly ActionParamSpec[] = []

/** 表里手写的部分：模板由 `match` + `params` 生成，别再手写一份 */
type ActionSpec = Omit<ActionMeta, 'template'>

/**
 * 模板 = `[固定值|固定值]` + 方括号外面的变量，多个变量之间用 `>` 隔开。
 *
 * 生成而不是手写：模板是解析器唯一的说明书，两边分开写迟早会漂 ——
 * 改了 `qualifier` 却忘了改模板，观众照着面板发出去就是「没反应」。
 */
function buildTemplate(spec: ActionSpec): string {
  const fixed = spec.match.qualifier
    ? `${spec.match.keyword}|${spec.match.qualifier}`
    : spec.match.keyword
  // 变量一律以「名称」结尾（`$角色名称`），读起来就知道该填个名字而不是开关
  const vars = spec.params.map((param) => `$${param.label}名称`).join('>')
  return `[${fixed}]${vars}`
}

/**
 * 全部动作。顺序就是界面里的顺序：
 * 先角色控制台（外观 → 音色），再舞台控制台（背景 → 特效 → 滤镜 → 音乐）。
 *
 * 解析时按「方括号里的固定值一字不差、外面变量的个数对上 `params`」来找，
 * 每条动作的入口唯一，所以这里的顺序只影响展示。
 */
const ACTION_SPECS: readonly ActionSpec[] = [
  {
    id: 'expression',
    scope: 'model',
    tool: 'set_expression',
    label: '外观装饰',
    description: '选中 / 反选该角色的某个外观预设',
    params: [
      MODEL_PARAM,
      { name: 'expression', label: '外观', type: 'preset', source: 'expressions', required: true },
    ],
    match: { keyword: '外观' },
  },
  {
    id: 'expressionClear',
    scope: 'model',
    tool: 'clear_expressions',
    label: '外观清除',
    description: '清空该角色身上的全部外观',
    params: [MODEL_PARAM],
    match: { keyword: '外观', qualifier: '清除' },
  },
  {
    id: 'voice',
    scope: 'model',
    tool: 'set_voice',
    label: '音色切换',
    description: '换成指定音色，下一句就生效',
    params: [
      MODEL_PARAM,
      { name: 'voice', label: '音色', type: 'preset', source: 'voices', required: true },
    ],
    match: { keyword: '音色' },
  },
  {
    id: 'background',
    scope: 'stage',
    tool: 'set_background',
    label: '背景切换',
    description: '切到指定背景，并回到固定显示',
    params: [{ name: 'background', label: '背景', type: 'preset', source: 'backgrounds', required: true }],
    match: { keyword: '背景' },
  },
  {
    id: 'backgroundFixed',
    scope: 'stage',
    tool: 'pin_background',
    label: '固定背景',
    description: '停在选中的那一张，不自动轮换',
    params: NAME_ONLY,
    match: { keyword: '背景', qualifier: '固定' },
    group: 'backgroundMode',
  },
  {
    id: 'backgroundCycle',
    scope: 'stage',
    tool: 'cycle_backgrounds',
    label: '背景循环切换',
    description: '按预设顺序自动轮播',
    params: NAME_ONLY,
    match: { keyword: '背景', qualifier: '循环' },
    group: 'backgroundMode',
  },
  {
    id: 'backgroundRandom',
    scope: 'stage',
    tool: 'randomize_backgrounds',
    label: '背景随机切换',
    description: '每次随机换一张',
    params: NAME_ONLY,
    match: { keyword: '背景', qualifier: '随机' },
    group: 'backgroundMode',
  },
  {
    id: 'backgroundOn',
    scope: 'stage',
    tool: 'show_background',
    label: '开启背景',
    description: '重新铺上图，回到关闭前的切换方式',
    params: NAME_ONLY,
    // 和下面那条是同一个开关的两头，面板上一行、一个开关。
    // 别并进「固定 / 循环 / 随机」：那三种管「怎么换图」，这两条只管「铺不铺图」
    match: { keyword: '背景', qualifier: '开启' },
    group: 'backgroundPower',
  },
  {
    id: 'backgroundOff',
    scope: 'stage',
    tool: 'hide_background',
    label: '关闭背景',
    description: '只留特效与滤镜，画面不铺图',
    params: NAME_ONLY,
    match: { keyword: '背景', qualifier: '关闭' },
    group: 'backgroundPower',
  },
  {
    id: 'particle',
    scope: 'stage',
    tool: 'set_particle',
    label: '特效切换',
    description: '顺带打开粒子开关',
    params: [{ name: 'particle', label: '特效', type: 'preset', source: 'particles', required: true }],
    match: { keyword: '特效' },
  },
  {
    id: 'particleFixed',
    scope: 'stage',
    tool: 'pin_particles',
    label: '固定粒子特效',
    description: '停在选中的那一个，不自动轮换',
    params: NAME_ONLY,
    match: { keyword: '特效', qualifier: '固定' },
    group: 'particleMode',
  },
  {
    id: 'particleCycle',
    scope: 'stage',
    tool: 'cycle_particles',
    label: '粒子循环切换',
    description: '按预设顺序自动轮播',
    params: NAME_ONLY,
    match: { keyword: '特效', qualifier: '循环' },
    group: 'particleMode',
  },
  {
    id: 'particleRandom',
    scope: 'stage',
    tool: 'randomize_particles',
    label: '粒子随机切换',
    description: '每次随机换一个',
    params: NAME_ONLY,
    match: { keyword: '特效', qualifier: '随机' },
    group: 'particleMode',
  },
  {
    id: 'particleOn',
    scope: 'stage',
    tool: 'show_particles',
    label: '开启特效',
    description: '重新渲染粒子，预设和参数都留着',
    params: NAME_ONLY,
    match: { keyword: '特效', qualifier: '开启' },
    group: 'particlePower',
  },
  {
    id: 'particleOff',
    scope: 'stage',
    tool: 'hide_particles',
    label: '关闭特效',
    description: '关掉粒子，只留背景与滤镜',
    params: NAME_ONLY,
    match: { keyword: '特效', qualifier: '关闭' },
    group: 'particlePower',
  },
  {
    id: 'filter',
    scope: 'stage',
    tool: 'set_filter',
    label: '滤镜切换',
    description: '调色、模糊、暗角',
    params: [{ name: 'filter', label: '滤镜', type: 'preset', source: 'filters', required: true }],
    match: { keyword: '滤镜' },
  },
  {
    id: 'filterFixed',
    scope: 'stage',
    tool: 'pin_filters',
    label: '固定滤镜',
    description: '停在选中的那一个，不自动轮换',
    params: NAME_ONLY,
    match: { keyword: '滤镜', qualifier: '固定' },
    group: 'filterMode',
  },
  {
    id: 'filterCycle',
    scope: 'stage',
    tool: 'cycle_filters',
    label: '滤镜循环切换',
    description: '按预设顺序自动轮播',
    params: NAME_ONLY,
    match: { keyword: '滤镜', qualifier: '循环' },
    group: 'filterMode',
  },
  {
    id: 'filterRandom',
    scope: 'stage',
    tool: 'randomize_filters',
    label: '滤镜随机切换',
    description: '每次随机换一个',
    params: NAME_ONLY,
    match: { keyword: '滤镜', qualifier: '随机' },
    group: 'filterMode',
  },
  {
    id: 'filterOn',
    scope: 'stage',
    tool: 'show_filter',
    label: '开启滤镜',
    description: '重新上色，回到关闭前选的那一项',
    params: NAME_ONLY,
    match: { keyword: '滤镜', qualifier: '开启' },
    group: 'filterPower',
  },
  {
    id: 'filterOff',
    scope: 'stage',
    tool: 'hide_filter',
    label: '关闭滤镜',
    description: '关掉滤镜，画面回到原色',
    params: NAME_ONLY,
    match: { keyword: '滤镜', qualifier: '关闭' },
    group: 'filterPower',
  },
  {
    id: 'music',
    scope: 'stage',
    tool: 'play_track',
    label: '音乐切换',
    description: '换一首歌，从开头播放',
    params: [{ name: 'track', label: '音乐', type: 'preset', source: 'tracks', required: true }],
    match: { keyword: '音乐' },
  },
  {
    id: 'musicSingle',
    scope: 'stage',
    tool: 'loop_single_track',
    label: '单曲循环',
    description: '这首放完从头再来',
    params: NAME_ONLY,
    match: { keyword: '音乐', qualifier: '单曲循环' },
    group: 'musicMode',
  },
  {
    id: 'musicList',
    scope: 'stage',
    tool: 'loop_track_list',
    label: '列表循环',
    description: '放完接列表里的下一首',
    params: NAME_ONLY,
    match: { keyword: '音乐', qualifier: '列表循环' },
    group: 'musicMode',
  },
  {
    id: 'musicShuffle',
    scope: 'stage',
    tool: 'shuffle_tracks',
    label: '随机播放',
    description: '放完随机挑一首',
    params: NAME_ONLY,
    match: { keyword: '音乐', qualifier: '随机播放' },
    group: 'musicMode',
  },
  {
    id: 'musicPlay',
    scope: 'stage',
    tool: 'play_music',
    label: '播放音乐',
    description: '从暂停处接着放；没在放就从头起',
    params: NAME_ONLY,
    // 和下面那条是同一件事的两头（放 / 停），面板一行、一个开关。
    // 和「切换」分开：那两条管放什么、怎么放，这两条只管放不放
    match: { keyword: '音乐', qualifier: '播放' },
    group: 'musicPlayback',
  },
  {
    id: 'musicPause',
    scope: 'stage',
    tool: 'pause_music',
    label: '暂停音乐',
    description: '停下当前播放，进度留着',
    params: NAME_ONLY,
    match: { keyword: '音乐', qualifier: '暂停' },
    group: 'musicPlayback',
  },
]

export const ACTIONS: readonly ActionMeta[] = ACTION_SPECS.map((spec) => ({
  ...spec,
  template: buildTemplate(spec),
}))

/** 每个动作的启用开关：缺省（没出现）视为启用 */
export type ActionSwitches = Record<ActionId, boolean>

/** 默认全部启用 —— 指令是可选功能，但默认打开才「开箱能用」 */
export function createDefaultActionSwitches(): ActionSwitches {
  return Object.fromEntries(ACTIONS.map((action) => [action.id, true])) as ActionSwitches
}

/**
 * 解析后的一句话：动作 id、方括号里的固定值、方括号外面的变量。
 *
 * `fixed` 是观众原样写进来的（已 trim），第 0 段是关键字；
 * `vars` 按 `params` 的顺序填，长度一定等于 `params.length` —— 对不上就不算这条动作。
 */
export type ParsedAction = {
  id: ActionId
  fixed: string[]
  vars: string[]
}

/**
 * 同一个关键字下的全部固定写法（方括号第 2 段）。
 *
 * 这些是「确定的值」：`固定` / `循环` / `随机` / `开启` / `关闭` / `播放` / `暂停` / `清除` / `单曲循环`……
 * 必须一字不差，**不参与模糊匹配** —— 模糊只留给方括号外面带 `$` 的变量。
 *
 * 写法**和舞台控制台那排分段控件、开关一字不差**：面板上写「循环」，指令就是 `[背景|循环]`；
 * 音乐那组写「单曲循环」，指令就是 `[音乐|单曲循环]`。观众照着控制台和速查卡念，
 * 两边差一个字就会念错。长度不强行统一（背景那组两字、音乐那组四字），照各自控件的实际文案走。
 */
export function fixedValuesOf(keyword: string): string[] {
  const values = new Set<string>()
  for (const action of ACTIONS) {
    if (action.match.keyword !== keyword) continue
    if (action.match.qualifier) values.add(action.match.qualifier)
  }
  return [...values]
}

/**
 * 观众把固定值写成了变量（`[背景]固定的`）时，猜他本来想写哪个固定值。
 *
 * 只用来**报错**，不用来执行 —— 固定值一旦允许「差不多就行」，`固定` 和 `固定式`
 * 就分不清了，而这俩一个改模式、一个根本不是指令。
 */
export function closestFixedValue(keyword: string, value: string): string | undefined {
  return findClosestMatch(value, fixedValuesOf(keyword), (item) => item)
}

/** 这一族里固定值**一字不差**等于 `value` 的那条动作 */
export function findFixedAction(keyword: string, value: string): ActionMeta | undefined {
  return ACTIONS.find((action) => action.match.keyword === keyword && action.match.qualifier === value)
}

/**
 * 这条弹幕算不算「指令写法」：以 `[` 开头、写出了 `]`，而且方括号第 1 段是认识的指令关键字。
 *
 * 用来把「写歪了的指令」和「闲聊」分开。写歪了（`[背景|电影]`、`[背景|固定/循环]` 这种把
 * 整串摘要发出来的、旧的三段式）既不该交给自然语言控制，也不该当普通弹幕回一句 ——
 * 观众明明在发指令，却收到一段聊天的回复，只会以为指令坏了。
 *
 * 关键字必须认识才拦得住：`[doge]`、`[笑死]` 这类表情包弹幕和「写歪的指令」在字面上
 * 分不出来，只能靠第 1 段认不认识来判 —— 不认识就照常聊天。
 */
export function looksLikeCommand(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('[')) return false
  const close = trimmed.indexOf(']')
  if (close < 0) return false
  const keyword = trimmed.slice(1, close).split('|')[0].trim()
  return ACTIONS.some((action) => action.match.keyword === keyword)
}

/**
 * 自然语言控制的触发前缀。**只有 `[AI控制]换个赛博背景` 这种写法才会送给模型理解** ——
 * 没写前缀的弹幕一律当普通聊天，不再为每条闲聊付一次「工具表 + 状态快照」。
 *
 * 前缀本身**不是动作**，不进 `ACTIONS`：它没有可执行的东西，只是告诉程序
 * 「这句话请你理解一下」。所以 `looksLikeCommand` 认不出它（关键字表里没有），
 * 两边不会打架。
 */
// 括号内允许空格、AI 大小写随意：观众手打容易多打个空格，不该因此静默失效
const AI_CONTROL_RE = /^\[\s*AI\s*控制\s*\]/i

/**
 * 取出 `[AI控制]` 后面的自然语言。
 * 不是这个前缀返回 `null`；只写了前缀、后面什么都没有则返回空串（调用方据此整条忽略）。
 */
export function parseAiControl(text: string): string | null {
  const trimmed = text.trim()
  const matched = AI_CONTROL_RE.exec(trimmed)
  if (!matched) return null
  return trimmed.slice(matched[0].length).trim()
}

/**
 * 把一条弹幕解析成动作。形状只有一条规则：**方括号里全是固定值，方括号外面全是变量**。
 *
 * `[外观|清除]$角色名称` —— 方括号两段必须和 `match` 一模一样（多一段少一段都不行），
 * 方括号外面按 `>` 切成变量，个数必须和 `params` 对上。
 * 不是指令（不以 `[` 开头、没有 `]`、关键字不认识、形状对不上）一律返回 null。
 * 返回 null **不等于**可以当普通弹幕回：先过一遍 `looksLikeCommand`，
 * 是指令写法的就到此为止，别再交给自然语言控制。
 */
export function parseAction(text: string): ParsedAction | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('[')) return null
  const close = trimmed.indexOf(']')
  if (close < 0) return null

  const fixed = trimmed.slice(1, close).split('|').map((part) => part.trim())
  const [keyword] = fixed
  if (!keyword) return null

  // 方括号外面是变量，多个之间用 `>` 隔开；什么都没写就是空数组
  const rest = trimmed.slice(close + 1).trim()
  const vars = rest ? rest.split('>').map((part) => part.trim()) : []
  // 少一个变量就分不清是哪个动作，多写个 `>` 也别猜
  if (vars.some((value) => !value)) return null

  for (const action of ACTIONS) {
    if (action.match.keyword !== keyword) continue
    // 方括号里的段数、每段的字都必须和模板一样
    if (fixed.length !== (action.match.qualifier ? 2 : 1)) continue
    if (action.match.qualifier && fixed[1] !== action.match.qualifier) continue
    // 变量的个数也必须对上
    if (vars.length !== action.params.length) continue
    return { id: action.id, fixed, vars }
  }
  return null
}

/** OpenAI 兼容接口的 tool 定义 */
export type ActionTool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: 'string'; description: string }>
      required: string[]
    }
  }
}

/**
 * 按「当前启用的动作」生成工具表。关掉的指令不进表 —— 模型看不到就不会调，
 * 也省得执行前再挡一次。
 *
 * 参数一律声明成字符串、**不放 enum**：观众和模型都记不全名字，
 * 执行器本来就有一层模糊匹配（`utils/matchName`），把几十个外观名塞进 schema
 * 既贵又死板，不如让它写个大概、由匹配兜底。
 */
export function buildActionTools(enabled: ReadonlySet<ActionId>): ActionTool[] {
  return ACTIONS.filter((action) => enabled.has(action.id)).map((action) => ({
    type: 'function' as const,
    function: {
      name: action.tool,
      description: action.params.length > 0
        ? `${action.label}：${action.description}。名字可以只写个大概。`
        : `${action.label}：${action.description}。`,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(action.params.map((param) => [
          param.name,
          {
            type: 'string',
            description: param.name === 'model'
              ? '角色名，可以只写个大概（比如「鲸鱼」）'
              : `${param.label}名，可以只写个大概`,
          },
        ])),
        required: action.params.filter((param) => param.required !== false).map((param) => param.name),
      },
    },
  }))
}

/** 按工具名反查动作；模型返回了表外的名字时给 undefined */
export function findActionByTool(tool: string): ActionMeta | undefined {
  return ACTIONS.find((action) => action.tool === tool)
}
