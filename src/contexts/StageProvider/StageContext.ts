import { createContext, useContext } from 'react'
import type { ParticlePreset } from '../../components/Atmosphere'
import type { CustomFilterPreset, FilterPreset } from '../../components/FilterSetting'

/**
 * 舞台背景的切换方式：
 * - `fixed` 固定，停在你选的那张
 * - `cycle` 循环切换，按内置预设顺序自动轮播
 */
export type BackgroundMode = 'fixed' | 'cycle'

export type StageContextValue = {
  backgroundUrl: string
  setBackgroundUrl: (url: string) => void
  backgroundMode: BackgroundMode
  setBackgroundMode: (mode: BackgroundMode) => void
  handleBackgroundFile: (file: File | null) => void
  particleEnabled: boolean
  setParticleEnabled: (enabled: boolean) => void
  particlePreset: ParticlePreset
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
  resetStage: () => void
}

export const StageContext = createContext<StageContextValue | null>(null)

export function useStage() {
  const context = useContext(StageContext)
  if (!context) throw new Error('useStage must be used within StageProvider')
  return context
}
