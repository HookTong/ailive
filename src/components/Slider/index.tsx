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
  /** 轨道左下方说明，例如「较小」 */
  minLabel?: string
  /** 轨道右下方说明，例如「较大」 */
  maxLabel?: string
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

/**
 * 带标题、数值与两端说明的滑块。
 * 所有文案都在组件内渲染，调用方只需要传值，不用在外面拼 label 行。
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  valueText,
  minLabel,
  maxLabel,
  disabled = false,
  ariaLabel,
  className,
}: SliderProps) {
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
      {(minLabel || maxLabel) && (
        <span className={styles.range}>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </span>
      )}
    </label>
  )
}
