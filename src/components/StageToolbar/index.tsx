import { useEffect, useRef, useState } from 'react'
import { Button } from '../Button'
import styles from './index.module.scss'

type StageToolbarProps = {
  /** 左上角的直播概览卡片组是否可见 */
  showOverview: boolean
  /** 「礼物动作」浮动面板是否可见 */
  showGiftMotions: boolean
  /** 弹幕面板是否可见 */
  showLiveChat: boolean
  onToggleOverview: () => void
  onToggleGiftMotions: () => void
  onToggleLiveChat: () => void
}

/**
 * 舞台顶部工具条：左边 LIVE PREVIEW 标识，右边几个文字按钮。
 * 概览、礼物动作、弹幕三块浮层各有各的开关，互不影响。
 */
export function StageToolbar({
  showOverview,
  showGiftMotions,
  showLiveChat,
  onToggleOverview,
  onToggleGiftMotions,
  onToggleLiveChat,
}: StageToolbarProps) {
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
        <Button variant="ghost" size="xs" className={styles.toolButton} onClick={onToggleOverview}>
          {showOverview ? '隐藏概览' : '显示概览'}
        </Button>
        <Button variant="ghost" size="xs" className={styles.toolButton} onClick={onToggleGiftMotions}>
          {showGiftMotions ? '隐藏礼物动作' : '显示礼物动作'}
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
