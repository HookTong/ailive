import { useAiChat, useLiveData, useVoice } from '../../hooks'
import { Button } from '../Button'
import { AiConfigDrawer } from '../AiConfigDrawer'
import { LiveConfigDrawer } from '../LiveConfigDrawer'
import { ThemeMenu } from '../ThemeMenu'
import { TtsConfigModal } from '../TtsConfigModal'
import styles from './index.module.scss'

/**
 * 顶部品牌栏：左侧 logo + 站点名，右侧直播 / AI / TTS 三个配置入口 + 主题切换。
 * 三个配置界面都挂在这里，全局各一份（AI 配置是右侧抽屉，另外两个是弹窗）。
 */
export function TopBar() {
  const { ttsConfigOpen, openTtsConfig, closeTtsConfig } = useVoice()
  const { aiConfigOpen, openAiConfig, closeAiConfig, status } = useAiChat()
  const { openLiveConfig } = useLiveData()

  // AI 在工作（思考/播报）时按钮亮一点，方便确认自动回复真的在跑
  const aiActive = status === 'thinking' || status === 'speaking'

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>✦</span>
        <span>AI LIVE<span className={styles.brandMuted}>.studio</span></span>
      </div>
      <div className={styles.meta}>
        <Button variant="ghost" size="xs" className={styles.configButton} onClick={openLiveConfig}>
          直播配置
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className={aiActive ? styles.configButtonActive : styles.configButton}
          onClick={openAiConfig}
        >
          AI 配置{status === 'off' ? '' : ' · ' + (status === 'thinking' ? '思考中' : status === 'speaking' ? '播报中' : '已开启')}
        </Button>
        <Button variant="ghost" size="xs" className={styles.configButton} onClick={openTtsConfig}>
          TTS 配置
        </Button>
        <ThemeMenu />
      </div>
      <LiveConfigDrawer />
      <AiConfigDrawer open={aiConfigOpen} onClose={closeAiConfig} />
      <TtsConfigModal open={ttsConfigOpen} onClose={closeTtsConfig} />
    </header>
  )
}
