import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  /** 无障碍名称，开关本身没有可见文字 */
  ariaLabel: string
  disabled?: boolean
  className?: string
}

/** 胶囊开关（粒子特效 / 舞台滤镜的启停） */
export function Switch({ checked, onChange, ariaLabel, disabled = false, className }: SwitchProps) {
  return (
    <label className={cx(styles.root, className)}>
      <input
        className={styles.input}
        type="checkbox"
        role="switch"
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.track} aria-hidden="true" />
    </label>
  )
}
