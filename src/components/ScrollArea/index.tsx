import { createElement, forwardRef, type ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type ScrollAreaProps = {
  children: ReactNode
  /** 渲染标签，弹幕列表用 ul */
  as?: 'div' | 'ul' | 'ol'
  /** 固定高度，例如 clamp(104px, 16vh, 178px) */
  height?: string
  /** 最大高度，内容少时容器自适应 */
  maxHeight?: string
  /** 列数，1 = 单列列表 */
  columns?: number
  /** 网格间距 */
  gap?: string
  /** 是否带边框与底色 */
  framed?: boolean
  role?: string
  ariaLabel?: string
  className?: string
}

/**
 * 容器内滚动区：统一细滚动条、网格排版与（可选的）边框底色。
 * 高度/列数/间距都由调用方配置，替代各处手写的 overflow 容器。
 */
export const ScrollArea = forwardRef<HTMLElement, ScrollAreaProps>(function ScrollArea(
  {
    children,
    as = 'div',
    height,
    maxHeight,
    columns = 1,
    gap,
    framed = false,
    role,
    ariaLabel,
    className,
  },
  ref,
) {
  return createElement(
    as,
    {
      ref,
      role,
      'aria-label': ariaLabel,
      className: cx(styles.root, styles.grid, framed && styles.framed, className),
      style: {
        height,
        maxHeight,
        gap,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      },
    },
    children,
  )
})
