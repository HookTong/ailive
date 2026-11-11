import { useState } from 'react'
import type { VolcengineVoicePreset } from '../../hooks/useTts/api'
import { useVoice } from '../../hooks'
import { Button } from '../Button'
import { DropdownSelect } from '../DropdownSelect'
import { Input, Textarea } from '../Input'
import { Modal } from '../Modal'
import { PresetChip } from '../PresetChip'
import { RequiredMark } from '../RequiredMark'
import { ScrollArea } from '../ScrollArea'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

type VoiceSettingProps = {
  presetId: string
  speaking: boolean
  error: string
  onPresetChange: (preset: VolcengineVoicePreset) => void
  onSpeak: (text: string, preset: VolcengineVoicePreset) => void
  onAddVoice: (voice: VolcengineVoicePreset) => void
  onDeleteVoice: (id: string) => void
}

const voiceResourceOptions = [
  { label: 'seed-tts-2.0', value: 'seed-tts-2.0' },
  { label: 'seed-icl-2.0', value: 'seed-icl-2.0' },
]

export function VoiceSetting({
  presetId, speaking, error, onPresetChange, onSpeak, onAddVoice, onDeleteVoice,
}: VoiceSettingProps) {
  // 音色列表（内置 + 自定义）由 VoiceProvider 合并好后直接给出
  const { voiceConfig, voices, openTtsConfig } = useVoice()
  const [draft, setDraft] = useState('')
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [voiceName, setVoiceName] = useState('')
  const [voiceId, setVoiceId] = useState('')
  // 两个字段都必填，但不要一打开就飘红：各自等用户离开过才提示
  const [nameTouched, setNameTouched] = useState(false)
  const [idTouched, setIdTouched] = useState(false)
  const showNameHint = !voiceName.trim() && nameTouched
  const showIdHint = !voiceId.trim() && idTouched
  const [voiceResourceId, setVoiceResourceId] = useState('seed-tts-2.0')
  const [voiceModalError, setVoiceModalError] = useState('')
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
    setNameTouched(false)
    setIdTouched(false)
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
      <div className={styles.title}><span>音色</span></div>
      <ScrollArea
        columns={3}
        gap="9px 8px"
        // 高度刚好装 4 行，不多不少：上下各 5px 内边距（见 .presets）+ 4×30px 胶囊 + 3×9px 行距 = 157px。
        // 少 3px（老值 154）就会在「正好 4 行」时冒出滚动条，还把第 4 行切掉一截
        maxHeight="157px"
        className={styles.presets}
        role="group"
        ariaLabel="人声风格预设"
      >
        {voices.map((preset) => (
          <div className={styles.presetWrap} key={preset.id}>
            {/* 提示由 PresetChip 内部的 Tooltip 出，这里别再套一层 */}
            <PresetChip
              label={preset.label}
              active={preset.id === selectedPreset.id}
              onSelect={() => onPresetChange(preset)}
              onRemove={preset.id.startsWith('custom:') ? () => onDeleteVoice(preset.id) : undefined}
              className={styles.preset}
            />
          </div>
        ))}
      </ScrollArea>
      <Button variant="ghost" size="sm" block className={styles.addButton} onClick={openVoiceModal}>＋ 添加音色</Button>

      <Textarea
        className={styles.textarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="输入内容测试说话"
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
          {speaking ? '正在说话…' : '▶ 测试说话'}
        </Button>
      </span>
      {error && <div className={styles.error}>{error}</div>}

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
            <span>音色名称<RequiredMark /></span>
            <Input
              size="lg"
              value={voiceName}
              onChange={(event) => setVoiceName(event.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="输入预设名称"
              aria-label="音色名称"
              aria-invalid={showNameHint || undefined}
              aria-describedby={showNameHint ? 'voice-name-hint' : undefined}
              autoFocus
            />
            {showNameHint && <div className={styles.fieldHint} id="voice-name-hint">请填写音色名称</div>}
          </label>
          <label className={styles.field}>
            <span>音色 ID<RequiredMark /></span>
            <Input
              size="lg"
              value={voiceId}
              onChange={(event) => setVoiceId(event.target.value)}
              onBlur={() => setIdTouched(true)}
              placeholder="输入火山音色 ID"
              aria-label="音色 ID"
              aria-invalid={showIdHint || undefined}
              aria-describedby={showIdHint ? 'voice-id-hint' : undefined}
            />
            {showIdHint && <div className={styles.fieldHint} id="voice-id-hint">请填写音色 ID</div>}
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
