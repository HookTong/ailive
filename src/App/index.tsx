import { useMemo, useState } from 'react'
import { Stage, type StageModel } from '../components/Stage'
import { ModelControlPanel } from '../components/ModelControlPanel'
import { StageControlPanel } from '../components/StageControlPanel'
import { Tooltip } from '../components/Tooltip'
import { Button } from '../components/Button'
import { cx } from '../utils/cx'
import { ModelProvider, StageProvider, VoiceProvider, LiveDataProvider } from '../contexts'
import { useModel, useVoice } from '../contexts'
import styles from './index.module.scss'

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
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>✦</span>
          <span>AI LIVE<span className={styles.brandMuted}>.studio</span></span>
        </div>
        <div className={styles.topbarMeta}>
          <span className={styles.statusPill}><i /> 系统在线</span>
          <span className={styles.avatar}>A</span>
        </div>
      </header>
      <section className={styles.workspace}>
        <ModelControlPanel />
        <section className={styles.stagePanel}>
          <div className={styles.stageToolbar}>
            <div><span className={styles.liveDot} /> LIVE PREVIEW</div>
            <div className={styles.toolbarActions}>
              <Tooltip placement="bottom" title={showStageCards ? '隐藏顶部卡片' : '显示顶部卡片'}>
                <Button
                  variant="bare"
                  className={styles.toolButton}
                  aria-label={showStageCards ? '隐藏顶部卡片' : '显示顶部卡片'}
                  onClick={() => setShowStageCards((visible) => !visible)}
                >
                  {showStageCards ? '▣' : '□'}
                </Button>
              </Tooltip>
              <Tooltip placement="bottom" title="全屏">
                <Button variant="bare" className={styles.toolButton}>↗</Button>
              </Tooltip>
              <Tooltip placement="bottom" title="更多">
                <Button variant="bare" className={styles.toolButton}>•••</Button>
              </Tooltip>
            </div>
          </div>
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
      <footer className={styles.footer}>
        <span>AI LIVE STUDIO</span>
        <span>模型资源由 Live2D Cubism 提供支持</span>
        <span>⌘ K 快捷键</span>
      </footer>
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
