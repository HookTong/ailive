export type DouyinLiveUser = {
  id: number | null
  nickname: string | null
  sec_uid: string | null
  level: number | null
}

type UserPayload = { user?: DouyinLiveUser; to_user?: DouyinLiveUser }

export type DouyinChatEvent = UserPayload & { type: 'chat'; content: string }
export type DouyinGiftEvent = UserPayload & { type: 'gift'; gift: string; gift_id: string; count: number }
export type DouyinMemberEvent = UserPayload & { type: 'member'; member_count: number }
export type DouyinLikeEvent = UserPayload & { type: 'like'; count: number; total: number }
export type DouyinFollowEvent = UserPayload & { type: 'follow'; follow_count: number }
export type DouyinRoomStatsEvent = { type: 'room_stats'; display: string | null; total: number }

export type DouyinEvent =
  | DouyinChatEvent
  | DouyinGiftEvent
  | DouyinMemberEvent
  | DouyinLikeEvent
  | DouyinFollowEvent
  | DouyinRoomStatsEvent

export type DouyinRoomInfo = {
  web_rid: string
  room_id: string
  user_unique_id: string
  anchor_id: string | null
  sec_uid: string | null
  room_status: number | null
  room_title: string | null
}

export type DouyinConnectionState =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'offline'
  | 'closed'
  | 'error'

export type DouyinStreamMessage =
  | {
    type: 'status'
    state: DouyinConnectionState
    room: DouyinRoomInfo | null
    message?: string
    attempt?: number
    backoff?: number
  }
  | { type: 'room'; room: DouyinRoomInfo }
  | { type: 'event'; event: DouyinEvent }

const BRIDGE_BASE = (import.meta.env.VITE_DY_BRIDGE as string | undefined)?.replace(/\/$/, '') ?? ''

export const ROOM_STATUS_LIVE = 2

/** 房间号在 App 与弹幕面板之间共享，持久化用同一个 key */
export const DOUYIN_ROOM_STORAGE_KEY = 'ailive.douyin-room'

export function bridgeUrl(path: string): string {
  return `${BRIDGE_BASE}${path}`
}

/** 接受纯房间号，也接受 https://live.douyin.com/123456 这类链接。 */
export function normalizeWebRid(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (/^\d{4,}$/.test(value)) return value
  const match = value.match(/live\.douyin\.com\/(\d+)/)
  return match ? match[1] : null
}

export type StreamHandlers = {
  onMessage: (message: DouyinStreamMessage) => void
  onOpen?: () => void
  onTransportError?: () => void
}

/**
 * 打开 SSE 事件流。返回的函数用于关闭连接。
 * 断线重连由服务端下发的 retry 间隔 + 浏览器 EventSource 自动处理。
 */
export function openDouyinStream(webRid: string, handlers: StreamHandlers): () => void {
  const source = new EventSource(bridgeUrl(`/api/rooms/${encodeURIComponent(webRid)}/stream`))

  source.onopen = () => handlers.onOpen?.()
  source.onmessage = (event) => {
    try {
      handlers.onMessage(JSON.parse(event.data) as DouyinStreamMessage)
    } catch (error) {
      console.warn('[douyin] 无法解析事件流数据', error)
    }
  }
  source.onerror = () => {
    // EventSource 会自动重连，这里只上报，不主动关闭
    handlers.onTransportError?.()
  }

  return () => source.close()
}
