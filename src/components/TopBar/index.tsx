import { useEffect, useState, type RefObject } from 'react'
import { useAiChat, useLiveData, useVoice } from '../../hooks'
import { Button } from '../Button'
import { AiConfigDrawer } from '../AiConfigDrawer'
import { LiveConfigDrawer } from '../LiveConfigDrawer'
import { ThemeMenu } from '../ThemeMenu'
import { TtsConfigModal } from '../TtsConfigModal'
import styles from './index.module.scss'

type TopBarProps = {
  /**
   * 舞台容器。全屏只保留中间那块舞台，不是整个应用 ——
   * 原来这个按钮在舞台自己的工具条上（父级就是舞台），工具条拆掉后挪到这里，
   * 得由 App 把节点传进来，别用 querySelector 去猜。
   */
  stagePanelRef: RefObject<HTMLElement>
}

/**
 * 顶部品牌栏：左侧 logo + 站点名，右侧直播 / AI / TTS 三个配置入口、全屏、主题切换。
 * 三个配置界面都挂在这里，全局各一份（AI 配置是右侧抽屉，另外两个是弹窗）。
 */
export function TopBar({ stagePanelRef }: TopBarProps) {
  const { ttsConfigOpen, openTtsConfig, closeTtsConfig } = useVoice()
  const { aiConfigOpen, openAiConfig, closeAiConfig, status } = useAiChat()
  const { openLiveConfig } = useLiveData()
  const [isFullscreen, setIsFullscreen] = useState(false)

  // AI 在工作（思考/播报）时按钮亮一点，方便确认自动回复真的在跑
  const aiActive = status === 'thinking' || status === 'speaking'

  // 用户按 Esc 退出全屏时浏览器不会通知按钮，只能监听这个事件把文案同步回来
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    const target = stagePanelRef.current
    if (!target) return
    target.requestFullscreen().catch(() => undefined)
  }

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
        <Button variant="ghost" size="xs" className={styles.configButton} onClick={toggleFullscreen}>
          {isFullscreen ? '退出全屏' : '全屏'}
        </Button>
        <ThemeMenu />
      </div>
      <LiveConfigDrawer />
      <AiConfigDrawer open={aiConfigOpen} onClose={closeAiConfig} />
      <TtsConfigModal open={ttsConfigOpen} onClose={closeTtsConfig} />
    </header>
  )
}
