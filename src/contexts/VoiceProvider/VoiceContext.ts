import { createContext, useContext } from 'react'
import type { VolcengineTtsConfig, VolcengineVoicePreset } from '../../hooks/useTts/api'

export type VoiceContextValue = {
  voiceConfig: VolcengineTtsConfig
  setVoiceConfig: (config: VolcengineTtsConfig) => void
  /** 全部可用音色：内置预设 + 用户自定义，已按顺序合并好，消费方直接用即可 */
  voices: VolcengineVoicePreset[]
  addVoice: (voice: VolcengineVoicePreset) => void
  deleteVoice: (id: string) => void
  voiceError: string
  speakingModel: { modelId: string; text: string } | null
  /** 每个模型最近一次说过的内容（按 modelId 索引）；说话结束后仍然保留，供「气泡常显」使用 */
  lastSpoken: Record<string, string>
  speak: (text: string, preset: VolcengineVoicePreset, modelId: string) => Promise<void>
  stopSpeaking: () => void
  /** TTS 配置弹窗是否打开：顶栏按钮与「测试发声」共用同一份状态 */
  ttsConfigOpen: boolean
  openTtsConfig: () => void
  closeTtsConfig: () => void
}

export const VoiceContext = createContext<VoiceContextValue | null>(null)

export function useVoice() {
  const context = useContext(VoiceContext)
  if (!context) throw new Error('useVoice must be used within VoiceProvider')
  return context
}
