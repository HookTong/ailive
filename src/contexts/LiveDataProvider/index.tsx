import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveServer } from '../../hooks/useLiveServer'
import { DOUYIN_ROOM_STORAGE_KEY } from '../../hooks/useLiveServer/api'
import { LiveDataContext, type LiveDataContextValue } from './LiveDataContext'

/** 礼物单价表：只存用户改过的项，没出现的礼物走 data/gifts 里的默认价 */
const GIFT_PRICES_STORAGE_KEY = 'ailive.gift-prices'

function loadGiftPrices(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(GIFT_PRICES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, number> = {}
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) result[name] = value
    }
    return result
  } catch {
    return {}
  }
}

type LiveDataProviderProps = {
  children: ReactNode
}

export function LiveDataProvider({ children }: LiveDataProviderProps) {
  const [douyinRoomId, setDouyinRoomId] = useState<string | null>(
    () => window.localStorage.getItem(DOUYIN_ROOM_STORAGE_KEY) || null
  )
  const douyinRoom = useLiveServer(douyinRoomId)

  const [giftPrices, setGiftPricesState] = useState<Record<string, number>>(loadGiftPrices)
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

  const setGiftPrices = useCallback((prices: Record<string, number>) => {
    const next: Record<string, number> = {}
    for (const [name, value] of Object.entries(prices)) {
      if (Number.isFinite(value) && value >= 0) next[name] = value
    }
    setGiftPricesState(next)
  }, [])

  // 单价变化就落盘；写在 effect 里而不是 setState 的 updater 里，updater 保持纯函数
  useEffect(() => {
    try {
      window.localStorage.setItem(GIFT_PRICES_STORAGE_KEY, JSON.stringify(giftPrices))
    } catch {
      // 隐私模式下存不了，只在内存里生效
    }
  }, [giftPrices])

  const openLiveConfig = useCallback(() => setLiveConfigOpen(true), [])
  const closeLiveConfig = useCallback(() => setLiveConfigOpen(false), [])

  const value = useMemo<LiveDataContextValue>(() => ({
    douyinRoomId,
    douyinRoom,
    handleDouyinRoomChange,
    giftPrices,
    setGiftPrices,
    liveConfigOpen,
    openLiveConfig,
    closeLiveConfig,
  }), [douyinRoomId, douyinRoom, giftPrices, setGiftPrices, liveConfigOpen, openLiveConfig, closeLiveConfig])

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  )
}
