import { useEffect, useMemo, useRef, useState } from 'react'
import { AddModelModal } from '../AddModelModal'
import { VoiceControlPanel } from '../VoiceControlPanel'
import { Button } from '../Button'
import { Modal } from '../Modal'
import { ScrollArea } from '../ScrollArea'
import { Slider } from '../Slider'
import { cx } from '../../utils/cx'
import type { VolcengineTtsConfig, VolcengineVoicePreset } from '../../voice/volcengineTts'
import type { ModelManifest, ModelSource } from '../../modelTypes'
import styles from './index.module.scss'

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
  voicePresetId: string
  voiceConfig: VolcengineTtsConfig
  voiceSpeaking: boolean
  voiceError: string
  customVoices: VolcengineVoicePreset[]
  onVoicePresetChange: (preset: VolcengineVoicePreset) => void
  onVoiceConfigChange: (config: VolcengineTtsConfig) => void
  onVoiceSpeak: (text: string, preset: VolcengineVoicePreset) => void
  onAddVoice: (voice: VolcengineVoicePreset) => void
  onDeleteVoice: (id: string) => void
  onResetRole: () => void
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
  voicePresetId,
  voiceConfig,
  voiceSpeaking,
  voiceError,
  customVoices,
  onVoicePresetChange,
  onVoiceConfigChange,
  onVoiceSpeak,
  onAddVoice,
  onDeleteVoice,
  onResetRole,
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
    <aside className={styles.panel}>
      <div className={styles.eyebrow}>LIVE2D CONTROL</div>
      <h1 className={styles.title}>角色控制台</h1>
      <p className={styles.intro}>管理你的虚拟形象、动作与实时互动。</p>

      {/* 当前角色 */}
      <div className={styles.block}>
        <div className={styles.labelRow}>
          <span>当前角色</span>
          <span className={styles.tinyTag}>LIVE2D</span>
        </div>
        <div className={styles.picker} ref={modelPickerRef}>
          <Button
            variant="bare"
            className={cx(styles.trigger, modelMenuOpen && styles.triggerOpen)}
            aria-expanded={modelMenuOpen}
            onClick={() => setModelMenuOpen((open) => !open)}
          >
            <div className={styles.orb}>{(currentSource?.name ?? manifest?.displayName ?? '模').slice(0, 1)}</div>
            <div>
              <strong className={styles.modelName}>{currentSource?.name ?? manifest?.displayName ?? 'Live2D 模型'}</strong>
              <span className={styles.modelKind}>{activeModelId.startsWith('online:') ? '线上模型' : '本地模型'}</span>
            </div>
            <span className={styles.chevron} aria-hidden="true" />
          </Button>
          {modelMenuOpen && (
            <div className={styles.menu} role="listbox">
              {modelSources.map((source) => (
                <div className={cx(styles.optionRow, source.id === activeModelId && styles.optionRowActive)} key={source.id}>
                  <button className={styles.option} type="button" onClick={() => selectModel(source.id)}>
                    <span>{source.name}</span>
                    <small className={styles.optionMeta}>{source.id.startsWith('online:') ? '线上模型' : '本地模型'}</small>
                  </button>
                  {source.id.startsWith('online:') && (
                    <button
                      className={styles.remove}
                      type="button"
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
        <Button size="md" block className={styles.addButton} onClick={openAddModel}>＋ 添加模型</Button>
        {configError && <div className={styles.error}>模型配置或线上资源加载失败</div>}
      </div>

      {/* 动作预设 */}
      <div className={styles.block}>
        <div className={styles.labelRow}>
          <span>动作预设</span>
          <span className={styles.count}>{motionOptions.length}</span>
        </div>
        <ScrollArea
          framed
          gap="4px"
          height="clamp(104px, 16vh, 178px)"
          className={styles.motionList}
          ariaLabel="动作预设列表"
        >
          {motionOptions.length > 0 ? (
            motionOptions.map(([group, config], index) => (
              <button
                className={cx(styles.motion, activeMotion === group && styles.motionActive)}
                key={group}
                type="button"
                onClick={() => onMotionChange(group)}
              >
                <span className={styles.motionIcon}>{motionIcons[index % motionIcons.length]}</span>
                <span className={styles.motionCopy}>
                  <strong>{config.label ?? group}</strong>
                  <small>{config.loop ? '循环' : config.duration == null ? '动作' : `${config.duration.toFixed(1)} 秒`}</small>
                </span>
                <span className={styles.play}>{activeMotion === group ? '●' : '›'}</span>
              </button>
            ))
          ) : (
            <div className={styles.loading}>
              {configError ? '模型配置读取失败' : '正在读取模型配置...'}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 表达预设 */}
      {(manifest === null || expressionOptions.length > 0) && (
        <div className={styles.block}>
          <div className={styles.labelRow}>
            <span>表达预设</span>
            <span className={styles.count}>{expressionOptions.length}</span>
          </div>
          <ScrollArea
            framed
            columns={2}
            gap="4px"
            height="clamp(148px, 24vh, 252px)"
            className={styles.expressionList}
            ariaLabel="表达预设列表"
          >
            {manifest ? (
              expressionOptions.map((expression) => (
                <button
                  className={cx(styles.expression, selectedExpressions.includes(expression) && styles.expressionActive)}
                  key={expression}
                  type="button"
                  onClick={() => onExpressionToggle(expression)}
                >
                  {expression}
                  <span className={styles.expressionMark}>{selectedExpressions.includes(expression) ? '●' : '›'}</span>
                </button>
              ))
            ) : (
              <div className={styles.loading}>
                {configError ? '模型配置读取失败' : '正在读取模型配置...'}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* 模型大小 */}
      <div className={cx(styles.block, styles.sizeBlock)}>
        <Slider
          label="模型大小"
          valueText={`${Math.round(modelSize * 100)}%`}
          minLabel="较小"
          maxLabel="较大"
          ariaLabel="模型大小"
          min={0.2}
          max={0.95}
          step={0.05}
          value={modelSize}
          onChange={onModelSizeChange}
        />
      </div>

      <VoiceControlPanel
        presetId={voicePresetId}
        config={voiceConfig}
        speaking={voiceSpeaking}
        error={voiceError}
        customVoices={customVoices}
        onPresetChange={onVoicePresetChange}
        onConfigChange={onVoiceConfigChange}
        onSpeak={onVoiceSpeak}
        onAddVoice={onAddVoice}
        onDeleteVoice={onDeleteVoice}
      />

      {/* 底部信息 */}
      <div className={styles.footer}>
        <div className={styles.footerMeta}>
          <div>
            <span>渲染引擎</span>
            <strong>PixiJS + Cubism</strong>
          </div>
          <div>
            <span>配置项</span>
            <strong>{motionOptions.length + expressionOptions.length}</strong>
          </div>
        </div>
        <Button size="md" block className={styles.resetButton} onClick={onResetRole}>↺ 重置角色</Button>
      </div>

      {addModelOpen && (
        <AddModelModal
          onClose={() => setAddModelOpen(false)}
          onAddOnlineModel={onAddOnlineModel}
        />
      )}

      {deleteTarget && (
        <Modal
          eyebrow="MODEL REMOVE"
          title="删除模型"
          scrollable={false}
          width="min(380px, 100%)"
          onClose={() => setDeleteTarget(null)}
          actions={(
            <>
              <Button variant="secondary" size="lg" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button
                variant="danger"
                size="lg"
                onClick={() => {
                  onDeleteModel(deleteTarget.id)
                  setDeleteTarget(null)
                  setModelMenuOpen(false)
                }}
              >
                确认删除
              </Button>
            </>
          )}
        >
          <p className={styles.confirmCopy}>确定要删除“{deleteTarget.name}”吗？删除后可重新添加模型。</p>
        </Modal>
      )}
    </aside>
  )
}
