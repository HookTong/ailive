import { useEffect, useMemo, useRef, useState } from 'react'
import { Live2DCanvas } from './components/Live2DCanvas'
import { ControlPanel } from './components/ControlPanel'
import { PARTICLE_PRESETS, StageAtmosphere, type ParticlePreset, type ParticlePresetSettings } from './components/StageAtmosphere'
import { FILTER_PRESETS, type CustomFilterPreset, type FilterPreset } from './components/FilterControlPanel'
import { StageControlPanel } from './components/StageControlPanel'
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

function App() {
  const [manifest, setManifest] = useState<ModelManifest | null>(null)
  const [configError, setConfigError] = useState(false)
  const [modelSources, setModelSources] = useState<ModelSource[]>([DEFAULT_MODEL_SOURCE])
  const [modelSource, setModelSource] = useState(DEFAULT_MODEL_SOURCE)
  const [activeMotion, setActiveMotion] = useState('idle')
  const [selectedExpressions, setSelectedExpressions] = useState<string[]>([])
  const [modelSize, setModelSize] = useState(0.78)
  const [positionResetKey, setPositionResetKey] = useState(0)
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

  useEffect(() => {
    const controller = new AbortController()
    setManifest(null)
    fetch(modelSource.manifestUrl ?? modelSource.modelUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Model config request failed: ${response.status}`)
        return response.json() as Promise<ModelManifest | Model3Config>
      })
      .then((config) => {
        const nextManifest = modelSource.manifestUrl
          ? config as ModelManifest
          : createManifestFromModel3(config as Model3Config, modelSource)
        setConfigError(false)
        setManifest(nextManifest)
        setActiveMotion((current) => nextManifest.motions[current] ? current : Object.keys(nextManifest.motions)[0] ?? '')
        if (modelSource.useConfigName && nextManifest.displayName?.trim()) {
          const configuredName = nextManifest.displayName.trim()
          setModelSources((current) => current.map((source) => source.id === modelSource.id
            ? { ...source, name: configuredName, useConfigName: false }
            : source))
          setModelSource((current) => current.id === modelSource.id
            ? { ...current, name: configuredName, useConfigName: false }
            : current)
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Live2D manifest failed to load', error)
        setConfigError(true)
      })
    return () => controller.abort()
  }, [modelSource])

  const selectedExpressionConfigs = useMemo(() => selectedExpressions.flatMap((name) => {
    const config = manifest?.expressions[name]
    return config ? [{ name, file: config.file }] : []
  }), [manifest, selectedExpressions])
  const activeMotionConfig = manifest?.motions[activeMotion]
  const currentExpressionLabel = selectedExpressions.length > 0 ? selectedExpressions.join(' + ') : '默认'

  const handleMotionChange = (motion: string) => {
    setActiveMotion(motion)
  }

  const handleExpressionToggle = (name: string) => {
    setSelectedExpressions((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    )
  }

  const handleModelSizeChange = (size: number) => {
    setModelSize(size)
  }

  const handleModelSelect = (id: string) => {
    const nextSource = modelSources.find((source) => source.id === id)
    if (!nextSource || nextSource.id === modelSource.id) return
    setModelSource(nextSource)
    setManifest(null)
    setConfigError(false)
    setSelectedExpressions([])
    setPositionResetKey((current) => current + 1)
  }

  const handleDeleteModel = (id: string) => {
    if (!id.startsWith('online:')) return
    const deletedIndex = modelSources.findIndex((source) => source.id === id)
    if (deletedIndex < 0) return
    const remainingSources = modelSources.filter((source) => source.id !== id)
    if (remainingSources.length === 0) return
    if (modelSource.id !== id) {
      setModelSources(remainingSources)
      return
    }
    const nextSource = remainingSources[deletedIndex] ?? remainingSources[0]
    setModelSources(remainingSources)
    setModelSource(nextSource)
    setManifest(null)
    setConfigError(false)
    setSelectedExpressions([])
    setPositionResetKey((current) => current + 1)
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
      setModelSource(nextSource)
      setManifest(null)
      setConfigError(false)
      setSelectedExpressions([])
      setPositionResetKey((current) => current + 1)
    } catch (error) {
      console.error('Online Live2D model URL is invalid', error)
      setConfigError(true)
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

  const handleResetAll = () => {
    setActiveMotion('idle')
    setSelectedExpressions([])
    setModelSize(0.78)
    setPositionResetKey((current) => current + 1)
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
          activeModelId={modelSource.id}
          onModelSelect={handleModelSelect}
          onDeleteModel={handleDeleteModel}
          onAddOnlineModel={handleAddOnlineModel}
          activeMotion={activeMotion}
          onMotionChange={handleMotionChange}
          selectedExpressions={selectedExpressions}
          onExpressionToggle={handleExpressionToggle}
          modelSize={modelSize}
          onModelSizeChange={handleModelSizeChange}
          onResetAll={handleResetAll}
        />
        <section className="stage-panel">
          <div className="stage-toolbar"><div><span className="live-dot" /> LIVE PREVIEW</div><div className="toolbar-actions"><button title="全屏">↗</button><button title="更多">•••</button></div></div>
          <div className="preview"><div className="stage-background" style={{ ...(backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : {}), filter: filterEnabled ? `brightness(${filterBrightness}) contrast(${filterContrast}) saturate(${filterSaturation}) blur(${filterBlur}px)` : 'none' }} /><StageAtmosphere enabled={particleEnabled} intensity={particleIntensity} speed={particleSpeed} opacity={particleOpacity} preset={particlePreset} color={particleColor} size={particleSize} /><Live2DCanvas key={modelSource.id} modelUrl={modelSource.modelUrl} motion={activeMotion} expressions={selectedExpressionConfigs} size={modelSize} positionResetKey={positionResetKey} /><div className={filterEnabled && vignette ? 'stage-vignette active' : 'stage-vignette'} /><div className="preview-caption"><span>{manifest?.displayName ?? modelSource.name}</span><span>{activeMotionConfig?.label ?? '读取配置中'} · {currentExpressionLabel}</span></div></div>
          <div className="interaction-bar"><div className="input-wrap"><span>⌕</span><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && setIsTalking(true)} placeholder="输入一句话，让角色回应..." /><button onClick={() => setIsTalking(true)}>发送</button></div><button className={isTalking ? 'talk-button active' : 'talk-button'} onClick={() => setIsTalking(!isTalking)}><span>◉</span>{isTalking ? '正在聆听' : '开始对话'}</button></div>
        </section>
        <StageControlPanel
          backgroundUrl={backgroundUrl}
          onBackgroundUrlChange={handleBackgroundUrlChange}
          onBackgroundFile={handleBackgroundFile}
          onClearBackground={() => handleBackgroundUrlChange('')}
          onResetBackground={() => handleBackgroundUrlChange(DEFAULT_BACKGROUND_URL)}
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
