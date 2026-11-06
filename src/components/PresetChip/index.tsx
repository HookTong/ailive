import { Button } from '../Button'
import { ChipRemove } from '../ChipRemove'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type PresetChipProps = {
  label: string
  active: boolean
  onSelect: () => void
  /**
   * 提供后右侧出现一个删除角标。
   * 只有用户自己添加的项才传 —— 内置预设删不掉。
   */
  onRemove?: () => void
  className?: string
}

/**
 * 预设胶囊：一行文字，选中态整颗高亮。
 *
 * 三处预设列表（舞台背景 / 舞台滤镜 / 背景音乐）共用这一个，删除角标也在这里统一实现，
 * 否则三份几乎一样的结构迟早长歪。
 */
export function PresetChip({ label, active, onSelect, onRemove, className }: PresetChipProps) {
  return (
    <Button
      variant="chip"
      size="xs"
      active={active}
      // 选中态只有颜色差异，读屏用户摸不到；同步一份到 aria-pressed 上
      aria-pressed={active}
      onClick={onSelect}
      className={cx(styles.chip, onRemove && styles.withRemove, className)}
    >
      <span className={styles.label} title={label}>{label}</span>
      {onRemove && <ChipRemove label={label} onRemove={onRemove} />}
    </Button>
  )
}
