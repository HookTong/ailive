export type LivePlatform = 'douyin' | string

export type LiveIncome = {
  balance: string
  income: string
  expense: string
  todayVotes: string
  gifts: string
  tokens: string
}

export type LiveGuardian = {
  name: string
  amount: string
  rank: number
  highlighted?: boolean
}

export type LiveOverviewType = {
  platform: LivePlatform
  isLive: boolean
  updatedAt: number
  income: LiveIncome
  guardians: LiveGuardian[]
}