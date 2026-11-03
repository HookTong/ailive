import { useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

type TooltipProps = {
  placement?: TooltipPlacement
  title: string
  children: ReactNode
  /** 触发元素需要撑满父容器时打开（音色胶囊等） */
  block?: boolean
}

export function Tooltip({ placement = 'top', title, children, block = false }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})

  const show = (event: React.PointerEvent<HTMLSpanElement>) => {
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
      {visible && <span className={styles.popup} style={style} role="tooltip">{title}</span>}
    </span>
  )
}
