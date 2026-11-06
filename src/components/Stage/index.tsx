import { Live2D, type Live2DLoadState, type Live2DModelConfig } from '../Live2D'
import { Atmosphere } from '../Atmosphere'
import { LiveOverview } from '../LiveOverview'
import { GiftMotionCard } from '../GiftMotionCard'
import { LiveChatCard } from '../LiveChatCard'
import { cx } from '../../utils/cx'
import { useStage, useLiveData } from '../../hooks'
import styles from './index.module.scss'

export type { Live2DModelConfig as StageModel }
export type { Live2DLoadState as StageLoadState } from '../Live2D'

type StageProps = {
  models: Live2DModelConfig[]
  activeModelId?: string
  onActivateModel?: (id: string) => void
  onModelStateChange?: (id: string, state: Live2DLoadState, message?: string) => void
  /** 左上角的直播概览卡片组 */
  showOverview?: boolean
  /** 「礼物动作」浮动面板 */
  showGiftMotions?: boolean
  /** 是否显示弹幕面板 */
  showChat?: boolean
  /** 只渲染模型本身：弹窗预览用，不带背景、滤镜、粒子、信息卡、聊天和字幕 */
  bare?: boolean
  caption?: {
    left: string
    right: string
  }
}

export function Stage({ models, activeModelId, onActivateModel, onModelStateChange, showOverview = true, showGiftMotions = true, showChat = true, bare = false, caption }: StageProps) {
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

  const { douyinRoom } = useLiveData()

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
      {showOverview && <LiveOverview />}
      {showGiftMotions && <GiftMotionCard />}
      {showChat && <LiveChatCard live={douyinRoom} />}
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
