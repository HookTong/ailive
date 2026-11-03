import { useEffect, useState } from 'react'
import {
  type VolcengineTtsConfig,
  type VolcengineVoicePreset,
  VOLCENGINE_TTS_CONFIG_STORAGE_KEY,
  VOLCENGINE_VOICE_PRESETS,
} from '../../voice/volcengineTts'
import { Button } from '../Button'
import { DropdownSelect } from '../DropdownSelect'
import { Input, Textarea } from '../Input'
import { Modal } from '../Modal'
import { ScrollArea } from '../ScrollArea'
import { Tooltip } from '../Tooltip'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

type VoiceSettingProps = {
  presetId: string
  config: VolcengineTtsConfig
  speaking: boolean
  error: string
  onPresetChange: (preset: VolcengineVoicePreset) => void
  onConfigChange: (config: VolcengineTtsConfig) => void
  onSpeak: (text: string, preset: VolcengineVoicePreset) => void
  customVoices: VolcengineVoicePreset[]
  onAddVoice: (voice: VolcengineVoicePreset) => void
  onDeleteVoice: (id: string) => void
}

const voiceResourceOptions = [
  { label: 'seed-tts-2.0', value: 'seed-tts-2.0' },
  { label: 'seed-icl-2.0', value: 'seed-icl-2.0' },
]

export function VoiceSetting({ presetId, config, speaking, error, onPresetChange, onConfigChange, onSpeak, customVoices, onAddVoice, onDeleteVoice }: VoiceSettingProps) {
  const [draft, setDraft] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [voiceName, setVoiceName] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [voiceResourceId, setVoiceResourceId] = useState('seed-tts-2.0')
  const [voiceModalError, setVoiceModalError] = useState('')
  const [saved, setSaved] = useState(false)
  const voices = [...VOLCENGINE_VOICE_PRESETS, ...customVoices]
  const selectedPreset = voices.find((preset) => preset.id === presetId) ?? voices[0]

  useEffect(() => {
    setSaved(false)
  }, [config])

  const updateConfig = <K extends keyof VolcengineTtsConfig>(key: K, value: VolcengineTtsConfig[K]) => {
    onConfigChange({ ...config, [key]: value })
    setSaved(false)
  }

  const saveConfig = () => {
    try {
      window.localStorage.setItem(VOLCENGINE_TTS_CONFIG_STORAGE_KEY, JSON.stringify(config))
      setSaved(true)
      setShowConfig(false)
    } catch {
      setSaved(false)
    }
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
        {!config.apiKey.trim()
          ? (
            <Tooltip block placement="top" title="请先配置APIkey">
              <Button
                variant="bare"
                className={styles.speakButton}
                disabled={!draft.trim() || speaking || !config.apiKey.trim()}
                onClick={() => onSpeak(draft, selectedPreset)}
              >
                {speaking ? '正在说话…' : '▶ 测试发声'}
              </Button>
            </Tooltip>
          )
          : (
            <Button
              variant="bare"
              className={styles.speakButton}
              disabled={!draft.trim() || speaking}
              onClick={() => onSpeak(draft, selectedPreset)}
            >
              {speaking ? '正在说话…' : '▶ 测试发声'}
            </Button>
          )}
      </span>
      {error && <div className={styles.error}>{error}</div>}
      <Button variant="bare" className={styles.configToggle} onClick={() => setShowConfig(true)}>配置火山 TTS</Button>
      {showConfig && (
        <Modal
          title="TTS 设置"
          tone="panel"
          scrollable={false}
          width="min(420px, calc(100vw - 32px))"
          zIndex={31}
          onClose={() => setShowConfig(false)}
          actions={(
            <>
              <Button variant="secondary" size="lg" onClick={() => setShowConfig(false)}>取消</Button>
              <Button size="lg" onClick={saveConfig}>{saved ? '已保存' : '保存设置'}</Button>
            </>
          )}
        >
          <label className={styles.field}>
            <span>API Key</span>
            <Input size="lg" type="password" value={config.apiKey} onChange={(event) => updateConfig('apiKey', event.target.value)} placeholder="控制台 API Key" autoFocus />
          </label>
          <label className={styles.field}>
            <span>接口地址</span>
            <Input size="lg" value={config.endpoint} onChange={(event) => updateConfig('endpoint', event.target.value)} placeholder="TTS API 地址" />
          </label>
        </Modal>
      )}
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
