import { useEffect, useMemo, useRef, useState } from 'react'
import { AddModelModal } from '../AddModelModal'
import { VoiceSetting } from '../VoiceSetting'
import { Button } from '../Button'
import { Modal } from '../Modal'
import { ScrollArea, PRESET_GRID_MAX_HEIGHT } from '../ScrollArea'
import { PresetChip } from '../PresetChip'
import { Slider } from '../Slider'
import { Tooltip } from '../Tooltip'
import { cx } from '../../utils/cx'
import { useModel, useVoice } from '../../hooks'
import type { VolcengineVoicePreset } from '../../hooks/useTts/api'
import styles from './index.module.scss'

const motionIcons = ['◌', '⌁', '◇', '◍', '◠']

/** 说明图标：细圈里一个 i，和 Input 里的那几个图标同一套写法（currentColor + aria-hidden） */
function InfoIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="5" />
      <path d="M6 5.5v3" strokeLinecap="round" />
      <circle cx="6" cy="3.6" r="0.72" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ModelControlPanel() {
  const {
    modelSources,
    activeModelId,
    manifest,
    configError,
    activeCharacter,
    setActiveModelId,
    updateActiveCharacter,
    addOnlineModel,
    deleteModel,
    resetActiveCharacter,
  } = useModel()

  const {
    addVoice,
    deleteVoice,
    voiceError,
    speakingModel,
    speak,
  } = useVoice()

  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<typeof modelSources[number] | null>(null)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)

  const motionOptions = useMemo(() => Object.entries(manifest?.motions ?? {}), [manifest])
  const expressionOptions = useMemo(() => Object.keys(manifest?.expressions ?? {}), [manifest])
  const currentSource = modelSources.find((source) => source.id === activeModelId)

  const activeMotion = activeCharacter.activeMotion
  const selectedExpressions = activeCharacter.selectedExpressions
  const modelSize = activeCharacter.modelSize
  const voicePresetId = activeCharacter.voicePresetId
  const modelVisible = activeCharacter.modelVisible
  const bubbleMode = activeCharacter.bubbleMode
  const voiceSpeaking = speakingModel?.modelId === activeModelId

  useEffect(() => {
    if (!modelMenuOpen) return
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!modelPickerRef.current?.contains(event.target as Node)) setModelMenuOpen(false)
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [modelMenuOpen])

  const selectModel = (id: string) => {
    setActiveModelId(id)
    setModelMenuOpen(false)
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
    updateActiveCharacter({ modelSize: Math.min(0.95, Math.max(0.2, size)) })
  }

  const clearExpressions = () => {
    updateActiveCharacter({ selectedExpressions: [] })
  }

  const handleVoicePresetChange = (preset: { id: string }) => {
    updateActiveCharacter({ voicePresetId: preset.id })
  }

  const handleVoiceSpeak = async (text: string, preset: VolcengineVoicePreset) => {
    // preset 直接来自 VoiceSetting 里合并好的音色列表，无需再查一遍
    await speak(text, preset, activeModelId)
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
        {/* 添加模型 / 隐藏模型：两等分一行 */}
        <div className={styles.modelActions}>
          <Button variant="ghost" size="sm" onClick={() => setAddModelOpen(true)}>＋ 添加模型</Button>
          <Button variant="ghost" size="sm" onClick={() => updateActiveCharacter({ modelVisible: !modelVisible })}>
            {modelVisible ? '隐藏模型' : '显示模型'}
          </Button>
        </div>
        {configError && <div className={styles.error}>模型配置或线上资源加载失败</div>}
      </div>

      {/* 动作预设 */}
      <div className={styles.block}>
        <div className={styles.labelRow}>
          <span className={styles.labelWithHint}>
            动作预设
            {/* 说明挂在标题上：这一组里选中的那一项就是「说话触发动作」 */}
            <Tooltip title="当角色说话时会触发该动作">
              <span className={styles.hintIcon} role="img" aria-label="当角色说话时会触发该动作" tabIndex={0}>
                <InfoIcon />
              </span>
            </Tooltip>
          </span>
          <span className={styles.count}>{motionOptions.length}</span>
        </div>
        <ScrollArea
          gap="5px"
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
                onClick={() => handleMotionChange(group)}
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

      {/* 外观预设 */}
      {(manifest === null || expressionOptions.length > 0) && (
        <div className={styles.block}>
          <div className={styles.labelRow}>
            <span>外观预设</span>
            <span className={styles.count}>{expressionOptions.length}</span>
          </div>
          <ScrollArea
            columns={3}
            gap="5px"
            maxHeight={PRESET_GRID_MAX_HEIGHT}
            className={styles.expressionList}
            role="group"
            ariaLabel="外观预设列表"
          >
            {manifest ? (
              expressionOptions.map((expression) => (
                <PresetChip
                  key={expression}
                  label={expression}
                  // 外观是多选，选中态同步到 aria-pressed（PresetChip 里做）
                  active={selectedExpressions.includes(expression)}
                  onSelect={() => handleExpressionToggle(expression)}
                />
              ))
            ) : (
              <div className={styles.loading}>
                {configError ? '模型配置读取失败' : '正在读取模型配置...'}
              </div>
            )}
          </ScrollArea>
          <Button
            variant="ghost"
            size="xs"
            block
            className={styles.clearExpressions}
            disabled={selectedExpressions.length === 0}
            onClick={clearExpressions}
          >
            清除外观
          </Button>
        </div>
      )}

      {/* 模型大小 */}
      <div className={cx(styles.block, styles.sizeBlock)}>
        <Slider
          className={styles.sizeSlider}
          label="模型大小"
          valueText={`${Math.round(modelSize * 100)}%`}
          ariaLabel="模型大小"
          min={0.2}
          max={0.95}
          step={0.05}
          value={modelSize}
          onChange={handleModelSizeChange}
        />
      </div>

      <VoiceSetting
        presetId={voicePresetId}
        speaking={voiceSpeaking}
        error={voiceError}
        bubbleMode={bubbleMode}
        onPresetChange={handleVoicePresetChange}
        onSpeak={handleVoiceSpeak}
        onAddVoice={addVoice}
        onDeleteVoice={deleteVoice}
        onBubbleModeChange={(mode) => updateActiveCharacter({ bubbleMode: mode })}
      />

      {/* 底部操作 */}
      <div className={styles.footer}>
        <Button size="md" block className={styles.resetButton} onClick={resetActiveCharacter}>↺ 重置角色</Button>
      </div>

      {addModelOpen && (
        <AddModelModal
          onClose={() => setAddModelOpen(false)}
          onAddOnlineModel={addOnlineModel}
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
                  deleteModel(deleteTarget.id)
                  setDeleteTarget(null)
                  setModelMenuOpen(false)
                }}
              >
                确认删除
              </Button>
            </>
          )}
        >
          <p className={styles.confirmCopy}>确定要删除"{deleteTarget.name}"吗？删除后可重新添加模型。</p>
        </Modal>
      )}
    </aside>
  )
}
