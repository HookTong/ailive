import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTts } from '../../hooks/useTts'
import {
  loadCustomVolcengineVoices,
  loadVolcengineTtsConfig,
  type VolcengineTtsConfig,
  type VolcengineVoicePreset,
  VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY,
} from '../../hooks/useTts/api'
import { VoiceContext, type VoiceContextValue } from './VoiceContext'

type VoiceProviderProps = {
  children: ReactNode
  onCharacterVoicePresetReset?: (deletedId: string) => void
}

export function VoiceProvider({ children, onCharacterVoicePresetReset }: VoiceProviderProps) {
  const [voiceConfig, setVoiceConfig] = useState<VolcengineTtsConfig>(loadVolcengineTtsConfig)
  const [customVoices, setCustomVoices] = useState<VolcengineVoicePreset[]>(loadCustomVolcengineVoices)
  const [ttsConfigOpen, setTtsConfigOpen] = useState(false)
  // 发声请求、播放与「谁在说话」都在 useTts 里，这里只持有配置和音色库
  const { voiceError, speakingModel, lastSpoken, speak, stopSpeaking } = useTts(voiceConfig)

  const openTtsConfig = useCallback(() => setTtsConfigOpen(true), [])
  const closeTtsConfig = useCallback(() => setTtsConfigOpen(false), [])

  // Persist custom voices
  useEffect(() => {
    try {
      window.localStorage.setItem(VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(customVoices))
    } catch {
      // Storage unavailable
    }
  }, [customVoices])

  const addVoice = (voice: VolcengineVoicePreset) => {
    setCustomVoices((current) => [...current, voice])
  }

  const deleteVoice = (id: string) => {
    setCustomVoices((current) => current.filter((voice) => voice.id !== id))
    onCharacterVoicePresetReset?.(id)
  }

  const value = useMemo<VoiceContextValue>(() => ({
    voiceConfig,
    setVoiceConfig,
    customVoices,
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
  }), [voiceConfig, customVoices, voiceError, speakingModel, lastSpoken, speak, stopSpeaking, ttsConfigOpen, openTtsConfig, closeTtsConfig])

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}
