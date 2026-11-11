import { createContext, useContext } from 'react'
import type { ParticlePreset } from '../../components/Atmosphere'
import type { CustomFilterPreset, FilterPreset } from '../../components/FilterSetting'
import type { BackgroundPreset, PresetRotateMode } from './presets'

/**
 * 舞台背景的切换方式：
 * - `fixed` 固定，停在你选的那张
 * - `cycle` 循环切换，按预设顺序自动轮播
 * - `random` 随机切换，每次挑一张和当前不同的
 * - `none` 无背景，只留粒子与滤镜。两个入口：面板上「舞台背景」标题右边那个开关，
 *   和指令 `[背景|关闭]`。它不在切换方式那组里 —— 管的是「铺不铺图」，不是「怎么换图」
 */
export type BackgroundMode = 'fixed' | 'cycle' | 'random' | 'none'

export type StageContextValue = {
  backgroundUrl: string
  setBackgroundUrl: (url: string) => void
  backgroundMode: BackgroundMode
  setBackgroundMode: (mode: BackgroundMode) => void
  /**
   * 关掉背景之前那一种轮换方式。开关重新打开、指令 `[背景|开启]` 都回到它 ——
   * 否则从「循环」关掉再打开会被降级成「固定」。关掉时下面那排分段控件也照它亮着。
   */
  backgroundModeBeforeOff: Exclude<BackgroundMode, 'none'>
  /**
   * 舞台背景开关：只控制「铺不铺图」，不换图、不改轮换方式、不清选中项。
   * 面板上标题右边那个 Switch 和指令 `[背景|开启]` / `[背景|关闭]` 都走这里。
   */
  setBackgroundVisible: (visible: boolean) => void
  /** 用户自己添加的背景，排在内置预设之后 */
  customBackgrounds: BackgroundPreset[]
  /** 添加一张自定义背景并立即切换过去 */
  addBackground: (name: string, url: string) => void
  /**
   * 删掉一张自定义背景。删的正是当前这张时退回默认底图。
   * 内置预设不在可删范围内（列表里也没有它们的删除入口）。
   */
  removeBackground: (id: string) => void
  particleEnabled: boolean
  setParticleEnabled: (enabled: boolean) => void
  particlePreset: ParticlePreset
  /** 粒子预设的切换方式：固定 / 循环 / 随机。关掉粒子时自动切换暂停 */
  particleMode: PresetRotateMode
  setParticleMode: (mode: PresetRotateMode) => void
  particleIntensity: number
  particleSpeed: number
  particleOpacity: number
  particleColor: string
  particleSize: number
  handleParticlePresetChange: (preset: ParticlePreset) => void
  handleParticleColorChange: (color: string) => void
  handleParticleIntensityChange: (intensity: number) => void
  handleParticleSpeedChange: (speed: number) => void
  handleParticleOpacityChange: (opacity: number) => void
  handleParticleSizeChange: (size: number) => void
  filterEnabled: boolean
  setFilterEnabled: (enabled: boolean) => void
  filterPreset: FilterPreset
  /** 滤镜预设的切换方式：固定 / 循环 / 随机。关掉滤镜时自动切换暂停 */
  filterMode: PresetRotateMode
  setFilterMode: (mode: PresetRotateMode) => void
  filterBrightness: number
  filterContrast: number
  filterSaturation: number
  filterBlur: number
  vignette: boolean
  setVignette: (enabled: boolean) => void
  customFilterPresets: CustomFilterPreset[]
  handleFilterPresetChange: (preset: FilterPreset) => void
  setFilterBrightness: (value: number) => void
  setFilterContrast: (value: number) => void
  setFilterSaturation: (value: number) => void
  setFilterBlur: (value: number) => void
  addCustomFilterPreset: (preset: CustomFilterPreset) => void
  /**
   * 删掉一个自定义滤镜。删的正是当前滤镜时退回「标准」。
   * 内置预设不在可删范围内（列表里也没有它们的删除入口）。
   */
  removeCustomFilterPreset: (id: FilterPreset) => void
  resetStage: () => void
}

export const StageContext = createContext<StageContextValue | null>(null)

export function useStage() {
  const context = useContext(StageContext)
  if (!context) throw new Error('useStage must be used within StageProvider')
  return context
}
