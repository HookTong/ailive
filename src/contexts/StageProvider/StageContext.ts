import { createContext, useContext } from 'react'
import type { ParticlePreset } from '../../components/Atmosphere'
import type { CustomFilterPreset, FilterPreset } from '../../components/FilterSetting'
import type { BackgroundPreset, PresetRotateMode } from './presets'

/**
 * 舞台背景的切换方式：
 * - `fixed` 固定，停在你选的那张
 * - `cycle` 循环切换，按预设顺序自动轮播
 * - `none` 无背景，只留粒子与滤镜
 */
export type BackgroundMode = 'fixed' | 'cycle' | 'none'

export type StageContextValue = {
  backgroundUrl: string
  setBackgroundUrl: (url: string) => void
  backgroundMode: BackgroundMode
  setBackgroundMode: (mode: BackgroundMode) => void
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
