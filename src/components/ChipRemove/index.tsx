import type { KeyboardEvent } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type ChipRemoveProps = {
  /** 删的是哪一项，用来拼无障碍名称「删除 xxx」 */
  label: string
  onRemove: () => void
  className?: string
}

/**
 * 胶囊右侧的删除角标。
 *
 * 平时只有一根淡淡的 ×，鼠标移入才铺上圆底 —— 常显一个实心圆太抢眼，
 * 而 × 本身留着，触屏和键盘用户才找得到入口。
 *
 * 用 `span + role="button"` 而不是嵌套 `<button>`：HTML 不允许 button 套 button，
 * 而且这样点删除不会顺带触发外层胶囊的选中。
 */
export function ChipRemove({ label, onRemove, className }: ChipRemoveProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    // 空格默认会滚动页面、回车会冒泡到外层胶囊触发选中，都得拦下来
    event.preventDefault()
    event.stopPropagation()
    onRemove()
  }

  return (
    <span
      className={cx(styles.remove, className)}
      role="button"
      tabIndex={0}
      aria-label={`删除 ${label}`}
      // 胶囊外面可能套着 Tooltip，点删除时别再把「xxx」的提示弹出来
      data-tooltip-ignore="true"
      onClick={(event) => {
        event.stopPropagation()
        onRemove()
      }}
      onKeyDown={handleKeyDown}
    />
  )
}
