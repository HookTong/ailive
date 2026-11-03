import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createMockLiveDataProvider } from '../live/providers'
import { DOUYIN_ROOM_STORAGE_KEY } from '../live/douyin'
import { useDouyinRoom } from '../live/useDouyinRoom'
import type { LiveDataProvider, LiveDataSnapshot } from '../live/types'

type LiveDataContextValue = {
  liveSnapshot: LiveDataSnapshot
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
  const liveDataProviderRef = useRef<LiveDataProvider>(createMockLiveDataProvider())
  const [baseSnapshot, setBaseSnapshot] = useState<LiveDataSnapshot>(() => liveDataProviderRef.current.getSnapshot())
  const [douyinRoomId, setDouyinRoomId] = useState<string | null>(
    () => window.localStorage.getItem(DOUYIN_ROOM_STORAGE_KEY) || null
  )
  const douyinRoom = useDouyinRoom(douyinRoomId)

  useEffect(() => liveDataProviderRef.current.subscribe(setBaseSnapshot), [])

  const handleDouyinRoomChange = (roomId: string | null) => {
    try {
      if (roomId) window.localStorage.setItem(DOUYIN_ROOM_STORAGE_KEY, roomId)
      else window.localStorage.removeItem(DOUYIN_ROOM_STORAGE_KEY)
    } catch {
      // localStorage may be unavailable in private mode
    }
    setDouyinRoomId(roomId)
  }

  // Merge base snapshot with real Douyin data
  const liveSnapshot = useMemo<LiveDataSnapshot>(() => ({
    ...baseSnapshot,
    platform: douyinRoom.room ? 'douyin' : baseSnapshot.platform,
    isLive: douyinRoom.state === 'live',
    updatedAt: Date.now(),
    income: { ...baseSnapshot.income, gifts: String(douyinRoom.stats.gift) },
    guardians: douyinRoom.giftRank.map((entry, index) => ({
      name: entry.name,
      amount: `${entry.count} 件`,
      rank: index + 1,
      highlighted: index === 0,
    })),
  }), [baseSnapshot, douyinRoom])

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
