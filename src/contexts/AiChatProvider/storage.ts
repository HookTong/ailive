import {
  DEFAULT_DOUBAO_CHAT_BASE_URL,
  DEFAULT_DOUBAO_MODEL,
  type DoubaoChatConfig,
} from '../../hooks/useAiChat/api'

/** AI 自动回复的全部设置：接口配置 + 人设 + 总开关 + 计费单价 */
export type AiChatSettings = DoubaoChatConfig & {
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
