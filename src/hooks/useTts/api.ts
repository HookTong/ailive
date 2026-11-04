export type VolcengineTtsConfig = {
  apiKey: string
  endpoint: string
}

/**
 * 一条音色预设：内置预设与用户自定义音色共用同一结构。
 * 定义放在请求协议这一层，因为 useTts 合成音频时要用到它；
 * 预设数据本身在 contexts/VoiceProvider/presets.ts。
 */
export type VolcengineVoicePreset = {
  id: string
  label: string
  voiceType: string
  resourceId?: string
  speedRatio: number
  pitchRatio: number
}

export const DEFAULT_VOLCENGINE_TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'
const VOLCENGINE_TTS_PROXY_PATH = '/volcengine-tts'

export async function synthesizeVolcengineSpeech(text: string, preset: VolcengineVoicePreset, config: VolcengineTtsConfig): Promise<Blob> {
  const content = text.trim()
  if (!content) throw new Error('请输入要朗读的内容')
  if (!config.apiKey.trim()) throw new Error('请先配置火山 TTS API Key')
  if (!preset.resourceId) throw new Error('当前音色缺少资源 ID')

  const endpoint = config.endpoint.trim() === DEFAULT_VOLCENGINE_TTS_ENDPOINT && import.meta.env.DEV
    ? VOLCENGINE_TTS_PROXY_PATH
    : config.endpoint.trim()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Api-Key': config.apiKey.trim(),
      'X-Api-Resource-Id': preset.resourceId,
      'X-Api-Request-Id': crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      req_params: {
        text: content,
        speaker: preset.voiceType,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speech_rate: Math.round((preset.speedRatio - 1) * 100),
        },
      },
    }),
  })
  if (!response.ok) {
    const raw = await response.text()
    // 火山失败时返回的是 JSON 信封，直接甩原文给用户看不懂，尽量抽出 message
    let detail = raw.trim()
    try {
      const parsed = JSON.parse(raw) as { header?: { message?: string }; message?: string }
      detail = parsed.header?.message || parsed.message || detail
    } catch {
      // 非 JSON，保留原文
    }
    throw new Error(detail || `火山 TTS 请求失败（${response.status}）`)
  }
  if (!response.body) throw new Error('火山 TTS 未返回音频流')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const audioChunks: Uint8Array[] = []
  let pending = ''
  let finished = false
  const consumeLine = (line: string) => {
    if (!line.trim()) return
    const payload = JSON.parse(line) as { code?: number; message?: string; data?: string }
    if (payload.code && payload.code !== 20000000) throw new Error(payload.message || `火山 TTS 返回错误（${payload.code}）`)
    if (payload.data) {
      const binary = atob(payload.data)
      audioChunks.push(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
    }
    if (payload.code === 20000000) finished = true
  }
  while (!finished) {
    const { done, value } = await reader.read()
    pending += decoder.decode(value, { stream: !done })
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    lines.forEach(consumeLine)
    if (done) break
  }
  if (pending.trim()) consumeLine(pending)
  if (audioChunks.length === 0) throw new Error('火山 TTS 未返回音频数据')
  const totalLength = audioChunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const audio = new Uint8Array(totalLength)
  let offset = 0
  audioChunks.forEach((chunk) => { audio.set(chunk, offset); offset += chunk.byteLength })
  return new Blob([audio], { type: 'audio/mpeg' })
}
