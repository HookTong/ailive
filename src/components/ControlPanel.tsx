import { useEffect, useMemo, useRef, useState } from 'react'
import { AddModelModal } from './AddModelModal'
import type { ModelManifest, ModelSource } from '../modelTypes'

const motionIcons = ['◌', '⌁', '◇', '◍', '◠']

type ControlPanelProps = {
  manifest: ModelManifest | null
  configError: boolean
  modelSources: ModelSource[]
  activeModelId: string
  onModelSelect: (id: string) => void
  onDeleteModel: (id: string) => void
  onAddOnlineModel: (url: string, name: string) => void
  activeMotion: string
  onMotionChange: (motion: string) => void
  selectedExpressions: string[]
  onExpressionToggle: (expression: string) => void
  modelSize: number
  onModelSizeChange: (size: number) => void
  onResetAll: () => void
}

export function ControlPanel({
  manifest,
  configError,
  modelSources,
  activeModelId,
  onModelSelect,
  onDeleteModel,
  onAddOnlineModel,
  activeMotion,
  onMotionChange,
  selectedExpressions,
  onExpressionToggle,
  modelSize,
  onModelSizeChange,
  onResetAll,
}: ControlPanelProps) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ModelSource | null>(null)
  const [addModelOpen, setAddModelOpen] = useState(false)
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
            <div className="mini-orb">{(currentSource?.name ?? manifest?.displayName ?? '模').slice(0, 1)}</div>
            <div>
              <strong>{currentSource?.name ?? manifest?.displayName ?? 'Live2D 模型'}</strong>
              <span>{activeModelId.startsWith('online:') ? '线上模型' : '本地模型'}</span>
            </div>
            <span className="chevron" aria-hidden="true" />
          </button>
          {modelMenuOpen && (
            <div className="model-menu" role="listbox">
              {modelSources.map((source) => (
                <div className={source.id === activeModelId ? 'model-option-row active' : 'model-option-row'} key={source.id}>
                  <button
                    className="model-option"
                    type="button"
                    onClick={() => selectModel(source.id)}
                  >
                    <span>{source.name}</span>
                    <small>{source.id.startsWith('online:') ? '线上模型' : '本地模型'}</small>
                  </button>
                  {source.id.startsWith('online:') && (
                    <button
                      className="model-delete"
                      type="button"
                      title={`删除 ${source.name}`}
                      aria-label={`删除 ${source.name}`}
                      onClick={() => setDeleteTarget(source)}
                    >
                      ×
                    </button>
                  )}
                </div>
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
        <AddModelModal
          onClose={() => setAddModelOpen(false)}
          onAddOnlineModel={onAddOnlineModel}
        />
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-model-title">
            <div className="modal-header">
              <div>
                <span className="eyebrow">MODEL REMOVE</span>
                <h2 id="delete-model-title">删除模型</h2>
              </div>
              <button className="modal-close" type="button" aria-label="关闭" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <p className="confirm-copy">确定要删除“{deleteTarget.name}”吗？删除后可重新添加模型。</p>
            <div className="modal-actions">
              <button className="modal-secondary" type="button" onClick={() => setDeleteTarget(null)}>取消</button>
              <button
                className="modal-danger"
                type="button"
                onClick={() => {
                  onDeleteModel(deleteTarget.id)
                  setDeleteTarget(null)
                  setModelMenuOpen(false)
                }}
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}
    </aside>
  )
}
