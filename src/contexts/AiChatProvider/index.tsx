import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createDoubaoChatReply, type DoubaoChatMessage, type DoubaoChatUsage } from '../../hooks/useAiChat/api'
import type { LiveFeedItem } from '../../hooks/useLiveServer'
import {
  useActionRouter,
  useChatCommand,
  useLiveData,
  useModel,
  useVoice,
  type ChatCommandResult,
} from '../../hooks'
import { looksLikeCommand, parseAction, parseAiControl, type ActionId, type ParsedAction } from '../../data/actions'
import { loadAiChatSettings, saveAiChatSettings, type AiChatSettings } from './storage'
import { AiChatContext, type AiChatContextValue, type AiChatStatus, type AiChatUsage, type AiReplyRecord } from './AiChatContext'

/**
 * 事件优先级：礼物答谢最要紧，进场欢迎次之，弹幕指令只比普通弹幕高一点，普通弹幕垫底。
 * 指令的反馈也走这条队列，所以它和礼物 / 进场一样受「回复间隔」节流。
 */
const KIND_PRIORITY: Record<QueueItem['kind'], number> = { gift: 30, member: 20, command: 15, chat: 10 }

/** 队列长度上限；满了先丢最旧的低优先级事件，礼物尽量不丢 */
const MAX_QUEUE = 10
/** 调用出错后的退避间隔，比正常间隔更长一点 */
const ERROR_BACKOFF_MS = 15000
/** 进场欢迎冷却：同一个人反复进出不重复欢迎 */
const MEMBER_USER_COOLDOWN_MS = 10 * 60_000
/** 礼物答谢冷却：礼物连击（combo）合并成一次答谢 */
const GIFT_USER_COOLDOWN_MS = 8_000
/**
 * 同一个人发指令的冷却。指令本身不受弹幕冷却限制（否则连发两条第二条就没了），
 * 但完全不限的话一个人能把舞台刷成幻灯片，所以单独给一个很短的窗口。
 */
const COMMAND_USER_COOLDOWN_MS = 3_000
/**
 * 自然语言理解：同一个人触发控制的冷却。
 * 和指令那套分开记 —— 普通聊天不该消耗观众的指令额度。
 */
const ROUTE_USER_COOLDOWN_MS = 3_000
/**
 * 自然语言理解的**全局**最小间隔。
 *
 * 回复那条链路有「回复间隔」（默认 6s）兜着，理解这条只有「每人 3s」+
 * 「队列最多 4 条」—— 队列一空就继续，实际速度等于模型响应速度（约 1 次/秒）。
 * 而每次理解都要重发一份跟弹幕长短无关的大 prompt：27 个工具定义 ≈ 1900 token +
 * 状态快照 ≈ 500 + 系统提示 ≈ 170，单次 2400 token 起（实测）。
 * 2s 一次是「观众等得起」和「账单扛得住」的折中。
 */
const MIN_ROUTE_INTERVAL_MS = 2_000
/** 待理解的弹幕上限；排这么长说明在刷屏，再等下去观众早忘了自己说过什么 */
const MAX_ROUTE_QUEUE = 4
/** 同一条弹幕的理解结果缓存多久：刷屏时重复话很多，能省一次调用 */
const ROUTE_CACHE_TTL_MS = 60_000
const ROUTE_CACHE_LIMIT = 100
/** 理解失败后的退避：Key 无效时别每条弹幕都打一次接口 */
const ROUTE_ERROR_BACKOFF_MS = 30_000
/** 发给模型的对话历史条数（user/assistant 成对） */
const HISTORY_PAIRS = 8
/** AI 生成内容去重：与最近几条回复相同就放弃这条 */
const REPLY_DEDUP_LIMIT = 5
/**
 * 展示用的回复记录上限。不封顶的话长跑一整天能攒到上千条 ——
 * 抽屉打开期间每次新回复都要重渲染整张列表，收益却早就没有了（没人翻几百条以前的话）。
 * 50 条大约够回看最近一小时。
 */
