import { createContext, useContext } from 'react'
import type { ModelManifest, ModelSource } from '../../modelTypes'

/** 气泡显示策略：speaking = 只有说话时显示，always = 常显 */
export type BubbleMode = 'speaking' | 'always'

export type CharacterState = {
  manifest: ModelManifest | null
  configError: boolean
  activeMotion: string
  selectedExpressions: string[]
  modelSize: number
  positionResetKey: number
  voicePresetId: string
  /** 模型在舞台上是否可见 */
  modelVisible: boolean
  bubbleMode: BubbleMode
  /** 说话时触发的动作分组名，空串表示不触发 */
  speakingMotion: string
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
