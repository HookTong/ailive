import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createDoubaoChatReply, type DoubaoChatMessage } from '../../hooks/useAiChat/api'
import type { LiveFeedItem } from '../../hooks/useLiveServer'
import { useLiveData, useModel, useVoice } from '../../hooks'
import { loadAiChatSettings, saveAiChatSettings, type AiChatSettings } from './storage'
import { AiChatContext, type AiChatContextValue, type AiChatStatus, type AiChatUsage, type AiReplyRecord } from './AiChatContext'

/** 事件优先级：礼物答谢最要紧，进场欢迎次之，普通弹幕垫底 */
const KIND_PRIORITY: Record<'gift' | 'member' | 'chat', number> = { gift: 30, member: 20, chat: 10 }

/** 队列长度上限；满了先丢最旧的低优先级事件，礼物尽量不丢 */
const MAX_QUEUE = 10
/** 两次回复之间的最小间隔：串行说话本身已经是节流，这里再兜一层，避免连续喋喋不休 */
const MIN_REPLY_INTERVAL_MS = 6000
/** 调用出错后的退避间隔，比正常间隔更长一点 */
const ERROR_BACKOFF_MS = 15000
/** 同一个观众的弹幕冷却：连发弹幕也只答一条 */
const CHAT_USER_COOLDOWN_MS = 45_000
/** 进场欢迎冷却：同一个人反复进出不重复欢迎 */
const MEMBER_USER_COOLDOWN_MS = 10 * 60_000
/** 礼物答谢冷却：礼物连击（combo）合并成一次答谢 */
const GIFT_USER_COOLDOWN_MS = 8_000
/** 相同内容的弹幕在这个窗口内只答一次 */
const SAME_TEXT_WINDOW_MS = 60_000
/** 发给模型的对话历史条数（user/assistant 成对） */
const HISTORY_PAIRS = 8
/** AI 生成内容去重：与最近几条回复相同就放弃这条 */
const REPLY_DEDUP_LIMIT = 5
/** 展示用的回复记录上限 */
const REPLY_RECORD_LIMIT = 12

type QueueItem = {
  kind: 'gift' | 'member' | 'chat'
  name: string
  text: string
  count?: number
  at: number
}

function describeEvent(item: QueueItem): string {
  switch (item.kind) {
    case 'gift':
      return `观众「${item.name}」送出了礼物「${item.text}」${item.count && item.count > 1 ? ` ×${item.count}` : ''}，请向这位观众表示感谢。`
    case 'member':
      return `观众「${item.name}」进入了直播间，请简短地欢迎这位新观众。`
    default:
      return `观众「${item.name}」发弹幕说：「${item.text}」，请回复这位观众。`
  }
}

function systemPrompt(persona: string): string {
  return [
    persona.trim(),
    '你正在直播间直播，请遵守：',
    '- 直接输出要说的话本身，一到两句话以内，口语化',
    '- 不要输出引号、括号动作、舞台指示或任何解释文字',
  ].filter(Boolean).join('\n')
}

/** 归一化：去掉空白与常见标点后比较，避免「你好」「你好！」被当成两条弹幕 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s，。！？!?,.、~～]+/g, '')
}

/**
 * 弹幕 AI 中枢：监听直播事件流 → 按优先级排队（礼物 > 进场 > 弹幕）→ 调豆包生成回复
 * → 派给舞台上的角色轮流说出来。说话走串行队列：一条说完才轮到下一条，不会互相打断。
 */
