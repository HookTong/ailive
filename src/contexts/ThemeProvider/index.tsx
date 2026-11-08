import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemeMode } from './ThemeContext'
import { DARK_QUERY, loadThemeMode, resolveTheme, saveThemeMode, systemTheme } from './storage'

/**
 * 主题：暗色 / 浅色两套色板，色值在 `styles/themes.scss` 里按 CSS 变量定义。
 * 这里只负责决定 `<html data-theme>` 挂哪个值 —— 组件样式通过 `$token`（= var(--token)）
 * 自动跟着换，不需要任何组件感知主题。
 *
 * 默认「跟随系统」：监听 `prefers-color-scheme`，系统换了主题页面立刻跟着换。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(loadThemeMode)
  const [system, setSystem] = useState(systemTheme)

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => setSystem(media.matches ? 'dark' : 'light')
    // Safari 14 之前只有 addListener，这里按现代 API 写，必要时再补兼容
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const theme = resolveTheme(mode, system)

  // layout effect：首帧绘制前就把属性挂上，避免「先按默认深色画一帧再跳成浅色」
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    saveThemeMode(mode)
  }, [mode])

  const changeMode = useCallback((next: ThemeMode) => setMode(next), [])

  const value = useMemo(() => ({ mode, theme, setMode: changeMode }), [mode, theme, changeMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
