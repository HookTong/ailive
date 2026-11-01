import { useEffect, useRef, useState } from 'react'
import { Live2DCanvas, type Live2DCanvasHandle } from './components/Live2DCanvas'
import { ControlPanel } from './components/ControlPanel'
import { PARTICLE_PRESETS, StageAtmosphere, type ParticlePreset, type ParticlePresetSettings } from './components/StageAtmosphere'
import { FILTER_PRESETS, type CustomFilterPreset, type FilterPreset } from './components/FilterControlPanel'
import { StageControlPanel } from './components/StageControlPanel'
import { StageInfoCards } from './components/StageInfoCards'
import { createMockLiveDataProvider } from './live/providers'
import type { LiveDataProvider, LiveDataSnapshot } from './live/types'
import type { Model3Config, ModelManifest, ModelSource } from './modelTypes'

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
}

const createCharacterState = (): CharacterState => ({
  manifest: null,
  configError: false,
  activeMotion: 'idle',
  selectedExpressions: [],
  modelSize: 0.78,
  positionResetKey: 0,
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
  const liveDataProviderRef = useRef<LiveDataProvider>(createMockLiveDataProvider())
  const [liveSnapshot, setLiveSnapshot] = useState<LiveDataSnapshot>(() => liveDataProviderRef.current.getSnapshot())
  const modelRefs = useRef<Record<string, Live2DCanvasHandle | null>>({})
  const draggingModelRef = useRef<string | null>(null)

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

  useEffect(() => liveDataProviderRef.current.subscribe(setLiveSnapshot), [])

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

  const getExpressionConfigs = (state: CharacterState) => state.selectedExpressions.flatMap((name) => {
    const config = state.manifest?.expressions[name]
    return config ? [{ name, file: config.file }] : []
  })

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.stage-info-cards')) return
    const orderedSources = [...modelSources].sort((left, right) => {
      if (left.id === activeModelId) return 1
      if (right.id === activeModelId) return -1
      return modelSources.indexOf(left) - modelSources.indexOf(right)
    }).reverse()
    const hitSource = orderedSources.find((source) => modelRefs.current[source.id]?.hitTest(event.clientX, event.clientY))
    if (!hitSource) return
    setActiveModelId(hitSource.id)
    if (modelRefs.current[hitSource.id]?.beginDrag(event.clientX, event.clientY)) {
      draggingModelRef.current = hitSource.id
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    }
  }

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const modelId = draggingModelRef.current
    if (!modelId) return
    modelRefs.current[modelId]?.moveDrag(event.clientX, event.clientY)
    event.preventDefault()
  }

  const handleStagePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const modelId = draggingModelRef.current
    if (modelId) modelRefs.current[modelId]?.endDrag()
    draggingModelRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

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
    updateActiveCharacter({ modelSize: size })
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
      setModelSources((current) => current.some((source) => source.id === nextSource.id) ? current : [...current, nextSource])
      setCharacterStates((current) => current[nextSource.id]
        ? current
        : { ...current, [nextSource.id]: createCharacterState() })
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
    updateActiveCharacter({
      activeMotion: 'idle',
      selectedExpressions: [],
      modelSize: 0.78,
      positionResetKey: activeCharacter.positionResetKey + 1,
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
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_FILTERS_STORAGE_KEY, JSON.stringify(customFilterPresets))
    } catch {
      // Storage can be unavailable in private browsing or restrictive WebViews.
    }
  }, [customFilterPresets])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span><span>AI LIVE<span className="brand-muted">.studio</span></span></div>
        <div className="topbar-meta"><span className="status-pill"><i /> 系统在线</span><span className="avatar">A</span></div>
      </header>
      <section className="workspace">
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
          onResetRole={handleResetRole}
        />
        <section className="stage-panel">
          <div className="stage-toolbar"><div><span className="live-dot" /> LIVE PREVIEW</div><div className="toolbar-actions"><button type="button" title="顶部卡片" aria-label={showStageCards ? '隐藏顶部卡片' : '显示顶部卡片'} onClick={() => setShowStageCards((visible) => !visible)}>{showStageCards ? '▣' : '□'}</button><button type="button" title="全屏">↗</button><button type="button" title="更多">•••</button></div></div>
          <div className="preview" onPointerDown={handleStagePointerDown} onPointerMove={handleStagePointerMove} onPointerUp={handleStagePointerUp} onPointerCancel={handleStagePointerUp}>
            <div className="stage-background" style={{ ...(backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : {}), filter: filterEnabled ? `brightness(${filterBrightness}) contrast(${filterContrast}) saturate(${filterSaturation}) blur(${filterBlur}px)` : 'none' }} />
            <StageAtmosphere enabled={particleEnabled} intensity={particleIntensity} speed={particleSpeed} opacity={particleOpacity} preset={particlePreset} color={particleColor} size={particleSize} />
            {showStageCards && <StageInfoCards snapshot={liveSnapshot} />}
            {modelSources.map((source, index) => {
              const state = characterStates[source.id]
              if (!state) return null
              const isActive = source.id === activeModelId
              return (
                <div
                  className={isActive ? 'model-layer active' : 'model-layer'}
                  key={source.id}
                  style={{
                    zIndex: isActive ? 5 : 3 + index,
                  }}
                >
                  <Live2DCanvas
                    ref={(handle) => { modelRefs.current[source.id] = handle }}
                    modelUrl={source.modelUrl}
                    motion={state.activeMotion}
                    expressions={getExpressionConfigs(state)}
                    size={state.modelSize}
                    positionResetKey={state.positionResetKey}
                    initialPosition={MODEL_LAYOUT_POSITIONS[index % MODEL_LAYOUT_POSITIONS.length]}
                  />
                </div>
              )
            })}
            <div className="model-interaction-layer" aria-hidden="true" />
            <div className={filterEnabled && vignette ? 'stage-vignette active' : 'stage-vignette'} />
            <div className="preview-caption"><span>{manifest?.displayName ?? modelSource.name}</span><span>{activeMotionConfig?.label ?? '读取配置中'} · {currentExpressionLabel}</span></div>
          </div>
          <div className="interaction-bar"><div className="input-wrap"><span>⌕</span><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && setIsTalking(true)} placeholder="输入一句话，让角色回应..." /><button onClick={() => setIsTalking(true)}>发送</button></div><button className={isTalking ? 'talk-button active' : 'talk-button'} onClick={() => setIsTalking(!isTalking)}><span>◉</span>{isTalking ? '正在聆听' : '开始对话'}</button></div>
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
      <footer className="footer"><span>AI LIVE STUDIO</span><span>模型资源由 Live2D Cubism 提供支持</span><span>⌘ K 快捷键</span></footer>
    </main>
  )
}

export default App
