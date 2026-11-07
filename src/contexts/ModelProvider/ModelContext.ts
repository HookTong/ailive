import { createContext, useContext } from 'react'
import type { ModelManifest, ModelSource } from './types'

/** 气泡显示策略：speaking = 只有说话时显示，always = 常显 */
export type BubbleMode = 'speaking' | 'always'

export type CharacterState = {
  manifest: ModelManifest | null
  configError: boolean
  /**
   * 动作预设的选中项。**只由用户在控制台里选**，同时也是「说话时触发的动作」。
   * 礼物等外部触发的一次性动作走 overrideMotion，不许回写这里 ——
   * 否则送一次礼物就把用户选的预设顶掉了。
   */
  activeMotion: string
  /** 一次性动作（礼物触发）：播完不影响 activeMotion，也不改变说话触发动作 */
  overrideMotion: string
  /** 一次性动作的重放计数：同一个动作被再次触发时自增，Live2D 靠它区分「值没变但要重播」 */
  overrideNonce: number
  /**
   * 礼物动作的独占截止时间（毫秒时间戳）。
   * 在此之前说话动作不许抢 —— 礼物优先级高于「开始说话」触发的动作。
   */
  motionHoldUntil: number
  selectedExpressions: string[]
  modelSize: number
  positionResetKey: number
  voicePresetId: string
  /** 模型在舞台上是否可见 */
  modelVisible: boolean
  bubbleMode: BubbleMode
  /**
   * 舞台上该角色脚下的名称名牌要不要显示，**默认关**。
   * 名牌是给观众认人的，单人直播或者名字跟角色明显对不上时可以不开；
   * 开着的时候它压在角色脚边，会盖掉一点画面。
   */
  nameplateVisible: boolean
}

export type ModelContextValue = {
  modelSources: ModelSource[]
  activeModelId: string
  characterStates: Record<string, CharacterState>
  activeCharacter: CharacterState
  manifest: ModelManifest | null
  configError: boolean
  setActiveModelId: (id: string) => void
  updateActiveCharacter: (patch: Partial<CharacterState>) => void
  /** 按模型 id 更新，用来同时驱动舞台上多个角色（比如同一个礼物让每个角色各做一个动作） */
  updateCharacter: (id: string, patch: Partial<CharacterState>) => void
  addOnlineModel: (url: string, name: string) => void
  deleteModel: (id: string) => void
  resetActiveCharacter: () => void
  resetVoicePresetForAll: (deletedPresetId: string) => void
}

export const ModelContext = createContext<ModelContextValue | null>(null)

export function useModel() {
  const context = useContext(ModelContext)
  if (!context) throw new Error('useModel must be used within ModelProvider')
  return context
}
