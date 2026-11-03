import { useMemo, useState } from 'react'
import { Stage, type StageModel } from './components/Stage'
import { Footer } from './components/Footer'
import { ModelControlPanel } from './components/ModelControlPanel'
import { StageControlPanel } from './components/StageControlPanel'
import { StageToolbar } from './components/StageToolbar'
import { TopBar } from './components/TopBar'
import { ModelProvider, StageProvider, VoiceProvider, LiveDataProvider } from './contexts'
import { useModel, useVoice } from './contexts'

const MODEL_LAYOUT_POSITIONS = [
  { x: 0.5, y: 0.54 },
  { x: 0.74, y: 0.54 },
  { x: 0.26, y: 0.54 },
  { x: 0.86, y: 0.54 },
  { x: 0.14, y: 0.54 },
]

function AppContent() {
  const { modelSources, activeModelId, setActiveModelId, characterStates, activeCharacter, manifest } = useModel()
  const { speakingModel } = useVoice()

  const [showStageCards, setShowStageCards] = useState(true)

  const activeMotion = activeCharacter.activeMotion
  const modelSource = modelSources.find((source) => source.id === activeModelId)
  const activeMotionConfig = manifest?.motions[activeMotion]
  const currentExpressionLabel = activeCharacter.selectedExpressions.length > 0
    ? activeCharacter.selectedExpressions.join(' + ')
    : '默认'

  const stageModels = useMemo<StageModel[]>(() => modelSources.flatMap((source, index) => {
    const state = characterStates[source.id]
    if (!state) return []
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
      speechText: speakingModel?.modelId === source.id ? speakingModel.text : '',
    }]
  }), [activeModelId, characterStates, modelSources, modelSource, speakingModel])

  return (
    <main className="shell">
      <TopBar />
      <section className="workspace">
        <ModelControlPanel />
        <section className="stagePanel">
          <StageToolbar
            showInfoCards={showStageCards}
            onToggleInfoCards={() => setShowStageCards((visible) => !visible)}
          />
          <Stage
            models={stageModels}
            activeModelId={activeModelId}
            onActivateModel={setActiveModelId}
            showInfoCards={showStageCards}
            caption={{
              left: manifest?.displayName ?? modelSource?.name ?? '',
              right: `${activeMotionConfig?.label ?? '读取配置中'} · ${currentExpressionLabel}`,
            }}
          />
        </section>
        <StageControlPanel />
      </section>
      <Footer />
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
      <AppContent />
    </VoiceProvider>
  )
}

export default App
