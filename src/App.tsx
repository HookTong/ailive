import { useEffect, useMemo, useRef, useState } from 'react'
import { Live2DCanvas } from './components/Live2DCanvas'
import { ControlPanel } from './components/ControlPanel'
import type { Model3Config, ModelManifest, ModelSource } from './modelTypes'

const MODEL_URL = '/models/whale/c_0120.model3.json'
const MANIFEST_URL = '/models/whale/manifest.json'
const DEFAULT_MODEL_SOURCE: ModelSource = {
  id: 'whale-local',
  name: 'DS 鲸鱼娘',
  modelUrl: MODEL_URL,
  manifestUrl: MANIFEST_URL,
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
  const [onlineModelUrl, setOnlineModelUrl] = useState('')
  const [activeMotion, setActiveMotion] = useState('idle')
  const [selectedExpressions, setSelectedExpressions] = useState<string[]>([])
  const [modelSize, setModelSize] = useState(0.78)
  const [positionResetKey, setPositionResetKey] = useState(0)
  const [backgroundUrl, setBackgroundUrl] = useState('')
  const backgroundObjectUrlRef = useRef<string | null>(null)
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

  const handleLoadOnlineModel = () => {
    const url = onlineModelUrl.trim()
    try {
      if (!url) throw new Error('Model URL is required')
      const parsed = new URL(url, window.location.href)
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('Unsupported model URL protocol')
      const nextSource: ModelSource = {
        id: `online:${parsed.toString()}`,
        name: parsed.hostname,
        modelUrl: parsed.toString(),
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
    setBackgroundUrl('')
  }

  useEffect(() => () => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
  }, [])

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
          onlineModelUrl={onlineModelUrl}
          onOnlineModelUrlChange={setOnlineModelUrl}
          onModelSelect={handleModelSelect}
          onLoadOnlineModel={handleLoadOnlineModel}
          activeMotion={activeMotion}
          onMotionChange={handleMotionChange}
          selectedExpressions={selectedExpressions}
          onExpressionToggle={handleExpressionToggle}
          modelSize={modelSize}
          onModelSizeChange={handleModelSizeChange}
          backgroundUrl={backgroundUrl}
          onBackgroundUrlChange={handleBackgroundUrlChange}
          onBackgroundFile={handleBackgroundFile}
          onResetAll={handleResetAll}
        />
        <section className="stage-panel">
          <div className="stage-toolbar"><div><span className="live-dot" /> LIVE PREVIEW</div><div className="toolbar-actions"><button title="全屏">↗</button><button title="更多">•••</button></div></div>
          <div className="preview" style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><Live2DCanvas key={modelSource.id} modelUrl={modelSource.modelUrl} motion={activeMotion} expressions={selectedExpressionConfigs} size={modelSize} positionResetKey={positionResetKey} /><div className="preview-caption"><span>{manifest?.displayName ?? modelSource.name}</span><span>{activeMotionConfig?.label ?? '读取配置中'} · {currentExpressionLabel}</span></div></div>
          <div className="interaction-bar"><div className="input-wrap"><span>⌕</span><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && setIsTalking(true)} placeholder="输入一句话，让角色回应..." /><button onClick={() => setIsTalking(true)}>发送</button></div><button className={isTalking ? 'talk-button active' : 'talk-button'} onClick={() => setIsTalking(!isTalking)}><span>◉</span>{isTalking ? '正在聆听' : '开始对话'}</button></div>
        </section>
      </section>
      <footer className="footer"><span>AI LIVE STUDIO</span><span>模型资源由 Live2D Cubism 提供支持</span><span>⌘ K 快捷键</span></footer>
    </main>
  )
}

export default App
