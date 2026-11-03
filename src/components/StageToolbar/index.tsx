import { Button } from '../Button'
import { Tooltip } from '../Tooltip'
import styles from './index.module.scss'

type StageToolbarProps = {
  /** 顶部信息卡当前是否可见 */
  showInfoCards: boolean
  onToggleInfoCards: () => void
}

/**
 * 舞台顶部工具条：左边 LIVE PREVIEW 标识，右边信息卡 / 全屏 / 更多。
 */
export function StageToolbar({ showInfoCards, onToggleInfoCards }: StageToolbarProps) {
  const toggleLabel = showInfoCards ? '隐藏顶部卡片' : '显示顶部卡片'

  return (
    <div className={styles.toolbar}>
      <div><span className={styles.liveDot} /> LIVE PREVIEW</div>
      <div className={styles.actions}>
        <Tooltip placement="bottom" title={toggleLabel}>
          <Button
            variant="bare"
            className={styles.toolButton}
            aria-label={toggleLabel}
            onClick={onToggleInfoCards}
          >
            {showInfoCards ? '▣' : '□'}
          </Button>
        </Tooltip>
        <Tooltip placement="bottom" title="全屏">
          <Button variant="bare" className={styles.toolButton}>↗</Button>
        </Tooltip>
        <Tooltip placement="bottom" title="更多">
          <Button variant="bare" className={styles.toolButton}>•••</Button>
        </Tooltip>
      </div>
    </div>
  )
}
