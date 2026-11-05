import { useCallback, useEffect, useRef, useState } from 'react'
import {
  normalizeWebRid,
  openDouyinStream,
  ROOM_STATUS_LIVE,
  type DouyinConnectionState,
  type DouyinEvent,
  type DouyinRoomInfo,
} from './api'

export type LiveFeedItem = {
  id: number
  kind: 'chat' | 'gift' | 'member' | 'follow' | 'stats'
  name: string
  text: string
  count?: number
  at: number
}

export type LiveRoomStats = {
  online: string | null
  chat: number
  /** 礼物事件条数（一次连击算一条） */
  gift: number
  /** 礼物件数（连击 ×N 按 N 累加），算收入用它 */
  giftCount: number
  member: number
  like: number
  follow: number
}

export type LiveRoomState = {
  state: DouyinConnectionState | 'idle'
  room: DouyinRoomInfo | null
  error: string | null
  feed: LiveFeedItem[]
  stats: LiveRoomStats
  giftRank: { name: string; count: number }[]
}

const FEED_LIMIT = 60
const GIFT_RANK_LIMIT = 5
// 热门直播间每秒十几条事件，逐条 setState 会把 React 打满。
// 所有事件先进 ref，再按固定节奏批量提交。
const FLUSH_INTERVAL_MS = 400
const GUARDIAN_STORAGE_KEY = 'ailive.douyin-guardians'
const GUARDIAN_SAVE_INTERVAL_MS = 5000

type GiftEntry = { name: string; count: number }

