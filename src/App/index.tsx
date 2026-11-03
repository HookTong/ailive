import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, type StageModel } from '../components/Stage'
import { ControlPanel } from '../components/ControlPanel'
import { PARTICLE_PRESETS, StageAtmosphere, type ParticlePreset, type ParticlePresetSettings } from '../components/StageAtmosphere'
import { FILTER_PRESETS, type CustomFilterPreset, type FilterPreset } from '../components/FilterControlPanel'
import { StageControlPanel } from '../components/StageControlPanel'
import { StageInfoCards } from '../components/StageInfoCards'
import { Tooltip } from '../components/Tooltip'
import { LiveChatPanel } from '../components/LiveChatPanel'
import { createMockLiveDataProvider } from '../live/providers'
import { DOUYIN_ROOM_STORAGE_KEY } from '../live/douyin'
import { useDouyinRoom } from '../live/useDouyinRoom'
import type { LiveDataProvider, LiveDataSnapshot } from '../live/types'
import { loadCustomVolcengineVoices, synthesizeVolcengineSpeech, loadVolcengineTtsConfig, type VolcengineTtsConfig, type VolcengineVoicePreset, VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY, VOLCENGINE_VOICE_PRESETS } from '../voice/volcengineTts'
import type { Model3Config, ModelManifest, ModelSource } from '../modelTypes'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { cx } from '../utils/cx'
import styles from './index.module.scss'

const MODEL_URL = '/models/whale/c_0120.model3.json'
const MANIFEST_URL = '/models/whale/manifest.json'
const DEFAULT_BACKGROUND_URL = '/background.png'
const DEFAULT_MODEL_SOURCE: ModelSource = {
  id: 'whale-local',
  name: 'DS 鲸鱼娘',
  modelUrl: MODEL_URL,
  manifestUrl: MANIFEST_URL,
}

const CUSTOM_FILTERS_STORAGE_KEY = 'ailive.custom-filters'
const ONLINE_MODELS_STORAGE_KEY = 'ailive.online-models'

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
      ...(source.useConfigName ? { useConfigName: true } : {}),
    }))
  } catch {
    return []
  }
}

function loadCustomFilterPresets(): CustomFilterPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_FILTERS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CustomFilterPreset => {
      if (!item || typeof item !== 'object') return false
      const value = item as Partial<CustomFilterPreset>
      return typeof value.id === 'string'
        && value.id.startsWith('custom:')
        && typeof value.label === 'string'
        && typeof value.brightness === 'number'
        && typeof value.contrast === 'number'
        && typeof value.saturation === 'number'
        && typeof value.blur === 'number'
        && typeof value.vignette === 'boolean'
    })
  } catch {
    return []
  }
}

