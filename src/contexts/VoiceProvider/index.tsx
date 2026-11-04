import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  loadCustomVolcengineVoices,
  synthesizeVolcengineSpeech,
  loadVolcengineTtsConfig,
  type VolcengineTtsConfig,
  type VolcengineVoicePreset,
  VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY,
} from '../../voice/volcengineTts'
import { VoiceContext, type VoiceContextValue } from './VoiceContext'

type VoiceProviderProps = {
  children: ReactNode
  onCharacterVoicePresetReset?: (deletedId: string) => void
}

export function VoiceProvider({ children, onCharacterVoicePresetReset }: VoiceProviderProps) {
  const [voiceConfig, setVoiceConfig] = useState<VolcengineTtsConfig>(loadVolcengineTtsConfig)
  const [customVoices, setCustomVoices] = useState<VolcengineVoicePreset[]>(loadCustomVolcengineVoices)
  const [voiceError, setVoiceError] = useState('')
  const [speakingModel, setSpeakingModel] = useState<{ modelId: string; text: string } | null>(null)
  const [lastSpoken, setLastSpoken] = useState<Record<string, string>>({})
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const voiceObjectUrlRef = useRef<string | null>(null)

  // Persist custom voices
  useEffect(() => {
    try {
      window.localStorage.setItem(VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(customVoices))
    } catch {
      // Storage unavailable
    }
  }, [customVoices])

  // Cleanup on unmount
  useEffect(() => () => {
    voiceAudioRef.current?.pause()
    if (voiceObjectUrlRef.current) URL.revokeObjectURL(voiceObjectUrlRef.current)
  }, [])

  const addVoice = (voice: VolcengineVoicePreset) => {
    setCustomVoices((current) => [...current, voice])
  }

  const deleteVoice = (id: string) => {
    setCustomVoices((current) => current.filter((voice) => voice.id !== id))
    onCharacterVoicePresetReset?.(id)
  }

  const stopSpeaking = () => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause()
      voiceAudioRef.current = null
    }
    if (voiceObjectUrlRef.current) {
      URL.revokeObjectURL(voiceObjectUrlRef.current)
      voiceObjectUrlRef.current = null
    }
    setSpeakingModel(null)
  }

  const speak = async (text: string, preset: VolcengineVoicePreset, modelId: string) => {
    stopSpeaking()
    setVoiceError('')

    try {
      const blob = await synthesizeVolcengineSpeech(text, preset, voiceConfig)
      const objectUrl = URL.createObjectURL(blob)
      voiceObjectUrlRef.current = objectUrl
      const audio = new Audio(objectUrl)
      voiceAudioRef.current = audio

      audio.onended = () => {
        setSpeakingModel(null)
        voiceAudioRef.current = null
        if (voiceObjectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl)
          voiceObjectUrlRef.current = null
        }
      }

      audio.onerror = () => {
        setVoiceError('语音播放失败,请检查音频数据')
        setSpeakingModel(null)
      }

      setSpeakingModel({ modelId, text: text.trim() })
      // 按模型分别记录，多个模型常显时各自显示自己说过的话
      setLastSpoken((current) => ({ ...current, [modelId]: text.trim() }))
      await audio.play()
    } catch (error) {
      setSpeakingModel(null)
      setVoiceError(error instanceof Error ? error.message : '火山 TTS 请求失败')
    }
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
  }), [voiceConfig, customVoices, voiceError, speakingModel, lastSpoken])

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}
