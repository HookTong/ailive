import { DEFAULT_VOLCENGINE_VOICE_PRESET_ID } from '../VoiceProvider/presets'
import type { BubbleMode, CharacterState } from './ModelContext'

export const MODEL_CONSOLE_STORAGE_KEY = 'ailive.model-console'

/**
 * 角色设置的默认值。
 *
 * 只有 `manifest` / `configError` 不在里面 —— 那两个是加载模型配置时读出来的，
 * 不属于「用户配的东西」。默认值集中在这儿有两个用处：provider 建初始状态、
 * 落盘时拿它判断「这个字段配过没有」，散在两处各写一遍迟早会对不上。
 */
export const DEFAULT_CHARACTER_STATE = {
  activeMotion: 'idle',
  overrideMotion: '',
  overrideNonce: 0,
  motionHoldUntil: 0,
  selectedExpressions: [] as string[],
  modelSize: 0.6,
  positionResetKey: 0,
  voicePresetId: DEFAULT_VOLCENGINE_VOICE_PRESET_ID,
  modelVisible: true,
  bubbleMode: 'speaking' as BubbleMode,
  nameplateVisible: false,
}

type PersistedKey =
  | 'activeMotion'
  | 'selectedExpressions'
  | 'modelSize'
  | 'voicePresetId'
  | 'modelVisible'
  | 'bubbleMode'
  | 'nameplateVisible'

/**
 * 会被记住的那部分，**只写和默认值不一样的键**。
 * 一次性动作（礼物）、重放计数、重置计数都是临时的，不落盘。
 */
export type StoredCharacterState = Partial<Pick<CharacterState, PersistedKey>>

export type StoredModelConsole = {
  /** 上次在控制台里选中的模型，空串表示没记过 */
  activeModelId: string
  states: Record<string, StoredCharacterState>
}

const EMPTY: StoredModelConsole = { activeModelId: '', states: {} }

const clampSize = (value: number) => Math.min(0.95, Math.max(0.2, value))

/**
 * 从 localStorage 读回上次的角色设置。
 *
 * 每一项都单独校验、读不懂就当没配过 —— 这里的数据是上一版代码写的，
 * 中间改过字段类型是常事，整块 JSON.parse 成功不代表里面的东西还能用。
 */
export function loadModelConsole(): StoredModelConsole {
  try {
    const raw = window.localStorage.getItem(MODEL_CONSOLE_STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY
    const record = parsed as Record<string, unknown>
    const states: Record<string, StoredCharacterState> = {}
    const storedStates = record.states
    if (storedStates && typeof storedStates === 'object' && !Array.isArray(storedStates)) {
      for (const [id, value] of Object.entries(storedStates as Record<string, unknown>)) {
        const state = readState(value)
        if (Object.keys(state).length > 0) states[id] = state
      }
    }
    return {
      activeModelId: typeof record.activeModelId === 'string' ? record.activeModelId : '',
      states,
    }
  } catch {
    return EMPTY
  }
}

function readState(value: unknown): StoredCharacterState {
  if (!value || typeof value !== 'object') return {}
  const item = value as Record<string, unknown>
  const state: StoredCharacterState = {}
  if (typeof item.activeMotion === 'string') state.activeMotion = item.activeMotion
  if (Array.isArray(item.selectedExpressions)) {
    state.selectedExpressions = item.selectedExpressions.filter((name): name is string => typeof name === 'string')
  }
  if (typeof item.modelSize === 'number' && Number.isFinite(item.modelSize)) state.modelSize = clampSize(item.modelSize)
  if (typeof item.voicePresetId === 'string' && item.voicePresetId) state.voicePresetId = item.voicePresetId
  if (typeof item.modelVisible === 'boolean') state.modelVisible = item.modelVisible
  // 只有两态，别的一律当没配过（也就是「说话时显示」）
  if (item.bubbleMode === 'always' || item.bubbleMode === 'speaking') state.bubbleMode = item.bubbleMode
  if (typeof item.nameplateVisible === 'boolean') state.nameplateVisible = item.nameplateVisible
  return state
}

/** 把一份运行时状态压成要落盘的样子：只留和默认值不一样的键 */
function toStoredState(state: CharacterState): StoredCharacterState {
  const stored: StoredCharacterState = {}
  if (state.activeMotion !== DEFAULT_CHARACTER_STATE.activeMotion) stored.activeMotion = state.activeMotion
  if (state.selectedExpressions.length > 0) stored.selectedExpressions = state.selectedExpressions
  if (state.modelSize !== DEFAULT_CHARACTER_STATE.modelSize) stored.modelSize = state.modelSize
  if (state.voicePresetId !== DEFAULT_CHARACTER_STATE.voicePresetId) stored.voicePresetId = state.voicePresetId
  if (state.modelVisible !== DEFAULT_CHARACTER_STATE.modelVisible) stored.modelVisible = state.modelVisible
  if (state.bubbleMode !== DEFAULT_CHARACTER_STATE.bubbleMode) stored.bubbleMode = state.bubbleMode
  if (state.nameplateVisible !== DEFAULT_CHARACTER_STATE.nameplateVisible) stored.nameplateVisible = state.nameplateVisible
  return stored
}

/** 上一次写进去的字符串。模型加载完会再刷一次 state（manifest 变了），那次的载荷没变，不必重写 */
let lastWritten = ''

/**
 * 落盘。
 *
 * 一份全是默认值的配置等于没配过 —— 不写进去，也把旧键删掉，
 * 这样以后改默认值时，没动过那一项的用户才能跟着变。
 */
export function saveModelConsole(
  activeModelId: string,
  states: Record<string, CharacterState>,
  defaultModelId: string,
): void {
  try {
    const payload: StoredModelConsole = {
      activeModelId: activeModelId === defaultModelId ? '' : activeModelId,
      states: {},
    }
    for (const [id, state] of Object.entries(states)) {
      const stored = toStoredState(state)
      if (Object.keys(stored).length > 0) payload.states[id] = stored
    }
    const isEmpty = !payload.activeModelId && Object.keys(payload.states).length === 0
    const json = isEmpty ? '' : JSON.stringify(payload)
    if (json === lastWritten) return
    lastWritten = json
    if (!json) {
      window.localStorage.removeItem(MODEL_CONSOLE_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(MODEL_CONSOLE_STORAGE_KEY, json)
  } catch {
    // 隐私模式下存不了，只在内存里生效
  }
}
