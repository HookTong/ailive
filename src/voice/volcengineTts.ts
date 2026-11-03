export type VolcengineTtsConfig = {
  apiKey: string
  endpoint: string
}

export type VolcengineVoicePreset = {
  id: string
  label: string
  voiceType: string
  resourceId?: string
  speedRatio: number
  pitchRatio: number
}

export const VOLCENGINE_TTS_CONFIG_STORAGE_KEY = 'ailive.volcengine-tts-config'
export const VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY = 'ailive.volcengine-custom-voices'
export const DEFAULT_VOLCENGINE_TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'
export const DEFAULT_VOLCENGINE_TTS_RESOURCE_ID = 'seed-tts-2.0'
const VOLCENGINE_TTS_PROXY_PATH = '/volcengine-tts'

export const VOLCENGINE_VOICE_PRESETS: readonly VolcengineVoicePreset[] = [
  { id: 'clear-female', label: '清新', voiceType: 'zh_female_vv_uranus_bigtts', resourceId: DEFAULT_VOLCENGINE_TTS_RESOURCE_ID, speedRatio: 1, pitchRatio: 1 },
  { id: 'gentle-female', label: '温柔', voiceType: 'zh_female_roumeinvyou_uranus_bigtts', resourceId: DEFAULT_VOLCENGINE_TTS_RESOURCE_ID, speedRatio: 0.95, pitchRatio: 1 },
  { id: 'lively-female', label: '活力', voiceType: 'ICL_uranus_zh_female_huoponvhai_tob', resourceId: 'seed-icl-2.0', speedRatio: 1.08, pitchRatio: 1 },
  { id: 'steady-female', label: '沉稳', voiceType: 'ICL_uranus_zh_female_qingxinshaonv_tob', resourceId: 'seed-icl-2.0', speedRatio: 0.92, pitchRatio: 1 },
  { id: 'friendly-female', label: '亲切', voiceType: 'zh_female_peiqi_uranus_bigtts', resourceId: DEFAULT_VOLCENGINE_TTS_RESOURCE_ID, speedRatio: 1, pitchRatio: 1 },
]

export function loadCustomVolcengineVoices(): VolcengineVoicePreset[] {
  try {
    const raw = window.localStorage.getItem(VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is VolcengineVoicePreset => {
      if (!item || typeof item !== 'object') return false
      const voice = item as Partial<VolcengineVoicePreset>
      return typeof voice.id === 'string' && voice.id.startsWith('custom:')
        && typeof voice.label === 'string' && voice.label.trim().length > 0
        && typeof voice.voiceType === 'string' && voice.voiceType.trim().length > 0
        && (voice.resourceId === 'seed-tts-2.0' || voice.resourceId === 'seed-icl-2.0')
        && typeof voice.speedRatio === 'number' && typeof voice.pitchRatio === 'number'
    })
  } catch {
    return []
  }
}

export function loadVolcengineTtsConfig(): VolcengineTtsConfig {
  const fallback: VolcengineTtsConfig = {
    apiKey: (import.meta.env.VITE_VOLCENGINE_TTS_API_KEY as string | undefined) ?? '',
    endpoint: (import.meta.env.VITE_VOLCENGINE_TTS_ENDPOINT as string | undefined) ?? DEFAULT_VOLCENGINE_TTS_ENDPOINT,
  }
  try {
    const raw = window.localStorage.getItem(VOLCENGINE_TTS_CONFIG_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<VolcengineTtsConfig>
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : fallback.apiKey,
      endpoint: typeof parsed.endpoint === 'string' && parsed.endpoint.trim() ? parsed.endpoint : fallback.endpoint,
    }
  } catch {
    return fallback
  }
}

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
    const message = await response.text()
    throw new Error(message || `火山 TTS 请求失败（${response.status}）`)
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
