import { useEffect, useRef } from 'react'
import { describeRoomState, useDragPosition, useLiveData, type LiveFeedItem, type LiveRoomState } from '../../hooks'
import { giftIcon, giftPrice } from '../../data/gifts'
import { cx } from '../../utils/cx'
import { Card, type CardDotTone } from '../Card'
import { ScrollArea } from '../ScrollArea'
import styles from './index.module.scss'

type LiveChatProps = {
  live: LiveRoomState
}

// 连接状态 -> 标题圆点配色；未列出的状态走 idle 灰点
const DOT_TONE: Record<string, CardDotTone | undefined> = {
  live: 'live',
  connecting: 'warn',
  reconnecting: 'warn',
  error: 'error',
  offline: 'error',
}

const ROW_TONE: Record<LiveFeedItem['kind'], string | undefined> = {
  chat: styles.rowChat,
  gift: styles.rowGift,
  member: styles.rowMember,
  follow: styles.rowFollow,
  stats: styles.rowStats,
}

function FeedRow({ item }: { item: LiveFeedItem }) {
  const { giftPrices } = useLiveData()

  if (item.kind === 'stats') {
    return <li className={cx(styles.row, styles.rowStats)}>{item.text}</li>
  }

  // 送礼行按礼物名查单价，折算成这次打赏大概值多少钱
  if (item.kind === 'gift') {
    const count = item.count ?? 1
    const amount = giftPrice(giftPrices, item.text) * count
    const icon = giftIcon(item.text)
    return (
      <li className={cx(styles.row, styles.rowGift)}>
        <b>{item.name}</b>
        <span>
          送出
          {icon && <img className={styles.feedIcon} src={icon} alt="" aria-hidden />}
          <em>{item.text}</em>
          {count > 1 ? ` ×${count}` : ''}
          {amount > 0 && <i className={styles.amount}>≈{amount.toFixed(2)} 元</i>}
        </span>
      </li>
    )
  }

  return (
    <li className={cx(styles.row, ROW_TONE[item.kind])}>
      <b>{item.name}</b>
      {item.kind === 'chat' && <span>{item.text}</span>}
      {item.kind === 'member' && <span>{item.text}</span>}
      {item.kind === 'follow' && <span>{item.text}</span>}
    </li>
  )
}

/**
 * 弹幕面板。直播状态由 LiveDataProvider 通过 useLiveServer 统一持有，
 * 这样舞台卡片（今日守护等）和面板共享同一条 SSE 连接。
 * 房间号的连接入口在顶栏「直播配置」弹窗里，这里只负责展示。
 */
export function LiveChat({ live }: LiveChatProps) {
  const listRef = useRef<HTMLUListElement>(null)
  // 整张卡片都能拖：handlers 挂在 Card 根节点上，
  // 交互元素由 useDragPosition 内部的 INTERACTIVE 守卫自动排除
  const { ref, transform, handlers } = useDragPosition<HTMLElement>({ draggingClassName: styles.dragging })

  const { state, room, error, feed, stats } = live

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [feed])

  return (
    <Card
      as="aside"
      ref={ref}
      className={styles.panel}
      style={{ transform }}
      {...handlers}
      aria-label="抖音直播间监听"
      padding="sm"
      title="抖音直播"
      dot={DOT_TONE[state] ?? 'idle'}
      status={describeRoomState(state, room)}
      extra={stats.online ?? '—'}
      headerProps={{ className: styles.head }}
    >
      {error && <p className={styles.error}>{error}</p>}

      {room?.room_title && <p className={styles.roomTitle}>{room.room_title}</p>}

      <div className={styles.metrics}>
        <span>弹幕 <b>{stats.chat}</b></span>
        <span>礼物 <b>{stats.gift}</b></span>
        <span>进场 <b>{stats.member}</b></span>
        <span>关注 <b>{stats.follow}</b></span>
      </div>

      <ScrollArea as="ul" className={styles.feed} ref={listRef}>
        {feed.length === 0 ? (
          <li className={styles.feedEmpty}>连接直播间后显示弹幕</li>
        ) : (
          feed.map((item) => <FeedRow key={item.id} item={item} />)
        )}
      </ScrollArea>
    </Card>
  )
}
