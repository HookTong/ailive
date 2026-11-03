import styles from './index.module.scss'

/**
 * 底部信息栏：左侧产品名，中间资源声明，右侧快捷键提示。
 * 纯展示，不接任何状态。
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.brand}>AI LIVE STUDIO</span>
      <span className={styles.support}>模型资源由 Live2D Cubism 提供支持</span>
      <span className={styles.shortcut}>⌘ K 快捷键</span>
    </footer>
  )
}
