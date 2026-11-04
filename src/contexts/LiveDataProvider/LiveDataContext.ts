import { createContext, useContext } from 'react'
import type { useDouyinRoom } from '../../hooks/useDouyinRoom'
import type { LiveOverviewType } from '../../live/types'

export type LiveDataContextValue = {
  liveOverview: LiveOverviewType
  douyinRoomId: string | null
  douyinRoom: ReturnType<typeof useDouyinRoom>
  handleDouyinRoomChange: (roomId: string | null) => void
}

export const LiveDataContext = createContext<LiveDataContextValue | null>(null)

export function useLiveData() {
  const context = useContext(LiveDataContext)
  if (!context) throw new Error('useLiveData must be used within LiveDataProvider')
  return context
}
