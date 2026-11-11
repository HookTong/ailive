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

/** 工具定义：参数结构原样透传给接口，这里不关心具体字段 */
export type DoubaoChatTool = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** 模型返回的一次工具调用；arguments 是 JSON 字符串 */
export type DoubaoChatToolCall = {
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
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

export type ActionPlanResult = {
  calls: { name: string; arguments: string }[]
  usage: DoubaoChatUsage
}

type ChatCompletionEnvelope = {
  choices?: {
    message?: {
      content?: string | null
      tool_calls?: DoubaoChatToolCall[]
    }
  }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

function readUsage(data: ChatCompletionEnvelope): DoubaoChatUsage {
  return {
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
  }
}

/** 发一次非流式 chat/completions；错误信封、代理地址、鉴权都在这里统一处理 */
async function postChatCompletions(
  payload: Record<string, unknown>,
  config: DoubaoChatConfig,
): Promise<ChatCompletionEnvelope> {
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
      ...payload,
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

  return await response.json() as ChatCompletionEnvelope
}

/** 生成一条回复：非流式 chat/completions，取第一条 choice 的文本 */
export async function createDoubaoChatReply(
  messages: DoubaoChatMessage[],
  config: DoubaoChatConfig,
): Promise<DoubaoChatResult> {
  const data = await postChatCompletions({
    messages,
    // 直播口播场景要短答，长了观众等不住
    temperature: 0.7,
    max_tokens: 120,
  }, config)

  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error('豆包没有返回有效回复')
  return { text: reply, usage: readUsage(data) }
}

/**
 * 让模型判断这句话要不要操作控制台，返回它想调的工具。
 * 没调工具（普通聊天）时 calls 是空数组 —— 调用方据此决定「执行动作」还是「正常回话」。
 *
 * temperature 压到 0.1：这一步要的是稳定判断，不是发挥。
 */
export async function createActionPlan(
  messages: DoubaoChatMessage[],
  tools: DoubaoChatTool[],
  config: DoubaoChatConfig,
): Promise<ActionPlanResult> {
  const data = await postChatCompletions({
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.1,
    max_tokens: 300,
  }, config)

  const calls = (data.choices?.[0]?.message?.tool_calls ?? [])
    .map((call) => ({
      name: call.function?.name?.trim() ?? '',
      arguments: call.function?.arguments ?? '{}',
    }))
    .filter((call) => call.name.length > 0)

  return { calls, usage: readUsage(data) }
}
