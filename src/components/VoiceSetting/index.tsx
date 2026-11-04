import { useState } from 'react'
import {
  type VolcengineVoicePreset,
  VOLCENGINE_VOICE_PRESETS,
} from '../../hooks/useTts/api'
import { useVoice } from '../../hooks'
import { Button } from '../Button'
import { DropdownSelect, type DropdownOption } from '../DropdownSelect'
import { Input, Textarea } from '../Input'
import { Modal } from '../Modal'
import { ScrollArea } from '../ScrollArea'
import { Segmented, type SegmentedOption } from '../Segmented'
import { Tooltip } from '../Tooltip'
import type { BubbleMode } from '../../contexts/ModelProvider/ModelContext'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

type VoiceSettingProps = {
  presetId: string
  speaking: boolean
  error: string
  onPresetChange: (preset: VolcengineVoicePreset) => void
  onSpeak: (text: string, preset: VolcengineVoicePreset) => void
  customVoices: VolcengineVoicePreset[]
  onAddVoice: (voice: VolcengineVoicePreset) => void
  onDeleteVoice: (id: string) => void
  /** 气泡显示策略 */
  bubbleMode: BubbleMode
  onBubbleModeChange: (mode: BubbleMode) => void
  /** 说话时触发的动作分组名，空串表示不触发 */
  speakingMotion: string
  speakingMotionOptions: DropdownOption[]
  onSpeakingMotionChange: (motion: string) => void
}

const voiceResourceOptions = [
  { label: 'seed-tts-2.0', value: 'seed-tts-2.0' },
  { label: 'seed-icl-2.0', value: 'seed-icl-2.0' },
]

const BUBBLE_MODE_OPTIONS: readonly SegmentedOption<BubbleMode>[] = [
  { value: 'speaking', label: '说话显示' },
  { value: 'always', label: '常显' },
]

