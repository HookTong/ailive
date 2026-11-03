import { useMemo } from 'react'
import { Stage, type StageLoadState, type StageModel } from '../Stage'

type ModelPreviewProps = {
  modelUrl: string
  onStateChange?: (state: StageLoadState, message?: string) => void
}

const PREVIEW_MODEL_ID = 'model-preview'

/**
 * 弹窗里的模型预览：直接复用 Stage。
 * 预览是独立的一张小舞台（自己的 PIXI 应用 + canvas），
 * 与首页舞台互不影响；首页依旧只有一张 canvas。
 */
export function ModelPreview({ modelUrl, onStateChange }: ModelPreviewProps) {
  const models = useMemo<StageModel[]>(() => [{
    id: PREVIEW_MODEL_ID,
    modelUrl,
    motion: '',
    expressions: [],
    size: 1,
    positionResetKey: 0,
    initialPosition: { x: 0.5, y: 0.52 },
    zIndex: 1,
  }], [modelUrl])

  return (
    <Stage
      models={models}
      activeModelId={PREVIEW_MODEL_ID}
      onModelStateChange={(_id, state, message) => onStateChange?.(state, message)}
    />
  )
}
