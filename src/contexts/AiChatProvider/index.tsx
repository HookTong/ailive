import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createDoubaoChatReply, type DoubaoChatMessage } from '../../hooks/useAiChat/api'
import type { LiveFeedItem } from '../../hooks/useLiveServer'
import { useChatCommand, useLiveData, useModel, useVoice, type ChatCommandResult } from '../../hooks'
import { parseChatCommand } from '../../data/chatCommands'
import { loadAiChatSettings, saveAiChatSettings, type AiChatSettings } from './storage'
import { AiChatContext, type AiChatContextValue, type AiChatStatus, type AiChatUsage, type AiReplyRecord } from './AiChatContext'

/**
 * 事件优先级：礼物答谢最要紧，进场欢迎次之，弹幕指令只比普通弹幕高一点，普通弹幕垫底。
 * 指令的反馈也走这条队列，所以它和礼物 / 进场一样受 MIN_REPLY_INTERVAL_MS 节流。
 */
const KIND_PRIORITY: Record<QueueItem['kind'], number> = { gift: 30, member: 20, command: 15, chat: 10 }

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
/**
 * 同一个人发指令的冷却。指令本身不受弹幕冷却限制（否则连发两条第二条就没了），
 * 但完全不限的话一个人能把舞台刷成幻灯片，所以单独给一个很短的窗口。
 */
const COMMAND_USER_COOLDOWN_MS = 3_000
/** 相同内容的弹幕在这个窗口内只答一次 */
const SAME_TEXT_WINDOW_MS = 60_000
/** 发给模型的对话历史条数（user/assistant 成对） */
const HISTORY_PAIRS = 8
/** AI 生成内容去重：与最近几条回复相同就放弃这条 */
const REPLY_DEDUP_LIMIT = 5
/** 展示用的回复记录上限 */
const REPLY_RECORD_LIMIT = 12

