import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLiveServer } from '../../hooks/useLiveServer'
import { DOUYIN_ROOM_STORAGE_KEY } from '../../hooks/useLiveServer/api'
import type { LiveOverviewType } from '../../components/LiveOverview/types'
import { LiveDataContext, type LiveDataContextValue } from './LiveDataContext'

/** 礼物单价存储键；未配置时按 1 元/件估算 */
const GIFT_PRICE_STORAGE_KEY = 'ailive.gift-price'
const DEFAULT_GIFT_PRICE = 1

function loadGiftPrice(): number {
  try {
    const raw = window.localStorage.getItem(GIFT_PRICE_STORAGE_KEY)
    if (!raw) return DEFAULT_GIFT_PRICE
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_GIFT_PRICE
  } catch {
    return DEFAULT_GIFT_PRICE
  }
}

/** 写死的演示数据；接入真实数据源时替换这里即可 */
const DEMO_LIVE_OVERVIEW: LiveOverviewType = {
  platform: 'demo',
  isLive: true,
  updatedAt: 0,
  guardians: [
    { name: '极限战士', amount: '6.40 元', rank: 1, highlighted: true },
    { name: '旧林', amount: '2.50 元', rank: 2 },
    { name: '墨墨', amount: '1.80 元', rank: 3 },
    { name: '行止', amount: '1.40 元', rank: 4 },
    { name: '几月是冬', amount: '1.20 元', rank: 5 },
  ],
}

type LiveDataProviderProps = {
  children: ReactNode
}

export function LiveDataProvider({ children }: LiveDataProviderProps) {
  const [douyinRoomId, setDouyinRoomId] = useState<string | null>(
    () => window.localStorage.getItem(DOUYIN_ROOM_STORAGE_KEY) || null
  )
  const douyinRoom = useLiveServer(douyinRoomId)

  const [giftPrice, setGiftPriceState] = useState<number>(loadGiftPrice)
  const [liveConfigOpen, setLiveConfigOpen] = useState(false)

  const handleDouyinRoomChange = (roomId: string | null) => {
    try {
      if (roomId) window.localStorage.setItem(DOUYIN_ROOM_STORAGE_KEY, roomId)
      else window.localStorage.removeItem(DOUYIN_ROOM_STORAGE_KEY)
    } catch {
      // localStorage may be unavailable in private mode
    }
    setDouyinRoomId(roomId)
  }

  const setGiftPrice = useCallback((price: number) => {
    const next = Number.isFinite(price) && price >= 0 ? price : DEFAULT_GIFT_PRICE
    try {
      window.localStorage.setItem(GIFT_PRICE_STORAGE_KEY, String(next))
    } catch {
      // 隐私模式下存不了，只在内存里生效
    }
    setGiftPriceState(next)
  }, [])

  const openLiveConfig = useCallback(() => setLiveConfigOpen(true), [])
  const closeLiveConfig = useCallback(() => setLiveConfigOpen(false), [])

  // 演示数据 + 真实抖音房间数据叠加
  const liveOverview = useMemo<LiveOverviewType>(() => ({
    ...DEMO_LIVE_OVERVIEW,
    platform: douyinRoom.room ? 'douyin' : DEMO_LIVE_OVERVIEW.platform,
    isLive: douyinRoom.state === 'live',
    updatedAt: Date.now(),
    guardians: douyinRoom.giftRank.map((entry, index) => ({
      name: entry.name,
      amount: `${entry.count} 件`,
      rank: index + 1,
      highlighted: index === 0,
    })),
  }), [douyinRoom])

  const value = useMemo<LiveDataContextValue>(() => ({
    liveOverview,
    douyinRoomId,
    douyinRoom,
    handleDouyinRoomChange,
    giftPrice,
    setGiftPrice,
    liveConfigOpen,
    openLiveConfig,
    closeLiveConfig,
  }), [liveOverview, douyinRoomId, douyinRoom, giftPrice, setGiftPrice, liveConfigOpen, openLiveConfig, closeLiveConfig])

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  )
}
