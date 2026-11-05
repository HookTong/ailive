import { createContext, useContext } from 'react'
import type { useLiveServer } from '../../hooks/useLiveServer'
import type { LiveOverviewType } from '../../components/LiveOverview/types'

export type LiveDataContextValue = {
  liveOverview: LiveOverviewType
  douyinRoomId: string | null
  douyinRoom: ReturnType<typeof useLiveServer>
  handleDouyinRoomChange: (roomId: string | null) => void
  /** 礼物单价（元/件），用来把礼物件数折算成收入 */
  giftPrice: number
  setGiftPrice: (price: number) => void
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
