import { createContext, useContext } from 'react'

/** 用户在菜单里选的模式；`system` = 跟随系统 */
export type ThemeMode = 'system' | 'light' | 'dark'

/** 解析之后真正生效的主题 */
export type ThemeName = 'light' | 'dark'

export type ThemeContextValue = {
  mode: ThemeMode
  /** mode 为 system 时是系统当前的主题，否则等于 mode */
  theme: ThemeName
  setMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
