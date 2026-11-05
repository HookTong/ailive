export type DoubaoChatConfig = {
  apiKey: string
  /** 方舟 OpenAI 兼容接口的 Base URL，一般不用改 */
  baseUrl: string
  /** 模型 ID 或接入点 ID（ep- 开头） */
  model: string
}

export type DoubaoChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const DEFAULT_DOUBAO_CHAT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
export const DEFAULT_DOUBAO_MODEL = 'doubao-seed-character-260628'

// 方舟不允许浏览器跨域，开发环境默认地址走同源代理转发（见 vite.config.ts）
const DOUBAO_CHAT_PROXY_PATH = '/volcengine-ark'

/** 单次调用消耗的 token，取自响应体的 usage 字段 */
export type DoubaoChatUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type DoubaoChatResult = {
  text: string
  usage: DoubaoChatUsage
}

/** 生成一条回复：非流式 chat/completions，取第一条 choice 的文本 */
export async function createDoubaoChatReply(
  messages: DoubaoChatMessage[],
  config: DoubaoChatConfig,
): Promise<DoubaoChatResult> {
  if (!config.apiKey.trim()) throw new Error('请先配置豆包 API Key')

  const base = config.baseUrl.trim() || DEFAULT_DOUBAO_CHAT_BASE_URL
  const endpoint = base === DEFAULT_DOUBAO_CHAT_BASE_URL && import.meta.env.DEV
    ? `${DOUBAO_CHAT_PROXY_PATH}/chat/completions`
    : `${base.replace(/\/+$/, '')}/chat/completions`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model.trim() || DEFAULT_DOUBAO_MODEL,
      messages,
      // 直播口播场景要短答，长了观众等不住
      temperature: 0.7,
      max_tokens: 120,
    }),
  })

  if (!response.ok) {
    const raw = await response.text()
    // 方舟失败时返回 { error: { message } } 信封，抽出可读信息
    let detail = raw.trim()
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string }
      detail = parsed.error?.message || parsed.message || detail
    } catch {
      // 非 JSON，保留原文
    }
    throw new Error(detail || `豆包请求失败（${response.status}）`)
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error('豆包没有返回有效回复')
  return {
    text: reply,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  }
}
