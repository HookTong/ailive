import { MUSIC_PRESETS, type MusicPreset } from './presets'
import type { MusicLoopMode, MusicTrack } from './MusicContext'

export const MUSIC_CONSOLE_STORAGE_KEY = 'ailive.music-console'

export const DEFAULT_VOLUME = 0.55

export const DEFAULT_MUSIC_CONSOLE = {
  presetId: MUSIC_PRESETS[0].id,
  loopMode: 'single' as MusicLoopMode,
  volume: DEFAULT_VOLUME,
}

export type StoredMusicConsole = {
  /** 上次选中的那一首。**不存播放状态** —— 刷新后自动出声会被浏览器拦掉 */
  presetId: string
  loopMode: MusicLoopMode
  volume: number
}

const EMPTY: StoredMusicConsole = { ...DEFAULT_MUSIC_CONSOLE }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const readLoopMode = (value: unknown): MusicLoopMode =>
  (value === 'list' || value === 'shuffle' ? value : 'single')

export function loadMusicConsole(): StoredMusicConsole {
  try {
    const raw = window.localStorage.getItem(MUSIC_CONSOLE_STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY
    const record = parsed as Record<string, unknown>
    return {
      presetId: typeof record.presetId === 'string' ? record.presetId : DEFAULT_MUSIC_CONSOLE.presetId,
      loopMode: readLoopMode(record.loopMode),
      volume: typeof record.volume === 'number' && Number.isFinite(record.volume)
        ? clamp(record.volume, 0, 1)
        : DEFAULT_MUSIC_CONSOLE.volume,
    }
  } catch {
    return EMPTY
  }
}

/** 上一次写进去的字符串。拖音量滑杆会连着触发很多次，载荷没变就不必重写 */
let lastWritten = ''

/**
 * 落盘。全是默认值时把键删掉 —— 没动过音乐的用户不该留一份快照，
 * 否则以后改默认音量他也不会跟着变。
 */
export function saveMusicConsole(console: StoredMusicConsole): void {
  try {
    const stored: Partial<StoredMusicConsole> = {}
    if (console.presetId !== DEFAULT_MUSIC_CONSOLE.presetId) stored.presetId = console.presetId
    if (console.loopMode !== DEFAULT_MUSIC_CONSOLE.loopMode) stored.loopMode = console.loopMode
    if (console.volume !== DEFAULT_MUSIC_CONSOLE.volume) stored.volume = console.volume
    const json = Object.keys(stored).length === 0 ? '' : JSON.stringify(stored)
    if (json === lastWritten) return
    lastWritten = json
    if (!json) {
      window.localStorage.removeItem(MUSIC_CONSOLE_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(MUSIC_CONSOLE_STORAGE_KEY, json)
  } catch {
    // 隐私模式下存不了，只在内存里生效
  }
}

/**
 * 把存下来的 presetId 还原成一首歌。
 * 对不上时退回第一首内置曲目 —— 自定义音乐可能已经被删了，
 * 而本地文件那种 blob 地址刷新后本来也播不了。
 */
export function resolveStoredTrack(presetId: string, tracks: readonly MusicPreset[]): MusicTrack {
  const preset = tracks.find((item) => item.id === presetId) ?? MUSIC_PRESETS[0]
  return { name: preset.label, url: preset.url }
}
