import { useCallback, useEffect, useRef, useState } from 'react'
import {
  synthesizeVolcengineSpeech,
  type VolcengineTtsConfig,
  type VolcengineVoicePreset,
} from './api'

export type SpeakingModel = { modelId: string; text: string } | null

export type UseTtsResult = {
  /** 最近一次发声失败的提示，成功后清空 */
  voiceError: string
  /** 正在说话的模型与内容；没人说话时为 null */
  speakingModel: SpeakingModel
  /** 每个模型最近一次说过的内容（按 modelId 索引）；说完仍保留，供气泡常显使用 */
  lastSpoken: Record<string, string>
  speak: (text: string, preset: VolcengineVoicePreset, modelId: string) => Promise<void>
  stopSpeaking: () => void
}

/**
 * 火山 TTS 的发声请求与播放：合成音频 → 播放 → 维护「谁在说话 / 说过什么」。
 * 只负责发声本身，配置与音色库由调用方持有（这里不碰 localStorage）。
 */
export function useTts(config: VolcengineTtsConfig): UseTtsResult {
  const [voiceError, setVoiceError] = useState('')
  const [speakingModel, setSpeakingModel] = useState<SpeakingModel>(null)
  const [lastSpoken, setLastSpoken] = useState<Record<string, string>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setSpeakingModel(null)
  }, [])

  // 卸载时停掉播放并释放 object URL
  useEffect(() => () => {
    audioRef.current?.pause()
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const speak = useCallback(async (text: string, preset: VolcengineVoicePreset, modelId: string) => {
    stopSpeaking()
    setVoiceError('')

    try {
      const blob = await synthesizeVolcengineSpeech(text, preset, config)
      const objectUrl = URL.createObjectURL(blob)
      objectUrlRef.current = objectUrl
      const audio = new Audio(objectUrl)
      audioRef.current = audio

      audio.onended = () => {
        setSpeakingModel(null)
        audioRef.current = null
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl)
          objectUrlRef.current = null
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
  }, [config, stopSpeaking])

  return { voiceError, speakingModel, lastSpoken, speak, stopSpeaking }
}
