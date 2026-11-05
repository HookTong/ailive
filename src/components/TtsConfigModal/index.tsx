import { useEffect, useState } from 'react'
import { useVoice } from '../../hooks'
import type { VolcengineTtsConfig } from '../../hooks/useTts/api'
import { Button } from '../Button'
import { Input } from '../Input'
import { Modal } from '../Modal'
import { saveTtsConfig } from '../../contexts/VoiceProvider/storage'
import styles from './index.module.scss'

type TtsConfigModalProps = {
  open: boolean
  onClose: () => void
}

/**
 * 火山 TTS 的 API Key / 接口地址配置弹窗。
 * 顶栏按钮与「测试发声」（缺 Key 时）都走这里；取消即丢弃草稿，保存才写回配置与 localStorage。
 */
export function TtsConfigModal({ open, onClose }: TtsConfigModalProps) {
  const { voiceConfig, setVoiceConfig } = useVoice()
  const [draft, setDraft] = useState<VolcengineTtsConfig>(voiceConfig)

  // 每次打开都从当前配置重新起草，避免上次取消的改动残留
  useEffect(() => {
    if (open) setDraft(voiceConfig)
  }, [open, voiceConfig])

  const save = () => {
    const next: VolcengineTtsConfig = { ...draft, apiKey: draft.apiKey.trim(), endpoint: draft.endpoint.trim() || voiceConfig.endpoint }
    setVoiceConfig(next)
    saveTtsConfig(next)
    onClose()
  }

  if (!open) return null

  return (
    <Modal
      title="TTS 设置"
      tone="panel"
      scrollable={false}
      width="min(420px, calc(100vw - 32px))"
      zIndex={31}
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>取消</Button>
          <Button size="lg" onClick={save}>保存设置</Button>
        </>
      )}
    >
      <label className={styles.field}>
        <span>API Key</span>
        <Input
          size="lg"
          type="password"
          // 同 AI 配置弹窗：密码框必须用 new-password 才挡得住 Chrome 的凭据填充
          name="volcengine-tts-key"
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
          spellCheck={false}
          autoCapitalize="off"
          value={draft.apiKey}
          onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
          placeholder="控制台 API Key"
          autoFocus
        />
      </label>
      <label className={styles.field}>
        <span>接口地址</span>
        <Input
          size="lg"
          value={draft.endpoint}
          onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
          placeholder="TTS API 地址"
        />
      </label>
    </Modal>
  )
}