export function AiChatProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AiChatSettings>(loadAiChatSettings)
  const [aiConfigOpen, setAiConfigOpen] = useState(false)
  const [status, setStatus] = useState<AiChatStatus>('off')
  const [pendingCount, setPendingCount] = useState(0)
  const [replies, setReplies] = useState<AiReplyRecord[]>([])
  const [usage, setUsage] = useState<AiChatUsage>({ promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 })
  const [error, setError] = useState('')

  const { douyinRoom } = useLiveData()
  const { modelSources, characterStates } = useModel()
  const { speak, voices } = useVoice()

  // —— 全部用 ref 持有可变状态，泵循环只靠定时器驱动，不吃 React 渲染时机 ——
  const queueRef = useRef<QueueItem[]>([])
  const lastSeenFeedIdRef = useRef(0)
  const busyRef = useRef(false)
  const lastReplyAtRef = useRef(0)
  const userCooldownRef = useRef(new Map<string, number>())
  const textSeenRef = useRef(new Map<string, number>())
  const recentRepliesRef = useRef<string[]>([])
  const historyRef = useRef<DoubaoChatMessage[]>([])
  const roundRobinRef = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const autoActive = settings.autoReply && settings.apiKey.trim() !== ''
  const autoActiveRef = useRef(autoActive)
  autoActiveRef.current = autoActive

  const openAiConfig = useCallback(() => setAiConfigOpen(true), [])
  const closeAiConfig = useCallback(() => setAiConfigOpen(false), [])
  const clearError = useCallback(() => setError(''), [])

  const persistSettings = useCallback((next: AiChatSettings) => {
    setSettings(next)
    saveAiChatSettings(next)
  }, [])

  /** 冷却表会随观众增长，顺手清理过期项，防止内存无限膨胀 */
  const pruneCooldowns = useCallback(() => {
    const now = Date.now()
    for (const map of [userCooldownRef.current, textSeenRef.current]) {
      if (map.size < 400) continue
      for (const [key, at] of map) {
        if (now - at > MEMBER_USER_COOLDOWN_MS) map.delete(key)
      }
    }
  }, [])

  const enqueue = useCallback((item: LiveFeedItem) => {
    if (item.kind !== 'chat' && item.kind !== 'gift' && item.kind !== 'member') return
    const now = Date.now()
    const cooldown = item.kind === 'gift' ? GIFT_USER_COOLDOWN_MS
      : item.kind === 'member' ? MEMBER_USER_COOLDOWN_MS
        : CHAT_USER_COOLDOWN_MS
    const cooldowns = userCooldownRef.current

    // 同类事件同一观众的冷却（礼物连击合并、弹幕连发只答一条、反复进出只欢迎一次）
    const userKey = `${item.kind}:${item.name}`
    const lastAt = cooldowns.get(userKey)
    if (lastAt !== undefined && now - lastAt < cooldown) return
    cooldowns.set(userKey, now)

    // 同内容弹幕冷却：不同观众刷同一句话，只答第一句
    if (item.kind === 'chat') {
      const textKey = normalizeText(item.text)
      const seenAt = textSeenRef.current.get(textKey)
      if (seenAt !== undefined && now - seenAt < SAME_TEXT_WINDOW_MS) return
      textSeenRef.current.set(textKey, now)
    }

    const queue = queueRef.current
    queue.push({ kind: item.kind, name: item.name, text: item.text, count: item.count, at: item.at })
    // 队列满了优先丢最旧的低优先级事件，礼物尽量保住
    while (queue.length > MAX_QUEUE) {
      const victim = queue.findIndex((candidate) => candidate.kind !== 'gift')
      queue.splice(victim >= 0 ? victim : 0, 1)
    }
    setPendingCount(queue.length)
    pruneCooldowns()
  }, [pruneCooldowns])

  // 监听事件流增量：feed 每 400ms 批量刷新一次，只处理没见过的高 id
  useEffect(() => {
    const feed = douyinRoom.feed
    if (feed.length === 0) {
      // 断开重连会清空 feed，此时序号从头计数，必须重置游标
      lastSeenFeedIdRef.current = 0
      return
    }
    if (!autoActiveRef.current) {
      lastSeenFeedIdRef.current = feed[feed.length - 1].id
      return
    }
    for (const item of feed) {
      if (item.id <= lastSeenFeedIdRef.current) continue
      enqueue(item)
    }
    lastSeenFeedIdRef.current = feed[feed.length - 1].id
  }, [douyinRoom.feed, enqueue])

  /** 从队列里挑下一条要回的：优先级高者优先，同级先来先回 */
  const pickNext = useCallback((): QueueItem | null => {
    const queue = queueRef.current
    if (queue.length === 0) return null
    let best = 0
    for (let index = 1; index < queue.length; index += 1) {
      if (KIND_PRIORITY[queue[index].kind] > KIND_PRIORITY[queue[best].kind]) best = index
    }
    const [item] = queue.splice(best, 1)
    setPendingCount(queue.length)
    return item
  }, [])

  /** 轮流挑一个说话的角色：可见角色按顺序轮转，音色用该角色自己配置的 */
  const nextSpeaker = useCallback(() => {
    const visible = modelSources.filter((source) => characterStates[source.id]?.modelVisible !== false)
    const pool = visible.length > 0 ? visible : modelSources
    if (pool.length === 0) return null
    const speaker = pool[roundRobinRef.current % pool.length]
    roundRobinRef.current = (roundRobinRef.current + 1) % Math.max(pool.length, 1)
    const voiceId = characterStates[speaker.id]?.voicePresetId
    const preset = voices.find((voice) => voice.id === voiceId) ?? voices[0]
    if (!preset) return null
    return { modelId: speaker.id, preset }
  }, [modelSources, characterStates, voices])

  /** 泵：每秒看一眼，闲着、到了间隔、队列有货就开始处理一条 */
  useEffect(() => {
    const timer = window.setInterval(() => { void pump() }, 1000)

    async function pump() {
      if (busyRef.current || !autoActiveRef.current) return
      const config = settingsRef.current
      const sinceReply = Date.now() - lastReplyAtRef.current
      if (sinceReply < MIN_REPLY_INTERVAL_MS) return
      const item = pickNext()
      if (!item) return

      busyRef.current = true
      setStatus('thinking')
      try {
        const question = describeEvent(item)
        const messages: DoubaoChatMessage[] = [
          { role: 'system', content: systemPrompt(config.persona) },
          ...historyRef.current,
          { role: 'user', content: question },
        ]
        const result = await createDoubaoChatReply(messages, config)

        // 记账放在去重之前：即使这条回复因为复读被丢掉，token 也是真花出去了
        setUsage((current) => ({
          promptTokens: current.promptTokens + result.usage.promptTokens,
          completionTokens: current.completionTokens + result.usage.completionTokens,
          totalTokens: current.totalTokens + result.usage.totalTokens,
          calls: current.calls + 1,
        }))

        // 回复去重：模型最近刚说过一模一样的话就放弃，宁可不说也不复读
        const reply = result.text
        const normalized = normalizeText(reply)
        if (recentRepliesRef.current.includes(normalized)) {
          lastReplyAtRef.current = Date.now()
          return
        }
        recentRepliesRef.current.unshift(normalized)
        if (recentRepliesRef.current.length > REPLY_DEDUP_LIMIT) recentRepliesRef.current.pop()

        const target = nextSpeaker()
        if (target) {
          setStatus('speaking')
          // speak 会等到这条语音说完（或失败）才返回，所以天然串行、不会打断
          await speak(reply, target.preset, target.modelId)

          historyRef.current.push({ role: 'user', content: question }, { role: 'assistant', content: reply })
          if (historyRef.current.length > HISTORY_PAIRS * 2) {
            historyRef.current.splice(0, historyRef.current.length - HISTORY_PAIRS * 2)
          }
          const record: AiReplyRecord = {
            at: Date.now(),
            kind: item.kind,
            question: item.kind === 'chat' ? `${item.name}：${item.text}` : `${item.name}（${describeKind(item.kind)}）`,
            reply,
            modelId: target.modelId,
          }
          setReplies((current) => [record, ...current].slice(0, REPLY_RECORD_LIMIT))
        }
        lastReplyAtRef.current = Date.now()
        setError('')
      } catch (reason) {
        // 出错退避久一点，避免 Key 无效时每秒打一次接口
        lastReplyAtRef.current = Date.now() - MIN_REPLY_INTERVAL_MS + ERROR_BACKOFF_MS
        setError(reason instanceof Error ? reason.message : '豆包请求失败')
      } finally {
        busyRef.current = false
        setStatus(autoActiveRef.current ? 'idle' : 'off')
      }
    }

    return () => window.clearInterval(timer)
  }, [pickNext, nextSpeaker, speak])

  // 开关或配置变化时同步状态展示
  useEffect(() => {
    if (!autoActive) setStatus('off')
    else if (status === 'off') setStatus('idle')
  }, [autoActive, status])

  const value = useMemo<AiChatContextValue>(() => ({
    settings,
    persistSettings,
    aiConfigOpen,
    openAiConfig,
    closeAiConfig,
    status,
    pendingCount,
    replies,
    usage,
    error,
    clearError,
  }), [settings, persistSettings, aiConfigOpen, openAiConfig, closeAiConfig, status, pendingCount, replies, usage, error, clearError])

  return (
    <AiChatContext.Provider value={value}>
      {children}
    </AiChatContext.Provider>
  )
}

function describeKind(kind: QueueItem['kind']): string {
  if (kind === 'gift') return '礼物'
  if (kind === 'member') return '进场'
  return '弹幕'
}
