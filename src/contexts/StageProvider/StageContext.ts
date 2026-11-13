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

/**
 * 舞台四块浮层。直播时观众多半用手机看竖屏，卡片上的字经常小到看不清，
 * 所以四块各自能单独放大 —— 弹幕刷得快就调大弹幕，概览数据多就调大概览。
 */
export type OverlayScaleKey = 'overview' | 'giftMotion' | 'chat' | 'chatCommand'

/** 四块浮层各自的缩放倍数，1 = 原始大小 */
export type OverlayScales = Record<OverlayScaleKey, number>

/** 缩放范围：再小字就糊成一团，再大会盖住半个舞台 */
export const OVERLAY_SCALE_MIN = 0.6
export const OVERLAY_SCALE_MAX = 2

/** 面板上的四行滑块，顺序就是舞台上的摆放顺序 */
export const OVERLAY_SCALE_KEYS: readonly OverlayScaleKey[] = ['overview', 'giftMotion', 'chat', 'chatCommand']

/** 四块浮层各自的透明度，1 = 不透明 */
export type OverlayOpacities = Record<OverlayScaleKey, number>

/**
 * 透明度范围：再低卡片就只剩个影子，手指找不到落点（真要隐藏用每块自己的开关）。
 * 下限 0.2 还能看出轮廓。
 */
export const OVERLAY_OPACITY_MIN = 0.2
export const OVERLAY_OPACITY_MAX = 1

/**
 * 四块浮层各自的显示 / 隐藏。
 * 原来这四个开关在舞台工具条上，现在跟着「卡片大小 / 透明度」一起收进舞台控制台，
 * 每块卡片一个操作区（开关 + 两根滑块），调的时候不用在顶栏和面板之间来回找。
 */
export type OverlayVisibility = Record<OverlayScaleKey, boolean>

/**
 * 每块浮层各自的复位令牌：点哪一块的「复位」就只加那一个数。
 *
 * 位置是各卡 `useDragPosition` 里的局部 state，面板够不着，只能靠这个数字变化
 * 让那张卡自己 `translate(0, 0)`。做成四份而不是一份 —— 复位一块时不该把
 * 另外三张拖到别处的卡片也弹回原位。
 */
export type OverlayResetTokens = Record<OverlayScaleKey, number>

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
  /** 四块浮层各自的缩放倍数 */
  overlayScales: OverlayScales
  setOverlayScale: (key: OverlayScaleKey, value: number) => void
  /** 四块浮层各自的透明度 */
  overlayOpacities: OverlayOpacities
  setOverlayOpacity: (key: OverlayScaleKey, value: number) => void
  /** 四块浮层各自的显示 / 隐藏，只影响渲染，不碰大小和透明度 */
  overlayVisible: OverlayVisibility
  setOverlayVisible: (key: OverlayScaleKey, visible: boolean) => void
  /**
   * 复位令牌：每块各一个，点一次那一块的「复位」就加一。
   *
   * 卡片位置在各自 `useDragPosition` 的局部 state 里，面板拿不到，
   * 只能靠这个数字变化让那张卡自己 `translate(0, 0)` 回到 CSS 默认位置。
   * 只增不减，且不落盘 —— 它是「刚刚被点了一下」这件事本身，不是配置。
   */
  overlayResetTokens: OverlayResetTokens
  /** 单块复位：大小 / 透明度回默认，位置回默认，**开关不动**（那是另一个明确的动作） */
  resetOverlayCard: (key: OverlayScaleKey) => void
  resetStage: () => void
}

export const StageContext = createContext<StageContextValue | null>(null)

export function useStage() {
  const context = useContext(StageContext)
  if (!context) throw new Error('useStage must be used within StageProvider')
  return context
}
