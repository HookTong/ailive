import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dashed' | 'danger' | 'chip' | 'bare'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  /** 不传则不设置高度/内边距，交给调用方的模块样式决定 */
  size?: ButtonSize
  /** 撑满父容器宽度 */
  block?: boolean
  /** 胶囊类按钮的选中态 */
  active?: boolean
  /** 正方形图标按钮 */
  iconOnly?: boolean
}

/**
 * 全站统一按钮。
 * variant 负责配色与边框，size 负责高度/内边距/字号，
 * 特殊版式（工具栏图标、发送键）用 variant="bare" + 自己的模块样式覆盖。
 */
export function Button({
  variant = 'primary',
  size,
  block = false,
  active = false,
  iconOnly = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(
        styles.button,
        styles[variant],
        size && styles[size],
        block && styles.block,
        active && styles.active,
        iconOnly && styles.iconOnly,
        className,
      )}
    />
  )
}
