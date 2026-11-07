import { createElement, forwardRef, type ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

/**
 * 舞台控制台里五处预设按钮组（背景 / 粒子 / 滤镜 / 音乐 / 外观）共用的高度上限。
 * 胶囊 30px + 间距 5px，**4 行正好 135px** —— 取这个值，正好 4 行时 `scrollHeight`
 * 与 `clientHeight` 相等、不会冒出滚动条；第 5 行起才滚，且滚到的位置刚好是整 4 行。
 * 别再往大里调：多 1px 就会在「刚好 4 行」时出现滚动条（曾经是 140px，多出的 5px
 * 只露出第 5 行的上边框，看着像被切了一截）。五处必须用同一个值，各写各的迟早对不齐。
 */
export const PRESET_GRID_MAX_HEIGHT = '135px'

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
      className: cx(styles.root, styles.grid, className),
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
