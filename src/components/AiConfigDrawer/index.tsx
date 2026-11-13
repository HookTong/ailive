import { useEffect, useState } from 'react'
import { useAiChat } from '../../hooks'
import {
  DEFAULT_DOUBAO_CHAT_BASE_URL,
  DEFAULT_DOUBAO_MODEL,
} from '../../hooks/useAiChat/api'
import {
  AI_THROTTLE_LIMITS,
  DEFAULT_AI_INPUT_PRICE,
  DEFAULT_AI_OUTPUT_PRICE,
  DEFAULT_AI_PERSONA,
  DEFAULT_AI_THROTTLE,
  type AiChatSettings,
  type AiChatThrottle,
} from '../../contexts/AiChatProvider/storage'
import { Button } from '../Button'
import { Drawer } from '../Drawer'
import { Input, Textarea } from '../Input'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import { Tabs } from '../Tabs'
import styles from './index.module.scss'

type AiConfigDrawerProps = {
  open: boolean
  onClose: () => void
}

/** 抽屉里的两个标签页：一边调参数，一边看它刚才说了什么 */
type AiTab = 'config' | 'history'

const AI_TABS = [
  { value: 'config' as const, label: '配置参数' },
  { value: 'history' as const, label: '回复历史' },
]

const STATUS_TEXT: Record<string, string> = {
  off: '未启用（缺 API Key 或开关未开）',
  idle: '待命中',
  thinking: '思考中…',
  speaking: '播报中…',
}

/**
 * 三行节流滑块的文案。值在面板里按**秒**调，存的是毫秒 ——
 * 存秒的话 `1000` 这个换算要在 provider 里再乘一遍，容易漏。
 *
 * 每根都带一句「影响范围」：光看「回复间隔」和「同一观众冷却」这两个名字，
 * 没人知道前者是总闸、后者只管弹幕。`scope` 是那句话的抬头，单独提亮一档。
 */
const THROTTLE_FIELDS: ReadonlyArray<{
  key: keyof AiChatThrottle
  label: string
  /** 0 表示不限制时的文案 */
  zeroText?: string
  /** 这一项管到哪儿 —— 抬头 */
  scope: string
  /** 这一项管到哪儿 —— 展开说 */
  hint: string
}> = [
  {
    key: 'replyIntervalMs',
    label: '回复间隔',
    scope: '全局总闸',
    hint: '礼物答谢、进场欢迎、指令反馈、弹幕聊天共用，任意两条之间至少隔这么久',
  },
  {
    key: 'userCooldownMs',
    label: '同一观众冷却',
    zeroText: '不限',
    scope: '只挡弹幕',
    // 冷却是在「这条排进队列」时记的，不是说完话才记 —— 忙的时候两者差得远，别写错
    hint: '他这条刚进队列，这段时间里他再发也不排队；礼物 8s、进场 10 分钟各自固定',
  },
  {
    key: 'sameTextWindowMs',
    label: '重复内容窗口',
    zeroText: '不去重',
    scope: '全直播间',
    hint: '不分是谁发的，同一句话（忽略空格标点）在窗口内只答一次',
  },
]

