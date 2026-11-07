import { useRef, type KeyboardEvent } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
}

/** 与 Button 的尺寸体系保持一致 */
export type SegmentedSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type SegmentedProps<T extends string> = {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  /** 无障碍名称，控件本身通常没有可见标题 */
  ariaLabel: string
  /** 控件高度，默认 xs（30px） */
  size?: SegmentedSize
  /** 撑满父容器，各段等宽 */
  block?: boolean
  disabled?: boolean
  className?: string
}

/**
 * 分段选择器：一组互斥选项并排，当前项整段高亮。
 * 适合「说话显示 / 常显」这类少量枚举的即时切换。
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'xs',
  block = false,
  disabled = false,
  className,
}: SegmentedProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)

  // 方向键在选项间移动（radio 组的键盘约定），焦点跟着选中项
  const move = (event: KeyboardEvent<HTMLButtonElement>, step: 1 | -1) => {
    const index = options.findIndex((option) => option.value === value)
    if (index < 0) return
    event.preventDefault()
    const nextIndex = (index + step + options.length) % options.length
    onChange(options[nextIndex].value)
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[nextIndex]?.focus()
  }

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(styles.root, styles[size], block && styles.block, disabled && styles.disabled, className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // radio 组只让选中项进 Tab 序列，其余靠方向键
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            className={cx(styles.option, selected && styles.selected)}
            onClick={() => { if (!selected) onChange(option.value) }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(event, 1)
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(event, -1)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
