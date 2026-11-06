import { useLiveData, useDragPosition, useMusic, useAiChat } from '../../hooks'
import { giftPrice } from '../../data/gifts'
import { cx } from '../../utils/cx'
import { Card } from '../Card'
import { NowPlayingCard } from '../NowPlayingCard'
import styles from './index.module.scss'

/** 金额统一两位小数；token 数带千分位 */
function money(value: number) {
  return value.toFixed(2)
}

function tokens(value: number) {
  return value.toLocaleString('zh-CN')
}

/**
 * 舞台左上角的直播概览卡片组：正在播放 / 收支面板 / 礼物榜。
 * 数据直接从 LiveDataContext 取，不需要外部传参；整块可在舞台内拖动。
 *
 * 礼物动作清单不在这里 —— 它是独立浮动的 `GiftMotionPanel`，可以单独拖到别的角落。
 */
export function LiveOverview() {
  const { douyinRoom, giftPrices } = useLiveData()
  const { settings, usage } = useAiChat()
  const { track, isPlaying, currentTime, duration, analyser } = useMusic()
  const { ref, transform, handlers } = useDragPosition({ draggingClassName: styles.dragging })

  // 礼物榜只统计本次连接，断开重连即清零（useLiveServer 里不落盘）
  const giftRank = douyinRoom.giftRank

  // 收入按「每种礼物的件数 × 该礼物单价」累加；
  // 花费按 token 用量 × 单价折算（单价单位是元/百万 tokens）
  const giftCount = douyinRoom.stats.giftCount
  const revenue = douyinRoom.giftTotals.reduce(
    (sum, item) => sum + giftPrice(giftPrices, item.name) * item.count,
    0,
  )
  const cost = (usage.promptTokens * settings.inputPrice + usage.completionTokens * settings.outputPrice) / 1_000_000
  const profit = revenue - cost

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
          <strong>{money(profit)} <small>元</small></strong>
          <div className={styles.metrics}>
            <span>收入 <b>{money(revenue)}</b></span>
            <span>花费 <b>{money(cost)}</b></span>
          </div>
          <dl>
            <dt>礼物</dt><dd>{giftCount} 件</dd>
            <dt>今日 token</dt><dd>{tokens(usage.totalTokens)}</dd>
          </dl>
        </Card>
        <Card className={cx(styles.card, styles.guard)} title="礼物榜">
          <ol>
            {giftRank.length > 0
              ? giftRank.map((entry, index) => (
                <li key={`${index}-${entry.name}`}>
                  <i>{index + 1}</i>
                  <span>{entry.name}</span>
                  <b>{entry.count} 件</b>
                </li>
              ))
              : <li className={styles.guardEmpty}>连接直播间后按礼物件数排名</li>}
          </ol>
        </Card>
      </div>
    </div>
  )
}
