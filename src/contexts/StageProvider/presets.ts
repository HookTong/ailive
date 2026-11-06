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
