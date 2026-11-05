import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

/** 标题前状态圆点的配色 */
export type CardDotTone = 'idle' | 'live' | 'warn' | 'error'
/** 卡片内边距：none = 0，sm = 12px，md = 13px 14px */
export type CardPadding = 'none' | 'sm' | 'md'
export type CardTag = 'section' | 'aside' | 'div' | 'article'

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** 卡片标题；不传则不渲染标题行 */
  title?: ReactNode
  /** 标题前的状态圆点 */
  dot?: CardDotTone
  /** 紧跟标题的状态说明 */
  status?: ReactNode
  /** 标题行最右侧的内容 */
  extra?: ReactNode
  /** 标题行的额外属性，例如拖拽事件、自定义类名 */
  headerProps?: HTMLAttributes<HTMLDivElement>
  /** 根元素标签，默认 section */
  as?: CardTag
  /** 内边距，默认 md */
  padding?: CardPadding
}

/**
 * 舞台上的浮动玻璃卡片：统一的毛玻璃底 + 标题行（圆点 / 标题 / 状态 / 右侧插槽）。
 * 定位、宽高、拖拽等布局交给调用方的 className，卡片只负责外观与标题结构。
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, dot, status, extra, headerProps, as = 'section', padding = 'md', className, children, ...rest },
  ref,
) {
  const { className: headerClassName, ...restHeaderProps } = headerProps ?? {}
  const hasHeader = dot !== undefined || title !== undefined || status !== undefined || extra !== undefined
  const Tag = as as ElementType

  return (
    <Tag ref={ref} className={cx(styles.card, styles[padding], className)} {...rest}>
      {hasHeader && (
        <header className={cx(styles.head, headerClassName)} {...restHeaderProps}>
          <div className={styles.title}>
            {dot && <i className={cx(styles.dot, styles[dot])} />}
            {title !== undefined && <strong className={styles.heading}>{title}</strong>}
            {status !== undefined && <small className={styles.status}>{status}</small>}
          </div>
          {extra !== undefined && <div className={styles.extra}>{extra}</div>}
        </header>
      )}
      {children}
    </Tag>
  )
})
