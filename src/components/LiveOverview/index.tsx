import { useLiveData, useDragPosition } from '../../hooks'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

/**
 * 舞台左上角的直播概览卡片组：正在播放 / 收支面板 / 点歌排队 / 最近点歌 / 今日守护。
 * 数据直接从 LiveDataContext 取，不需要外部传参；整块可在舞台内拖动。
 */
export function LiveOverview() {
  const { liveOverview } = useLiveData()
  const { ref, transform, handlers } = useDragPosition({ draggingClassName: styles.dragging })

  return (
    <div
      ref={ref}
      className={styles.cards}
      aria-label="舞台信息卡片"
      style={{ transform }}
      {...handlers}
    >
      <div className={styles.nowPlaying}>
        <span className={styles.icon}>◉</span>
        <div>
          <strong>{liveOverview.isLive ? '正在播放' : '未开播'}</strong>
          <b>{liveOverview.nowPlaying.title}</b>
          <small>{liveOverview.nowPlaying.elapsed} / {liveOverview.nowPlaying.duration}</small>
        </div>
        <span className={styles.equalizer}>▂▅▇▅</span>
      </div>
      <div className={styles.grid}>
        <section className={cx(styles.card, styles.income)}>
          <h3>收支面板</h3>
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
        </section>
        <div className={styles.stack}>
          <section className={styles.card}>
            <h3>点歌排队 <small>{liveOverview.songQueue.length} 首</small></h3>
            <div className={styles.empty}>{liveOverview.songQueue[0]?.title ?? '暂无歌曲'}</div>
          </section>
          <section className={styles.card}>
            <h3>最近点歌</h3>
            <ul>{liveOverview.recentSongs.length > 0 ? liveOverview.recentSongs.map((song) => <li key={song.title}>◈ {song.title}</li>) : <li>暂无记录</li>}</ul>
          </section>
        </div>
        <section className={cx(styles.card, styles.guard)}>
          <h3>今日守护</h3>
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
        </section>
      </div>
    </div>
  )
}
