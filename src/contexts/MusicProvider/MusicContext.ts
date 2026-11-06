import { createContext, useContext } from 'react'
import type { MusicPreset } from './presets'

export type MusicTrack = {
  /** 展示名：内置预设用中文标签，自定义音乐用用户填的名称 */
  name: string
  url: string
}

/**
 * 背景音乐的播放方式：
 * - `single` 单曲循环，当前这首放完从头再来
 * - `list` 列表循环，接着放列表里的下一首（内置预设 + 自定义音乐）
 * - `shuffle` 随机播放，放完从列表里随机挑一首，不会连着放同一首
 */
export type MusicLoopMode = 'single' | 'list' | 'shuffle'

/**
 * 试听播放器：一套和背景音乐完全独立的 audio 元素 + 频谱节点。
 *
 * 独立是必须的 —— 试听如果借用主播放器，舞台那张「正在播放」卡片会跟着变，
 * 用户只是想听一下地址对不对，台面上的歌不该因此被顶掉。
 */
export type MusicPreview = {
  /** 正在试听的曲目；没试听过时 name / url 都是空串 */
  track: MusicTrack
  playing: boolean
  currentTime: number
  duration: number
  analyser: AnalyserNode | null
  /**
   * 试听一个地址：只播不入列表，也不动主播放器。
   * 拿不到元数据时返回 false，错误提示交给调用方。
   */
  start: (url: string, name?: string) => Promise<boolean>
  toggle: () => void
  /** 停掉并清空试听信息（关弹窗时调，下次打开是一张干净的卡片） */
  clear: () => void
}

export type MusicContextValue = {
  track: MusicTrack
  /** 当前曲目在列表里的 id，自定义音源为 `custom:…`，临时试听为空串 */
  presetId: string
  /** 全部可选曲目：内置预设在前，用户自己添加的排在后面 */
  tracks: MusicPreset[]
  /** 用户自己添加的音乐，排在内置预设之后 */
  customTracks: MusicPreset[]
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
  /**
   * 添加一首自定义音乐并立即播放。
   * 地址拿不到元数据时返回 false（不落进列表），错误提示交给调用方。
   */
  addTrack: (name: string, url: string) => Promise<boolean>
  /**
   * 删掉一首自定义音乐。删的正是当前这首时会一并停止播放并退回默认曲目。
   * 内置预设不在可删范围内（列表里也没有它们的删除入口）。
   */
  removeTrack: (id: string) => void
  /** 试听播放器：独立于背景音乐，舞台卡片不受它影响 */
  preview: MusicPreview
  /**
   * 进入试听：暂停外面的背景音乐，记住它原本是不是在放。
   * 弹窗打开时调用；曲目、进度、频谱都不动，因为试听用的是另一套播放器。
   */
  beginPreview: () => void
  /**
   * 退出试听：清空试听信息，原本在放的就接着放。
   * 传 `false` 表示这次操作已经产生新曲目（刚添加的音乐正在播），不再恢复外面的播放。
   */
  endPreview: (restore?: boolean) => void
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
