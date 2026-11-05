import { useMemo, useState } from 'react'
import { Stage, type StageModel } from './components/Stage'
import { ModelControlPanel } from './components/ModelControlPanel'
import { StageControlPanel } from './components/StageControlPanel'
import { StageToolbar } from './components/StageToolbar'
import { TopBar } from './components/TopBar'
import { ModelProvider, StageProvider, VoiceProvider, LiveDataProvider, MusicProvider, AiChatProvider } from './contexts'
import { useModel, useVoice } from './hooks'

const MODEL_LAYOUT_POSITIONS = [
  { x: 0.5, y: 0.54 },
  { x: 0.74, y: 0.54 },
  { x: 0.26, y: 0.54 },
  { x: 0.86, y: 0.54 },
  { x: 0.14, y: 0.54 },
]

function AppContent() {
  const { modelSources, activeModelId, setActiveModelId, characterStates, activeCharacter, manifest } = useModel()
  const { speakingModel, lastSpoken } = useVoice()

  const [showStageCards, setShowStageCards] = useState(true)
  const [showLiveChat, setShowLiveChat] = useState(true)

  const activeMotion = activeCharacter.activeMotion
  const modelSource = modelSources.find((source) => source.id === activeModelId)
  const activeMotionConfig = manifest?.motions[activeMotion]
  const currentExpressionLabel = activeCharacter.selectedExpressions.length > 0
    ? activeCharacter.selectedExpressions.join(' + ')
    : '默认'

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
