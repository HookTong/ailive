import { Button } from '../Button'
import { ChipRemove } from '../ChipRemove'
import { Tooltip } from '../Tooltip'
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
  /** 整块关掉时（粒子 / 滤镜 / 舞台背景的开关）胶囊跟着不能点 */
  disabled?: boolean
  className?: string
}

/**
 * 预设胶囊：一行文字，选中态整颗高亮。
 *
 * 五处预设列表（舞台背景 / 舞台滤镜 / 背景音乐 / 人声 / 外观）共用这一个，
 * 删除角标也在这里统一实现，否则几份几乎一样的结构迟早长歪。
 *
 * 提示统一用 `Tooltip` 而不是 `title` 属性 —— 原生提示延迟长、样式跟界面两套，
 * 而胶囊里的名字动辄被省略号截断，得有个能立刻看全名的入口。
 * 外层用 block 触发器，胶囊才会撑满栅格单元。
 */
export function PresetChip({ label, active, onSelect, onRemove, disabled = false, className }: PresetChipProps) {
  return (
    <Tooltip block title={label}>
      <Button
        variant="chip"
        size="xs"
        active={active}
        disabled={disabled}
        // 选中态只有颜色差异，读屏用户摸不到；同步一份到 aria-pressed 上
        aria-pressed={active}
        onClick={onSelect}
        className={cx(styles.chip, onRemove && styles.withRemove, className)}
      >
        <span className={styles.label}>{label}</span>
        {onRemove && <ChipRemove label={label} onRemove={onRemove} />}
      </Button>
    </Tooltip>
  )
}