/** 单价只接受非负有限数，空/非法时回退默认值 */
function normalizePrice(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * 回复时间只到秒。列表是「本次会话内倒序」，一屏里最多跨几小时，
 * HH:MM:SS 足够定位；写成 `toLocaleTimeString` 会跟着系统语言变（还可能冒出上午/下午）。
 */
function formatReplyTime(at: number) {
  const date = new Date(at)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 豆包（Doubao-Seed-Character）自动回复的配置抽屉，分「配置参数」「回复历史」两页：
 * 开关 / API Key / 接口地址 / 模型 ID / 单价 / 主播人设 / 节流，以及最近的回复记录。
 * 取消即丢弃草稿，保存才写回配置与 localStorage。
 */
export function AiConfigDrawer({ open, onClose }: AiConfigDrawerProps) {
  const { settings, persistSettings, status, pendingCount, replies, error, clearError } = useAiChat()
  const [draft, setDraft] = useState<AiChatSettings>(settings)
  const [tab, setTab] = useState<AiTab>('config')

  // 每次打开都从当前配置重新起草，避免上次取消的改动残留
  useEffect(() => {
    if (open) {
      setDraft(settings)
      // 也回到第一页：这个抽屉是来「配置」的，上次停在历史页不该成为下次的入口
      setTab('config')
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
      nlControl: draft.nlControl,
      inputPrice: normalizePrice(draft.inputPrice, DEFAULT_AI_INPUT_PRICE),
      outputPrice: normalizePrice(draft.outputPrice, DEFAULT_AI_OUTPUT_PRICE),
      throttle: draft.throttle,
    }
    persistSettings(next)
    onClose()
  }

  /**
   * 只把三根节流滑块拉回默认值，Key / 人设这些填过的内容一律不动。
   * 改的是草稿 —— 和抽屉里其它字段一样，点「保存设置」才写回配置，点「取消」就作废。
   */
  const resetThrottle = () => setDraft((current) => ({ ...current, throttle: { ...DEFAULT_AI_THROTTLE } }))

  return (
    <Drawer
      open={open}
      title="AI 自动回复设置"
      tone="panel"
      zIndex={31}
      // 标签页自己管滚动（标签栏固定、内容区滚），抽屉别再套一层
      scrollable={false}
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>取消</Button>
          <Button size="lg" onClick={save}>保存设置</Button>
        </>
      )}
    >
      <Tabs
        value={tab}
        items={AI_TABS}
        onChange={setTab}
        ariaLabel="AI 自动回复设置分区"
      >
        {tab === 'config' ? (
          <div className={styles.content}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <strong>自动回复弹幕</strong>
                <small>礼物答谢 &gt; 进场欢迎 &gt; 弹幕聊天，排队轮流回答，一条说完才轮到下一条</small>
              </div>
              <Switch
                checked={draft.autoReply}
                onChange={(checked) => setDraft({ ...draft, autoReply: checked })}
                ariaLabel="自动回复弹幕"
              />
            </div>

            <div className={styles.row}>
              <div className={styles.rowText}>
                <strong>自然语言控制</strong>
                <small>只有「[AI控制]换个赛博背景」这种写法才交给模型理解；没写前缀的一律当普通聊天，不额外调用</small>
              </div>
              <Switch
                checked={draft.nlControl}
                onChange={(checked) => setDraft({ ...draft, nlControl: checked })}
                ariaLabel="自然语言控制"
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

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <span>
                  节流参数
                  {/* 说明跟在标题后面同一行：单独占一行时两行都灰扑扑的，像两个标题 */}
                  <em>越小回得越勤，token 花得越快</em>
                </span>
                {/* 三根滑块调乱之后没有参照物，一个个拖回默认值很烦 —— 和舞台控制台那两处一样给个复位 */}
                <Button variant="bare" className={styles.resetThrottle} onClick={resetThrottle}>复位</Button>
              </div>
              <div className={styles.throttleList}>
                {THROTTLE_FIELDS.map(({ key, label, zeroText, scope, hint }) => {
                  const { min, max, step } = AI_THROTTLE_LIMITS[key]
                  const seconds = draft.throttle[key] / 1000
                  return (
                    <div key={key} className={styles.throttleItem}>
                      <Slider
                        label={label}
                        valueText={seconds === 0 && zeroText ? zeroText : `${seconds}s`}
                        min={min / 1000}
                        max={max / 1000}
                        step={step / 1000}
                        value={seconds}
                        onChange={(value) => {
                          setDraft({
                            ...draft,
                            throttle: { ...draft.throttle, [key]: Math.round(value * 1000) },
                          })
                        }}
                        ariaLabel={label}
                      />
                      <p className={styles.throttleHint}>
                        <strong>{scope}</strong>
                        {' · '}
                        {hint}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.historyPane}>
            {replies.length > 0 ? (
              <ul className={styles.historyList}>
                {replies.map((record) => (
                  <li key={`${record.at}-${record.question}`} data-model={record.modelId}>
                    {/* 时间和提问挤在同一行：回复正文是这张卡的主角，别为时间再占一行 */}
                    <div className={styles.historyMeta}>
                      <small>{record.question}</small>
                      <time dateTime={new Date(record.at).toISOString()}>{formatReplyTime(record.at)}</time>
                    </div>
                    <b>{record.reply}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.historyEmpty}>
                还没有回复记录。开启自动回复后，最近 50 条会按时间倒序排在这里。
              </p>
            )}
            {/* 状态行跟着记录走：它说的是「刚回了什么、还在排几条」，
                和上面那份记录是同一件事的两个侧面。列表自己滚，这行钉在下面 */}
            <p className={styles.status}>
              当前状态：{STATUS_TEXT[status] ?? status}
              {status !== 'off' && pendingCount > 0 ? ` · 排队 ${pendingCount} 条` : ''}
              {error ? ` · ${error}` : ''}
            </p>
          </div>
        )}
      </Tabs>
    </Drawer>
  )
}
