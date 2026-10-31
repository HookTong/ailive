import { useState } from 'react'
import { Live2DCanvas } from './Live2DCanvas'

type AddModelModalProps = {
  onClose: () => void
  onAddOnlineModel: (url: string, name: string) => void
}

export function AddModelModal({ onClose, onAddOnlineModel }: AddModelModalProps) {
  const [modelNameDraft, setModelNameDraft] = useState('')
  const [modelUrlDraft, setModelUrlDraft] = useState('')
  const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle')
  const [previewError, setPreviewError] = useState('')
  const [previewResetKey, setPreviewResetKey] = useState(0)

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
    if (state !== 'ready') return
    setPreviewError('')
    if (!previewModelUrl || modelNameDraft.trim()) return

    const fallbackName = new URL(previewModelUrl).hostname
    fetch(previewModelUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Model config request failed: ${response.status}`)
        return response.json() as Promise<unknown>
      })
      .then((config) => {
        const record = config && typeof config === 'object' ? config as Record<string, unknown> : {}
        const configuredName = typeof record.Name === 'string' && record.Name.trim()
          ? record.Name.trim()
          : typeof record.name === 'string' && record.name.trim()
            ? record.name.trim()
            : fallbackName
        setModelNameDraft((current) => current.trim() ? current : configuredName)
      })
      .catch(() => {
        setModelNameDraft((current) => current.trim() ? current : fallbackName)
      })
  }

  const addPreviewModel = () => {
    if (previewStatus !== 'ready' || !previewModelUrl) return
    onAddOnlineModel(previewModelUrl, modelNameDraft.trim())
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="model-modal" role="dialog" aria-modal="true" aria-labelledby="add-model-title">
        <div className="modal-header">
          <div>
            <span className="eyebrow">MODEL IMPORT</span>
            <h2 id="add-model-title">添加线上模型</h2>
          </div>
          <button className="modal-close" type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <label className="modal-field">
          <span>模型地址</span>
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
        </label>
        <label className="modal-field modal-name-field">
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
        <div className="model-preview-box">
          {previewModelUrl ? (
            <Live2DCanvas
              key={`${previewModelUrl}:${previewResetKey}`}
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
          <button className="modal-secondary" type="button" onClick={onClose}>取消</button>
          <button className="modal-primary" type="button" onClick={addPreviewModel} disabled={previewStatus !== 'ready'}>添加模型</button>
        </div>
      </section>
    </div>
  )
}
