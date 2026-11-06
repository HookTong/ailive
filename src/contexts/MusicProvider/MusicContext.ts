import { createContext, useContext } from 'react'
import type { MusicPreset } from './presets'

export type MusicTrack = {
  /** 展示名：内置预设用中文标签，URL 用文件名，本地文件用原始文件名 */
  name: string
  url: string
}

/**
 * 背景音乐的循环方式：
 * - `single` 单曲循环，当前这首放完从头再来
 * - `list` 列表循环，接着放预设列表里的下一首
 */
export type MusicLoopMode = 'single' | 'list'

export type MusicContextValue = {
  track: MusicTrack
  /** 当前选中的内置预设 id，自定义音源为空串 */
  presetId: string
  loopMode: MusicLoopMode
  setLoopMode: (mode: MusicLoopMode) => void
  isPlaying: boolean
  /** 已播放秒数 */
  currentTime: number
  /** 总时长（秒），元数据还没拿到时为 0 */
  duration: number
  volume: number
  error: string
  /**
   * 频谱分析节点，供律动条读取实时能量。
   * 只有同源音源才接得上（跨域接进 Web Audio 会被静音），此时为 null，
   * 消费方应退回纯 CSS 动画。
   */
  analyser: AnalyserNode | null
  selectPreset: (preset: MusicPreset) => void
  playUrl: (url: string) => void
  playFile: (file: File) => void
  toggle: () => void
  setVolume: (volume: number) => void
  clearError: () => void
  /** 回到默认音源并停止播放（「重置舞台」用） */
  reset: () => void
}

export const MusicContext = createContext<MusicContextValue | null>(null)

export function useMusic() {
  const context = useContext(MusicContext)
  if (!context) throw new Error('useMusic must be used within MusicProvider')
  return context
}