type QueueItem = {
  kind: 'gift' | 'member' | 'chat' | 'command'
  name: string
  text: string
  count?: number
  at: number
  /** 仅 command：要说的那句话。指令反馈是确定性的，不经过模型生成 */
  speech?: string
  /** 仅 command：指定由哪个角色来说；null = 交给轮流挑人 */
  modelId?: string | null
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

  const { douyinRoom, chatCommands } = useLiveData()
  const { modelSources, characterStates } = useModel()
  const { speak, voices } = useVoice()
  const executeCommand = useChatCommand()

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
  // 事件流那个 effect 只该跟着 feed 走，开关一改就重跑会白扫一遍历史事件
  const chatCommandsRef = useRef(chatCommands)
  chatCommandsRef.current = chatCommands

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

  /** 入队并按上限淘汰：满了先丢最旧的非礼物事件，礼物尽量保住 */
  const pushQueue = useCallback((item: QueueItem) => {
    const queue = queueRef.current
    queue.push(item)
    while (queue.length > MAX_QUEUE) {
      const victim = queue.findIndex((candidate) => candidate.kind !== 'gift')
      queue.splice(victim >= 0 ? victim : 0, 1)
    }
    setPendingCount(queue.length)
    pruneCooldowns()
  }, [pruneCooldowns])

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

    pushQueue({ kind: item.kind, name: item.name, text: item.text, count: item.count, at: item.at })
  }, [pushQueue])

  /**
   * 同一个人的指令节流。指令绕开了弹幕那套冷却（连发两条不同指令是正常用法），
   * 但完全不限的话一个人能把背景刷成幻灯片，所以单独给一个很短的窗口。
   * 挡掉的是整条指令（动作 + 反馈一起不执行），不然会出现「台上变了但没人说话」。
   */
  const allowCommand = useCallback((name: string) => {
    const now = Date.now()
    const key = `command:${name}`
    const lastAt = userCooldownRef.current.get(key)
    if (lastAt !== undefined && now - lastAt < COMMAND_USER_COOLDOWN_MS) return false
    userCooldownRef.current.set(key, now)
    return true
  }, [])

  const enqueueCommand = useCallback((item: LiveFeedItem, result: ChatCommandResult) => {
    pushQueue({
      kind: 'command',
      name: item.name,
      text: item.text,
      at: item.at,
      speech: result.speech,
      modelId: result.modelId,
    })
  }, [pushQueue])

  // 监听事件流增量：feed 每 400ms 批量刷新一次，只处理没见过的高 id
  useEffect(() => {
    const feed = douyinRoom.feed
    if (feed.length === 0) {
      // 断开重连会清空 feed，此时序号从头计数，必须重置游标
      lastSeenFeedIdRef.current = 0
      return
    }
    const fresh = feed.filter((item) => item.id > lastSeenFeedIdRef.current)
    lastSeenFeedIdRef.current = feed[feed.length - 1].id
    if (fresh.length === 0) return

    for (const item of fresh) {
      // 指令先于一切判断：它不吃弹幕冷却，也不受自动回复开关影响（没配 Key 也能用）
      if (item.kind === 'chat') {
        const command = parseChatCommand(item.text)
        if (command && chatCommandsRef.current[command.id] !== false) {
          // 动作立刻执行，反馈走队列 —— 等 6 秒节流才换背景的话，观众早就发了下一条
          if (allowCommand(item.name)) enqueueCommand(item, executeCommand(command))
          continue
        }
      }
      // 被关掉的指令当普通弹幕处理：观众确实说了句话，让 AI 接一句也不突兀
      if (!autoActiveRef.current) continue
      enqueue(item)
    }
  }, [douyinRoom.feed, allowCommand, enqueue, enqueueCommand, executeCommand])

  /**
   * 从队列里挑下一条要处理的：优先级高者优先，同级先来先回。
   * `allowAi` 为 false（没配 Key / 关了自动回复）时只挑指令 —— 指令反馈是确定的文案，
   * 不需要模型，关着自动回复也该能用。
   */
  const pickNext = useCallback((allowAi: boolean): QueueItem | null => {
    const queue = queueRef.current
    let best = -1
    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index]
      if (!allowAi && item.kind !== 'command') continue
      if (best < 0 || KIND_PRIORITY[item.kind] > KIND_PRIORITY[queue[best].kind]) best = index
    }
    if (best < 0) return null
    const [item] = queue.splice(best, 1)
    setPendingCount(queue.length)
    return item
  }, [])

  /** 指定角色 + 它自己配的音色。指令点了名，就不该轮到别人来说 */
  const speakerFor = useCallback((modelId: string) => {
    const voiceId = characterStates[modelId]?.voicePresetId
    const preset = voices.find((voice) => voice.id === voiceId) ?? voices[0]
    if (!preset) return null
    return { modelId, preset }
  }, [characterStates, voices])

  /** 轮流挑一个说话的角色：可见角色按顺序轮转，音色用该角色自己配置的 */
  const nextSpeaker = useCallback(() => {
    const visible = modelSources.filter((source) => characterStates[source.id]?.modelVisible !== false)
    const pool = visible.length > 0 ? visible : modelSources
    if (pool.length === 0) return null
    const speaker = pool[roundRobinRef.current % pool.length]
    roundRobinRef.current = (roundRobinRef.current + 1) % Math.max(pool.length, 1)
    return speakerFor(speaker.id)
  }, [modelSources, characterStates, speakerFor])

  /** 泵：每秒看一眼，闲着、到了间隔、队列有货就开始处理一条 */
  useEffect(() => {
    const timer = window.setInterval(() => { void pump() }, 1000)

    async function pump() {
      if (busyRef.current) return
      const sinceReply = Date.now() - lastReplyAtRef.current
      if (sinceReply < MIN_REPLY_INTERVAL_MS) return
      const item = pickNext(autoActiveRef.current)
      if (!item) return

      // 指令反馈不走模型：文案是执行结果本身，没配 Key 也得能播
      if (item.kind === 'command') {
        busyRef.current = true
        if (autoActiveRef.current) setStatus('speaking')
        try {
          // 模型控制台指令由点名的角色说；舞台指令（和找不到角色的失败）交给轮流挑人
          const target = item.modelId ? speakerFor(item.modelId) : nextSpeaker()
          if (target) await speak(item.speech ?? '', target.preset, target.modelId)
          const record: AiReplyRecord = {
            at: Date.now(),
            kind: 'command',
            question: `${item.name}：${item.text}`,
            reply: item.speech ?? '',
            modelId: target?.modelId ?? '',
          }
          setReplies((current) => [record, ...current].slice(0, REPLY_RECORD_LIMIT))
        } finally {
          busyRef.current = false
          lastReplyAtRef.current = Date.now()
          setStatus(autoActiveRef.current ? 'idle' : 'off')
        }
        return
      }

      const config = settingsRef.current
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
  }, [pickNext, nextSpeaker, speakerFor, speak])

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
  if (kind === 'command') return '指令'
  return '弹幕'
}
