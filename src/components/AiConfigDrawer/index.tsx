import { useEffect, useState } from 'react'
import { useAiChat } from '../../hooks'
import {
  DEFAULT_DOUBAO_CHAT_BASE_URL,
  DEFAULT_DOUBAO_MODEL,
} from '../../hooks/useAiChat/api'
import {
  DEFAULT_AI_INPUT_PRICE,
  DEFAULT_AI_OUTPUT_PRICE,
  DEFAULT_AI_PERSONA,
  type AiChatSettings,
} from '../../contexts/AiChatProvider/storage'
import { Button } from '../Button'
import { Drawer } from '../Drawer'
import { Input, Textarea } from '../Input'
import { Switch } from '../Switch'
import styles from './index.module.scss'

type AiConfigDrawerProps = {
  open: boolean
  onClose: () => void
}

const STATUS_TEXT: Record<string, string> = {
  off: '未启用（缺 API Key 或开关未开）',
  idle: '待命中',
  thinking: '思考中…',
  speaking: '播报中…',
}

/** 单价只接受非负有限数，空/非法时回退默认值 */
function normalizePrice(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * 豆包（Doubao-Seed-Character）自动回复的配置抽屉：
 * 开关 / API Key / 接口地址 / 模型 ID / 单价 / 主播人设 / 最近回复。
 * 取消即丢弃草稿，保存才写回配置与 localStorage。
 */
export function AiConfigDrawer({ open, onClose }: AiConfigDrawerProps) {
  const { settings, persistSettings, status, pendingCount, replies, error, clearError } = useAiChat()
  const [draft, setDraft] = useState<AiChatSettings>(settings)

  // 每次打开都从当前配置重新起草，避免上次取消的改动残留
  useEffect(() => {
    if (open) {
      setDraft(settings)
      clearError()
    }
  }, [open, settings, clearError])

  const save = () => {
    const next: AiChatSettings = {
      apiKey: draft.apiKey.trim(),
      baseUrl: draft.baseUrl.trim() || DEFAULT_DOUBAO_CHAT_BASE_URL,
      model: draft.model.trim() || DEFAULT_DOUBAO_MODEL,
      persona: draft.persona.trim() || DEFAULT_AI_PERSONA,
      autoReply: draft.autoReply,
      inputPrice: normalizePrice(draft.inputPrice, DEFAULT_AI_INPUT_PRICE),
      outputPrice: normalizePrice(draft.outputPrice, DEFAULT_AI_OUTPUT_PRICE),
    }
    persistSettings(next)
    onClose()
  }

  return (
    <Drawer
      open={open}
      title="AI 自动回复设置"
      tone="panel"
      zIndex={31}
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>取消</Button>
          <Button size="lg" onClick={save}>保存设置</Button>
        </>
      )}
    >
      <div className={styles.content}>
        <div className={styles.row}>
          <div className={styles.rowText}>
            <strong>自动回复弹幕</strong>
            <small>礼物答谢 &gt; 进场欢迎 &gt; 弹幕聊天，按优先级排队轮流回答</small>
          </div>
          <Switch
            checked={draft.autoReply}
            onChange={(checked) => setDraft({ ...draft, autoReply: checked })}
            ariaLabel="自动回复弹幕"
          />
        </div>

        <label className={styles.field}>
          <span>API Key</span>
          <Input
            size="lg"
            type="password"
            // 密码框上的 autocomplete="off" 会被 Chrome 无视，new-password 才表示「这不是已有凭据」；
            // name 也故意取成浏览器认不出的字段名，免得被当成登录表单
            name="doubao-ark-key"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            spellCheck={false}
            autoCapitalize="off"
            value={draft.apiKey}
            onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
            placeholder="火山方舟 API Key"
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span>接口地址</span>
          <Input
            size="lg"
            value={draft.baseUrl}
            onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
            placeholder={DEFAULT_DOUBAO_CHAT_BASE_URL}
          />
        </label>

        <label className={styles.field}>
          <span>模型 ID</span>
          <Input
            size="lg"
            value={draft.model}
            onChange={(event) => setDraft({ ...draft, model: event.target.value })}
            placeholder={DEFAULT_DOUBAO_MODEL}
          />
        </label>

        <div className={styles.prices}>
          <label className={styles.field}>
            <span>输入单价 <em>元/百万 tokens</em></span>
            <Input
              size="lg"
              type="number"
              min="0"
              step="0.1"
              value={draft.inputPrice}
              onChange={(event) => setDraft({ ...draft, inputPrice: Number(event.target.value) })}
              placeholder={String(DEFAULT_AI_INPUT_PRICE)}
            />
          </label>
          <label className={styles.field}>
            <span>输出单价 <em>元/百万 tokens</em></span>
            <Input
              size="lg"
              type="number"
              min="0"
              step="0.1"
              value={draft.outputPrice}
              onChange={(event) => setDraft({ ...draft, outputPrice: Number(event.target.value) })}
              placeholder={String(DEFAULT_AI_OUTPUT_PRICE)}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>主播人设</span>
          <Textarea
            rows={3}
            value={draft.persona}
            onChange={(event) => setDraft({ ...draft, persona: event.target.value })}
            placeholder={DEFAULT_AI_PERSONA}
          />
        </label>

        <p className={styles.status}>
          当前状态：{STATUS_TEXT[status] ?? status}
          {status !== 'off' && pendingCount > 0 ? ` · 排队 ${pendingCount} 条` : ''}
          {error ? ` · ${error}` : ''}
        </p>

        {replies.length > 0 && (
          <div className={styles.history}>
            <div className={styles.historyTitle}>最近回复</div>
            <ul>
              {replies.map((record) => (
                <li key={`${record.at}-${record.question}`} data-model={record.modelId}>
                  <small>{record.question}</small>
                  <b>{record.reply}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  )
}
