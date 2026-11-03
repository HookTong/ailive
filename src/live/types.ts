export type LivePlatform = 'douyin' | string

export type LiveNowPlaying = {
  title: string
  elapsed: string
  duration: string
}

export type LiveIncome = {
  balance: string
  income: string
  expense: string
  todayVotes: string
  gifts: string
  tokens: string
}

export type LiveQueueItem = {
  title: string
}

export type LiveGuardian = {
  name: string
  amount: string
  rank: number
  highlighted?: boolean
}

export type LiveInfoType = {
  platform: LivePlatform
  isLive: boolean
  updatedAt: number
  nowPlaying: LiveNowPlaying
  income: LiveIncome
  songQueue: LiveQueueItem[]
  recentSongs: LiveQueueItem[]
  guardians: LiveGuardian[]
}

export type LiveDataListener = (info: LiveInfoType) => void

export type LiveDataProvider = {
  readonly platform: LivePlatform
  getInfo: () => LiveInfoType
  subscribe: (listener: LiveDataListener) => () => void
}
