import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTts } from '../../hooks/useTts'
import type { VolcengineTtsConfig, VolcengineVoicePreset } from '../../hooks/useTts/api'
// 配置与音色库的读写都收在 storage.ts 里
import { loadCustomVolcengineVoices, loadTtsConfig, saveCustomVolcengineVoices } from './storage'
// 内置预设是这一层的数据，不再外泄给其他模块
import { VOLCENGINE_VOICE_PRESETS } from './presets'
import { VoiceContext, type VoiceContextValue } from './VoiceContext'

type VoiceProviderProps = {
  children: ReactNode
  onCharacterVoicePresetReset?: (deletedId: string) => void
}

export function VoiceProvider({ children, onCharacterVoicePresetReset }: VoiceProviderProps) {
  const [voiceConfig, setVoiceConfig] = useState<VolcengineTtsConfig>(loadTtsConfig)
  const [customVoices, setCustomVoices] = useState<VolcengineVoicePreset[]>(loadCustomVolcengineVoices)
  const [ttsConfigOpen, setTtsConfigOpen] = useState(false)
  // 发声请求、播放与「谁在说话」都在 useTts 里，这里只持有配置和音色库
  const { voiceError, speakingModel, lastSpoken, speak, stopSpeaking } = useTts(voiceConfig)

  const openTtsConfig = useCallback(() => setTtsConfigOpen(true), [])
  const closeTtsConfig = useCallback(() => setTtsConfigOpen(false), [])

  // 自定义音色变化即落盘
  useEffect(() => {
    saveCustomVolcengineVoices(customVoices)
  }, [customVoices])

  const addVoice = useCallback((voice: VolcengineVoicePreset) => {
    setCustomVoices((current) => [...current, voice])
  }, [])

  const deleteVoice = useCallback((id: string) => {
    setCustomVoices((current) => current.filter((voice) => voice.id !== id))
    onCharacterVoicePresetReset?.(id)
  }, [onCharacterVoicePresetReset])

  // 内置预设 + 自定义音色的合并只在这里做，其他组件统一从上下文取
  const voices = useMemo<VolcengineVoicePreset[]>(
    () => [...VOLCENGINE_VOICE_PRESETS, ...customVoices],
    [customVoices],
  )

  const value = useMemo<VoiceContextValue>(() => ({
    voiceConfig,
    setVoiceConfig,
    voices,
    addVoice,
    deleteVoice,
    voiceError,
    speakingModel,
    lastSpoken,
    speak,
    stopSpeaking,
    ttsConfigOpen,
    openTtsConfig,
    closeTtsConfig,
  }), [voiceConfig, voices, addVoice, deleteVoice, voiceError, speakingModel, lastSpoken, speak, stopSpeaking, ttsConfigOpen, openTtsConfig, closeTtsConfig])

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}
