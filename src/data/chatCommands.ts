/**
 * 弹幕指令：观众在弹幕里发一段固定格式的文字，就能远程操作模型控制台 / 舞台控制台。
 *
 * 格式统一是 `[关键字|限定词…]内容`：
 * - 方括号里第一段是命令族（外观 / 音色 / 背景 / 粒子 / 滤镜 / 音乐）
 * - 后面的段是限定词：角色名、或 `清除` / `无背景` 这类固定动作
 * - 方括号外面的内容是要匹配的配置名（外观名、背景名、音色名……）
 *
 * 这个文件只放「有哪些指令」和「怎么把一句话解析成指令」，
 * 真正改状态的动作在 hooks/useChatCommand 里 —— 那里才拿得到各个上下文。
 */

export type ChatCommandId =
  | 'expression'
  | 'expressionClear'
  | 'voice'
  | 'background'
  | 'backgroundNone'
  | 'backgroundFixed'
  | 'backgroundCycle'
  | 'particle'
  | 'particleFixed'
  | 'particleCycle'
  | 'particleRandom'
  | 'filter'
  | 'filterFixed'
  | 'filterCycle'
  | 'filterRandom'
  | 'music'
  | 'musicSingle'
  | 'musicList'
  | 'musicShuffle'

/** 指令属于哪一侧的控制台：决定「谁来说这句反馈」 */
export type ChatCommandScope = 'model' | 'stage'

export type ChatCommandMeta = {
  id: ChatCommandId
  scope: ChatCommandScope
  /**
   * 展示用的指令模板，**原样显示、不做替换** —— `$xxx` 就是留给观众填的地方。
   * 变量一律以「名称」结尾（`$角色名称` / `$背景名称` / `$外观名称`……），
   * 读起来就知道该往里填一个名字，而不是填开关或数字。
   */
  template: string
  /** 一句话说明这条指令做什么 */
  description: string
}

/**
 * 全部可配置的指令。顺序就是界面里的顺序：
 * 先模型控制台（外观 → 音色），再舞台控制台（背景 → 粒子 → 滤镜 → 音乐）。
 */
export const CHAT_COMMANDS: readonly ChatCommandMeta[] = [
  {
    id: 'expression',
    scope: 'model',
    template: '[外观|$角色名称]$外观名称',
    description: '选中 / 反选该角色的某个外观预设',
  },
  {
    id: 'expressionClear',
    scope: 'model',
    template: '[外观|$角色名称|清除]',
    description: '清除该角色的全部外观预设',
  },
  {
    id: 'voice',
    scope: 'model',
    template: '[音色|$角色名称]$音色名称',
    description: '把该角色的说话音色换成指定音色',
  },
  {
    id: 'background',
    scope: 'stage',
    template: '[背景]$背景名称',
    description: '切换舞台背景（同时切回固定显示）',
  },
  {
    id: 'backgroundNone',
    scope: 'stage',
    template: '[背景|无背景]',
    description: '关掉舞台背景，只留粒子与滤镜',
  },
  {
    id: 'backgroundFixed',
    scope: 'stage',
    template: '[背景|固定]',
    description: '背景停在你选的那一张',
  },
  {
    id: 'backgroundCycle',
    scope: 'stage',
    template: '[背景|循环切换]',
    description: '背景按预设顺序自动轮播',
  },
  {
    id: 'particle',
    scope: 'stage',
    template: '[粒子]$特效名称',
    description: '切换粒子特效（顺带打开粒子开关）',
  },
  {
    id: 'particleFixed',
    scope: 'stage',
    template: '[粒子|固定]',
    description: '粒子停在你选的那一个',
  },
  {
    id: 'particleCycle',
    scope: 'stage',
    template: '[粒子|循环切换]',
    description: '粒子按预设顺序自动轮播',
  },
  {
    id: 'particleRandom',
    scope: 'stage',
    template: '[粒子|随机切换]',
    description: '粒子每次随机换一个',
  },
  {
    id: 'filter',
    scope: 'stage',
    template: '[滤镜]$滤镜名称',
    description: '切换舞台滤镜',
  },
  {
    id: 'filterFixed',
    scope: 'stage',
    template: '[滤镜|固定]',
    description: '滤镜停在你选的那一个',
  },
  {
    id: 'filterCycle',
    scope: 'stage',
    template: '[滤镜|循环切换]',
    description: '滤镜按预设顺序自动轮播',
  },
  {
    id: 'filterRandom',
    scope: 'stage',
    template: '[滤镜|随机切换]',
    description: '滤镜每次随机换一个',
  },
  {
    id: 'music',
    scope: 'stage',
    template: '[音乐]$音乐名称',
    description: '切换正在播放的背景音乐',
  },
  {
    id: 'musicSingle',
    scope: 'stage',
    template: '[音乐|单曲循环]',
    description: '当前这首放完从头再来',
  },
  {
    id: 'musicList',
    scope: 'stage',
    template: '[音乐|列表循环]',
    description: '放完接着放列表里的下一首',
  },
  {
    id: 'musicShuffle',
    scope: 'stage',
    template: '[音乐|随机播放]',
    description: '放完从列表里随机挑一首',
  },
]

