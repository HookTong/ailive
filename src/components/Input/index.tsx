import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type InputSize = 'sm' | 'md' | 'lg'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** md = 32px（默认），sm = 28px，lg = 36px */
  size?: InputSize
  /** bare 去掉边框与底色，用于包在自定义外壳里的输入框 */
  variant?: 'default' | 'bare'
}

export function Input({ size = 'md', variant = 'default', className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={cx(styles.input, styles[size], variant === 'bare' && styles.bare, className)}
    />
  )
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...rest }: TextareaProps) {
  return <textarea {...rest} className={cx(styles.textarea, className)} />
}
