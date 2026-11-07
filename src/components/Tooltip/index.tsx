import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

type TooltipProps = {
  placement?: TooltipPlacement
  /** 提示内容。需要分色 / 分段的调用方可以传节点，普通文字直接传字符串 */
  title: ReactNode
  children: ReactNode
  /** 触发元素需要撑满父容器时打开（音色胶囊等） */
  block?: boolean
  /** 禁用后完全不弹提示，用于「同一个触发元素在某些状态下不该有提示」的场景 */
  disabled?: boolean
}

export function Tooltip({ placement = 'top', title, children, block = false, disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})

  // 外部切到禁用时立刻收起已经弹出来的提示
  useEffect(() => {
    if (disabled) setVisible(false)
  }, [disabled])

  const show = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled) {
      setVisible(false)
      return
    }
    if (event.target instanceof Element && event.target.closest('[data-tooltip-ignore]')) {
      setVisible(false)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const gap = 8
    if (placement === 'bottom') {
      setStyle({ left: `${rect.left + rect.width / 2}px`, top: `${rect.bottom + gap}px`, transform: 'translate(-50%, 0)' })
    } else if (placement === 'left') {
      setStyle({ left: `${rect.left - gap}px`, top: `${rect.top + rect.height / 2}px`, transform: 'translate(-100%, -50%)' })
    } else if (placement === 'right') {
      setStyle({ left: `${rect.right + gap}px`, top: `${rect.top + rect.height / 2}px`, transform: 'translate(0, -50%)' })
    } else {
      setStyle({ left: `${rect.left + rect.width / 2}px`, top: `${rect.top - gap}px`, transform: 'translate(-50%, -100%)' })
    }
    setVisible(true)
  }

  const showOnFocus = (event: React.FocusEvent<HTMLSpanElement>) => {
    if (disabled) {
      setVisible(false)
      return
    }
    if (event.target instanceof Element && event.target.closest('[data-tooltip-ignore]')) {
      setVisible(false)
      return
    }
    setVisible(true)
  }

  return (
    <span
      className={cx(styles.trigger, block && styles.blockTrigger)}
      onPointerEnter={show}
      onPointerLeave={() => setVisible(false)}
      onFocus={showOnFocus}
      onBlur={() => setVisible(false)}
    >
      {children}
      {/*
        弹层挂到 body：`Drawer` 用 `transform: translateX()` 做进场动画，而带 `transform` 的祖先
        会成为 `position: fixed` 的包含块 —— 留在原地的话提示会按「相对抽屉」定位，整块飘到屏幕外。
        `.popup` 的字体/颜色都是显式声明的，不依赖继承，挪走不会掉样式。
      */}
      {visible && !disabled && createPortal(
        <span className={styles.popup} style={style} role="tooltip">{title}</span>,
        document.body,
      )}
    </span>
  )
}
