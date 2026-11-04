import { Live2D, type Live2DLoadState, type Live2DModelConfig } from '../Live2D'
import { Atmosphere } from '../Atmosphere'
import { LiveOverview } from '../LiveOverview'
import { LiveChat } from '../LiveChat'
import { cx } from '../../utils/cx'
import { useStage } from '../../contexts'
import { useLiveData } from '../../contexts'
import styles from './index.module.scss'

export type { Live2DModelConfig as StageModel }
export type { Live2DLoadState as StageLoadState } from '../Live2D'

type StageProps = {
  models: Live2DModelConfig[]
  activeModelId?: string
  onActivateModel?: (id: string) => void
  onModelStateChange?: (id: string, state: Live2DLoadState, message?: string) => void
  showInfoCards?: boolean
  /** 只渲染模型本身：弹窗预览用，不带背景、滤镜、粒子、信息卡、聊天和字幕 */
  bare?: boolean
  caption?: {
    left: string
    right: string
  }
}

export function Stage({ models, activeModelId, onActivateModel, onModelStateChange, showInfoCards = true, bare = false, caption }: StageProps) {
  const {
    backgroundUrl,
    particleEnabled,
    particleIntensity,
    particleSpeed,
    particleOpacity,
    particlePreset,
    particleColor,
    particleSize,
    filterEnabled,
    filterBrightness,
    filterContrast,
    filterSaturation,
    filterBlur,
    vignette,
  } = useStage()

  const { douyinRoomId, douyinRoom, handleDouyinRoomChange } = useLiveData()

  if (bare) {
    return (
      <div className={cx(styles.preview, styles.previewBare)}>
        <Live2D
          models={models}
          activeModelId={activeModelId}
          onActivateModel={onActivateModel}
          onModelStateChange={onModelStateChange}
        />
      </div>
    )
  }

  return (
    <div className={styles.preview}>
      <div
        className={styles.stageBackground}
        style={{
          ...(backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : {}),
          filter: filterEnabled
            ? `brightness(${filterBrightness}) contrast(${filterContrast}) saturate(${filterSaturation}) blur(${filterBlur}px)`
            : 'none',
        }}
      />
      <Atmosphere
        enabled={particleEnabled}
        intensity={particleIntensity}
        speed={particleSpeed}
        opacity={particleOpacity}
        preset={particlePreset}
        color={particleColor}
        size={particleSize}
      />
      {showInfoCards && <LiveOverview />}
      <LiveChat
        roomId={douyinRoomId}
        onRoomIdChange={handleDouyinRoomChange}
        live={douyinRoom}
      />
      <Live2D models={models} activeModelId={activeModelId} onActivateModel={onActivateModel} onModelStateChange={onModelStateChange} />
      <div className={cx(styles.vignette, filterEnabled && vignette && styles.vignetteActive)} />
      {caption && (
        <div className={styles.caption}>
          <span>{caption.left}</span>
          <span>{caption.right}</span>
        </div>
      )}
    </div>
  )
}
