import { cx } from '../../utils/cx'
import { Tooltip } from '../Tooltip'
import styles from './index.module.scss'

export type ColorSelectProps = {
  /** 当前颜色，命中 options 里的某一项时该色点高亮 */
  value: string
  /** 预设色点 */
  options: readonly string[]
  onChange: (color: string) => void
  disabled?: boolean
  /** 整组色点的无障碍名称 */
  ariaLabel?: string
  /** 末尾自定义取色的悬浮提示 */
  customLabel?: string
  className?: string
}

/**
 * 一排圆形色点 + 末尾一个彩虹自定义取色。
 * 当前颜色不在预设里时，高亮落在自定义取色上。
 */
export function ColorSelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel = '颜色快捷选择',
  customLabel = '自定义颜色',
  className,
}: ColorSelectProps) {
  const isPresetColor = options.includes(value)

  return (
    <div className={cx(styles.root, className)} role="group" aria-label={ariaLabel}>
      {options.map((swatch) => (
        <button
          key={swatch}
          type="button"
          disabled={disabled}
          aria-label={`设置颜色 ${swatch}`}
          aria-pressed={value === swatch}
          className={cx(styles.swatch, value === swatch && styles.swatchActive)}
          style={{ backgroundColor: swatch }}
          onClick={() => onChange(swatch)}
        />
      ))}
      <Tooltip placement="top" title={customLabel}>
        <label
          className={cx(
            styles.picker,
            disabled && styles.pickerDisabled,
            !isPresetColor && styles.pickerActive,
          )}
        >
          <input
            type="color"
            disabled={disabled}
            value={value}
            aria-label={customLabel}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </Tooltip>
    </div>
  )
}