const REPLY_RECORD_LIMIT = 50

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
  const routeAction = useActionRouter()

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

  // 只有真的连着直播间（state === 'live'）才算「有人在看」。
  // 断开 / 掉线 / 下播 / 连接中都按「没人看」处理：这批弹幕已经没有观众了
  const liveConnected = douyinRoom.state === 'live'
  const liveRef = useRef(liveConnected)
  liveRef.current = liveConnected

  // 自然语言理解：待理解队列、串行锁、短时缓存、失败退避
  const routeQueueRef = useRef<LiveFeedItem[]>([])
  const routingRef = useRef(false)
  const routeCacheRef = useRef(new Map<string, { at: number; actions: ParsedAction[] }>())
  const routeBackoffRef = useRef(0)
  /** 上一次真正打模型的时间，给全局节流用（命中缓存的不算） */
  const lastRouteAtRef = useRef(0)

  const autoActive = settings.autoReply && settings.apiKey.trim() !== ''
  const autoActiveRef = useRef(autoActive)
  autoActiveRef.current = autoActive

  /** 自然语言控制只看「开关 + Key」，和自动回复是两件事：关了回复也能让弹幕改舞台 */
  const nlActiveRef = useRef(false)
  nlActiveRef.current = settings.nlControl && settings.apiKey.trim() !== ''

  const openAiConfig = useCallback(() => setAiConfigOpen(true), [])
  const closeAiConfig = useCallback(() => setAiConfigOpen(false), [])
  const clearError = useCallback(() => setError(''), [])

  const persistSettings = useCallback((next: AiChatSettings) => {
    setSettings(next)
    saveAiChatSettings(next)
  }, [])

  /** 记账：回复和意图理解都算一次调用，别把理解的钱漏掉 */
  const addUsage = useCallback((spent: DoubaoChatUsage) => {
    setUsage((current) => ({
      promptTokens: current.promptTokens + spent.promptTokens,
      completionTokens: current.completionTokens + spent.completionTokens,
      totalTokens: current.totalTokens + spent.totalTokens,
      calls: current.calls + 1,
    }))
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

  /**
   * 入队并按上限淘汰：满了先丢最旧的非礼物事件，礼物尽量保住。
   * 返回这条是否还留在队列里 —— 被挤掉的那条没被回复，不该消耗观众的冷却额度。
   */
  const pushQueue = useCallback((item: QueueItem): boolean => {
    // 没连着直播就不再收：断开那一刻可能还有一批 flush 在路上，
    // 收下来只会让台上对着空气继续回
    if (!liveRef.current) return false
    const queue = queueRef.current
    queue.push(item)
    while (queue.length > MAX_QUEUE) {
      const victim = queue.findIndex((candidate) => candidate.kind !== 'gift')
      queue.splice(victim >= 0 ? victim : 0, 1)
    }
    setPendingCount(queue.length)
    pruneCooldowns()
    return queue.includes(item)
  }, [pruneCooldowns])

  const enqueue = useCallback((item: LiveFeedItem) => {
    if (item.kind !== 'chat' && item.kind !== 'gift' && item.kind !== 'member') return
    const now = Date.now()
    const cooldown = item.kind === 'gift' ? GIFT_USER_COOLDOWN_MS
      : item.kind === 'member' ? MEMBER_USER_COOLDOWN_MS
        // 可调：面板「节流参数」里的「同一观众冷却」
        : settingsRef.current.throttle.userCooldownMs
    const cooldowns = userCooldownRef.current

    // 队列里已经有这个人的弹幕在等：他还没被回复，新的一句排进去也只会被后面的顶掉。
    // 「一个人连发占满队列」靠这一条挡，比按时间窗屏蔽精确得多
    if (item.kind === 'chat' && queueRef.current.some(
      (queued) => queued.kind === 'chat' && queued.name === item.name,
    )) return

    // 同类事件同一观众的冷却（礼物连击合并、弹幕连发只答一条、反复进出只欢迎一次）
    const userKey = `${item.kind}:${item.name}`
    const lastAt = cooldowns.get(userKey)
    if (lastAt !== undefined && now - lastAt < cooldown) return

    // 同内容弹幕冷却：不同观众刷同一句话，只答第一句
    let textKey = ''
    if (item.kind === 'chat') {
      textKey = normalizeText(item.text)
      const seenAt = textSeenRef.current.get(textKey)
      if (seenAt !== undefined && now - seenAt < settingsRef.current.throttle.sameTextWindowMs) return
    }

    const kept = pushQueue({ kind: item.kind, name: item.name, text: item.text, count: item.count, at: item.at })
    // 冷却和「同文本」都只在真排进队列后才算数，被上限挤掉的那条什么都没发生
    if (!kept) return
    cooldowns.set(userKey, now)
    if (textKey) textSeenRef.current.set(textKey, now)
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

  /** 同一个人触发自然语言控制的冷却；和指令额度分开记，普通聊天不该消耗指令配额 */
  const allowRoute = useCallback((name: string) => {
    const now = Date.now()
    const key = `route:${name}`
    const lastAt = userCooldownRef.current.get(key)
    if (lastAt !== undefined && now - lastAt < ROUTE_USER_COOLDOWN_MS) return false
    userCooldownRef.current.set(key, now)
    return true
  }, [])

  /**
   * 全局节流：距上次真调用不足间隔就先等着。
   * 等的时候 `routingRef` 还是 true，新弹幕只会进队列，不会插队打接口。
   */
  const waitForRouteSlot = useCallback(async () => {
    const wait = MIN_ROUTE_INTERVAL_MS - (Date.now() - lastRouteAtRef.current)
    if (wait > 0) await new Promise((resolve) => { window.setTimeout(resolve, wait) })
    lastRouteAtRef.current = Date.now()
  }, [])

  /** 同一条话短时间内只理解一次：刷屏时重复话很多，能省掉大量调用 */
  const readRouteCache = useCallback((text: string): ParsedAction[] | null => {
    const key = normalizeText(text)
    const hit = routeCacheRef.current.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > ROUTE_CACHE_TTL_MS) {
      routeCacheRef.current.delete(key)
      return null
    }
    return hit.actions
  }, [])

  const writeRouteCache = useCallback((text: string, actions: ParsedAction[]) => {
    const cache = routeCacheRef.current
    cache.set(normalizeText(text), { at: Date.now(), actions })
    if (cache.size <= ROUTE_CACHE_LIMIT) return
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (now - entry.at > ROUTE_CACHE_TTL_MS) cache.delete(key)
    }
    if (cache.size > ROUTE_CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
  }, [])

  /**
   * 串行地把待理解的弹幕送进模型：并发跑多条既抢额度，
   * 也会让动作顺序说不清（两条都换背景时谁最后生效）。
   */
  const drainRouteQueue = useCallback(async () => {
    if (routingRef.current) return
    routingRef.current = true
    try {
      while (routeQueueRef.current.length > 0) {
        const item = routeQueueRef.current.shift()
        if (!item) break

        let actions: ParsedAction[] = []
        const cached = readRouteCache(item.text)
        if (cached) {
          actions = cached
        } else {
          const config = settingsRef.current
          const enabled = enabledActionIds(chatCommandsRef.current)
          if (enabled.length > 0 && config.apiKey.trim()) {
            // 真打接口才占节流名额；命中缓存的那条不花钱，也不该拖慢后面的
            await waitForRouteSlot()
            try {
              const result = await routeAction(item.text, enabled, config)
              actions = result.actions
              addUsage(result.usage)
              writeRouteCache(item.text, actions)
            } catch (reason) {
              // 理解失败按普通弹幕处理，别让观众觉得指令坏了；退避一会儿再试
              routeBackoffRef.current = Date.now() + ROUTE_ERROR_BACKOFF_MS
              setError(reason instanceof Error ? reason.message : '自然语言理解失败')
            }
          }
        }

        // 缓存里的动作可能是在「关掉它」之前理解的：执行前按当前开关再过一遍
        actions = actions.filter((action) => chatCommandsRef.current[action.id] !== false)

        // 不是指令：回到原来的回复队列，行为和以前完全一样
        if (actions.length === 0) {
          if (autoActiveRef.current) enqueue(item)
          continue
        }

        const results = actions.map((action) => executeCommand(action))
        enqueueCommand(item, {
          id: results[0].id,
          ok: results.every((result) => result.ok),
          // 一句话里好几个动作时合成一句播报，观众才知道都改了什么
          speech: results.map((result) => result.speech).join('；'),
          modelId: results.find((result) => result.modelId)?.modelId ?? null,
        })
      }
    } finally {
      routingRef.current = false
    }
  }, [addUsage, enqueue, enqueueCommand, executeCommand, readRouteCache, routeAction, waitForRouteSlot, writeRouteCache])

  const enqueueRoute = useCallback((item: LiveFeedItem) => {
    // 刚失败过：退避期内直接当普通弹幕，别再打接口
    if (Date.now() < routeBackoffRef.current) {
      if (autoActiveRef.current) enqueue(item)
      return
    }
    // 排太长说明在刷屏，再等下去动作早就过时了，直接按普通弹幕处理
    if (routeQueueRef.current.length >= MAX_ROUTE_QUEUE) {
      if (autoActiveRef.current) enqueue(item)
      return
    }
    routeQueueRef.current.push(item)
    void drainRouteQueue()
  }, [drainRouteQueue, enqueue])

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
      if (item.kind === 'chat') {
        // 指令写法的弹幕（`[关键字…]`）只走指令这一条路：形状不对、指令被关掉、在冷却里，
        // 都到此为止 —— 不交给自然语言控制，也不当普通弹幕回一句。
        // 观众明明在发指令，回他一段聊天只会让人以为指令坏了
        if (looksLikeCommand(item.text)) {
          const command = parseAction(item.text)
          if (command && chatCommandsRef.current[command.id] !== false && allowCommand(item.name)) {
            // 动作立刻执行，反馈走队列 —— 等 6 秒节流才换背景的话，观众早就发了下一条
            enqueueCommand(item, executeCommand(command))
          }
          continue
        }
        // 只有 `[AI控制]换个赛博背景` 这种写法才送模型理解。没写前缀的一律当普通聊天 ——
        // 单次理解要重发一整张工具表 + 状态快照（≈2400 token），不该为每条闲聊都付一遍
        const aiText = parseAiControl(item.text)
        if (aiText !== null) {
          // 只写了个前缀、后面什么都没有：当没写，既不调接口也不回一句
          if (!aiText) continue
          // 写了前缀就是明说「这是控制指令」，关掉 / 冷却 / 队列满都不落普通回复
          if (nlActiveRef.current && allowRoute(item.name)) {
            enqueueRoute({ ...item, text: aiText })
          }
          continue
        }
      }
      if (!autoActiveRef.current) continue
      enqueue(item)
    }
  }, [douyinRoom.feed, allowCommand, allowRoute, enqueue, enqueueCommand, enqueueRoute, executeCommand])

  /**
   * 连接断了就把手上没做完的活停掉：清空待回复队列、清空待理解队列。
   * **正在说的那一句不打断**，让它把话说完再自然收尾 —— 半句话被掐掉比多等两秒难听得多。
   * 不清队列的话泵每秒还在取下一条 —— 点了「断开」，台上却继续对着空气回弹幕。
   * 重连也走这里：重连时 feed 本来就会清空，留着旧队列等于在回一批已经翻篇的消息。
   */
  useEffect(() => {
    if (liveConnected) return
    queueRef.current = []
    routeQueueRef.current = []
    setPendingCount(0)
  }, [liveConnected])

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
      if (sinceReply < settingsRef.current.throttle.replyIntervalMs) return
      const item = pickNext(autoActiveRef.current)
      if (!item) return

      // 指令反馈不走模型：文案是执行结果本身，没配 Key 也得能播
      if (item.kind === 'command') {
        busyRef.current = true
        if (autoActiveRef.current) setStatus('speaking')
        try {
          // 角色控制台指令由点名的角色说；舞台指令（和找不到角色的失败）交给轮流挑人
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
        addUsage(result.usage)

        // 等接口的这几秒里连接可能已经断了：这条回复已经没人在听，别再开口。
        // 不拦的话断开瞬间正在路上的那一条还会念出来（队列清了也没用，它已经出队了）
        if (!liveRef.current) return

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
        // 出错退避久一点，避免 Key 无效时每秒打一次接口。
        // 取 max：用户把间隔调到 60s 时，退避不该反而让重试变得更快
        const interval = settingsRef.current.throttle.replyIntervalMs
        lastReplyAtRef.current = Date.now() - interval + Math.max(ERROR_BACKOFF_MS, interval)
        setError(reason instanceof Error ? reason.message : '豆包请求失败')
      } finally {
        busyRef.current = false
        setStatus(autoActiveRef.current ? 'idle' : 'off')
      }
    }

    return () => window.clearInterval(timer)
  }, [pickNext, nextSpeaker, speakerFor, speak, addUsage])

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

/** 只把「没被关掉」的动作交给模型；缺省视为启用 */
function enabledActionIds(switches: Record<ActionId, boolean>): ActionId[] {
  return (Object.keys(switches) as ActionId[]).filter((id) => switches[id] !== false)
}
