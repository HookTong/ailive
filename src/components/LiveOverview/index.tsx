import { useDragPosition, useMusic } from '../../hooks'
import { NowPlayingCard } from '../NowPlayingCard'
import { IncomeCard } from '../IncomeCard'
import { GiftRankCard } from '../GiftRankCard'
import styles from './index.module.scss'

/**
 * 舞台左上角的直播概览卡片组：正在播放 / 收支面板 / 礼物榜。
 * 这里只负责摆放和整块拖动，三张卡片各自取数据、各自管样式。
 *
 * 礼物动作清单不在这里 —— 它是独立浮动的 `GiftMotionCard`，可以单独拖到别的角落。
 */
export function LiveOverview() {
  const { track, isPlaying, currentTime, duration, analyser } = useMusic()
  const { ref, transform, handlers } = useDragPosition({ draggingClassName: styles.dragging })

  return (
    <div
      ref={ref}
      className={styles.cards}
      aria-label="舞台信息卡片"
      style={{ transform }}
      {...handlers}
    >
      <NowPlayingCard
        status={isPlaying ? '正在播放' : '已暂停'}
        title={track.name}
        elapsed={currentTime}
        duration={duration}
        playing={isPlaying}
        analyser={analyser}
      />
      <div className={styles.grid}>
        <IncomeCard />
        <GiftRankCard />
      </div>
    </div>
  )
}
