import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type InputSize = 'sm' | 'md' | 'lg'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** md = 32px（默认），sm = 28px，lg = 36px */
  size?: InputSize
  /** bare 去掉边框与底色，用于包在自定义外壳里的输入框 */
  variant?: 'default' | 'bare'
}

/** 眼睛图标：睁眼表示「点了能看见」，加斜线表示「点了会藏起来」 */
function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.6 8S4 4.2 8 4.2 14.4 8 14.4 8 12 11.8 8 11.8 1.6 8 1.6 8Z" />
      <circle cx="8" cy="8" r="1.7" />
      {crossed && <path d="M2.6 13.4 13.4 2.6" />}
    </svg>
  )
}

/**
 * 默认关掉浏览器自动填充：这类表单填的是接口 Key / 地址 / 人设，
 * 没有一项能从浏览器记住的表单历史里受益，被填反而会污染配置。
 * 密码类字段光靠 off 不管用，调用方需要显式传 new-password。
 */
export function Input({
  size = 'md',
  variant = 'default',
  type,
  className,
  autoComplete = 'off',
  ...rest
}: InputProps) {
  const [revealed, setRevealed] = useState(false)
  // 只有密码框需要眼睛；bare 是嵌在自定义外壳里的，位置由调用方决定，不掺和
  const isPassword = type === 'password' && variant !== 'bare'

  const field = (
    <input
      {...rest}
      type={isPassword && revealed ? 'text' : type}
      autoComplete={autoComplete}
      className={cx(
        styles.input,
        styles[size],
        variant === 'bare' && styles.bare,
        isPassword && styles.affixed,
        className,
      )}
    />
  )

  if (!isPassword) return field

  return (
    <span className={styles.wrap}>
      {field}
      <button
        type="button"
        className={styles.reveal}
        aria-label={revealed ? '隐藏密码' : '显示密码'}
        aria-pressed={revealed}
        // 别让点击抢走输入框焦点，否则光标会跳回末尾、输入法也会被打断
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setRevealed((current) => !current)}
      >
        <EyeIcon crossed={revealed} />
      </button>
    </span>
  )
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, autoComplete = 'off', ...rest }: TextareaProps) {
  return <textarea {...rest} autoComplete={autoComplete} className={cx(styles.textarea, className)} />
}
