import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { DOUYIN_ROOM_STORAGE_KEY } from '../live/douyin'
import { useDouyinRoom } from '../live/useDouyinRoom'
import type { LiveDataType } from '../live/types'

/** 写死的演示数据；接入真实数据源时替换这里即可 */
const DEMO_LIVE_SNAPSHOT: LiveDataType = {
  platform: 'demo',
  isLive: true,
  updatedAt: 0,
  nowPlaying: { title: '三角洲行动 · 星河追梦', elapsed: '2:57', duration: '3:36' },
  income: { balance: '149.11', income: '11.10', expense: '0.37', todayVotes: '5-5', gifts: '186', tokens: '456,345' },
  songQueue: [],
  recentSongs: [{ title: '疾风到达' }, { title: 'Red' }],
  guardians: [
    { name: '极限战士', amount: '6.40 元', rank: 1, highlighted: true },
    { name: '旧林', amount: '2.50 元', rank: 2 },
    { name: '墨墨', amount: '1.80 元', rank: 3 },
    { name: '行止', amount: '1.40 元', rank: 4 },
    { name: '几月是冬', amount: '1.20 元', rank: 5 },
  ],
}

type LiveDataContextValue = {
  liveSnapshot: LiveDataType
  douyinRoomId: string | null
  douyinRoom: ReturnType<typeof useDouyinRoom>
  handleDouyinRoomChange: (roomId: string | null) => void
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null)

export function useLiveData() {
  const context = useContext(LiveDataContext)
  if (!context) throw new Error('useLiveData must be used within LiveDataProvider')
  return context
}

type LiveDataProviderProps = {
  children: ReactNode
}

export function LiveDataProvider({ children }: LiveDataProviderProps) {
  const [douyinRoomId, setDouyinRoomId] = useState<string | null>(
    () => window.localStorage.getItem(DOUYIN_ROOM_STORAGE_KEY) || null
  )
  const douyinRoom = useDouyinRoom(douyinRoomId)

  const handleDouyinRoomChange = (roomId: string | null) => {
    try {
      if (roomId) window.localStorage.setItem(DOUYIN_ROOM_STORAGE_KEY, roomId)
      else window.localStorage.removeItem(DOUYIN_ROOM_STORAGE_KEY)
    } catch {
      // localStorage may be unavailable in private mode
    }
    setDouyinRoomId(roomId)
  }

  // 演示数据 + 真实抖音房间数据叠加
  const liveSnapshot = useMemo<LiveDataType>(() => ({
    ...DEMO_LIVE_SNAPSHOT,
    platform: douyinRoom.room ? 'douyin' : DEMO_LIVE_SNAPSHOT.platform,
    isLive: douyinRoom.state === 'live',
    updatedAt: Date.now(),
    income: { ...DEMO_LIVE_SNAPSHOT.income, gifts: String(douyinRoom.stats.gift) },
    guardians: douyinRoom.giftRank.map((entry, index) => ({
      name: entry.name,
      amount: `${entry.count} 件`,
      rank: index + 1,
      highlighted: index === 0,
    })),
  }), [douyinRoom])

  const value = useMemo<LiveDataContextValue>(() => ({
    liveSnapshot,
    douyinRoomId,
    douyinRoom,
    handleDouyinRoomChange,
  }), [liveSnapshot, douyinRoomId, douyinRoom])

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  )
}
