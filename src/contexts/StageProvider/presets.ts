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

/**
 * 默认底图。单独提出来是因为它有三个用处：舞台没配过时的初值、
 * 删掉当前自定义背景时的退路、以及持久化里「读不到就退回默认」的兜底 ——
 * 各写一遍 `'/background.png'` 迟早会改漏一处。
 */
export const DEFAULT_BACKGROUND_URL = BACKGROUND_PRESETS[0].url

/** 循环切换时每张背景停留多久。太短会显得晃眼，太长又看不出在切换 */
export const BACKGROUND_CYCLE_INTERVAL_MS = 12_000

/**
 * 粒子 / 滤镜这类「一组预设里挑一个」的自动切换方式：
 * - `fixed` 固定，停在你选的那个
 * - `cycle` 循环，按预设顺序轮播
 * - `random` 随机，每次挑一个和当前不同的
 */
export type PresetRotateMode = 'fixed' | 'cycle' | 'random'

/**
 * 背景 / 粒子 / 滤镜的切换方式，三组同一个视觉。
 * 标签只留两个字：分段控件一共三格，写「循环切换」会把格子挤满；「循环」「随机」单看也认得。
 * （音乐那组不在这条规则里 —— 「单曲」「列表」离了「循环」就说不清，所以照写四字，
 * 见 `StageControlPanel` 的 `MUSIC_LOOP_OPTIONS`。）
 * 这两个字同时就是弹幕指令的限定词（`[特效|循环]`）—— 改文案要连 `data/actions` 的
 * `qualifier` 一起改，否则观众照着控制台念的指令就发不出去了。
 */
export const PRESET_ROTATE_OPTIONS: readonly { value: PresetRotateMode; label: string }[] = [
  { value: 'fixed', label: '固定' },
  { value: 'cycle', label: '循环' },
  { value: 'random', label: '随机' },
]

/**
 * 粒子 / 滤镜自动切换的停留时长。
 * 和背景轮播同一个节奏 —— 三处各用各的间隔，切换频率不一致看着更乱。
 */
export const PRESET_ROTATE_INTERVAL_MS = 12_000
