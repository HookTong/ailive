import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, type StageModel } from './components/Stage'
import { ModelControlPanel } from './components/ModelControlPanel'
import { StageControlPanel } from './components/StageControlPanel'
import { TopBar } from './components/TopBar'
import { ThemeProvider, ModelProvider, StageProvider, VoiceProvider, LiveDataProvider, MusicProvider, AiChatProvider } from './contexts'
import { useLiveData, useModel, useVoice, useHoverScrollbar, GIFT_MOTION_ANY_MODEL, resolveGiftMotion } from './hooks'
import { normalizeGiftName } from './data/gifts'

const MODEL_LAYOUT_POSITIONS = [
  { x: 0.5, y: 0.54 },
  { x: 0.74, y: 0.54 },
  { x: 0.26, y: 0.54 },
  { x: 0.86, y: 0.54 },
  { x: 0.14, y: 0.54 },
]

/** 礼物动作队列的上限：刷屏时丢掉最旧的，保证播的总是「最近」的礼物 */
const GIFT_QUEUE_LIMIT = 8
/** 每条礼物动作至少占这么久再切下一条；也是这段时间里说话动作不许抢的时长 */
const GIFT_MOTION_INTERVAL_MS = 1200

function AppContent() {
  const { modelSources, activeModelId, setActiveModelId, characterStates, updateCharacter } = useModel()
  const { speakingModel, lastSpoken } = useVoice()
  const { douyinRoom, giftMotions } = useLiveData()

  // 全局只挂一次：指针进哪个滚动容器，哪个容器才露出滚动条
  useHoverScrollbar()

  // 全屏按钮在顶栏上，要全屏的却是中间这块舞台 —— 把节点传下去，别用 querySelector 猜
  const stagePanelRef = useRef<HTMLElement>(null)

  const modelSource = modelSources.find((source) => source.id === activeModelId)

  // ---- 礼物动作队列 ----
  // 一次 flush（400ms）里可能同时来好几条礼物，不能只认最后一条：全部入队，逐条播。
  // 队列满了丢最旧的，刷屏时看到的总是最近的礼物。
  const giftQueueRef = useRef<Array<{ id: number; name: string }>>([])
  // 已经入队的最大事件 id。feed 是增量推送的，靠它挑出「这一批新来的」
  const queuedGiftIdRef = useRef(0)
  // 正在播的那条（播放窗口结束前，别的礼物排队等着）
  const playingGiftRef = useRef<{ id: number; name: string } | null>(null)
  const giftTimerRef = useRef<number | null>(null)
  // 播放窗口内 manifest 还没就绪的模型，等它们到位后单独补上
  const pendingModelsRef = useRef<{ id: number; modelIds: string[] } | null>(null)
  // 推进队列用：入队和播放窗口结束都 +1，effect 靠它重新跑一次
  const [giftTick, setGiftTick] = useState(0)

  useEffect(() => {
    const feed = douyinRoom.feed
    // 断线重连会把 feed 和事件序号一起清零，这里跟着复位，否则新礼物会被当成旧的
    if (feed.length === 0) {
      queuedGiftIdRef.current = 0
      return
    }
    const fresh: Array<{ id: number; name: string }> = []
    for (const item of feed) {
      if (item.kind !== 'gift' || typeof item.id !== 'number') continue
      if (item.id <= queuedGiftIdRef.current) continue
      fresh.push({ id: item.id, name: normalizeGiftName(item.text) })
    }
    if (fresh.length === 0) return
    queuedGiftIdRef.current = fresh[fresh.length - 1].id
    const queue = giftQueueRef.current
    queue.push(...fresh)
    if (queue.length > GIFT_QUEUE_LIMIT) queue.splice(0, queue.length - GIFT_QUEUE_LIMIT)
    setGiftTick((tick) => tick + 1)
  }, [douyinRoom.feed])

  // 出队：没有正在播的就取下一条，给每个配了动作的模型切过去。
  // 播放窗口用 setTimeout 推进，不放在 effect 的 cleanup 里 —— 依赖一变就 cleanup，
  // 会把「窗口结束」这个信号也清掉，队列就卡死了
  useEffect(() => {
    if (playingGiftRef.current) return
    // 没配动作的礼物不占播放窗口，直接跳过
    let next = giftQueueRef.current.shift()
    while (next && !giftMotions[next.name]) next = giftQueueRef.current.shift()
    if (!next) return

    const config = giftMotions[next.name]
    const holdUntil = Date.now() + GIFT_MOTION_INTERVAL_MS
    const waiting: string[] = []
    for (const source of modelSources) {
      const state = characterStates[source.id]
      // 这个礼物在这个模型上有配置，才需要关心它的 manifest 到没到
      const configured = config[source.id] ?? config[GIFT_MOTION_ANY_MODEL] ?? ''
      if (!configured) continue
      if (!state?.manifest) {
        waiting.push(source.id)
        continue
      }
      // 模型没有该动作就跳过（换过模型后旧配置可能失效）
      const motion = resolveGiftMotion(config, source.id, state.manifest.motions)
      if (!motion) continue
      updateCharacter(source.id, {
        overrideMotion: motion,
        overrideNonce: state.overrideNonce + 1,
        // 这段时间里说话动作不许抢（礼物优先级更高）
        motionHoldUntil: holdUntil,
      })
    }

    playingGiftRef.current = next
    pendingModelsRef.current = waiting.length > 0 ? { id: next.id, modelIds: waiting } : null
    giftTimerRef.current = window.setTimeout(() => {
      giftTimerRef.current = null
      playingGiftRef.current = null
      pendingModelsRef.current = null
      setGiftTick((tick) => tick + 1)
    }, GIFT_MOTION_INTERVAL_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftTick, giftMotions, modelSources, characterStates, updateCharacter])

  // 播放窗口内才有意义：模型加载慢一步的话，趁这条礼物还在播把它补上
  useEffect(() => {
    const pending = pendingModelsRef.current
    const playing = playingGiftRef.current
    if (!pending || !playing || pending.id !== playing.id) return
    const config = giftMotions[playing.name]
    if (!config) return
    const holdUntil = Date.now() + GIFT_MOTION_INTERVAL_MS
    const stillWaiting: string[] = []
    for (const modelId of pending.modelIds) {
      const state = characterStates[modelId]
      if (!state?.manifest) {
        stillWaiting.push(modelId)
        continue
      }
      const motion = resolveGiftMotion(config, modelId, state.manifest.motions)
      if (!motion) continue
      updateCharacter(modelId, {
        overrideMotion: motion,
        overrideNonce: state.overrideNonce + 1,
        motionHoldUntil: holdUntil,
      })
    }
    pendingModelsRef.current = stillWaiting.length > 0 ? { id: pending.id, modelIds: stillWaiting } : null
  }, [characterStates, giftMotions, updateCharacter])

  // 卸载时把播放窗口的定时器收掉
  useEffect(() => () => {
    if (giftTimerRef.current) window.clearTimeout(giftTimerRef.current)
  }, [])

  const stageModels = useMemo<StageModel[]>(() => modelSources.flatMap((source, index) => {
    const state = characterStates[source.id]
    if (!state) return []
    const speaking = speakingModel?.modelId === source.id
    // 说话时显示当前内容；常显模式显示该模型最近说过的话，没说过就退回默认招呼语，
    // 这样点「常显」后气泡会立刻出现在对应模型头上，不用等它先开口
    const speechText = speaking
      ? speakingModel.text
      : state.bubbleMode === 'always'
        ? lastSpoken[source.id] ?? `你好，我是${source.name}`
        : ''
    return [{
      id: source.id,
      // 舞台名牌显示的名字。以添加时定下的展示名为准，模型配置里的 displayName 只当兜底
      name: source.name || state.manifest?.displayName,
      // 控制台里「名牌显示」关掉时单独传个开关，名字留着（气泡、弹幕指令还要用）
      nameplate: state.nameplateVisible !== false,
      modelUrl: source.modelUrl,
      motion: state.activeMotion,
      expressions: state.selectedExpressions.flatMap((name) => {
        const config = state.manifest?.expressions[name]
        return config ? [{ name, file: config.file }] : []
      }),
      size: state.modelSize,
      positionResetKey: state.positionResetKey,
      initialPosition: MODEL_LAYOUT_POSITIONS[index % MODEL_LAYOUT_POSITIONS.length],
      zIndex: source.id === modelSource?.id ? (source.id.startsWith('online:') ? 20 : 30) : 5 + index,
      speechText,
      speaking,
      overrideMotion: state.overrideMotion,
      overrideNonce: state.overrideNonce,
      motionHoldUntil: state.motionHoldUntil,
      visible: state.modelVisible,
    }]
  }), [activeModelId, characterStates, modelSources, modelSource, speakingModel, lastSpoken])

  return (
    <main className="shell">
      <TopBar stagePanelRef={stagePanelRef} />
      <section className="workspace">
        <ModelControlPanel />
        {/* 工具条已经拆掉：四块浮层的显隐和大小时隔都在右侧「舞台控制台」里，全屏挪到了顶栏 */}
        <section className="stagePanel" ref={stagePanelRef}>
          <Stage
            models={stageModels}
            activeModelId={activeModelId}
            onActivateModel={setActiveModelId}
          />
        </section>
        <StageControlPanel />
      </section>
    </main>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ModelProvider>
        <StageProvider>
          <LiveDataProvider>
            <VoiceAndModelBridge />
          </LiveDataProvider>
        </StageProvider>
      </ModelProvider>
    </ThemeProvider>
  )
}

function VoiceAndModelBridge() {
  const { resetVoicePresetForAll } = useModel()

  return (
    <VoiceProvider onCharacterVoicePresetReset={resetVoicePresetForAll}>
      {/* MusicProvider 必须包在 AiChatProvider 外面：弹幕指令要能切歌，
          AiChatProvider 里的 useChatCommand 依赖 useMusic */}
      <MusicProvider>
        <AiChatProvider>
          <AppContent />
        </AiChatProvider>
      </MusicProvider>
    </VoiceProvider>
  )
}

export default App
