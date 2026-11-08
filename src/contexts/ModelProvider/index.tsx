import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Model3Config, ModelManifest, ModelSource } from './types'
import { DEFAULT_VOLCENGINE_VOICE_PRESET_ID } from '../VoiceProvider/presets'
import { ModelContext, type CharacterState, type ModelContextValue } from './ModelContext'
import {
  DEFAULT_CHARACTER_STATE,
  loadModelConsole,
  saveModelConsole,
} from './storage'

const DEFAULT_MODEL_SOURCE: ModelSource = {
  id: 'whale-local',
  name: 'DS 鲸鱼娘',
  modelUrl: '/models/whale/c_0120.model3.json',
  manifestUrl: '/models/whale/manifest.json',
}

const ONLINE_MODELS_STORAGE_KEY = 'ailive.online-models'

const createCharacterState = (): CharacterState => ({
  manifest: null,
  configError: false,
  // 默认值集中在 storage 里：持久化要拿它做「读不懂就退回默认」，两处各写一份迟早对不上
  ...DEFAULT_CHARACTER_STATE,
  selectedExpressions: [],
})

function loadOnlineModelSources(): ModelSource[] {
  try {
    const raw = window.localStorage.getItem(ONLINE_MODELS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    return parsed.filter((item): item is ModelSource => {
      if (!item || typeof item !== 'object') return false
      const source = item as Partial<ModelSource>
      if (typeof source.id !== 'string' || !source.id.startsWith('online:') || seen.has(source.id)) return false
      if (typeof source.name !== 'string' || typeof source.modelUrl !== 'string') return false
      try {
        const modelUrl = new URL(source.modelUrl)
        if (!/^https?:$/i.test(modelUrl.protocol)) return false
        if (source.manifestUrl) {
          const manifestUrl = new URL(source.manifestUrl)
          if (!/^https?:$/i.test(manifestUrl.protocol)) return false
        }
      } catch {
        return false
      }
      seen.add(source.id)
      return source.manifestUrl == null || typeof source.manifestUrl === 'string'
    }).map((source) => ({
      id: source.id,
      name: source.name,
      modelUrl: source.modelUrl,
      ...(source.manifestUrl ? { manifestUrl: source.manifestUrl } : {}),
    }))
  } catch {
    return []
  }
}

function createManifestFromModel3(config: Model3Config, source: ModelSource): ModelManifest {
  const configuredMotions = config.FileReferences?.Motions ?? config.motions ?? {}
  const configuredExpressions = config.FileReferences?.Expressions
    ?? (config.expressions ?? []).flatMap((expression) => expression.name && expression.file
      ? [{ Name: expression.name, File: expression.file }]
      : [])
  const motions = Object.fromEntries(
    Object.entries(configuredMotions)
      .filter(([, entries]) => entries.length > 0)
      .map(([group, entries]) => [group, {
        group,
        label: group,
        loop: group.toLowerCase().includes('idle'),
        file: entries[0].File,
      }]),
  )
  const expressions = Object.fromEntries(
    configuredExpressions
      .filter((expression) => expression.Name && expression.File)
      .map((expression) => [expression.Name, { file: expression.File }]),
  )
  return {
    displayName: config.Name || config.name || source.name,
    motions,
    expressions,
  }
}

type ModelProviderProps = {
  children: ReactNode
}

export function ModelProvider({ children }: ModelProviderProps) {
  // 上次的控制台设置，只在挂载时读一次
  const [stored] = useState(loadModelConsole)

  const [modelSources, setModelSources] = useState<ModelSource[]>(() => [DEFAULT_MODEL_SOURCE, ...loadOnlineModelSources()])
  // 存的那个模型可能已经被删了（在线模型列表是另一份存储），对不上就回到默认模型
  const [activeModelId, setActiveModelId] = useState(() =>
    modelSources.some((source) => source.id === stored.activeModelId) ? stored.activeModelId : DEFAULT_MODEL_SOURCE.id
  )
  const [characterStates, setCharacterStates] = useState<Record<string, CharacterState>>(() =>
    Object.fromEntries(modelSources.map((source) => [
      source.id,
      // 存过的字段盖在默认值上；没存过的模型（新加的）就是一份默认状态
      { ...createCharacterState(), ...stored.states[source.id] },
    ]))
  )

  const activeCharacter = characterStates[activeModelId] ?? createCharacterState()
  const manifest = activeCharacter.manifest
  const configError = activeCharacter.configError

  const modelSourceSignature = modelSources.map((source) => `${source.id}|${source.modelUrl}|${source.manifestUrl ?? ''}`).join('\n')

  // Persist online models
  useEffect(() => {
    try {
      window.localStorage.setItem(
        ONLINE_MODELS_STORAGE_KEY,
        JSON.stringify(modelSources.filter((source) => source.id.startsWith('online:')))
      )
    } catch {
      // Storage unavailable
    }
  }, [modelSources])

  /**
   * 角色设置落盘：每个角色一份「配过的那几项」，外加当前选中的是哪个模型。
   * 模型加载完会再刷一次 state（manifest 变了），那次的载荷没变，saveModelConsole 会跳过。
   */
  useEffect(() => {
    saveModelConsole(activeModelId, characterStates, DEFAULT_MODEL_SOURCE.id)
  }, [activeModelId, characterStates])

  // Load manifests for all models
  useEffect(() => {
    const controllers = modelSources.map((source) => {
      const controller = new AbortController()
      fetch(source.manifestUrl ?? source.modelUrl, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Model config request failed: ${response.status}`)
          return response.json() as Promise<ModelManifest | Model3Config>
        })
        .then((config) => {
          const nextManifest = source.manifestUrl
            ? config as ModelManifest
            : createManifestFromModel3(config as Model3Config, source)
          setCharacterStates((current) => {
            const state = current[source.id]
            if (!state) return current
            return {
              ...current,
              [source.id]: {
                ...state,
                manifest: nextManifest,
                configError: false,
                activeMotion: nextManifest.motions[state.activeMotion]
                  ? state.activeMotion
                  : Object.keys(nextManifest.motions)[0] ?? '',
              },
            }
          })
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          console.error('Live2D manifest failed to load', error)
          setCharacterStates((current) => current[source.id]
            ? { ...current, [source.id]: { ...current[source.id], configError: true } }
            : current)
        })
      return controller
    })
    return () => controllers.forEach((controller) => controller.abort())
  }, [modelSourceSignature])

  const updateCharacter = (id: string, patch: Partial<CharacterState>) => {
    setCharacterStates((current) => current[id]
      ? { ...current, [id]: { ...current[id], ...patch } }
      : current)
  }

  const updateActiveCharacter = (patch: Partial<CharacterState>) => updateCharacter(activeModelId, patch)

  const addOnlineModel = (url: string, name: string) => {
    try {
      const parsed = new URL(url, window.location.href)
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('Unsupported model URL protocol')
      const nextSource: ModelSource = {
        id: `online:${parsed.toString()}`,
        // 名称由用户填写（弹窗里是必填项），这里的 hostname 只是兜底，正常走不到
        name: name.trim() || parsed.hostname,
        modelUrl: parsed.toString(),
      }
      setModelSources((current) => {
        const withDefault = current.some((source) => source.id === DEFAULT_MODEL_SOURCE.id)
          ? current
          : [DEFAULT_MODEL_SOURCE, ...current]
        return withDefault.some((source) => source.id === nextSource.id) ? withDefault : [...withDefault, nextSource]
      })
      setCharacterStates((current) => {
        const next = { ...current }
        if (!next[DEFAULT_MODEL_SOURCE.id]) next[DEFAULT_MODEL_SOURCE.id] = createCharacterState()
        if (!next[nextSource.id]) next[nextSource.id] = createCharacterState()
        return next
      })
      setActiveModelId(nextSource.id)
    } catch (error) {
      console.error('Online Live2D model URL is invalid', error)
      updateActiveCharacter({ configError: true })
    }
  }

  const deleteModel = (id: string) => {
    if (!id.startsWith('online:')) return
    const deletedIndex = modelSources.findIndex((source) => source.id === id)
    if (deletedIndex < 0) return
    const remainingSources = modelSources.filter((source) => source.id !== id)
    if (remainingSources.length === 0) return
    setModelSources(remainingSources)
    setCharacterStates((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    if (activeModelId === id) {
      const nextSource = remainingSources[deletedIndex] ?? remainingSources[0]
      setActiveModelId(nextSource.id)
    }
  }

  const resetActiveCharacter = () => {
    // 字段和 DEFAULT_CHARACTER_STATE 对齐（positionResetKey 除外，它是自增的重置计数）
    updateActiveCharacter({
      activeMotion: DEFAULT_CHARACTER_STATE.activeMotion,
      selectedExpressions: [],
      modelSize: DEFAULT_CHARACTER_STATE.modelSize,
      positionResetKey: activeCharacter.positionResetKey + 1,
      voicePresetId: DEFAULT_CHARACTER_STATE.voicePresetId,
      modelVisible: DEFAULT_CHARACTER_STATE.modelVisible,
      bubbleMode: DEFAULT_CHARACTER_STATE.bubbleMode,
      nameplateVisible: DEFAULT_CHARACTER_STATE.nameplateVisible,
    })
  }

  const resetVoicePresetForAll = (deletedPresetId: string) => {
    setCharacterStates((current) => Object.fromEntries(
      Object.entries(current).map(([modelId, state]) => [
        modelId,
        state.voicePresetId === deletedPresetId
          ? { ...state, voicePresetId: DEFAULT_VOLCENGINE_VOICE_PRESET_ID }
          : state,
      ])
    ))
  }

  const value = useMemo<ModelContextValue>(() => ({
    modelSources,
    activeModelId,
    characterStates,
    activeCharacter,
    manifest,
    configError,
    setActiveModelId,
    updateActiveCharacter,
    updateCharacter,
    addOnlineModel,
    deleteModel,
    resetActiveCharacter,
    resetVoicePresetForAll,
  }), [modelSources, activeModelId, characterStates, activeCharacter, manifest, configError])

  return (
    <ModelContext.Provider value={value}>
      {children}
    </ModelContext.Provider>
  )
}
