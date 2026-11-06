import { useMemo, useRef, useState } from 'react'
import { useModel } from '../../hooks'
import { cx } from '../../utils/cx'
import { Button } from '../Button'
import { Input } from '../Input'
import { Modal } from '../Modal'
import { Stage, type StageLoadState, type StageModel } from '../Stage'
import styles from './index.module.scss'

type AddModelModalProps = {
  onClose: () => void
  onAddOnlineModel: (url: string, name: string) => void
}

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'missing'

const PREVIEW_MODEL_ID = 'model-preview'

function readModelName(config: unknown): string {
  if (!config || typeof config !== 'object') return ''
  const record = config as Record<string, unknown>
  if (typeof record.Name === 'string' && record.Name.trim()) return record.Name.trim()
  if (typeof record.name === 'string' && record.name.trim()) return record.name.trim()
  return ''
}

function isValidModelConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false
  const record = config as Record<string, unknown>
  const fileReferences = record.FileReferences && typeof record.FileReferences === 'object'
    ? record.FileReferences as Record<string, unknown>
    : null
  const isCubism34 = Boolean(fileReferences && typeof fileReferences.Moc === 'string' && Array.isArray(fileReferences.Textures))
  const isCubism2 = typeof record.model === 'string' && Array.isArray(record.textures)
  return isCubism34 || isCubism2
}

export function AddModelModal({ onClose, onAddOnlineModel }: AddModelModalProps) {
  const { modelSources } = useModel()
  const [modelNameDraft, setModelNameDraft] = useState('')
  const [modelUrlDraft, setModelUrlDraft] = useState('')
  const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle')
  const [previewError, setPreviewError] = useState('')
  const requestRef = useRef(0)

  // 模型名称要唯一：下拉列表、礼物动作配置都按名称认模型，重名会分不清。
  // 大小写和首尾空格不算区别（「Icy」和「 icy 」视为同一个）。
  const trimmedName = modelNameDraft.trim()
  const nameTaken = trimmedName.length > 0
    && modelSources.some((source) => source.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())

  // 预览直接复用 Stage：弹窗里挂一张独立的小舞台（自己的 PIXI 应用 + canvas），
  // 与首页舞台互不影响。
  const previewModels = useMemo<StageModel[]>(() => (previewModelUrl
    ? [{
      id: PREVIEW_MODEL_ID,
      modelUrl: previewModelUrl,
      motion: '',
      expressions: [],
      size: 1,
      positionResetKey: 0,
      initialPosition: { x: 0.5, y: 0.52 },
      zIndex: 1,
    }]
    : []), [previewModelUrl])

  const handlePreviewUrlChange = (value: string) => {
    requestRef.current += 1
    setModelUrlDraft(value)
    setPreviewModelUrl(null)
    setPreviewStatus('idle')
    setPreviewError('')
  }

  const loadModelPreview = async () => {
    const value = modelUrlDraft.trim()
    let target: string
    try {
      if (!value) throw new Error('请输入模型地址')
      const parsed = new URL(value, window.location.href)
      if (!/^https?:$/i.test(parsed.protocol)) throw new Error('模型地址必须使用 HTTP 或 HTTPS')
      target = parsed.toString()
    } catch (error) {
      setPreviewModelUrl(null)
      setPreviewStatus('missing')
      setPreviewError(error instanceof Error ? error.message : '模型地址无效')
      return
    }

    setPreviewError('')
    setPreviewStatus('loading')
    setPreviewModelUrl(null)
    const requestId = ++requestRef.current
    try {
      const response = await fetch(target)
      if (requestId !== requestRef.current) return
      if (!response.ok) throw new Error(`模型配置读取失败（${response.status}）`)
      const config: unknown = await response.json()
      if (requestId !== requestRef.current) return
      if (!isValidModelConfig(config)) throw new Error('该地址不是有效的 Live2D 模型配置（缺少 Moc / Textures）')
      const fallbackName = new URL(target).hostname
      const configuredName = readModelName(config)
      setModelNameDraft((current) => current.trim() ? current : configuredName || fallbackName)
      // 配置校验通过后才挂载预览，预览组件会自己报告加载结果
      setPreviewModelUrl(target)
      setPreviewStatus('loading')
    } catch (error) {
      if (requestId !== requestRef.current) return
      setPreviewModelUrl(null)
      setPreviewStatus('missing')
      setPreviewError(error instanceof Error
        ? error.message.includes('Failed to fetch')
          ? '模型配置读取失败，请检查地址是否可访问（可能受跨域限制）'
          : error.message
        : '模型配置读取失败')
    }
  }

  // 预览失败时由 Stage 在预览框内直接显示原因，这里只同步状态以控制按钮可用性
  const handlePreviewStateChange = (state: StageLoadState) => {
    setPreviewStatus(state)
    if (state !== 'missing') setPreviewError('')
  }

  const addPreviewModel = () => {
    // 按钮已经按 nameTaken 禁用了，这里再兜一层，防止回车之类的路径绕过去
    if (previewStatus !== 'ready' || !previewModelUrl || nameTaken) return
    onAddOnlineModel(previewModelUrl, trimmedName)
    onClose()
  }

  return (
    <Modal
      eyebrow="MODEL IMPORT"
      title="添加线上模型"
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>取消</Button>
          <Button size="lg" onClick={addPreviewModel} disabled={previewStatus !== 'ready' || nameTaken}>添加模型</Button>
        </>
      )}
    >
      <label className={styles.field}>
        <span>模型地址</span>
        <div className={styles.urlRow}>
          <Input
            className={styles.urlInput}
            size="lg"
            type="url"
            value={modelUrlDraft}
            onChange={(event) => handlePreviewUrlChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void loadModelPreview()}
            placeholder="输入 model3.json 地址"
            aria-label="线上模型地址"
            autoFocus
          />
          <Button size="lg" onClick={() => void loadModelPreview()} disabled={!modelUrlDraft.trim() || previewStatus === 'loading'}>加载</Button>
        </div>
      </label>
      <label className={cx(styles.field, styles.nameField)}>
        <span>模型名称</span>
        <Input
          className={nameTaken ? styles.invalid : undefined}
          size="lg"
          type="text"
          value={modelNameDraft}
          onChange={(event) => setModelNameDraft(event.target.value)}
          placeholder="输入名称，用于下拉列表展示"
          aria-label="模型名称"
          aria-invalid={nameTaken || undefined}
          aria-describedby={nameTaken ? 'add-model-name-hint' : undefined}
          maxLength={40}
        />
        {/* 用 div 而不是 span：.field > span 是给字段标签用的，会连带改掉提示的颜色和间距 */}
        {nameTaken && <div className={styles.hint} id="add-model-name-hint">该名称已被使用，请换一个</div>}
      </label>
      <div className={styles.previewBox}>
        {previewModelUrl
          ? (
            <Stage
              bare
              models={previewModels}
              activeModelId={PREVIEW_MODEL_ID}
              onModelStateChange={(_id, state) => handlePreviewStateChange(state)}
            />
          )
          : (
            <div className={styles.placeholder}>
              {previewStatus === 'loading'
                ? '正在读取模型配置...'
                : previewStatus === 'missing'
                  ? '模型预览未就绪'
                  : '输入模型地址后加载预览'}
            </div>
          )}
      </div>
      {previewError && <div className={styles.error}>{previewError}</div>}
      {/* 重名时不说「可以添加」——按钮是禁用的，两句话会打架 */}
      {previewStatus === 'ready' && !nameTaken && <div className={cx(styles.status, styles.statusReady)}>模型加载成功，可以添加</div>}
    </Modal>
  )
}
