import type { CSSProperties } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type SliderProps = {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** 左侧标题，不传则只渲染滑块本身 */
  label?: string
  /** 右侧数值文案，例如 55% / 1.5x */
  valueText?: string
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

/**
 * 带标题与数值的滑块。
 * 文案都在组件内渲染，调用方只需要传值，不用在外面拼 label 行。
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  valueText,
  disabled = false,
  ariaLabel,
  className,
}: SliderProps) {
  // 已填充比例，交给 CSS 画轨道渐变（0 ~ 1）
  const progress = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0

  const input = (
    <input
      className={styles.input}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      style={{ '--slider-progress': progress } as CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  )

  return (
    <label className={cx(styles.slider, className)}>
      {(label || valueText != null) && (
        <span className={styles.head}>
          <span>{label}</span>
          {valueText != null && <b className={styles.value}>{valueText}</b>}
        </span>
      )}
      {input}
    </label>
  )
}
