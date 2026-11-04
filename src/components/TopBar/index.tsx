import { useVoice } from '../../hooks'
import { Button } from '../Button'
import { TtsConfigModal } from '../TtsConfigModal'
import styles from './index.module.scss'

/**
 * 顶部品牌栏：左侧 logo + 站点名，右侧 TTS 配置入口、在线状态与头像。
 * TTS 配置弹窗挂在这里，全局只有一份。
 */
export function TopBar() {
  const { ttsConfigOpen, openTtsConfig, closeTtsConfig } = useVoice()

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>✦</span>
        <span>AI LIVE<span className={styles.brandMuted}>.studio</span></span>
      </div>
      <div className={styles.meta}>
        <Button variant="ghost" size="xs" className={styles.configButton} onClick={openTtsConfig}>
          配置火山 TTS
        </Button>
        <span className={styles.statusPill}><i /> 系统在线</span>
        <span className={styles.avatar}>A</span>
      </div>
      <TtsConfigModal open={ttsConfigOpen} onClose={closeTtsConfig} />
    </header>
  )
}
