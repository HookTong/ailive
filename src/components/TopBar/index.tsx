import styles from './index.module.scss'

/**
 * 顶部品牌栏：左侧 logo + 站点名，右侧在线状态与头像。
 * 纯展示，不接任何状态。
 */
export function TopBar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>✦</span>
        <span>AI LIVE<span className={styles.brandMuted}>.studio</span></span>
      </div>
      <div className={styles.meta}>
        <span className={styles.statusPill}><i /> 系统在线</span>
        <span className={styles.avatar}>A</span>
      </div>
    </header>
  )
}