export function VoiceSetting({
  presetId, speaking, error, onPresetChange, onSpeak, customVoices, onAddVoice, onDeleteVoice,
  bubbleMode, onBubbleModeChange, speakingMotion, speakingMotionOptions, onSpeakingMotionChange,
}: VoiceSettingProps) {
  const { voiceConfig, openTtsConfig } = useVoice()
  const [draft, setDraft] = useState('')
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [voiceName, setVoiceName] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [voiceResourceId, setVoiceResourceId] = useState('seed-tts-2.0')
  const [voiceModalError, setVoiceModalError] = useState('')
  const voices = [...VOLCENGINE_VOICE_PRESETS, ...customVoices]
  const selectedPreset = voices.find((preset) => preset.id === presetId) ?? voices[0]

  // 只有文本为空时才禁用；没配 Key 时点击直接打开顶栏那份配置弹窗
  const handleSpeakClick = () => {
    if (!draft.trim()) return
    if (!voiceConfig.apiKey.trim()) {
      openTtsConfig()
      return
    }
    onSpeak(draft, selectedPreset)
  }

  const openVoiceModal = () => {
    setVoiceName('')
    setVoiceId('')
    setVoiceResourceId('seed-tts-2.0')
    setVoiceModalError('')
    setShowVoiceModal(true)
  }

  const addVoice = () => {
    const label = voiceName.trim()
    const voiceType = voiceId.trim()
    if (!label || !voiceType) {
      setVoiceModalError('请填写音色名称和音色 ID')
      return
    }
    if (voices.some((voice) => voice.voiceType === voiceType)) {
      setVoiceModalError('该音色 ID 已存在')
      return
    }
    const voice: VolcengineVoicePreset = {
      id: `custom:${Date.now()}`,
      label,
      voiceType,
      resourceId: voiceResourceId,
      speedRatio: 1,
      pitchRatio: 1,
    }
    onAddVoice(voice)
    onPresetChange(voice)
    setShowVoiceModal(false)
  }

  return (
    <section className={styles.block}>
      <div className={styles.title}><span>人声</span><span className={styles.tinyTag}>VOLCANO TTS</span></div>
      <ScrollArea
        columns={3}
        gap="9px 8px"
        maxHeight="154px"
        className={styles.presets}
        role="group"
        ariaLabel="人声风格预设"
      >
        {voices.map((preset) => (
          <div className={styles.presetWrap} key={preset.id}>
            <Tooltip block placement="top" title={preset.label}>
              <Button
                variant="chip"
                size="xs"
                active={preset.id === selectedPreset.id}
                className={styles.preset}
                onClick={() => onPresetChange(preset)}
              >
                <span className={styles.presetLabel}>{preset.label}</span>
                {preset.id.startsWith('custom:') && (
                  <span
                    className={styles.remove}
                    data-tooltip-ignore="true"
                    role="button"
                    tabIndex={0}
                    aria-label={`删除${preset.label}`}
                    onClick={(event) => { event.stopPropagation(); onDeleteVoice(preset.id) }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        onDeleteVoice(preset.id)
                      }
                    }}
                  >
                    ×
                  </span>
                )}
              </Button>
            </Tooltip>
          </div>
        ))}
      </ScrollArea>
      <Button variant="dashed" size="xs" block className={styles.addButton} onClick={openVoiceModal}>＋ 添加音色</Button>

      <Textarea
        className={styles.textarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="输入内容测试发声"
        aria-label="人声测试内容"
        rows={3}
        maxLength={300}
      />
      <span className={styles.speakWrap}>
        <Button
          variant="bare"
          className={styles.speakButton}
          disabled={!draft.trim()}
          onClick={handleSpeakClick}
        >
          {speaking ? '正在说话…' : '▶ 测试发声'}
        </Button>
      </span>
      {error && <div className={styles.error}>{error}</div>}

      {/* 气泡与说话动作：标签在上，控件各占一行 */}
      <div className={styles.behavior}>
        <div className={styles.behaviorRow}>
          <span>气泡显示</span>
          <Segmented
            ariaLabel="气泡显示"
            block
            value={bubbleMode}
            options={BUBBLE_MODE_OPTIONS}
            onChange={onBubbleModeChange}
          />
        </div>
        <div className={styles.behaviorRow}>
          <span>说话触发动作</span>
          <DropdownSelect
            ariaLabel="说话触发动作"
            size="sm"
            value={speakingMotion}
            options={speakingMotionOptions}
            onChange={onSpeakingMotionChange}
          />
        </div>
      </div>

      {showVoiceModal && (
        <Modal
          title="添加音色"
          tone="panel"
          scrollable={false}
          width="min(420px, calc(100vw - 32px))"
          zIndex={32}
          onClose={() => setShowVoiceModal(false)}
          actions={(
            <>
              <Button variant="secondary" size="lg" onClick={() => setShowVoiceModal(false)}>取消</Button>
              <Button size="lg" onClick={addVoice} disabled={!voiceName.trim() || !voiceId.trim()}>添加音色</Button>
            </>
          )}
        >
          <label className={styles.field}>
            <span>音色名称 <b>*</b></span>
            <Input size="lg" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} placeholder="输入预设名称" autoFocus />
          </label>
          <label className={styles.field}>
            <span>音色 ID <b>*</b></span>
            <Input size="lg" value={voiceId} onChange={(event) => setVoiceId(event.target.value)} placeholder="输入火山音色 ID" />
          </label>
          <div className={styles.field}>
            <span>音色模型</span>
            <DropdownSelect ariaLabel="音色模型" value={voiceResourceId} options={voiceResourceOptions} onChange={setVoiceResourceId} />
          </div>
          <p className={styles.hint}>
            请到<a href="https://console.volcengine.com/speech/new/voices?projectName=default" target="_blank" rel="noreferrer">火山引擎/音色库</a>查找音色ID并复制到对应输入框，ICL开头的ID音色模型选择 <code>seed-icl-2.0</code>。
          </p>
          {voiceModalError && <div className={cx(styles.error, styles.modalError)}>{voiceModalError}</div>}
        </Modal>
      )}
    </section>
  )
}