function localDateKey(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** 「今日守护」按天 + 房间持久化，刷新页面或断线重连不会清零，跨天自动重开 */
function loadGuardians(roomId: string): Map<string, GiftEntry> {
  try {
    const raw = window.localStorage.getItem(GUARDIAN_STORAGE_KEY)
    if (!raw) return new Map()
    const data = JSON.parse(raw) as { date?: string; room?: string; gifts?: [string, GiftEntry][] }
    if (data.date !== localDateKey() || data.room !== roomId || !Array.isArray(data.gifts)) return new Map()
    return new Map(data.gifts)
  } catch {
    return new Map()
  }
}

function saveGuardians(roomId: string, gifts: Map<string, GiftEntry>) {
  try {
    window.localStorage.setItem(GUARDIAN_STORAGE_KEY, JSON.stringify({
      date: localDateKey(),
      room: roomId,
      gifts: [...gifts.entries()],
    }))
  } catch {
    // 存储不可用时只保留内存态
  }
}

const EMPTY_STATS: LiveRoomStats = { online: null, chat: 0, gift: 0, giftCount: 0, member: 0, like: 0, follow: 0 }

function createInitialState(): LiveRoomState {
  return { state: 'idle', room: null, error: null, feed: [], stats: { ...EMPTY_STATS }, giftRank: [] }
}

function displayName(event: DouyinEvent): string {
  const user = 'user' in event ? event.user : undefined
  return user?.nickname || user?.sec_uid || '匿名用户'
}

/** 守护榜按 sec_uid 归并，避免同名观众被算成同一个人 */
function giftUserKey(event: DouyinEvent): string {
  const user = 'user' in event ? event.user : undefined
  return user?.sec_uid || displayName(event)
}

function toFeedItem(event: DouyinEvent, id: number): LiveFeedItem | null {
  const at = Date.now()
  const name = displayName(event)
  switch (event.type) {
    case 'chat':
      return { id, kind: 'chat', name, text: event.content, at }
    case 'gift':
      return { id, kind: 'gift', name, text: event.gift, count: event.count, at }
    case 'member':
      return { id, kind: 'member', name, text: '进入直播间', at }
    case 'follow':
      return { id, kind: 'follow', name, text: '关注了主播', at }
    case 'room_stats':
      return event.display ? { id, kind: 'stats', name: '', text: event.display, at } : null
    case 'like':
      // 点赞量级太大，进列表会刷屏，只统计不展示
      return null
    default:
      return null
  }
}

export function useLiveServer(
  webRidInput: string | null,
  options?: { onEvent?: (event: DouyinEvent) => void },
): LiveRoomState & { reset: () => void } {
  const webRid = webRidInput ? normalizeWebRid(webRidInput) : null

  const [view, setView] = useState<LiveRoomState>(createInitialState)

  const feedRef = useRef<LiveFeedItem[]>([])
  const statsRef = useRef<LiveRoomStats>({ ...EMPTY_STATS })
  const giftRef = useRef(new Map<string, GiftEntry>())
  const roomRef = useRef<DouyinRoomInfo | null>(null)
  const roomIdRef = useRef<string | null>(null)
  const lastSaveRef = useRef(0)
  const seqRef = useRef(0)
  const dirtyRef = useRef(false)
  const onEventRef = useRef(options?.onEvent)

  onEventRef.current = options?.onEvent

  const flush = useCallback(() => {
    if (!dirtyRef.current) return
    dirtyRef.current = false
    if (roomIdRef.current && Date.now() - lastSaveRef.current > GUARDIAN_SAVE_INTERVAL_MS) {
      lastSaveRef.current = Date.now()
      saveGuardians(roomIdRef.current, giftRef.current)
    }
    const giftRank = [...giftRef.current.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, GIFT_RANK_LIMIT)
    setView((current) => ({
      ...current,
      room: roomRef.current,
      feed: [...feedRef.current],
      stats: { ...statsRef.current },
      giftRank,
    }))
  }, [])

  const reset = useCallback(() => {
    feedRef.current = []
    statsRef.current = { ...EMPTY_STATS }
    giftRef.current = new Map()
    roomRef.current = null
    dirtyRef.current = false
    setView(createInitialState())
  }, [])

  useEffect(() => {
    if (!webRid) {
      roomIdRef.current = null
      reset()
      return
    }

    feedRef.current = []
    statsRef.current = { ...EMPTY_STATS }
    giftRef.current = loadGuardians(webRid)
    roomRef.current = null
    roomIdRef.current = webRid
    dirtyRef.current = true
    setView({ ...createInitialState(), state: 'connecting' })

    const timer = window.setInterval(flush, FLUSH_INTERVAL_MS)

    const close = openDouyinStream(webRid, {
      onMessage: (message) => {
        if (message.type === 'status') {
          if (message.room) roomRef.current = message.room
          setView((current) => ({
            ...current,
            state: message.state,
            room: message.room ?? current.room,
            error: message.state === 'error' ? message.message ?? '连接失败' : null,
          }))
          return
        }

        if (message.type === 'room') {
          roomRef.current = message.room
          dirtyRef.current = true
          return
        }

        const event = message.event
        switch (event.type) {
          case 'chat':
            statsRef.current.chat += 1
            break
          case 'gift': {
            statsRef.current.gift += 1
            // 连击一次发 N 件，收入要按件数算
            statsRef.current.giftCount += event.count || 1
            const key = giftUserKey(event)
            const previous = giftRef.current.get(key)
            giftRef.current.set(key, {
              name: displayName(event),
              count: (previous?.count ?? 0) + (event.count || 1),
            })
            break
          }
          case 'member':
            statsRef.current.member += 1
            break
          case 'like':
            statsRef.current.like += 1
            break
          case 'follow':
            statsRef.current.follow += 1
            break
          case 'room_stats':
            if (event.display) statsRef.current.online = event.display
            break
          default:
            break
        }

        seqRef.current += 1
        const item = toFeedItem(event, seqRef.current)
        if (item) {
          feedRef.current.push(item)
          if (feedRef.current.length > FEED_LIMIT) feedRef.current.splice(0, feedRef.current.length - FEED_LIMIT)
        }
        dirtyRef.current = true
        onEventRef.current?.(event)
      },
      onTransportError: () => {
        setView((current) => (current.state === 'live' ? { ...current, state: 'reconnecting' } : current))
      },
    })

    return () => {
      window.clearInterval(timer)
      close()
    }
  }, [webRid, flush, reset])

  return { ...view, reset }
}

export function describeRoomState(state: LiveRoomState['state'], room: DouyinRoomInfo | null): string {
  switch (state) {
    case 'idle':
      return '未连接'
    case 'connecting':
      return '连接中'
    case 'live':
      return room?.room_status === ROOM_STATUS_LIVE ? '直播中' : '已连接'
    case 'reconnecting':
      return '重连中'
    case 'offline':
      return '已下播'
    case 'closed':
      return '已断开'
    case 'error':
      return '连接失败'
    default:
      return state
  }
}