/** 解析后的一句话：命令族、方括号里的各段、方括号后面的内容 */
export type ParsedChatCommand = {
  id: ChatCommandId
  /** 方括号里按 `|` 切开并 trim 过的各段，第 0 段是关键字 */
  head: string[]
  /** 方括号后面剩下的内容，已 trim */
  payload: string
}

/** 比较名字时忽略空白与大小写：「Lo-fi」和「lo fi」算同一个 */
export function normalizeCommandName(value: string): string {
  return value.replace(/\s+/g, '').toLocaleLowerCase()
}

/** 默认全部启用 —— 指令是可选功能，但默认打开才「开箱能用」 */
export function createDefaultChatCommands(): Record<ChatCommandId, boolean> {
  return Object.fromEntries(CHAT_COMMANDS.map((command) => [command.id, true])) as Record<ChatCommandId, boolean>
}

/**
 * 把一条弹幕解析成指令。不是指令（不以 `[` 开头、没有 `]`、关键字不认识）一律返回 null，
 * 让它继续走普通的弹幕回复。
 */
export function parseChatCommand(text: string): ParsedChatCommand | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('[')) return null
  const close = trimmed.indexOf(']')
  if (close < 0) return null

  const head = trimmed.slice(1, close).split('|').map((part) => part.trim())
  const payload = trimmed.slice(close + 1).trim()
  const [keyword, qualifier] = head
  if (!keyword) return null

  switch (keyword) {
    case '外观':
      // `[外观|$角色名称]` 后面没跟名字、又不是「清除」，这条指令不完整
      if (!qualifier) return null
      if (head[2] === '清除') return { id: 'expressionClear', head, payload: '' }
      return payload ? { id: 'expression', head, payload } : null
    case '音色':
      if (!qualifier || !payload) return null
      return { id: 'voice', head, payload }
    case '背景':
      if (qualifier === '无背景') return { id: 'backgroundNone', head, payload: '' }
      if (qualifier === '固定') return { id: 'backgroundFixed', head, payload: '' }
      if (qualifier === '循环切换') return { id: 'backgroundCycle', head, payload: '' }
      // `[背景|电影]` 和 `[背景]电影` 两种写法都收
      return payload ? { id: 'background', head, payload } : null
    case '粒子':
      if (qualifier === '固定') return { id: 'particleFixed', head, payload: '' }
      if (qualifier === '循环切换') return { id: 'particleCycle', head, payload: '' }
      if (qualifier === '随机切换') return { id: 'particleRandom', head, payload: '' }
      return payload ? { id: 'particle', head, payload } : null
    case '滤镜':
      if (qualifier === '固定') return { id: 'filterFixed', head, payload: '' }
      if (qualifier === '循环切换') return { id: 'filterCycle', head, payload: '' }
      if (qualifier === '随机切换') return { id: 'filterRandom', head, payload: '' }
      return payload ? { id: 'filter', head, payload } : null
    case '音乐':
      if (qualifier === '单曲循环') return { id: 'musicSingle', head, payload: '' }
      if (qualifier === '列表循环') return { id: 'musicList', head, payload: '' }
      if (qualifier === '随机播放') return { id: 'musicShuffle', head, payload: '' }
      return payload ? { id: 'music', head, payload } : null
    default:
      return null
  }
}
