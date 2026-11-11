import { createContext, useContext } from 'react'
import type { useLiveServer } from '../../hooks/useLiveServer'
import type { GiftMotionMap } from '../../data/giftMotions'
import type { ActionSwitches } from '../../data/actions'

export type LiveDataContextValue = {
  douyinRoomId: string | null
  douyinRoom: ReturnType<typeof useLiveServer>
  handleDouyinRoomChange: (roomId: string | null) => void
  /** 各礼物的单价（元/个），key 是礼物名；没配过的走 data/gifts 里的默认值 */
  giftPrices: Record<string, number>
  /** 整表替换；只存用户改过的项，没出现的礼物回落到默认价 */
  setGiftPrices: (prices: Record<string, number>) => void
  /** 各礼物触发哪个角色动作：礼物 →（模型 id → motion 分组名）；没配过 = 不触发 */
  giftMotions: GiftMotionMap
  /** 整表替换；空串 / 没出现的模型表示该模型不触发 */
  setGiftMotions: (motions: GiftMotionMap) => void
  /** 弹幕指令的启用开关：键是动作 id，缺省（没出现）视为启用 */
  chatCommands: ActionSwitches
  /** 整表替换；落盘时只写被关掉的那几条 */
  setChatCommands: (commands: ActionSwitches) => void
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
