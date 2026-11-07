export type BackgroundPreset = {
  id: string
  label: string
  url: string
}

/** 内置舞台背景，数组顺序就是「循环切换」的轮播顺序 */
export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  { id: 'default', label: '默认', url: '/background.png' },
  { id: 'cinematic', label: '电影', url: '/bg_cinematic.png' },
  { id: 'cyberpunk', label: '赛博', url: '/bg_cyberpunk.png' },
  { id: 'fantasy', label: '幻想', url: '/bg_fantasy.png' },
  { id: 'lofi', label: 'Lo-fi', url: '/bg_lofi.png' },
]

/** 循环切换时每张背景停留多久。太短会显得晃眼，太长又看不出在切换 */
export const BACKGROUND_CYCLE_INTERVAL_MS = 12_000

/**
 * 粒子 / 滤镜这类「一组预设里挑一个」的自动切换方式：
 * - `fixed` 固定，停在你选的那个
 * - `cycle` 循环切换，按预设顺序轮播
 * - `random` 随机切换，每次挑一个和当前不同的
 */
export type PresetRotateMode = 'fixed' | 'cycle' | 'random'

/** 粒子 / 滤镜的切换方式，和背景那组同一个视觉 */
export const PRESET_ROTATE_OPTIONS: readonly { value: PresetRotateMode; label: string }[] = [
  { value: 'fixed', label: '固定' },
  { value: 'cycle', label: '循环切换' },
  { value: 'random', label: '随机切换' },
]

/**
 * 粒子 / 滤镜自动切换的停留时长。
 * 和背景轮播同一个节奏 —— 三处各用各的间隔，切换频率不一致看着更乱。
 */
export const PRESET_ROTATE_INTERVAL_MS = 12_000
