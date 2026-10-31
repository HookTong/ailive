import { useEffect, useMemo, useRef, useState } from 'react'
import { Live2DCanvas } from './Live2DCanvas'
import type { ModelManifest, ModelSource } from '../modelTypes'

const motionIcons = ['◌', '⌁', '◇', '◍', '◠']

type ControlPanelProps = {
  manifest: ModelManifest | null
  configError: boolean
  modelSources: ModelSource[]
  activeModelId: string
  onModelSelect: (id: string) => void
  onAddOnlineModel: (url: string, name: string) => void
  activeMotion: string
  onMotionChange: (motion: string) => void
  selectedExpressions: string[]
  onExpressionToggle: (expression: string) => void
  modelSize: number
  onModelSizeChange: (size: number) => void
  backgroundUrl: string
  onBackgroundUrlChange: (value: string) => void
  onBackgroundFile: (file: File | null) => void
  onResetAll: () => void
}

export function ControlPanel({
  manifest,
  configError,
  modelSources,
  activeModelId,
  onModelSelect,
  onAddOnlineModel,
  activeMotion,
  onMotionChange,
  selectedExpressions,
  onExpressionToggle,
  modelSize,
  onModelSizeChange,
  backgroundUrl,
  onBackgroundUrlChange,
  onBackgroundFile,
  onResetAll,
}: ControlPanelProps) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [modelNameDraft, setModelNameDraft] = useState('')
  const [modelUrlDraft, setModelUrlDraft] = useState('')
  const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle')
  const [previewError, setPreviewError] = useState('')
  const [previewResetKey, setPreviewResetKey] = useState(0)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const motionOptions = useMemo(() => Object.entries(manifest?.motions ?? {}), [manifest])
  const expressionOptions = useMemo(() => Object.keys(manifest?.expressions ?? {}), [manifest])
  const currentSource = modelSources.find((source) => source.id === activeModelId)

  useEffect(() => {
    if (!modelMenuOpen) return
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!modelPickerRef.current?.contains(event.target as Node)) setModelMenuOpen(false)
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [modelMenuOpen])

  const selectModel = (id: string) => {
    onModelSelect(id)
    setModelMenuOpen(false)
  }

  const openAddModel = () => {
    setAddModelOpen(true)
    setModelNameDraft('')
    setModelUrlDraft('')
    setPreviewModelUrl(null)
    setPreviewStatus('idle')
    setPreviewError('')
  }

  const closeAddModel = () => {
    setAddModelOpen(false)
    setModelNameDraft('')
    setPreviewModelUrl(null)
    setPreviewStatus('idle')
    setPreviewError('')
  }

  const handlePreviewUrlChange = (value: string) => {
    setModelUrlDraft(value)
    setPreviewModelUrl(null)
    setPreviewStatus('idle')
    setPreviewError('')
  }

  const loadModelPreview = () => {
    const value = modelUrlDraft.trim()
    try {
      if (!value) throw new Error('请输入模型地址')
      const parsed = new URL(value, window.location.href)
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('模型地址必须使用 HTTP 或 HTTPS')
      setPreviewError('')
      setPreviewStatus('loading')
      setPreviewModelUrl(parsed.toString())
      setPreviewResetKey((current) => current + 1)
    } catch (error) {
      setPreviewModelUrl(null)
      setPreviewStatus('missing')
      setPreviewError(error instanceof Error ? error.message : '模型地址无效')
    }
  }

  const handlePreviewLoadState = (state: 'loading' | 'ready' | 'missing') => {
    setPreviewStatus(state)
    if (state === 'missing') setPreviewError('模型资源加载失败，请检查地址及跨域设置')
    if (state === 'ready') setPreviewError('')
  }

  const addPreviewModel = () => {
    if (previewStatus !== 'ready' || !previewModelUrl) return
    const fallbackName = new URL(previewModelUrl).hostname
    onAddOnlineModel(previewModelUrl, modelNameDraft.trim() || fallbackName)
    closeAddModel()
  }

  return (
    <aside className="sidebar">
      <div className="eyebrow">LIVE2D CONTROL</div>
      <h1>角色控制台</h1>
      <p className="intro">管理你的虚拟形象、动作与实时互动。</p>

      {/* 当前角色 */}
      <div className="side-block">
        <div className="label-row">
          <span>当前角色</span>
          <span className="tiny-tag">LIVE2D</span>
        </div>
        <div className="model-picker" ref={modelPickerRef}>
          <button
            className={modelMenuOpen ? 'character-card model-trigger open' : 'character-card model-trigger'}
            type="button"
            aria-expanded={modelMenuOpen}
            onClick={() => setModelMenuOpen((open) => !open)}
          >
            <div className="mini-orb">{(manifest?.displayName ?? currentSource?.name ?? '模').slice(0, 1)}</div>
            <div>
              <strong>{manifest?.displayName ?? currentSource?.name ?? 'Live2D 模型'}</strong>
              <span>{activeModelId.startsWith('online:') ? '线上模型' : '本地模型'}</span>
            </div>
            <span className="chevron" aria-hidden="true" />
          </button>
          {modelMenuOpen && (
            <div className="model-menu" role="listbox">
              {modelSources.map((source) => (
                <button
                  className={source.id === activeModelId ? 'model-option active' : 'model-option'}
                  type="button"
                  key={source.id}
                  onClick={() => selectModel(source.id)}
                >
                  <span>{source.name}</span>
                  <small>{source.id.startsWith('online:') ? '线上模型' : '本地模型'}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="add-model-button" type="button" onClick={openAddModel}>＋ 添加模型</button>
        {configError && <div className="control-error">模型配置或线上资源加载失败</div>}
      </div>

      {/* 动作预设 */}
      <div className="side-block">
        <div className="label-row">
          <span>动作预设</span>
          <span className="count">{motionOptions.length}</span>
        </div>
        <div className="motion-list">
          {motionOptions.length > 0 ? (
            motionOptions.map(([group, config], index) => (
              <button
                className={activeMotion === group ? 'motion active' : 'motion'}
                key={group}
                onClick={() => onMotionChange(group)}
              >
                <span className="motion-icon">{motionIcons[index % motionIcons.length]}</span>
                <span className="motion-copy">
                  <strong>{config.label ?? group}</strong>
                  <small>{config.loop ? '循环' : config.duration == null ? '动作' : `${config.duration.toFixed(1)} 秒`}</small>
                </span>
                <span className="play">{activeMotion === group ? '●' : '›'}</span>
              </button>
            ))
          ) : (
            <div className="control-loading">
              {configError ? '模型配置读取失败' : '正在读取模型配置...'}
            </div>
          )}
        </div>
      </div>

      {/* 表达预设 */}
      {(manifest === null || expressionOptions.length > 0) && (
        <div className="side-block">
          <div className="label-row">
            <span>表达预设</span>
            <span className="count">{expressionOptions.length}</span>
          </div>
          <div className="expression-list">
            {manifest ? (
              expressionOptions.map((expression) => (
                <button
                  className={selectedExpressions.includes(expression) ? 'expression active' : 'expression'}
                  key={expression}
                  onClick={() => onExpressionToggle(expression)}
                >
                  {expression}
                  <span>{selectedExpressions.includes(expression) ? '●' : '›'}</span>
                </button>
              ))
            ) : (
              <div className="control-loading">
                {configError ? '模型配置读取失败' : '正在读取模型配置...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 模型大小 */}
      <div className="side-block size-control">
        <div className="label-row">
          <span>模型大小</span>
          <span className="count">{Math.round(modelSize * 100)}%</span>
        </div>
        <input
          aria-label="模型大小"
          type="range"
          min="0.55"
          max="1.05"
          step="0.05"
          value={modelSize}
          onChange={(event) => onModelSizeChange(Number(event.target.value))}
        />
        <div className="range-labels">
          <span>较小</span>
          <span>较大</span>
        </div>
      </div>

      <div className="side-block background-control">
        <div className="label-row">
          <span>舞台背景</span>
          <span className="count">可选</span>
        </div>
        <input
          className="background-url"
          type="url"
          value={backgroundUrl.startsWith('blob:') ? '' : backgroundUrl}
          onChange={(event) => onBackgroundUrlChange(event.target.value)}
          placeholder="粘贴背景图 URL"
          aria-label="舞台背景图 URL"
        />
        <label className="background-file">
          <span>选择本地图片</span>
          <input type="file" accept="image/*" onChange={(event) => onBackgroundFile(event.target.files?.[0] ?? null)} />
        </label>
      </div>

      {/* 底部信息 */}
      <div className="side-footer">
        <div className="side-footer-meta">
          <div>
            <span>渲染引擎</span>
            <strong>PixiJS + Cubism</strong>
          </div>
          <div>
            <span>配置项</span>
            <strong>{motionOptions.length + expressionOptions.length}</strong>
          </div>
        </div>
        <button className="reset-all" type="button" onClick={onResetAll}>↺ 全部重置</button>
      </div>

      {addModelOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeAddModel()}>
          <section className="model-modal" role="dialog" aria-modal="true" aria-labelledby="add-model-title">
            <div className="modal-header">
              <div>
                <span className="eyebrow">MODEL IMPORT</span>
                <h2 id="add-model-title">添加线上模型</h2>
              </div>
              <button className="modal-close" type="button" aria-label="关闭" onClick={closeAddModel}>×</button>
            </div>
            <label className="modal-field">
              <span>模型名称</span>
              <input
                type="text"
                value={modelNameDraft}
                onChange={(event) => setModelNameDraft(event.target.value)}
                placeholder="输入名称，用于下拉列表展示"
                aria-label="模型名称"
                maxLength={40}
              />
            </label>
            <span className="modal-field-label">模型地址</span>
            <div className="modal-url-row">
              <input
                type="url"
                value={modelUrlDraft}
                onChange={(event) => handlePreviewUrlChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && loadModelPreview()}
                placeholder="输入 model3.json 地址"
                aria-label="线上模型地址"
                autoFocus
              />
              <button type="button" onClick={loadModelPreview} disabled={!modelUrlDraft.trim()}>加载</button>
            </div>
            <div className="model-preview-box">
              {previewModelUrl ? (
                <Live2DCanvas
                  key={previewModelUrl}
                  modelUrl={previewModelUrl}
                  motion=""
                  expressions={[]}
                  size={0.78}
                  positionResetKey={previewResetKey}
                  onLoadStateChange={handlePreviewLoadState}
                />
              ) : (
                <div className="model-preview-placeholder">输入模型地址后加载预览</div>
              )}
            </div>
            {previewError && <div className="control-error modal-error">{previewError}</div>}
            {previewStatus === 'loading' && <div className="modal-status">正在加载模型预览...</div>}
            {previewStatus === 'ready' && <div className="modal-status ready">模型加载成功，可以添加</div>}
            <div className="modal-actions">
              <button className="modal-secondary" type="button" onClick={closeAddModel}>取消</button>
              <button className="modal-primary" type="button" onClick={addPreviewModel} disabled={previewStatus !== 'ready'}>添加模型</button>
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}