function createParticlePresetConfigs(): Record<ParticlePreset, ParticlePresetSettings> {
  return Object.fromEntries(PARTICLE_PRESETS.map(({ id, color, intensity, speed, opacity, size }) => [id, { color, intensity, speed, opacity, size }])) as Record<ParticlePreset, ParticlePresetSettings>
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

type CharacterState = {
  manifest: ModelManifest | null
  configError: boolean
  activeMotion: string
  selectedExpressions: string[]
  modelSize: number
  positionResetKey: number
  voicePresetId: string
}

const createCharacterState = (): CharacterState => ({
  manifest: null,
  configError: false,
  activeMotion: 'idle',
  selectedExpressions: [],
  modelSize: 0.6,
  positionResetKey: 0,
  voicePresetId: VOLCENGINE_VOICE_PRESETS[0].id,
})

const MODEL_LAYOUT_POSITIONS = [
  { x: 0.5, y: 0.54 },
  { x: 0.74, y: 0.54 },
  { x: 0.26, y: 0.54 },
  { x: 0.86, y: 0.54 },
  { x: 0.14, y: 0.54 },
]

function App() {
  const [modelSources, setModelSources] = useState<ModelSource[]>(() => [DEFAULT_MODEL_SOURCE, ...loadOnlineModelSources()])
  const [activeModelId, setActiveModelId] = useState(DEFAULT_MODEL_SOURCE.id)
  const [characterStates, setCharacterStates] = useState<Record<string, CharacterState>>({
    ...Object.fromEntries(modelSources.map((source) => [source.id, createCharacterState()])),
  })
  const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKGROUND_URL)
  const backgroundObjectUrlRef = useRef<string | null>(null)
  const [particleEnabled, setParticleEnabled] = useState(true)
  const [particlePresetConfigs, setParticlePresetConfigs] = useState<Record<ParticlePreset, ParticlePresetSettings>>(() => createParticlePresetConfigs())
  const [particleIntensity, setParticleIntensity] = useState(PARTICLE_PRESETS[0].intensity)
  const [particleSpeed, setParticleSpeed] = useState(PARTICLE_PRESETS[0].speed)
  const [particleOpacity, setParticleOpacity] = useState(PARTICLE_PRESETS[0].opacity)
  const [particlePreset, setParticlePreset] = useState<ParticlePreset>('stardust')
  const [particleColor, setParticleColor] = useState(PARTICLE_PRESETS[0].color)
  const [particleSize, setParticleSize] = useState(PARTICLE_PRESETS[0].size)
  const [filterBrightness, setFilterBrightness] = useState(1)
  const [filterContrast, setFilterContrast] = useState(1)
  const [filterSaturation, setFilterSaturation] = useState(1)
  const [filterBlur, setFilterBlur] = useState(0)
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('standard')
  const [customFilterPresets, setCustomFilterPresets] = useState<CustomFilterPreset[]>(loadCustomFilterPresets)
  const [filterEnabled, setFilterEnabled] = useState(true)
  const [vignette, setVignette] = useState(true)
  const [isTalking, setIsTalking] = useState(false)
  const [message, setMessage] = useState('你好，我是你的 Live2D 助手。')
  const [showStageCards, setShowStageCards] = useState(true)
  const [voiceConfig, setVoiceConfig] = useState<VolcengineTtsConfig>(loadVolcengineTtsConfig)
  const [customVoices, setCustomVoices] = useState<VolcengineVoicePreset[]>(loadCustomVolcengineVoices)
  const [voiceError, setVoiceError] = useState('')
  const [speakingModel, setSpeakingModel] = useState<{ modelId: string; text: string } | null>(null)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const voiceObjectUrlRef = useRef<string | null>(null)
  const liveDataProviderRef = useRef<LiveDataProvider>(createMockLiveDataProvider())
  const [baseSnapshot, setBaseSnapshot] = useState<LiveDataSnapshot>(() => liveDataProviderRef.current.getSnapshot())
  const [douyinRoomId, setDouyinRoomId] = useState<string | null>(() => window.localStorage.getItem(DOUYIN_ROOM_STORAGE_KEY) || null)
  const douyinRoom = useDouyinRoom(douyinRoomId)

  const modelSource = modelSources.find((source) => source.id === activeModelId) ?? DEFAULT_MODEL_SOURCE
  const activeCharacter = characterStates[activeModelId] ?? createCharacterState()
  const manifest = activeCharacter.manifest
  const configError = activeCharacter.configError
  const activeMotion = activeCharacter.activeMotion
  const selectedExpressions = activeCharacter.selectedExpressions
  const modelSize = activeCharacter.modelSize
  const activeMotionConfig = manifest?.motions[activeMotion]
  const currentExpressionLabel = selectedExpressions.length > 0 ? selectedExpressions.join(' + ') : '默认'

  const modelSourceSignature = modelSources.map((source) => `${source.id}|${source.modelUrl}|${source.manifestUrl ?? ''}`).join('\n')

  useEffect(() => liveDataProviderRef.current.subscribe(setBaseSnapshot), [])

  const handleDouyinRoomChange = (roomId: string | null) => {
    try {
      if (roomId) window.localStorage.setItem(DOUYIN_ROOM_STORAGE_KEY, roomId)
      else window.localStorage.removeItem(DOUYIN_ROOM_STORAGE_KEY)
    } catch {
      // localStorage 在隐私模式下可能不可用
    }
    setDouyinRoomId(roomId)
  }

  // 舞台卡片：今日守护 / 开播状态 / 礼物计数用真实直播数据，
  // 点歌、收支金额仍走 baseSnapshot（暂无数据源）。
  const liveSnapshot = useMemo<LiveDataSnapshot>(() => ({
    ...baseSnapshot,
    platform: douyinRoom.room ? 'douyin' : baseSnapshot.platform,
    isLive: douyinRoom.state === 'live',
    updatedAt: Date.now(),
    income: { ...baseSnapshot.income, gifts: String(douyinRoom.stats.gift) },
    guardians: douyinRoom.giftRank.map((entry, index) => ({
      name: entry.name,
      amount: `${entry.count} 件`,
      rank: index + 1,
      highlighted: index === 0,
    })),
  }), [baseSnapshot, douyinRoom])

  useEffect(() => {
    try {
      window.localStorage.setItem(ONLINE_MODELS_STORAGE_KEY, JSON.stringify(modelSources.filter((source) => source.id.startsWith('online:'))))
    } catch {
      // Storage can be unavailable in private browsing or restrictive WebViews.
    }
  }, [modelSources])

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
          if (source.useConfigName && nextManifest.displayName?.trim()) {
            const configuredName = nextManifest.displayName.trim()
            setModelSources((current) => current.map((item) => item.id === source.id
              ? { ...item, name: configuredName, useConfigName: false }
              : item))
          }
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

  const updateActiveCharacter = (patch: Partial<CharacterState>) => {
    setCharacterStates((current) => current[activeModelId]
      ? { ...current, [activeModelId]: { ...current[activeModelId], ...patch } }
      : current)
  }

  const handleVoicePresetChange = (preset: VolcengineVoicePreset) => {
    updateActiveCharacter({ voicePresetId: preset.id })
  }

  const handleAddVoice = (voice: VolcengineVoicePreset) => {
    setCustomVoices((current) => [...current, voice])
  }

  const handleDeleteVoice = (id: string) => {
    setCustomVoices((current) => current.filter((voice) => voice.id !== id))
    setCharacterStates((current) => Object.fromEntries(Object.entries(current).map(([modelId, state]) => [
      modelId,
      state.voicePresetId === id ? { ...state, voicePresetId: VOLCENGINE_VOICE_PRESETS[0].id } : state,
    ])))
  }

  const handleVoiceSpeak = async (text: string, preset: VolcengineVoicePreset) => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause()
      voiceAudioRef.current = null
    }
    if (voiceObjectUrlRef.current) URL.revokeObjectURL(voiceObjectUrlRef.current)
    setVoiceError('')
    setSpeakingModel(null)
    try {
      const blob = await synthesizeVolcengineSpeech(text, preset, voiceConfig)
      const objectUrl = URL.createObjectURL(blob)
      voiceObjectUrlRef.current = objectUrl
      const audio = new Audio(objectUrl)
      voiceAudioRef.current = audio
      audio.onended = () => {
        setSpeakingModel(null)
        voiceAudioRef.current = null
        if (voiceObjectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl)
          voiceObjectUrlRef.current = null
        }
      }
      audio.onerror = () => {
        setVoiceError('语音播放失败，请检查音频数据')
        setSpeakingModel(null)
      }
      setSpeakingModel({ modelId: activeModelId, text: text.trim() })
      await audio.play()
    } catch (error) {
      setSpeakingModel(null)
      setVoiceError(error instanceof Error ? error.message : '火山 TTS 请求失败')
    }
  }

  // 所有模型共用一个 Stage：这里只计算每个模型该有的渲染参数，
  // 画布数量始终为 1。
  const stageModels = useMemo<StageModel[]>(() => modelSources.flatMap((source, index) => {
    const state = characterStates[source.id]
    if (!state) return []
    return [{
      id: source.id,
      modelUrl: source.modelUrl,
      motion: state.activeMotion,
      expressions: state.selectedExpressions.flatMap((name) => {
        const config = state.manifest?.expressions[name]
        return config ? [{ name, file: config.file }] : []
      }),
      size: state.modelSize,
      positionResetKey: state.positionResetKey,
      initialPosition: MODEL_LAYOUT_POSITIONS[index % MODEL_LAYOUT_POSITIONS.length],
      zIndex: source.id === DEFAULT_MODEL_SOURCE.id ? 30 : source.id === activeModelId ? 20 : 5 + index,
      speechText: speakingModel?.modelId === source.id ? speakingModel.text : '',
    }]
  }), [activeModelId, characterStates, modelSources, speakingModel])

  const handleMotionChange = (motion: string) => {
    updateActiveCharacter({ activeMotion: motion })
  }

  const handleExpressionToggle = (name: string) => {
    const nextExpressions = selectedExpressions.includes(name)
      ? selectedExpressions.filter((item) => item !== name)
      : [...selectedExpressions, name]
    updateActiveCharacter({ selectedExpressions: nextExpressions })
  }

  const handleModelSizeChange = (size: number) => {
    updateActiveCharacter({ modelSize: Math.min(0.95, Math.max(0.2, size)) })
  }

  const handleModelSelect = (id: string) => {
    const nextSource = modelSources.find((source) => source.id === id)
    if (!nextSource || nextSource.id === activeModelId) return
    setActiveModelId(nextSource.id)
  }

  const handleDeleteModel = (id: string) => {
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

  const handleAddOnlineModel = (url: string, name: string) => {
    try {
      const parsed = new URL(url, window.location.href)
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('Unsupported model URL protocol')
      const nextSource: ModelSource = {
        id: `online:${parsed.toString()}`,
        name: name.trim() || parsed.hostname,
        modelUrl: parsed.toString(),
        useConfigName: !name.trim(),
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

  const updateParticleSetting = <K extends keyof ParticlePresetSettings>(key: K, value: ParticlePresetSettings[K]) => {
    setParticlePresetConfigs((current) => ({
      ...current,
      [particlePreset]: { ...current[particlePreset], [key]: value },
    }))
  }

  const handleParticlePresetChange = (nextPreset: ParticlePreset) => {
    const config = particlePresetConfigs[nextPreset]
    if (!config) return
    setParticlePreset(nextPreset)
    setParticleColor(config.color)
    setParticleIntensity(config.intensity)
    setParticleSpeed(config.speed)
    setParticleOpacity(config.opacity)
    setParticleSize(config.size)
  }

  const handleParticleColorChange = (color: string) => {
    setParticleColor(color)
    updateParticleSetting('color', color)
  }

  const handleParticleIntensityChange = (intensity: number) => {
    setParticleIntensity(intensity)
    updateParticleSetting('intensity', intensity)
  }

  const handleParticleSpeedChange = (speed: number) => {
    setParticleSpeed(speed)
    updateParticleSetting('speed', speed)
  }

  const handleParticleOpacityChange = (opacity: number) => {
    setParticleOpacity(opacity)
    updateParticleSetting('opacity', opacity)
  }

  const handleParticleSizeChange = (size: number) => {
    setParticleSize(size)
    updateParticleSetting('size', size)
  }

  const handleBackgroundFile = (file: File | null) => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    backgroundObjectUrlRef.current = null
    if (!file) {
      setBackgroundUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    backgroundObjectUrlRef.current = objectUrl
    setBackgroundUrl(objectUrl)
  }

  const handleBackgroundUrlChange = (value: string) => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    backgroundObjectUrlRef.current = null
    setBackgroundUrl(value)
  }

  const handleResetRole = () => {
    if (speakingModel?.modelId === activeModelId) {
      voiceAudioRef.current?.pause()
      setSpeakingModel(null)
    }
    updateActiveCharacter({
      activeMotion: 'idle',
      selectedExpressions: [],
      modelSize: 0.6,
      positionResetKey: activeCharacter.positionResetKey + 1,
      voicePresetId: VOLCENGINE_VOICE_PRESETS[0].id,
    })
  }

  const handleResetStage = () => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    backgroundObjectUrlRef.current = null
    setBackgroundUrl(DEFAULT_BACKGROUND_URL)
    setParticleEnabled(true)
    setParticlePresetConfigs(createParticlePresetConfigs())
    setParticleIntensity(PARTICLE_PRESETS[0].intensity)
    setParticleSpeed(PARTICLE_PRESETS[0].speed)
    setParticleOpacity(PARTICLE_PRESETS[0].opacity)
    setParticlePreset('stardust')
    setParticleColor(PARTICLE_PRESETS[0].color)
    setParticleSize(PARTICLE_PRESETS[0].size)
    setFilterBrightness(1)
    setFilterContrast(1)
    setFilterSaturation(1)
    setFilterBlur(0)
    setFilterPreset('standard')
    setFilterEnabled(true)
    setVignette(true)
  }

  const handleFilterPresetChange = (id: FilterPreset) => {
    const preset = FILTER_PRESETS.find((item) => item.id === id) ?? customFilterPresets.find((item) => item.id === id)
    if (!preset) return
    setFilterPreset(id)
    setFilterEnabled(true)
    setFilterBrightness(preset.brightness)
    setFilterContrast(preset.contrast)
    setFilterSaturation(preset.saturation)
    setFilterBlur(preset.blur)
    setVignette(preset.vignette)
  }

  const handleAddCustomFilterPreset = (preset: CustomFilterPreset) => {
    setCustomFilterPresets((current) => [...current, preset])
    setFilterPreset(preset.id)
    setFilterEnabled(true)
    setFilterBrightness(preset.brightness)
    setFilterContrast(preset.contrast)
    setFilterSaturation(preset.saturation)
    setFilterBlur(preset.blur)
    setVignette(preset.vignette)
  }

  useEffect(() => () => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    voiceAudioRef.current?.pause()
    if (voiceObjectUrlRef.current) URL.revokeObjectURL(voiceObjectUrlRef.current)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_FILTERS_STORAGE_KEY, JSON.stringify(customFilterPresets))
    } catch {
      // Storage can be unavailable in private browsing or restrictive WebViews.
    }
  }, [customFilterPresets])

  useEffect(() => {
    try {
      window.localStorage.setItem(VOLCENGINE_CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(customVoices))
    } catch {
      // Storage can be unavailable in private browsing or restrictive WebViews.
    }
  }, [customVoices])

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>✦</span>
          <span>AI LIVE<span className={styles.brandMuted}>.studio</span></span>
        </div>
        <div className={styles.topbarMeta}>
          <span className={styles.statusPill}><i /> 系统在线</span>
          <span className={styles.avatar}>A</span>
        </div>
      </header>
      <section className={styles.workspace}>
        <ControlPanel
          manifest={manifest}
          configError={configError}
          modelSources={modelSources}
          activeModelId={activeModelId}
          onModelSelect={handleModelSelect}
          onDeleteModel={handleDeleteModel}
          onAddOnlineModel={handleAddOnlineModel}
          activeMotion={activeMotion}
          onMotionChange={handleMotionChange}
          selectedExpressions={selectedExpressions}
          onExpressionToggle={handleExpressionToggle}
          modelSize={modelSize}
          onModelSizeChange={handleModelSizeChange}
          voicePresetId={activeCharacter.voicePresetId}
          voiceConfig={voiceConfig}
          voiceSpeaking={speakingModel?.modelId === activeModelId}
          voiceError={voiceError}
          customVoices={customVoices}
          onVoicePresetChange={handleVoicePresetChange}
          onVoiceConfigChange={setVoiceConfig}
          onVoiceSpeak={handleVoiceSpeak}
          onAddVoice={handleAddVoice}
          onDeleteVoice={handleDeleteVoice}
          onResetRole={handleResetRole}
        />
        <section className={styles.stagePanel}>
          <div className={styles.stageToolbar}>
            <div><span className={styles.liveDot} /> LIVE PREVIEW</div>
            <div className={styles.toolbarActions}>
              <Tooltip placement="bottom" title={showStageCards ? '隐藏顶部卡片' : '显示顶部卡片'}>
                <Button
                  variant="bare"
                  className={styles.toolButton}
                  aria-label={showStageCards ? '隐藏顶部卡片' : '显示顶部卡片'}
                  onClick={() => setShowStageCards((visible) => !visible)}
                >
                  {showStageCards ? '▣' : '□'}
                </Button>
              </Tooltip>
              <Tooltip placement="bottom" title="全屏">
                <Button variant="bare" className={styles.toolButton}>↗</Button>
              </Tooltip>
              <Tooltip placement="bottom" title="更多">
                <Button variant="bare" className={styles.toolButton}>•••</Button>
              </Tooltip>
            </div>
          </div>
          <div className={styles.preview}>
            <div
              className={styles.stageBackground}
              style={{
                ...(backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : {}),
                filter: filterEnabled ? `brightness(${filterBrightness}) contrast(${filterContrast}) saturate(${filterSaturation}) blur(${filterBlur}px)` : 'none',
              }}
            />
            <StageAtmosphere enabled={particleEnabled} intensity={particleIntensity} speed={particleSpeed} opacity={particleOpacity} preset={particlePreset} color={particleColor} size={particleSize} />
            {showStageCards && <StageInfoCards snapshot={liveSnapshot} />}
            <LiveChatPanel roomId={douyinRoomId} onRoomIdChange={handleDouyinRoomChange} live={douyinRoom} />
            <Stage models={stageModels} activeModelId={activeModelId} onActivateModel={setActiveModelId} />
            <div className={cx(styles.vignette, filterEnabled && vignette && styles.vignetteActive)} />
            <div className={styles.caption}>
              <span>{manifest?.displayName ?? modelSource.name}</span>
              <span>{activeMotionConfig?.label ?? '读取配置中'} · {currentExpressionLabel}</span>
            </div>
          </div>
          <div className={styles.interactionBar}>
            <div className={styles.inputWrap}>
              <span>⌕</span>
              <Input
                variant="bare"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && setIsTalking(true)}
                placeholder="输入一句话，让角色回应..."
              />
              <Button variant="bare" className={styles.send} onClick={() => setIsTalking(true)}>发送</Button>
            </div>
            <Button
              variant="secondary"
              size="xl"
              className={cx(styles.talk, isTalking && styles.talkActive)}
              onClick={() => setIsTalking(!isTalking)}
            >
              <span className={styles.talkIcon}>◉</span>{isTalking ? '正在聆听' : '开始对话'}
            </Button>
          </div>
        </section>
        <StageControlPanel
          backgroundUrl={backgroundUrl}
          onBackgroundUrlChange={handleBackgroundUrlChange}
          onBackgroundFile={handleBackgroundFile}
          onClearBackground={() => handleBackgroundUrlChange('')}
          onResetBackground={() => handleBackgroundUrlChange(DEFAULT_BACKGROUND_URL)}
          onResetStage={handleResetStage}
          particleEnabled={particleEnabled}
          onParticleEnabledChange={setParticleEnabled}
          particleIntensity={particleIntensity}
          onParticleIntensityChange={handleParticleIntensityChange}
          particleSpeed={particleSpeed}
          onParticleSpeedChange={handleParticleSpeedChange}
          particleOpacity={particleOpacity}
          onParticleOpacityChange={handleParticleOpacityChange}
          particlePreset={particlePreset}
          onParticlePresetChange={handleParticlePresetChange}
          particleColor={particleColor}
          onParticleColorChange={handleParticleColorChange}
          particleSize={particleSize}
          onParticleSizeChange={handleParticleSizeChange}
          filterBrightness={filterBrightness}
          onFilterBrightnessChange={(value) => { setFilterPreset('custom'); setFilterBrightness(value) }}
          filterContrast={filterContrast}
          onFilterContrastChange={(value) => { setFilterPreset('custom'); setFilterContrast(value) }}
          filterSaturation={filterSaturation}
          onFilterSaturationChange={(value) => { setFilterPreset('custom'); setFilterSaturation(value) }}
          filterBlur={filterBlur}
          onFilterBlurChange={(value) => { setFilterPreset('custom'); setFilterBlur(value) }}
          filterPreset={filterPreset}
          onFilterPresetChange={handleFilterPresetChange}
          filterEnabled={filterEnabled}
          onFilterEnabledChange={(enabled) => {
            if (enabled) {
              handleFilterPresetChange('standard')
            } else {
              setFilterEnabled(false)
              setFilterPreset('custom')
            }
          }}
          customFilterPresets={customFilterPresets}
          onAddCustomFilterPreset={handleAddCustomFilterPreset}
        />
      </section>
      <footer className={styles.footer}>
        <span>AI LIVE STUDIO</span>
        <span>模型资源由 Live2D Cubism 提供支持</span>
        <span>⌘ K 快捷键</span>
      </footer>
    </main>
  )
}

export default App
