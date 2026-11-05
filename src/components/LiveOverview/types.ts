export type LivePlatform = 'douyin' | string

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
  guardians: LiveGuardian[]
}