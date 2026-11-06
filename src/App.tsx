import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, type StageModel } from './components/Stage'
import { ModelControlPanel } from './components/ModelControlPanel'
import { StageControlPanel } from './components/StageControlPanel'
import { StageToolbar } from './components/StageToolbar'
import { TopBar } from './components/TopBar'
import { ModelProvider, StageProvider, VoiceProvider, LiveDataProvider, MusicProvider, AiChatProvider } from './contexts'
import { useLiveData, useModel, useVoice, GIFT_MOTION_ANY_MODEL, resolveGiftMotion } from './hooks'

const MODEL_LAYOUT_POSITIONS = [
  { x: 0.5, y: 0.54 },
  { x: 0.74, y: 0.54 },
  { x: 0.26, y: 0.54 },
  { x: 0.86, y: 0.54 },
  { x: 0.14, y: 0.54 },
]

function AppContent() {
  const { modelSources, activeModelId, setActiveModelId, characterStates, activeCharacter, manifest, updateCharacter } = useModel()
  const { speakingModel, lastSpoken } = useVoice()
  const { douyinRoom, giftMotions } = useLiveData()

  const [showStageCards, setShowStageCards] = useState(true)
  const [showLiveChat, setShowLiveChat] = useState(true)

  const activeMotion = activeCharacter.activeMotion
  const modelSource = modelSources.find((source) => source.id === activeModelId)
  const activeMotionConfig = manifest?.motions[activeMotion]
  const currentExpressionLabel = activeCharacter.selectedExpressions.length > 0
    ? activeCharacter.selectedExpressions.join(' + ')
    : '默认'

  // 弹幕里最新的一条送礼。弹幕数组每次 flush 都会换新，但条目对象是复用的，
  // 所以同一个礼物的引用不变，下面只看 id 就能判断「是不是新来了一条」
  const latestGift = useMemo(() => {
    const feed = douyinRoom.feed
    for (let index = feed.length - 1; index >= 0; index -= 1) {
      if (feed[index].kind === 'gift') return feed[index]
    }
    return null
  }, [douyinRoom.feed])
  const latestGiftId = latestGift?.id

  // 收到礼物时按配置切动作：每个模型各查自己的那一格，谁配了、谁有这个动作，谁就做。
  // 依赖里带上 characterStates：模型还在加载时来的礼物不能就这么丢掉，
  // 等 manifest 到位后这次 effect 会再跑一遍补上。
  // 同一条礼物只处理一次，靠 ref 记 id，否则改个配置就会把上一条礼物重放一遍。
  const triggeredGiftRef = useRef<string | number | null>(null)
  // 多个模型的 manifest 是并行加载的，先加载好的别把这条礼物「用掉」——
  // 没加载完的记在这里，等它们到位后只补这几个模型，已经做过的不重放
  const pendingModelsRef = useRef<{ id: string | number; modelIds: string[] } | null>(null)
  useEffect(() => {
    if (!latestGift) return
    const isNewGift = triggeredGiftRef.current !== latestGift.id
    const pendingIds = pendingModelsRef.current?.id === latestGift.id
      ? pendingModelsRef.current.modelIds
      : null
    if (!isNewGift && !pendingIds) return

    const entry = giftMotions[latestGift.text]
    if (!entry) {
      triggeredGiftRef.current = latestGift.id
      pendingModelsRef.current = null
      return
    }

    const only = pendingIds ? new Set(pendingIds) : null
    const targets: Array<{ id: string; motion: string; nonce: number }> = []
    const waiting: string[] = []
    for (const source of modelSources) {
      if (only && !only.has(source.id)) continue
      const state = characterStates[source.id]
      // 这个礼物在这个模型上有配置，才需要关心它的 manifest 到没到
      const configured = entry[source.id] ?? entry[GIFT_MOTION_ANY_MODEL] ?? ''
      if (!configured) continue
      if (!state?.manifest) {
        waiting.push(source.id)
        continue
      }
      // 模型没有该动作就跳过（换过模型后旧配置可能失效）
      const motion = resolveGiftMotion(entry, source.id, state.manifest.motions)
      if (!motion) continue
      targets.push({ id: source.id, motion, nonce: state.motionNonce + 1 })
    }

    triggeredGiftRef.current = latestGift.id
    pendingModelsRef.current = waiting.length > 0 ? { id: latestGift.id, modelIds: waiting } : null
    for (const target of targets) {
      updateCharacter(target.id, { activeMotion: target.motion, motionNonce: target.nonce })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestGiftId, modelSources, characterStates, giftMotions])

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
      speakMotion: state.speakingMotion,
      motionNonce: state.motionNonce,
      visible: state.modelVisible,
    }]
  }), [activeModelId, characterStates, modelSources, modelSource, speakingModel, lastSpoken])

  return (
    <main className="shell">
      <TopBar />
      <section className="workspace">
        <ModelControlPanel />
        <section className="stagePanel">
          <StageToolbar
            showInfoCards={showStageCards}
            showLiveChat={showLiveChat}
            onToggleInfoCards={() => setShowStageCards((visible) => !visible)}
            onToggleLiveChat={() => setShowLiveChat((visible) => !visible)}
          />
          <Stage
            models={stageModels}
            activeModelId={activeModelId}
            onActivateModel={setActiveModelId}
            showInfoCards={showStageCards}
            showChat={showLiveChat}
            caption={{
              left: manifest?.displayName ?? modelSource?.name ?? '',
              right: `${activeMotionConfig?.label ?? '读取配置中'} · ${currentExpressionLabel}`,
            }}
          />
        </section>
        <StageControlPanel />
      </section>
    </main>
  )
}

function App() {
  return (
    <ModelProvider>
      <StageProvider>
        <LiveDataProvider>
          <VoiceAndModelBridge />
        </LiveDataProvider>
      </StageProvider>
    </ModelProvider>
  )
}

function VoiceAndModelBridge() {
  const { resetVoicePresetForAll } = useModel()

  return (
    <VoiceProvider onCharacterVoicePresetReset={resetVoicePresetForAll}>
      <AiChatProvider>
        <MusicProvider>
          <AppContent />
        </MusicProvider>
      </AiChatProvider>
    </VoiceProvider>
  )
}

export default App
