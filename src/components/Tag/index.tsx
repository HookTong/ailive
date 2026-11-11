import type { ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type TagTone = 'accent' | 'neutral'

export type TagProps = {
  children: ReactNode
  /**
   * `accent`：浮起底 + 主色字，用在说明区（示例、清单）；
   * `neutral`：描边 + 凹陷底，压在舞台毛玻璃上不抢眼。
   */
  tone?: TagTone
  /** 内容是字面量（指令模板这种）就用 `code`，语义更准 */
  as?: 'code' | 'span'
  className?: string
}

/**
 * 静态小标签：一段等宽字面量，淡底 + 小圆角。
 *
 * **不是按钮** —— 没有 hover、没有焦点环、点了也没反应。
 * 要能点的用 `PresetChip`（那套带选中态和 Tooltip）。
 * 单行放不下时整条省略，不折行 —— 指令从中间断开就看不出怎么拼了。
 */
export function Tag({ children, tone = 'accent', as: Component = 'code', className }: TagProps) {
  return <Component className={cx(styles.tag, styles[tone], className)}>{children}</Component>
}
