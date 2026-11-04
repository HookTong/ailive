import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import styles from './index.module.scss'

type StageToolbarProps = {
  /** 顶部概览卡片当前是否可见 */
  showInfoCards: boolean
  /** 弹幕面板当前是否可见 */
  showLiveChat: boolean
  onToggleInfoCards: () => void
  onToggleLiveChat: () => void
}

/**
 * 舞台顶部工具条：左边 LIVE PREVIEW 标识，右边三个文字按钮（概览卡片 / 弹幕 / 全屏）。
 */
export function StageToolbar({ showInfoCards, showLiveChat, onToggleInfoCards, onToggleLiveChat }: StageToolbarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

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
    // 工具条的直接父级就是舞台容器，全屏它等于只保留舞台
    const request = rootRef.current?.parentElement?.requestFullscreen?.()
    request?.catch(() => undefined)
  }

  return (
    <div className={styles.toolbar} ref={rootRef}>
      <div><span className={styles.liveDot} /> LIVE PREVIEW</div>
      <div className={styles.actions}>
        <Button variant="ghost" size="xs" className={styles.toolButton} onClick={onToggleInfoCards}>
          {showInfoCards ? '隐藏卡片' : '显示卡片'}
        </Button>
        <Button variant="ghost" size="xs" className={styles.toolButton} onClick={onToggleLiveChat}>
          {showLiveChat ? '隐藏弹幕' : '显示弹幕'}
        </Button>
        <Button variant="ghost" size="xs" className={styles.toolButton} onClick={toggleFullscreen}>
          {isFullscreen ? '退出全屏' : '全屏'}
        </Button>
      </div>
    </div>
  )
}
