import { useEffect, useRef, useState } from 'react'
import { Live2D, type Live2DLoadState, type Live2DModelConfig } from '../Live2D'
import { Atmosphere } from '../Atmosphere'
import { LiveOverview } from '../LiveOverview'
import { GiftMotionCard } from '../GiftMotionCard'
import { ChatCommandCard } from '../ChatCommandCard'
import { LiveChatCard } from '../LiveChatCard'
import { cx } from '../../utils/cx'
import { useStage, useLiveData } from '../../hooks'
import styles from './index.module.scss'

export type { Live2DModelConfig as StageModel }
export type { Live2DLoadState as StageLoadState } from '../Live2D'

/**
 * 交叉淡入淡出的时长。
 * 必须和 index.module.scss 里 `$background-fade` 保持一致 —— 这里用来安排
 * 「旧图什么时候可以卸掉」，早了会露出底色，晚了会白留一层。
 */
const BACKGROUND_FADE_MS = 560

type BackgroundLayer = { id: number; url: string }

type StageBackgroundProps = {
  /** 当前该显示的背景地址；空串表示「无背景」 */
  url: string
  filter: string
}

/**
 * 舞台背景：换图时做交叉淡入淡出。
 *
 * 旧图保持不透明垫在下面，新图在上层从 0 淡到 1 —— 叠出来始终是
 * 「a × 旧图 + (1 - a) × 新图」，中间不会透出底下的渐变。
 * 反过来让两层同时一淡出一淡入的话，两边都半透明的那一瞬间会把底色透出来，
 * 看着像闪了一下。
 */
function StageBackground({ url, filter }: StageBackgroundProps) {
  const [layers, setLayers] = useState<BackgroundLayer[]>(() => (url ? [{ id: 0, url }] : []))
  /** 只在切到「无背景」时用：整组淡出，动画结束再清空 */
  const [fadingOut, setFadingOut] = useState(false)
  const idRef = useRef(1)
  const cleanupTimersRef = useRef<number[]>([])
  /** 已经上屏的地址。只有它变了才需要走一遍动画 */
  const shownRef = useRef(url)

  useEffect(() => {
    if (url === shownRef.current) return
    shownRef.current = url

    // 上一轮排着的卸载先取消，否则它会把刚加进来的新图一起清掉
    for (const timer of cleanupTimersRef.current) window.clearTimeout(timer)
    cleanupTimersRef.current = []

    if (!url) {
      setFadingOut(true)
      cleanupTimersRef.current.push(window.setTimeout(() => {
        setLayers([])
        setFadingOut(false)
      }, BACKGROUND_FADE_MS))
      return
    }

    // 先把图取回来再上屏：淡入到一半图才到的话，会看到它「跳」一下
    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      const id = idRef.current
      idRef.current += 1
      setFadingOut(false)
      setLayers((current) => [...current, { id, url }])
      // 新图完全盖住旧图之后才卸，提前卸会露出底色
      cleanupTimersRef.current.push(window.setTimeout(() => {
        setLayers((current) => current.filter((layer) => layer.id === id))
      }, BACKGROUND_FADE_MS))
    }
    image.src = url

    return () => { cancelled = true }
  }, [url])

  // 卸载时把还排着的定时器收掉
  useEffect(() => () => {
    for (const timer of cleanupTimersRef.current) window.clearTimeout(timer)
  }, [])

  return (
    <div
      className={cx(styles.stageBackground, fadingOut && styles.stageBackgroundOut)}
      style={{ filter }}
    >
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={styles.backgroundLayer}
          style={{ backgroundImage: `url("${layer.url}")` }}
        />
      ))}
    </div>
  )
}

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
  /** 「弹幕指令」速查卡 */
  showChatCommands?: boolean
  /** 只渲染模型本身：弹窗预览用，不带背景、滤镜、粒子、信息卡、聊天和字幕 */
  bare?: boolean
  caption?: {
    left: string
    right: string
  }
}

export function Stage({ models, activeModelId, onActivateModel, onModelStateChange, showOverview = true, showGiftMotions = true, showChat = true, showChatCommands = true, bare = false, caption }: StageProps) {
  const {
    backgroundUrl,
    backgroundMode,
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
      <StageBackground
        // 「无背景」只是不显示，选中的地址还留着，切回固定就能恢复
        url={backgroundMode === 'none' ? '' : backgroundUrl}
        filter={filterEnabled
          ? `brightness(${filterBrightness}) contrast(${filterContrast}) saturate(${filterSaturation}) blur(${filterBlur}px)`
          : 'none'}
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
      {showChatCommands && <ChatCommandCard />}
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
