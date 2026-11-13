import {
  DEFAULT_DOUBAO_CHAT_BASE_URL,
  DEFAULT_DOUBAO_MODEL,
  type DoubaoChatConfig,
} from '../../hooks/useAiChat/api'

/**
 * 自动回复的节流参数，单位毫秒。原来这三个是写死的常量，
 * 现在交给面板调：直播间人多就放宽，自己调试就收紧。
 */
export type AiChatThrottle = {
  /** 两次回复之间的最小间隔（全局总闸） */
  replyIntervalMs: number
  /**
   * 同一个观众的弹幕冷却，0 = 不额外限制。
   *
   * 别指望它挡「一个人占满队列」—— 那件事由 enqueue 里的「队列里已经有他的弹幕」负责。
   * 这里设得比 `replyIntervalMs` 还长，效果就是「回他一句、然后他后面十几条全静默」。
   */
  userCooldownMs: number
  /** 相同内容的弹幕在这个窗口内只答一次，0 = 不去重 */
  sameTextWindowMs: number
}

/** 默认节流：就是原来那三个常量的值 */
export const DEFAULT_AI_THROTTLE: AiChatThrottle = {
  replyIntervalMs: 6_000,
  userCooldownMs: 6_000,
  sameTextWindowMs: 30_000,
}

/** 滑块范围。面板和落盘校验共用一份，别两边各写一个数 */
export const AI_THROTTLE_LIMITS: Record<keyof AiChatThrottle, { min: number; max: number; step: number }> = {
  replyIntervalMs: { min: 1_000, max: 60_000, step: 1_000 },
  userCooldownMs: { min: 0, max: 120_000, step: 1_000 },
  sameTextWindowMs: { min: 0, max: 300_000, step: 5_000 },
}

/** AI 自动回复的全部设置：接口配置 + 人设 + 总开关 + 计费单价 + 节流 */
export type AiChatSettings = DoubaoChatConfig & {
  /** 自动回复的节流参数 */
  throttle: AiChatThrottle
  /** 主播人设，作为 system prompt 的一部分 */
  persona: string
  /** 配好 Key 之后是否真的开始自动回复 */
  autoReply: boolean
  /**
   * 自然语言控制：让模型把「换个赛博背景」这类弹幕理解成控制台动作。
   * 每条没命中 `[关键字]` 的弹幕会多一次模型调用，所以单独给一个开关。
   */
  nlControl: boolean
  /** 推理输入单价，单位：元/百万 tokens */
  inputPrice: number
  /** 推理输出单价，单位：元/百万 tokens */
  outputPrice: number
}

export const AI_CHAT_SETTINGS_STORAGE_KEY = 'ailive.ai-chat-settings'

/** 默认人设：泛用型虚拟主播，行文约束由调用层追加 */
export const DEFAULT_AI_PERSONA = '你是直播间里活泼开朗的虚拟主播，说话亲切自然，喜欢和观众互动，偶尔用一点颜文字。'

/** 方舟 Doubao-Seed-Character 的公开价：输入 0.8 / 输出 2（元/百万 tokens） */
export const DEFAULT_AI_INPUT_PRICE = 0.8
export const DEFAULT_AI_OUTPUT_PRICE = 2

/** 单价只接受非负有限数，脏数据回退默认值 */
function readPrice(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

/** 逐项读节流参数并夹到滑块范围内 —— 存进去的可能是上一版代码写的数 */
function readThrottle(value: unknown): AiChatThrottle {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const read = (key: keyof AiChatThrottle) => {
    const { min, max } = AI_THROTTLE_LIMITS[key]
    const stored = raw[key]
    return typeof stored === 'number' && Number.isFinite(stored)
      ? Math.min(max, Math.max(min, Math.round(stored)))
      : DEFAULT_AI_THROTTLE[key]
  }
  return {
    replyIntervalMs: read('replyIntervalMs'),
    userCooldownMs: read('userCooldownMs'),
    sameTextWindowMs: read('sameTextWindowMs'),
  }
}

function envFallback(): AiChatSettings {
  return {
    apiKey: (import.meta.env.VITE_DOUBAO_API_KEY as string | undefined) ?? '',
    baseUrl: (import.meta.env.VITE_DOUBAO_BASE_URL as string | undefined) ?? DEFAULT_DOUBAO_CHAT_BASE_URL,
    model: (import.meta.env.VITE_DOUBAO_MODEL as string | undefined) ?? DEFAULT_DOUBAO_MODEL,
    persona: DEFAULT_AI_PERSONA,
    autoReply: true,
    nlControl: true,
    inputPrice: DEFAULT_AI_INPUT_PRICE,
    outputPrice: DEFAULT_AI_OUTPUT_PRICE,
    throttle: { ...DEFAULT_AI_THROTTLE },
  }
}

/** 启动时读一次；逐项校验，历史脏数据回退默认值 */
export function loadAiChatSettings(): AiChatSettings {
  const fallback = envFallback()
  try {
    const raw = window.localStorage.getItem(AI_CHAT_SETTINGS_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<AiChatSettings>
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : fallback.apiKey,
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl : fallback.baseUrl,
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : fallback.model,
      persona: typeof parsed.persona === 'string' && parsed.persona.trim() ? parsed.persona : fallback.persona,
      autoReply: typeof parsed.autoReply === 'boolean' ? parsed.autoReply : fallback.autoReply,
      nlControl: typeof parsed.nlControl === 'boolean' ? parsed.nlControl : fallback.nlControl,
      inputPrice: readPrice(parsed.inputPrice, fallback.inputPrice),
      outputPrice: readPrice(parsed.outputPrice, fallback.outputPrice),
      throttle: readThrottle(parsed.throttle),
    }
  } catch {
    return fallback
  }
}

export function saveAiChatSettings(settings: AiChatSettings): void {
  try {
    window.localStorage.setItem(AI_CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 隐私模式下存不了，只在内存里生效
  }
}
