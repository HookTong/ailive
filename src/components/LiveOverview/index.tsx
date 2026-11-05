import { useLiveData, useDragPosition, useMusic } from '../../hooks'
import { cx } from '../../utils/cx'
import { Card } from '../Card'
import { NowPlayingCard } from '../NowPlayingCard'
import styles from './index.module.scss'

// 概览卡片的数据结构就定义在本目录的 types.ts，组件出口一并导出
export type { LiveOverviewType } from './types'

/**
 * 舞台左上角的直播概览卡片组：正在播放 / 收支面板 / 今日守护。
 * 数据直接从 LiveDataContext 取，不需要外部传参；整块可在舞台内拖动。
 */
export function LiveOverview() {
  const { liveOverview } = useLiveData()
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
        <Card className={cx(styles.card, styles.income)} title="收支面板">
          <strong>{liveOverview.income.balance} <small>元</small></strong>
          <div className={styles.metrics}>
            <span>收入 <b>{liveOverview.income.income}</b></span>
            <span>支出 <b>{liveOverview.income.expense}</b></span>
          </div>
          <dl>
            <dt>今日获票</dt><dd>{liveOverview.income.todayVotes}</dd>
            <dt>礼物</dt><dd>{liveOverview.income.gifts}</dd>
            <dt>今日 token</dt><dd>{liveOverview.income.tokens}</dd>
          </dl>
        </Card>
        <Card className={cx(styles.card, styles.guard)} title="今日守护">
          <ol>
            {liveOverview.guardians.length > 0
              ? liveOverview.guardians.map((guardian) => (
                <li key={`${guardian.rank}-${guardian.name}`}>
                  <i>{guardian.highlighted ? '☺' : guardian.rank}</i>
                  <span>{guardian.name}</span>
                  <b>{guardian.amount}</b>
                </li>
              ))
              : <li className={styles.guardEmpty}>连接直播间后按礼物数排名</li>}
          </ol>
        </Card>
      </div>
    </div>
  )
}
