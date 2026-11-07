import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveServer } from '../../hooks/useLiveServer'
import { DOUYIN_ROOM_STORAGE_KEY } from '../../hooks/useLiveServer/api'
import { GIFT_MOTION_ANY_MODEL, type GiftMotionMap } from '../../data/giftMotions'
import { CHAT_COMMANDS, createDefaultChatCommands, type ChatCommandId } from '../../data/chatCommands'
import {
  LiveDataContext,
  type LiveDataContextValue,
} from './LiveDataContext'

/** 礼物单价表：只存用户改过的项，没出现的礼物走 data/gifts 里的默认价 */
const GIFT_PRICES_STORAGE_KEY = 'ailive.gift-prices'
/** 礼物 →（模型 → 动作）的映射，只存配过的项 */
const GIFT_MOTIONS_STORAGE_KEY = 'ailive.gift-motions'
/** 弹幕指令的开关：只存被关掉的那几条，新增指令默认就是启用的 */
const CHAT_COMMANDS_STORAGE_KEY = 'ailive.chat-commands'

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

function loadGiftMotions(): GiftMotionMap {
  try {
    const raw = window.localStorage.getItem(GIFT_MOTIONS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const result: GiftMotionMap = {}
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      // 旧格式：只存了一个动作名，不知道是给哪个模型配的。
      // 归到通配键上，哪个模型有同名动作就跟着用；用户在弹窗里确认一次就会展开成具体模型
      if (typeof value === 'string') {
        if (value) result[name] = { [GIFT_MOTION_ANY_MODEL]: value }
        continue
      }
      if (!value || typeof value !== 'object') continue
      const perModel: Record<string, string> = {}
      for (const [modelId, motion] of Object.entries(value as Record<string, unknown>)) {
        if (typeof motion === 'string' && motion) perModel[modelId] = motion
      }
      if (Object.keys(perModel).length > 0) result[name] = perModel
    }
    return result
  } catch {
    return {}
  }
}

/**
 * 读取指令开关。存的是「被关掉的那几条」，读的时候从「全部启用」出发覆盖一遍 ——
 * 这样以后新增的指令不用迁移数据，默认就是开着的。
 */
function loadChatCommands(): Record<ChatCommandId, boolean> {
  const result = createDefaultChatCommands()
  try {
    const raw = window.localStorage.getItem(CHAT_COMMANDS_STORAGE_KEY)
    if (!raw) return result
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return result
    for (const [id, enabled] of Object.entries(parsed as Record<string, unknown>)) {
      if (!(id in result) || typeof enabled !== 'boolean') continue
      result[id as ChatCommandId] = enabled
    }
    return result
  } catch {
    return result
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
  const [giftMotions, setGiftMotionsState] = useState<GiftMotionMap>(loadGiftMotions)
  const [chatCommands, setChatCommandsState] = useState<Record<ChatCommandId, boolean>>(loadChatCommands)
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

  // 空串 = 该模型不触发；两层都清一遍，别把没用的键留在 localStorage
  const setGiftMotions = useCallback((motions: GiftMotionMap) => {
    const next: GiftMotionMap = {}
    for (const [name, entry] of Object.entries(motions)) {
      if (!entry || typeof entry !== 'object') continue
      const perModel: Record<string, string> = {}
      for (const [modelId, motion] of Object.entries(entry)) {
        if (typeof motion === 'string' && motion) perModel[modelId] = motion
      }
      if (Object.keys(perModel).length > 0) next[name] = perModel
    }
    setGiftMotionsState(next)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(GIFT_MOTIONS_STORAGE_KEY, JSON.stringify(giftMotions))
    } catch {
      // 同上
    }
  }, [giftMotions])

  /** 只留认识的指令 id，值一律按布尔处理 */
  const setChatCommands = useCallback((commands: Record<ChatCommandId, boolean>) => {
    const next = createDefaultChatCommands()
    for (const { id } of CHAT_COMMANDS) {
      if (typeof commands[id] === 'boolean') next[id] = commands[id]
    }
    setChatCommandsState(next)
  }, [])

  // 只写被关掉的那几条：默认是启用，存一份全表等于把默认值抄了一遍
  useEffect(() => {
    try {
      const disabled = Object.fromEntries(
        Object.entries(chatCommands).filter(([, enabled]) => !enabled),
      )
      window.localStorage.setItem(CHAT_COMMANDS_STORAGE_KEY, JSON.stringify(disabled))
    } catch {
      // 同上
    }
  }, [chatCommands])

  const openLiveConfig = useCallback(() => setLiveConfigOpen(true), [])
  const closeLiveConfig = useCallback(() => setLiveConfigOpen(false), [])

  const value = useMemo<LiveDataContextValue>(() => ({
    douyinRoomId,
    douyinRoom,
    handleDouyinRoomChange,
    giftPrices,
    setGiftPrices,
    giftMotions,
    setGiftMotions,
    chatCommands,
    setChatCommands,
    liveConfigOpen,
    openLiveConfig,
    closeLiveConfig,
  }), [
    douyinRoomId, douyinRoom, giftPrices, setGiftPrices,
    giftMotions, setGiftMotions, chatCommands, setChatCommands,
    liveConfigOpen, openLiveConfig, closeLiveConfig,
  ])

  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  )
}
