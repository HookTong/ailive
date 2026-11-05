import { createContext, useContext } from 'react'
import type { useLiveServer } from '../../hooks/useLiveServer'

export type LiveDataContextValue = {
  douyinRoomId: string | null
  douyinRoom: ReturnType<typeof useLiveServer>
  handleDouyinRoomChange: (roomId: string | null) => void
  /** 各礼物的单价（元/个），key 是礼物名；没配过的走 data/gifts 里的默认值 */
  giftPrices: Record<string, number>
  /** 整表替换；只存用户改过的项，没出现的礼物回落到默认价 */
  setGiftPrices: (prices: Record<string, number>) => void
  /** 直播配置弹窗开关 */
  liveConfigOpen: boolean
  openLiveConfig: () => void
  closeLiveConfig: () => void
}

export const LiveDataContext = createContext<LiveDataContextValue | null>(null)

export function useLiveData() {
  const context = useContext(LiveDataContext)
  if (!context) throw new Error('useLiveData must be used within LiveDataProvider')
  return context
}
