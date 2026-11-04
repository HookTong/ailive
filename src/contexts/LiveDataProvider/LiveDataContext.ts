import { createContext, useContext } from 'react'
import type { useLiveServer } from '../../hooks/useLiveServer'
import type { LiveOverviewType } from '../../components/LiveOverview/types'

export type LiveDataContextValue = {
  liveOverview: LiveOverviewType
  douyinRoomId: string | null
  douyinRoom: ReturnType<typeof useLiveServer>
  handleDouyinRoomChange: (roomId: string | null) => void
}

export const LiveDataContext = createContext<LiveDataContextValue | null>(null)

export function useLiveData() {
  const context = useContext(LiveDataContext)
  if (!context) throw new Error('useLiveData must be used within LiveDataProvider')
  return context
}
