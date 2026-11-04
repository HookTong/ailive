import {
  DEFAULT_VOLCENGINE_TTS_ENDPOINT,
  type VolcengineTtsConfig,
  type VolcengineVoicePreset,
} from '../../hooks/useTts/api'

/** TTS 配置的本地持久化：Provider 启动时读一次，TtsConfigModal 保存时写入 */
export const VOLCENGINE_TTS_CONFIG_STORAGE_KEY = 'ailive.volcengine-tts-config'
export const VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY = 'ailive.volcengine-custom-voices'

/** 没存过配置时的兜底：优先读构建期环境变量 */
function envFallback(): VolcengineTtsConfig {
  return {
    apiKey: (import.meta.env.VITE_VOLCENGINE_TTS_API_KEY as string | undefined) ?? '',
    endpoint: (import.meta.env.VITE_VOLCENGINE_TTS_ENDPOINT as string | undefined) ?? DEFAULT_VOLCENGINE_TTS_ENDPOINT,
  }
}

export function loadTtsConfig(): VolcengineTtsConfig {
  const fallback = envFallback()
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

export function saveTtsConfig(config: VolcengineTtsConfig): void {
  try {
    window.localStorage.setItem(VOLCENGINE_TTS_CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // 隐私模式下存不了，只在内存里生效
  }
}

/** 读取自定义音色；逐项校验，历史脏数据直接丢弃 */
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

export function saveCustomVolcengineVoices(voices: VolcengineVoicePreset[]): void {
  try {
    window.localStorage.setItem(VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(voices))
  } catch {
    // 隐私模式下存不了，只在内存里生效
  }
}
