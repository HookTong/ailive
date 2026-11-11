import type { ReactNode } from 'react'
import { Tooltip } from '../Tooltip'
import styles from './index.module.scss'

export type HintIconProps = {
  /** 提示内容。传字符串时同时用作图标的无障碍名称 */
  hint: ReactNode
  /** `hint` 是节点时单独给读屏用的文字 */
  label?: string
  /**
   * 弹层方向，默认朝下。
   *
   * 注意 `top` / `bottom` 都是**以图标为中心水平居中**的：图标贴着视口左边时
   * （角色控制台左侧面板就是），稍长一点的提示会顶到屏幕外，左半句直接看不见。
   * 所以面板里的图标一律传 `right`，往内容区那侧展开。
   */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * 标题后面那颗「i」：悬停或键盘聚焦时弹一句说明。
 *
 * 图标是内联 SVG，**别用字符 ⓘ** —— 字体里的这个字符基线偏高，和 12px 的字对不齐，
 * 调 margin 也只是在不同字体栈下换一种歪法。
 *
 * 触发元素是个 `span`，默认收不到焦点，所以必须显式 `tabIndex={0}`，
 * 否则键盘用户永远看不到提示；`role="img"` + `aria-label` 让读屏也能读到同一句话。
 */
export function HintIcon({ hint, label, placement = 'bottom' }: HintIconProps) {
  return (
    <Tooltip placement={placement} title={hint}>
      <span
        className={styles.root}
        role="img"
        aria-label={label ?? (typeof hint === 'string' ? hint : undefined)}
        tabIndex={0}
      >
        <svg
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="5" />
          <path d="M6 5.5v3" strokeLinecap="round" />
          <circle cx="6" cy="3.6" r="0.72" fill="currentColor" stroke="none" />
        </svg>
      </span>
    </Tooltip>
  )
}
