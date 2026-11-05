import { useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
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

/** 数字框的上下小三角 */
function CaretIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 8 5" width="7" height="5" fill="currentColor" aria-hidden="true">
      {up ? <path d="M4 0 8 5H0z" /> : <path d="M0 0h8L4 5z" />}
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
  const inputRef = useRef<HTMLInputElement>(null)
  // 只有密码框需要眼睛、数字框需要步进器；bare 是嵌在自定义外壳里的，位置由调用方决定，不掺和
  const isPassword = type === 'password' && variant !== 'bare'
  const isNumber = type === 'number' && variant !== 'bare'

  const field = (
    <input
      {...rest}
      ref={inputRef}
      type={isPassword && revealed ? 'text' : type}
      autoComplete={autoComplete}
      className={cx(
        styles.input,
        styles[size],
        variant === 'bare' && styles.bare,
        (isPassword || isNumber) && styles.affixed,
        className,
      )}
    />
  )

  /**
   * 原生 spinner 在暗色主题上是个白方块，Chrome 又不给改颜色，所以用 CSS 把它藏了、
   * 自己画一对箭头。stepUp/stepDown 会遵循 min/max/step，再补发 input 事件让 React 的
   * onChange 收到新值 —— 这样调用方的受控逻辑不用改。
   */
  const stepBy = (direction: 1 | -1) => {
    const el = inputRef.current
    if (!el) return
    if (direction > 0) el.stepUp()
    else el.stepDown()
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  if (isPassword) {
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

  if (isNumber) {
    return (
      <span className={styles.wrap}>
        {field}
        <span className={styles.stepper}>
          <button
            type="button"
            className={styles.stepButton}
            aria-label="增加"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stepBy(1)}
          >
            <CaretIcon up />
          </button>
          <button
            type="button"
            className={styles.stepButton}
            aria-label="减少"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => stepBy(-1)}
          >
            <CaretIcon up={false} />
          </button>
        </span>
      </span>
    )
  }

  return field
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, autoComplete = 'off', ...rest }: TextareaProps) {
  return <textarea {...rest} autoComplete={autoComplete} className={cx(styles.textarea, className)} />
}
