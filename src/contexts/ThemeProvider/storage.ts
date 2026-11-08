import type { ThemeMode, ThemeName } from './ThemeContext'

export const THEME_STORAGE_KEY = 'ailive.theme'

/** 系统偏好查询。暗色主题是默认那套，系统没配过时 matchMedia 一般给 false（= 浅色） */
export const DARK_QUERY = '(prefers-color-scheme: dark)'

const MODES: ThemeMode[] = ['system', 'light', 'dark']

/**
 * 读用户选的模式。
 * 默认「跟随系统」—— 也是唯一不写盘的取值，没配过的用户以后改默认值能跟着变。
 */
export function loadThemeMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    if (mode === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // 隐私模式下存不了，只在本次会话里生效
  }
}

export function systemTheme(): ThemeName {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function resolveTheme(mode: ThemeMode, system: ThemeName): ThemeName {
  return mode === 'system' ? system : mode
}
