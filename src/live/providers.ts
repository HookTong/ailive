import type { LiveDataListener, LiveDataProvider, LiveDataSnapshot } from './types'

export type LiveDataTransform = (payload: unknown, previous: LiveDataSnapshot) => LiveDataSnapshot

export type HttpLiveDataProviderOptions = {
  platform: string
  endpoint: string
  pollInterval?: number
  transform: LiveDataTransform
}

export function createDouyinLiveDataProvider(endpoint: string, transform: LiveDataTransform, pollInterval = 15000): LiveDataProvider {
  return createHttpLiveDataProvider({ platform: 'douyin', endpoint, transform, pollInterval })
}

export function createHttpLiveDataProvider({ platform, endpoint, pollInterval = 15000, transform }: HttpLiveDataProviderOptions): LiveDataProvider {
  let snapshot = createEmptySnapshot(platform)
  const listeners = new Set<LiveDataListener>()
  let timer: number | null = null
  let loading = false

  const load = async () => {
    if (loading) return
    loading = true
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`Live data request failed: ${response.status}`)
      snapshot = transform(await response.json(), snapshot)
      listeners.forEach((listener) => listener(snapshot))
    } catch (error) {
      console.error(`[${platform}] live data request failed`, error)
    } finally {
      loading = false
    }
  }

  const start = () => {
    if (timer !== null) return
    void load()
    timer = window.setInterval(() => void load(), pollInterval)
  }

  const stop = () => {
    if (timer === null) return
    window.clearInterval(timer)
    timer = null
  }

  return {
    platform,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(snapshot)
      start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stop()
      }
    },
  }
}

export function createMockLiveDataProvider(): LiveDataProvider {
  const snapshot = createDemoSnapshot()
  return {
    platform: 'demo',
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listener(snapshot)
      return () => undefined
    },
  }
}

export function createEmptySnapshot(platform: string): LiveDataSnapshot {
  return {
    platform,
    isLive: false,
    updatedAt: Date.now(),
    nowPlaying: { title: '暂无播放', elapsed: '0:00', duration: '0:00' },
    income: { balance: '0.00', income: '0.00', expense: '0.00', todayVotes: '0', gifts: '0', tokens: '0' },
    songQueue: [],
    recentSongs: [],
    guardians: [],
  }
}

function createDemoSnapshot(): LiveDataSnapshot {
  return {
    platform: 'demo',
    isLive: true,
    updatedAt: Date.now(),
    nowPlaying: { title: '三角洲行动 · 星河追梦', elapsed: '2:57', duration: '3:36' },
    income: { balance: '149.11', income: '11.10', expense: '0.37', todayVotes: '5-5', gifts: '186', tokens: '456,345' },
    songQueue: [],
    recentSongs: [{ title: '疾风到达' }, { title: 'Red' }],
    guardians: [
      { name: '极限战士', amount: '6.40 元', rank: 1, highlighted: true },
      { name: '旧林', amount: '2.50 元', rank: 2 },
      { name: '墨墨', amount: '1.80 元', rank: 3 },
      { name: '行止', amount: '1.40 元', rank: 4 },
      { name: '几月是冬', amount: '1.20 元', rank: 5 },
    ],
  }
}
