import { useEffect, useRef, useState } from 'react'
import { useTheme, type ThemeMode } from '../../hooks'
import { cx } from '../../utils/cx'
import { Button } from '../Button'
import { Tooltip } from '../Tooltip'
import styles from './index.module.scss'

type ThemeOption = {
  value: ThemeMode
  label: string
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色主题' },
  { value: 'dark', label: '暗黑主题' },
]

/** 菜单和触发按钮共用的图标：显示器 / 太阳 / 月亮 */
function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1" strokeLinecap="round" />
      </svg>
    )
  }
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <path d="M13.4 9.8A5.6 5.6 0 0 1 6.2 2.6a5.8 5.8 0 1 0 7.2 7.2Z" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="1.6" y="2.8" width="12.8" height="8.4" rx="1.4" />
      <path d="M5.6 14h4.8M8 11.2V14" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 顶栏的主题切换：一个图标按钮 + 三项菜单（跟随系统 / 浅色 / 暗黑）。
 *
 * 图标跟着「选的模式」走而不是当前生效的主题 —— 跟随系统时显示显示器图标，
 * 否则用户在浅色系统里看到月亮图标会以为选的是暗色。
 */
export function ThemeMenu() {
  const { mode, setMode } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const current = THEME_OPTIONS.find((option) => option.value === mode) ?? THEME_OPTIONS[0]

  return (
    <div className={styles.root} ref={rootRef}>
      {/* 菜单展开时收起提示：它正好盖在菜单第一项上，把选中圆点挡掉了 */}
      <Tooltip placement="bottom" title={`主题：${current.label}`} disabled={open}>
        <Button
          variant="ghost"
          className={styles.trigger}
          aria-label={`切换主题（当前：${current.label}）`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          <ThemeIcon mode={mode} />
        </Button>
      </Tooltip>

      {open && (
        <div className={styles.menu} role="menu" aria-label="主题">
          {THEME_OPTIONS.map((option) => {
            const active = option.value === mode
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={cx(styles.item, active && styles.itemActive)}
                onClick={() => {
                  setMode(option.value)
                  setOpen(false)
                }}
              >
                <span className={styles.itemIcon}><ThemeIcon mode={option.value} /></span>
                <span className={styles.itemLabel}>{option.label}</span>
                {active && <span className={styles.itemDot} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
