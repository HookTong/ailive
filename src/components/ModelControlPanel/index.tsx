import { useEffect, useMemo, useRef, useState } from 'react'
import { AddModelModal } from '../AddModelModal'
import { VoiceSetting } from '../VoiceSetting'
import { Button } from '../Button'
import { Modal } from '../Modal'
import { ScrollArea } from '../ScrollArea'
import { Slider } from '../Slider'
import { cx } from '../../utils/cx'
import { useModel, useVoice } from '../../hooks'
import { VOLCENGINE_VOICE_PRESETS, type VolcengineVoicePreset } from '../../voice/volcengineTts'
import styles from './index.module.scss'

const motionIcons = ['◌', '⌁', '◇', '◍', '◠']

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
    voiceConfig,
    setVoiceConfig,
    customVoices,
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
  const speakingMotion = activeCharacter.speakingMotion
  const voiceSpeaking = speakingModel?.modelId === activeModelId

  // 「说话触发动作」下拉：空值表示不触发
  const speakingMotionOptions = useMemo(() => [
    { value: '', label: '不触发' },
    ...Object.entries(manifest?.motions ?? {}).map(([group, config]) => ({
      value: group,
      label: config.label ?? group,
    })),
  ], [manifest])

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
    // 内置音色不在 customVoices 里，必须两边一起查；查不到就退回传进来的对象，
    // 否则选内置音色点「测试发声」会静默什么都不做
    const fullPreset = [...VOLCENGINE_VOICE_PRESETS, ...customVoices].find((voice) => voice.id === preset.id) ?? preset
    await speak(text, fullPreset, activeModelId)
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
        <Button size="md" block className={styles.addButton} onClick={() => setAddModelOpen(true)}>＋ 添加模型</Button>
        <Button
          variant="ghost"
          size="md"
          block
          className={styles.visibilityButton}
          onClick={() => updateActiveCharacter({ modelVisible: !modelVisible })}
        >
          {modelVisible ? '隐藏模型' : '显示模型'}
        </Button>
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
                  onClick={() => handleExpressionToggle(expression)}
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
          label="模型大小"
          valueText={`${Math.round(modelSize * 100)}%`}
          minLabel="较小"
          maxLabel="较大"
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
        config={voiceConfig}
        speaking={voiceSpeaking}
        error={voiceError}
        customVoices={customVoices}
        bubbleMode={bubbleMode}
        speakingMotion={speakingMotion}
        speakingMotionOptions={speakingMotionOptions}
        onPresetChange={handleVoicePresetChange}
        onConfigChange={setVoiceConfig}
        onSpeak={handleVoiceSpeak}
        onAddVoice={addVoice}
        onDeleteVoice={deleteVoice}
        onBubbleModeChange={(mode) => updateActiveCharacter({ bubbleMode: mode })}
        onSpeakingMotionChange={(motion) => updateActiveCharacter({ speakingMotion: motion })}
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
