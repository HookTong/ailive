import { useEffect, useRef, useState } from 'react'
import { normalizeWebRid } from '../../hooks/useLiveServer/api'
import { describeRoomState, useDragPosition, type LiveFeedItem, type LiveRoomState } from '../../hooks'
import { cx } from '../../utils/cx'
import { Button } from '../Button'
import { Input } from '../Input'
import { ScrollArea } from '../ScrollArea'
import styles from './index.module.scss'

type LiveChatProps = {
  roomId: string | null
  onRoomIdChange: (roomId: string | null) => void
  live: LiveRoomState
}

// 连接状态 -> 指示灯配色；closed / idle 走基础色
const DOT_TONE: Record<string, string | undefined> = {
  live: styles.dotLive,
  connecting: styles.dotConnecting,
  reconnecting: styles.dotReconnecting,
  error: styles.dotError,
  offline: styles.dotOffline,
}

const ROW_TONE: Record<LiveFeedItem['kind'], string | undefined> = {
  chat: styles.rowChat,
  gift: styles.rowGift,
  member: styles.rowMember,
  follow: styles.rowFollow,
  stats: styles.rowStats,
}

function FeedRow({ item }: { item: LiveFeedItem }) {
  if (item.kind === 'stats') {
    return <li className={cx(styles.row, styles.rowStats)}>{item.text}</li>
  }
  return (
    <li className={cx(styles.row, ROW_TONE[item.kind])}>
      <b>{item.name}</b>
      {item.kind === 'chat' && <span>{item.text}</span>}
      {item.kind === 'gift' && (
        <span>
          送出 <em>{item.text}</em>
          {item.count && item.count > 1 ? ` ×${item.count}` : ''}
        </span>
      )}
      {item.kind === 'member' && <span>{item.text}</span>}
      {item.kind === 'follow' && <span>{item.text}</span>}
    </li>
  )
}

/**
 * 弹幕面板。直播状态由 LiveDataProvider 通过 useLiveServer 统一持有，
 * 这样舞台卡片（今日守护等）和面板共享同一条 SSE 连接。
 */
export function LiveChat({ roomId, onRoomIdChange, live }: LiveChatProps) {
  const [draft, setDraft] = useState(roomId ?? '')
  const [inputError, setInputError] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // 拖拽手柄只放在标题栏，避免和弹幕列表的滚动、文本选择打架
  const { ref, transform, handlers } = useDragPosition<HTMLElement>({ draggingClassName: styles.dragging })

  const { state, room, error, feed, stats, giftRank } = live

  useEffect(() => {
    setDraft(roomId ?? '')
  }, [roomId])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [feed])

  const connect = () => {
    const rid = normalizeWebRid(draft)
    if (!rid) {
      setInputError('请输入房间号或 live.douyin.com 链接')
      return
    }
    setInputError(null)
    onRoomIdChange(rid)
  }

  const isConnected = state === 'live' || state === 'connecting' || state === 'reconnecting'

  return (
    <aside className={styles.panel} ref={ref} style={{ transform }} aria-label="抖音直播间监听">
      <header className={styles.head} {...handlers}>
        <div className={styles.title}>
          <i className={cx(styles.dot, DOT_TONE[state])} />
          <strong>抖音直播</strong>
          <small>{describeRoomState(state, room)}</small>
        </div>
        <span className={styles.online}>{stats.online ?? '—'}</span>
      </header>

      <div className={styles.inputRow}>
        <Input
          className={styles.roomInput}
          size="sm"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && connect()}
          placeholder="房间号或直播间链接"
          aria-label="抖音直播间房间号"
        />
        <Button variant="bare" className={styles.connect} onClick={isConnected ? () => onRoomIdChange(null) : connect}>
          {isConnected ? '断开' : '连接'}
        </Button>
      </div>
      {(inputError || error) && <p className={styles.error}>{inputError ?? error}</p>}

      {room?.room_title && <p className={styles.roomTitle}>{room.room_title}</p>}

      <div className={styles.metrics}>
        <span>弹幕 <b>{stats.chat}</b></span>
        <span>礼物 <b>{stats.gift}</b></span>
        <span>进场 <b>{stats.member}</b></span>
        <span>关注 <b>{stats.follow}</b></span>
      </div>

      <ScrollArea as="ul" className={styles.feed} ref={listRef}>
        {feed.length === 0 ? (
          <li className={styles.feedEmpty}>{roomId ? '等待消息…' : '填入房间号后连接'}</li>
        ) : (
          feed.map((item) => <FeedRow key={item.id} item={item} />)
        )}
      </ScrollArea>

      {giftRank.length > 0 && (
        <div className={styles.rank}>
          <h4>礼物榜</h4>
          <ol>
            {giftRank.map((entry, index) => (
              <li key={`${index}-${entry.name}`}>
                <i>{index + 1}</i>
                <span>{entry.name}</span>
                <b>{entry.count}</b>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  )
}
