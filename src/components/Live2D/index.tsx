import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

type ExpressionSelection = { name: string; file: string }

type ExpressionDefinition = {
  Parameters?: Array<{ Id: string; Value: number; Blend?: 'Add' | 'Multiply' | 'Overwrite' }>
}

export type Live2DModelConfig = {
  id: string
  /**
   * 角色名，舞台上挂在角色脚下的那颗半透明名牌显示的就是它。
   * 不传（空串）就不显示名牌 —— 弹窗预览里只留模型本身。
   */
  name?: string
  /**
   * 名牌是否显示。`App` 会按角色的「名牌显示」开关传明确的 true / false，
   * 不传时按「显示」处理（`undefined !== false`）—— 弹窗预览那边是另一套，
   * 走的是 `showNames={false}` 的全局开关。
   */
  nameplate?: boolean
  modelUrl: string
  motion: string
  expressions: ExpressionSelection[]
  size: number
  positionResetKey: number
  initialPosition?: { x: number; y: number }
  zIndex: number
  speechText?: string
  /** 模型是否可见，默认 true */
  visible?: boolean
  /** 当前是否正在说话（开始说话时会重播 motion，也就是「动作预设」里选中的那一项） */
  speaking?: boolean
  /**
   * 一次性动作（礼物触发）。**不参与「当前动作」的比较** —— 只靠 overrideNonce 推进触发，
   * 播完不会改变 motion，所以控制台里选中的预设不会被礼物顶掉。
   */
  overrideMotion?: string
  /** 一次性动作的重放计数：变了就播 overrideMotion，哪怕值没变（同一礼物连送两次） */
  overrideNonce?: number
  /** 礼物动作的独占截止时间：在此之前说话动作不许抢 */
  motionHoldUntil?: number
}

export type Live2DLoadState = 'loading' | 'ready' | 'missing'

type ModelEntry = {
  id: string
  modelUrl: string
  model: Live2DModel | null
  size: number
  zIndex: number
  motion: string
  initialPosition: { x: number; y: number }
  positionRatio: { x: number; y: number } | null
  positionResetKey: number
  expressionKey: string
  expressionToken: number
  expressions: ExpressionDefinition[]
  loadToken: number
  drag: { offsetX: number; offsetY: number }
  cleanup: (() => void) | null
  visible: boolean
  speaking: boolean
  overrideMotion: string
  overrideNonce: number
  motionHoldUntil: number
  /**
   * 模型画布底部 / 顶部的透明留白占包围盒高度的比例（0 = 内容正好贴边）。
   * 加载时用顶点轮廓量一次：名牌靠 `bottomTrim` 贴到真正的脚下，
   * 说话气泡靠 `topTrim` 停在真正的头顶上方 —— 两个方向都不能按固定比例猜。
   */
  topTrim: number
  bottomTrim: number
}

type CoreModelLike = {
  getParameterCount?: () => number
  getParameterValueByIndex?: (index: number) => number
  setParameterValueByIndex?: (index: number, value: number) => void
  multiplyParameterValueById?: (id: string, value: number) => void
  setParameterValueById?: (id: string, value: number) => void
  addParameterValueById?: (id: string, value: number) => void
}

type Live2DProps = {
  models: Live2DModelConfig[]
  activeModelId?: string
  onActivateModel?: (id: string) => void
  onModelStateChange?: (id: string, state: Live2DLoadState, message?: string) => void
  /** 是否在角色下方显示名称名牌（弹窗预览里不要，那里只看模型本身） */
  showNames?: boolean
}

const DEFAULT_POSITION = { x: 0.5, y: 0.54 }

// 气泡跟着模型大小走：以默认大小（0.6）时模型占舞台高度的比例作为 1 倍基准，
// 这样换分辨率时气泡与模型的比例也保持一致（实测默认大小下模型约占 43%）。
const BUBBLE_REFERENCE_HEIGHT_RATIO = 0.43
/**
 * 气泡尾巴伸出气泡底边的距离（`--bubble-scale` 为 1 时）。
 *
 * 尾巴是 `::after` 里一个 18px 的方块旋转 45°、`bottom: -10px`：
 * 中心落在气泡底边下方 1px 处，菱形下尖再往下 18 × √2 / 2 ≈ 12.73px，合计约 13.7px。
 * **改 SCSS 里尾巴的尺寸或 `bottom` 时，这个数要跟着改** —— 否则气泡会贴着头发或者飘开。
 */
const BUBBLE_TAIL_DROP = 13.7
// 尾巴尖和角色头顶之间留的这点缝，固定值，不随气泡缩放
const BUBBLE_HEAD_GAP = 4
// 夹紧范围：太小的模型也要保证气泡可读，太大的模型别让气泡盖住半个舞台
const BUBBLE_SCALE_MIN = 0.7
const BUBBLE_SCALE_MAX = 1.45

// 名称名牌挂在模型「真正画到哪里」的下方。不能直接用包围盒底边：
// `getBounds()` 是几何包围盒，画布底下那圈透明边距也算在内，而且**每个模型空得不一样**
// （有的几乎贴底，有的能空出 18%）—— 按固定比例往上收，留白少的模型就会被名牌压住。
// 所以加载时读一次顶点轮廓，量出真实的底边（见 measureSilhouette）。
// 名牌顶边和内容底边之间留的这点缝，固定值，不随模型缩放
const NAMEPLATE_GAP = 4
// 名牌离舞台边缘至少留这么多。模型贴边时名牌会伸到舞台外，而 .preview 是
// overflow: hidden —— 掉出去就只剩半个字，所以定位时要夹回来
const NAMEPLATE_EDGE_GAP = 6

const createEntry = (model: Live2DModelConfig): ModelEntry => ({
  id: model.id,
  modelUrl: model.modelUrl,
  model: null,
  size: model.size,
  zIndex: model.zIndex,
  motion: model.motion,
  initialPosition: model.initialPosition ?? DEFAULT_POSITION,
  positionRatio: model.initialPosition ?? DEFAULT_POSITION,
  positionResetKey: model.positionResetKey,
  expressionKey: '',
  expressionToken: 0,
  expressions: [],
  loadToken: 0,
  drag: { offsetX: 0, offsetY: 0 },
  cleanup: null,
  visible: model.visible ?? true,
  speaking: Boolean(model.speaking),
  overrideMotion: model.overrideMotion ?? '',
  overrideNonce: model.overrideNonce ?? 0,
  motionHoldUntil: model.motionHoldUntil ?? 0,
  topTrim: 0,
  bottomTrim: 0,
})

/**
 * Cubism 的 coreModel 里能拿到每个 drawable 的顶点（已经过当前姿态的变形）。
 * 只声明用到的那几个方法 —— Cubism 2.1 的 coreModel 没有它们，特性检测会兜住。
 */
type CoreModelWithDrawables = {
  getDrawableCount?: () => number
  getDrawableVertexPositions?: (index: number) => Float32Array | undefined
  getDrawableDynamicFlagIsVisible?: (index: number) => boolean
  getDrawableOpacity?: (index: number) => number
  getCanvasHeight?: () => number
}

/**
 * 量出模型「真正画到哪里」：遍历所有 drawable 的顶点，取最高点和最低点，
 * 算出画布上下各空了多少（占画布高度的比例）。
 *
 * 为什么要这么量：`getBounds()` 是几何包围盒，画布上下那两圈透明边距也算在内，
 * **而且每个模型空得不一样** —— 有的几乎贴边，有的能空出十几个百分点。
 * 按固定比例去收，留白少的模型就会被名牌压住（脚下）、被气泡盖住头（头顶）；
 * 反过来一点不收，留白多的模型浮层又飘得老远。两个方向都得实测。
 *
 * 试过用 `renderer.extract.pixels()` 读像素轮廓，这条路走不通：extract 按
 * `getLocalBounds()` 建离屏纹理，而 Live2D 的这个值返回的是**画布原始尺寸**
 * （实测 4068×4068），创建出来的纹理有 66MB，扫一遍要好几秒，还会把主线程卡住。
 * 顶点数量级只有几千，而且是现成的数据，代价可以忽略。
 *
 * 只在模型加载完成时跑一次 —— 留白是模型文件自带的属性，换尺寸、换动作都不影响。
 * 拿不到数据（Cubism 2.1、字段缺失、顶点还没 update）就全返回 0，
 * 两块浮层退回「贴包围盒」：宁可飘一点，也不能压到角色身上。
 */
const measureSilhouette = (model: Live2DModel): { topTrim: number; bottomTrim: number } => {
  const fallback = { topTrim: 0, bottomTrim: 0 }
  try {
    const core = (model.internalModel as unknown as { coreModel?: CoreModelWithDrawables }).coreModel
    const count = core?.getDrawableCount?.() ?? 0
    const canvasHeight = core?.getCanvasHeight?.() ?? 0
    if (!count || !canvasHeight || !core?.getDrawableVertexPositions) return fallback
    // Cubism 的模型坐标以画布中心为原点、y 轴向上，所以最高点 / 最低点就是 maxY / minY。
    // 只统计真正显示出来的 drawable —— 模型里还有一批拿来做遮罩 / 已经移出画面的，
    // 它们的顶点会落在画布外，把范围整个带偏
    let lowest = Number.POSITIVE_INFINITY
    let highest = Number.NEGATIVE_INFINITY
    for (let index = 0; index < count; index += 1) {
      if (core.getDrawableDynamicFlagIsVisible && !core.getDrawableDynamicFlagIsVisible(index)) continue
      if (core.getDrawableOpacity && core.getDrawableOpacity(index) <= 0.01) continue
      const positions = core.getDrawableVertexPositions(index)
      if (!positions) continue
      for (let offset = 1; offset < positions.length; offset += 2) {
        if (positions[offset] < lowest) lowest = positions[offset]
        if (positions[offset] > highest) highest = positions[offset]
      }
    }
    // 顶点还没被 update 过时全是 0，这时候算出来的「留白」是半个画布，
    // 名牌会被推到模型腰上、气泡会盖住整张脸。范围小得离谱就当没量到
    if (!Number.isFinite(lowest) || highest - lowest < 0.01) return fallback
    // 画布上下边分别是 ±canvasHeight / 2，两者之差就是那侧的留白
    const half = canvasHeight / 2
    const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
    return {
      topTrim: clamp01((half - highest) / canvasHeight),
      bottomTrim: clamp01((half + lowest) / canvasHeight),
    }
  } catch (error) {
    console.warn('Live2D overlay: failed to measure the model silhouette', error)
    return fallback
  }
}

const keepModelInsideStage = (app: PIXI.Application, model: Live2DModel, x: number, y: number) => {
  model.x = x
  model.y = y
  let bounds = model.getBounds()
  let correctedX = model.x
  let correctedY = model.y
  if (bounds.width > app.screen.width || bounds.height > app.screen.height) {
    const fitScale = Math.min(
      app.screen.width / Math.max(bounds.width, 1),
      app.screen.height / Math.max(bounds.height, 1),
    ) * 0.98
    model.scale.set(model.scale.x * fitScale)
    bounds = model.getBounds()
  }
  if (bounds.width <= app.screen.width) {
    if (bounds.x < 0) correctedX += -bounds.x
    if (bounds.x + bounds.width > app.screen.width) correctedX -= bounds.x + bounds.width - app.screen.width
  } else {
    correctedX = app.screen.width / 2
  }
  if (bounds.height <= app.screen.height) {
    if (bounds.y < 0) correctedY += -bounds.y
    if (bounds.y + bounds.height > app.screen.height) correctedY -= bounds.y + bounds.height - app.screen.height
  } else {
    correctedY = app.screen.height / 2
  }
  model.x = correctedX
  model.y = correctedY
  return { x: correctedX, y: correctedY }
}

export function Live2D({ models, activeModelId, onActivateModel, onModelStateChange, showNames = true }: Live2DProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const entriesRef = useRef(new Map<string, ModelEntry>())
  const bubbleRefs = useRef(new Map<string, HTMLDivElement>())
  const nameplateRefs = useRef(new Map<string, HTMLDivElement>())
  // 名牌尺寸缓存。字号只跟缩放变，缩放没变就不必再读 offsetWidth/Height
  // （读它们会强制同步重排，而这个函数每 4 帧跑一次）
  const nameplateSizesRef = useRef(new Map<string, { width: number; height: number }>())
  const draggingIdRef = useRef<string | null>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const activeIdRef = useRef(activeModelId)
  const activateRef = useRef(onActivateModel)
  const stateChangeRef = useRef(onModelStateChange)
  const reportedStateRef = useRef<Record<string, Live2DLoadState>>({})
  const [statuses, setStatuses] = useState<Record<string, { status: Live2DLoadState; error: string }>>({})

  activeIdRef.current = activeModelId
  activateRef.current = onActivateModel
  stateChangeRef.current = onModelStateChange

  const updateStatus = (id: string, next: { status: Live2DLoadState; error: string } | null) => {
    if (!mountedRef.current) return
    if (!next) {
      if (reportedStateRef.current[id]) delete reportedStateRef.current[id]
    } else if (reportedStateRef.current[id] !== next.status) {
      reportedStateRef.current[id] = next.status
      stateChangeRef.current?.(id, next.status, next.error)
    }
    setStatuses((current) => {
      if (!next) {
        if (!(id in current)) return current
        const copy = { ...current }
        delete copy[id]
        return copy
      }
      const previous = current[id]
      if (previous && previous.status === next.status && previous.error === next.error) return current
      return { ...current, [id]: next }
    })
  }

  const fitModel = (entry: ModelEntry) => {
    const app = appRef.current
    const model = entry.model
    if (!app || !model) return
    const bounds = model.getLocalBounds()
    const availableWidth = app.screen.width * 0.56
    const availableHeight = app.screen.height * 0.82
    const fitScale = Math.min(
      availableWidth / Math.max(bounds.width, 1),
      availableHeight / Math.max(bounds.height, 1),
    )
    model.scale.set(fitScale * entry.size)
    const ratio = entry.positionRatio ?? entry.initialPosition
    const position = keepModelInsideStage(
      app,
      model,
      ratio.x * app.screen.width,
      ratio.y * app.screen.height,
    )
    entry.positionRatio = {
      x: position.x / Math.max(app.screen.width, 1),
      y: position.y / Math.max(app.screen.height, 1),
    }
  }

  const loadExpressions = async (entry: ModelEntry, selections: ExpressionSelection[]) => {
    const token = ++entry.expressionToken
    if (selections.length === 0) {
      entry.expressions = []
      return
    }
    try {
      const definitions = await Promise.all(selections.map(async ({ file }) => {
        const response = await fetch(new URL(file, new URL(entry.modelUrl, window.location.origin)).toString())
        if (!response.ok) throw new Error(`Expression request failed: ${response.status}`)
        return response.json() as Promise<ExpressionDefinition>
      }))
      if (token === entry.expressionToken) entry.expressions = definitions
    } catch (error) {
      console.error('Live2D expressions failed to load', error)
      if (token === entry.expressionToken) entry.expressions = []
    }
  }

  const attachExpressionHooks = (entry: ModelEntry, model: Live2DModel) => {
    const coreModel = model.internalModel.coreModel as CoreModelLike
    if (typeof coreModel.getParameterCount !== 'function') return
    let baseParameters: number[] | null = null
    const restoreBaseParameters = () => {
      if (!baseParameters || !coreModel.setParameterValueByIndex) return
      for (let index = 0; index < baseParameters.length; index += 1) {
        coreModel.setParameterValueByIndex(index, baseParameters[index])
      }
    }
    const captureBaseParameters = () => {
      if (!coreModel.getParameterValueByIndex || !coreModel.getParameterCount) return
      const count = coreModel.getParameterCount()
      baseParameters = Array.from({ length: count }, (_, index) => coreModel.getParameterValueByIndex?.(index) ?? 0)
    }
    const beforeMotionUpdate = () => restoreBaseParameters()
    const afterMotionUpdate = () => captureBaseParameters()
    const beforeModelUpdate = () => {
      for (const definition of entry.expressions) {
        for (const parameter of definition.Parameters ?? []) {
          if (parameter.Blend === 'Multiply') {
            coreModel.multiplyParameterValueById?.(parameter.Id, parameter.Value)
          } else if (parameter.Blend === 'Overwrite') {
            coreModel.setParameterValueById?.(parameter.Id, parameter.Value)
          } else {
            coreModel.addParameterValueById?.(parameter.Id, parameter.Value)
          }
        }
      }
    }
    model.internalModel.on('beforeMotionUpdate', beforeMotionUpdate)
    model.internalModel.on('afterMotionUpdate', afterMotionUpdate)
    model.internalModel.on('beforeModelUpdate', beforeModelUpdate)
    entry.cleanup = () => {
      model.internalModel.off('beforeMotionUpdate', beforeMotionUpdate)
      model.internalModel.off('afterMotionUpdate', afterMotionUpdate)
      model.internalModel.off('beforeModelUpdate', beforeModelUpdate)
    }
  }

  const loadEntry = async (entry: ModelEntry) => {
    const token = ++entry.loadToken
    updateStatus(entry.id, { status: 'loading', error: '' })
    try {
      const loaded = await Live2DModel.from(entry.modelUrl, { autoInteract: false })
      if (!mountedRef.current || token !== entry.loadToken) {
        loaded.destroy({ children: true })
        return
      }
      const app = appRef.current
      if (!app) {
        loaded.destroy({ children: true })
        return
      }
      entry.model = loaded
      loaded.anchor.set(0.5, 0.5)
      loaded.zIndex = entry.zIndex
      loaded.visible = entry.visible
      app.stage.addChild(loaded)
      attachExpressionHooks(entry, loaded)
      fitModel(entry)
      // 量出画布上下各空了多少：名牌靠它贴到真正的脚下，气泡靠它停在真正的头顶。
      // 放在播动作之前 —— 默认姿态下的轮廓才是稳的
      const silhouette = measureSilhouette(loaded)
      entry.topTrim = silhouette.topTrim
      entry.bottomTrim = silhouette.bottomTrim
      if (entry.motion) void loaded.motion(entry.motion, 0).catch(() => undefined)
      updateStatus(entry.id, { status: 'ready', error: '' })
    } catch (error) {
      console.error('Live2D model failed to load', entry.modelUrl, error)
      const message = error instanceof Error ? error.message : String(error)
      updateStatus(entry.id, {
        status: 'missing',
        error: message.includes('Unknown settings format')
          ? '模型格式不受支持，请确认是 Cubism 2.1 或 Cubism 3/4 模型'
          : '模型资源加载失败，请检查模型地址及跨域设置',
      })
    }
  }

  const disposeEntry = (entry: ModelEntry) => {
    entry.loadToken += 1
    entry.expressionToken += 1
    entry.cleanup?.()
    entry.cleanup = null
    const model = entry.model
    entry.model = null
    if (model) {
      model.parent?.removeChild(model)
      model.destroy({ children: true })
    }
    updateStatus(entry.id, null)
  }

  const applyModelProps = (entry: ModelEntry, next: Live2DModelConfig) => {
    const sizeChanged = entry.size !== next.size
    const resetChanged = entry.positionResetKey !== next.positionResetKey
    const motionChanged = entry.motion !== next.motion
    // 一次性动作（礼物）：只看计数，不看值。值没变但计数变了 = 又触发了一次（连送两个同款礼物）
    const overrideMotion = next.overrideMotion ?? ''
    const overrideTriggered = (next.overrideNonce ?? 0) !== entry.overrideNonce && Boolean(overrideMotion)
    const zChanged = entry.zIndex !== next.zIndex
    const visibleChanged = entry.visible !== (next.visible ?? true)
    // 只在「没说话 → 说话」的那一刻触发一次，气泡常显时不会反复触发
    const speakingStarted = Boolean(next.speaking) && !entry.speaking
    // 礼物动作的独占期还没过：这段时间说话动作让位，礼物优先
    // 用 next 的值判断 —— 下面 entry.motionHoldUntil 马上会被覆盖
    const giftHolding = (next.motionHoldUntil ?? 0) > Date.now()
    const expressionKey = next.expressions.map((item) => item.file).join('|')
    const expressionsChanged = expressionKey !== entry.expressionKey

    entry.size = next.size
    entry.motion = next.motion
    entry.zIndex = next.zIndex
    entry.visible = next.visible ?? true
    entry.speaking = Boolean(next.speaking)
    entry.overrideMotion = overrideMotion
    entry.overrideNonce = next.overrideNonce ?? 0
    entry.motionHoldUntil = next.motionHoldUntil ?? 0
    entry.initialPosition = next.initialPosition ?? DEFAULT_POSITION
    if (resetChanged) {
      entry.positionResetKey = next.positionResetKey
      entry.positionRatio = entry.initialPosition
    }

    const model = entry.model
    if (!model) {
      if (expressionsChanged) {
        entry.expressionKey = expressionKey
        void loadExpressions(entry, next.expressions)
      }
      return
    }
    if (zChanged) model.zIndex = next.zIndex
    if (visibleChanged) model.visible = entry.visible
    if (sizeChanged || resetChanged) fitModel(entry)
    // 三档优先级：换预设 > 礼物等一次性动作 > 开口时重播预设。
    // 必须是一条 else 链 —— 同一帧连调两次 model.motion() 会把动作从头重启
    if (motionChanged && next.motion) {
      void model.motion(next.motion, 0).catch(() => undefined)
    } else if (overrideTriggered) {
      void model.motion(overrideMotion, 0).catch(() => undefined)
    } else if (speakingStarted && next.motion && !giftHolding) {
      // 「动作预设」里选中的那一项兼任说话触发动作：开口时把当前动作重播一遍；
      // giftHolding 期间让位，礼物动作优先
      void model.motion(next.motion, 0).catch(() => undefined)
    }
    if (expressionsChanged) {
      entry.expressionKey = expressionKey
      void loadExpressions(entry, next.expressions)
    }
  }

  const syncModels = (nextModels: Live2DModelConfig[]) => {
    const app = appRef.current
    if (!app) return
    const entries = entriesRef.current
    const alive = new Set(nextModels.map((item) => item.id))
    for (const [id, entry] of Array.from(entries.entries())) {
      if (!alive.has(id)) {
        disposeEntry(entry)
        entries.delete(id)
      }
    }
    for (const next of nextModels) {
      let entry = entries.get(next.id)
      if (!entry || entry.modelUrl !== next.modelUrl) {
        if (entry) disposeEntry(entry)
        entry = createEntry(next)
        entries.set(next.id, entry)
        void loadEntry(entry)
      }
      applyModelProps(entry, next)
    }
  }

  const stagePoint = (clientX: number, clientY: number) => {
    const app = appRef.current
    const host = canvasHostRef.current
    if (!app || !host) return null
    const rect = host.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / Math.max(rect.width, 1)) * app.screen.width,
      y: ((clientY - rect.top) / Math.max(rect.height, 1)) * app.screen.height,
    }
  }

  const findEntryAt = (point: { x: number; y: number }) => {
    const activeId = activeIdRef.current
    const candidates = Array.from(entriesRef.current.values())
      .filter((entry) => entry.model?.visible)
      .sort((left, right) => {
        const leftActive = left.id === activeId ? 1 : 0
        const rightActive = right.id === activeId ? 1 : 0
        if (leftActive !== rightActive) return rightActive - leftActive
        return right.zIndex - left.zIndex
      })
    return candidates.find((entry) => entry.model?.getBounds().contains(point.x, point.y)) ?? null
  }

  /**
   * 把两块 HTML 浮层贴到各自的模型上：头顶的说话气泡、脚下的名称名牌。
   * 每 4 帧跑一次，别在里面做重活 —— getBounds 只算一次，两个浮层共用。
   */
  const updateOverlays = () => {
    const app = appRef.current
    const host = canvasHostRef.current
    if (!app || !host) return
    const scaleX = (host.clientWidth || 1) / Math.max(app.screen.width, 1)
    const scaleY = (host.clientHeight || 1) / Math.max(app.screen.height, 1)
    const referenceHeight = Math.max(host.clientHeight, 1) * BUBBLE_REFERENCE_HEIGHT_RATIO

    for (const [id, entry] of entriesRef.current) {
      const bubble = bubbleRefs.current.get(id)
      const nameplate = nameplateRefs.current.get(id)
      if (!bubble && !nameplate) continue
      const model = entry.model
      // 模型没就绪或已被隐藏（「隐藏模型」）时，两块浮层一起收起来
      if (!model || !model.visible) {
        if (bubble) bubble.style.visibility = 'hidden'
        if (nameplate) nameplate.style.visibility = 'hidden'
        continue
      }
      const bounds = model.getBounds()

      // 气泡和名牌共用一套缩放：字号/内边距/最大宽度都由 --bubble-scale 换算，
      // 跟着模型视觉高度等比变化，换分辨率时比例也不会走样
      const overlayScale = Math.min(
        BUBBLE_SCALE_MAX,
        Math.max(BUBBLE_SCALE_MIN, (bounds.height * scaleY) / referenceHeight),
      )
      const scaleValue = overlayScale.toFixed(3)
      const centerX = (bounds.x + bounds.width / 2) * scaleX

      if (bubble) {
        // 和元素上**当前**的值比，而不是在 ref 里记一份：两块浮层挂载时机不同
        // （模型一加载就有名牌，气泡要等它开口或切「常显」才出现），共用一份缓存
        // 会让后挂载的那个被误判成「已经写过」而跳过，停在 CSS 默认的 1 上
        if (bubble.style.getPropertyValue('--bubble-scale') !== scaleValue) {
          bubble.style.setProperty('--bubble-scale', scaleValue)
        }
        bubble.style.visibility = 'visible'
        bubble.style.left = `${centerX}px`
        // 气泡底边（= 尾巴根部）落在角色真正画到的头顶上方：尾巴尖再往下伸
        // BUBBLE_TAIL_DROP 那么长，所以整体还要多抬这么一截，否则菱形会插进头发里。
        // 头顶已经顶到舞台上沿时只能贴着顶放 —— 被 overflow: hidden 裁掉更糟
        const contentTop = (bounds.y + bounds.height * entry.topTrim) * scaleY
        bubble.style.top = `${Math.max(0, contentTop - BUBBLE_TAIL_DROP * overlayScale - BUBBLE_HEAD_GAP)}px`
      }

      if (nameplate) {
        if (nameplate.style.getPropertyValue('--bubble-scale') !== scaleValue) {
          nameplate.style.setProperty('--bubble-scale', scaleValue)
          // 字号变了名牌尺寸也跟着变，之前量的作废
          nameplateSizesRef.current.delete(id)
        }
        nameplate.style.visibility = 'visible'
        let size = nameplateSizesRef.current.get(id)
        if (!size) {
          size = { width: nameplate.offsetWidth, height: nameplate.offsetHeight }
          nameplateSizesRef.current.set(id, size)
        }
        // 贴到模型真正画到的位置再往下留一点缝，画布底下那圈透明边距不算数
        const rawTop = (bounds.y + bounds.height * (1 - entry.bottomTrim)) * scaleY + NAMEPLATE_GAP
        // 四个边都夹一遍：模型贴边、名字又长的时候，名牌不能伸到舞台外面去
        const halfWidth = size.width / 2
        const maxTop = Math.max(0, host.clientHeight - size.height - NAMEPLATE_EDGE_GAP)
        const maxLeft = Math.max(halfWidth, host.clientWidth - halfWidth - NAMEPLATE_EDGE_GAP)
        nameplate.style.top = `${Math.min(maxTop, Math.max(0, rawTop))}px`
        nameplate.style.left = `${Math.min(maxLeft, Math.max(halfWidth, centerX))}px`
      }
    }
  }

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return
    mountedRef.current = true
    ;(window as Window & { PIXI?: typeof PIXI }).PIXI = PIXI
    Live2DModel.registerTicker(PIXI.Ticker)

    let app: PIXI.Application
    try {
      app = new PIXI.Application({ backgroundAlpha: 0, resizeTo: host, antialias: true })
    } catch (error) {
      console.error('Live2D failed to create the WebGL renderer', error)
      return
    }
    app.stage.sortableChildren = true
    host.appendChild(app.view as HTMLCanvasElement)
    appRef.current = app

    let frame = 0
    const tick = () => {
      frame += 1
      if (frame % 4 === 0) updateOverlays()
    }
    const handleResize = () => {
      for (const entry of entriesRef.current.values()) fitModel(entry)
    }
    app.ticker.add(tick)
    app.renderer.on('resize', handleResize)
    syncModels(models)

    return () => {
      mountedRef.current = false
      app.ticker.remove(tick)
      app.renderer.off('resize', handleResize)
      for (const entry of entriesRef.current.values()) disposeEntry(entry)
      entriesRef.current.clear()
      bubbleRefs.current.clear()
      nameplateRefs.current.clear()
      nameplateSizesRef.current.clear()
      appRef.current = null
      app.destroy(true, { children: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    syncModels(models)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models])

  useLayoutEffect(() => {
    updateOverlays()
  })

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const point = stagePoint(event.clientX, event.clientY)
    if (!point) return
    const entry = findEntryAt(point)
    if (!entry?.model) return
    activateRef.current?.(entry.id)
    entry.drag.offsetX = point.x - entry.model.x
    entry.drag.offsetY = point.y - entry.model.y
    draggingIdRef.current = entry.id
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const app = appRef.current
    const point = stagePoint(event.clientX, event.clientY)
    if (!app || !point) return

    const draggingId = draggingIdRef.current
    if (draggingId) {
      const entry = entriesRef.current.get(draggingId)
      if (!entry?.model) return
      const position = keepModelInsideStage(
        app,
        entry.model,
        point.x - entry.drag.offsetX,
        point.y - entry.drag.offsetY,
      )
      entry.positionRatio = {
        x: position.x / Math.max(app.screen.width, 1),
        y: position.y / Math.max(app.screen.height, 1),
      }
      event.preventDefault()
      return
    }

    const hit = findEntryAt(point)
    if (hit?.id === hoveredIdRef.current) {
      hit?.model?.focus(point.x, point.y)
      return
    }
    const previous = hoveredIdRef.current ? entriesRef.current.get(hoveredIdRef.current) : null
    previous?.model?.focus(app.screen.width / 2, app.screen.height * 0.42)
    hoveredIdRef.current = hit?.id ?? null
    hit?.model?.focus(point.x, point.y)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingIdRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePointerLeave = () => {
    draggingIdRef.current = null
    hoveredIdRef.current = null
  }

  // 加载态合并成一条提示：不管同时有几个模型在加载，都只显示一个
  const loadingCount = models.filter((model) => statuses[model.id]?.status === 'loading').length
  // 失败态保留逐条展示，每个模型的错误原因可能不同
  const failures = models
    .map((model) => ({ model, state: statuses[model.id] }))
    .filter((item): item is { model: Live2DModelConfig; state: { status: Live2DLoadState; error: string } } => (
      Boolean(item.state) && item.state!.status === 'missing'
    ))

  return (
    <div
      className={styles.live2d}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div className={styles.canvas} ref={canvasHostRef} aria-hidden="true" />
      {showNames && models.map((model) => (model.name && model.nameplate !== false ? (
        <div
          key={`name-${model.id}`}
          className={styles.nameplate}
          data-nameplate={model.id}
          ref={(element) => {
            if (element) {
              nameplateRefs.current.set(model.id, element)
            } else {
              nameplateRefs.current.delete(model.id)
              // 卸载后缓存的量高也要清掉，否则重新挂载会拿旧值去算夹紧位置
              nameplateSizesRef.current.delete(model.id)
            }
          }}
        >
          {model.name}
        </div>
      ) : null))}
      {models.filter((model) => model.speechText).map((model) => (
        <div
          key={model.id}
          className={styles.bubble}
          ref={(element) => {
            if (element) {
              bubbleRefs.current.set(model.id, element)
            } else {
              bubbleRefs.current.delete(model.id)
            }
          }}
        >
          {model.speechText}
        </div>
      ))}
      {(loadingCount > 0 || failures.length > 0) && (
        <div className={styles.status} aria-live="polite">
          {loadingCount > 0 && (
            <div className={styles.state}>
              <span className={styles.dot} />
              <span>正在加载模型</span>
            </div>
          )}
          {failures.map(({ model, state }) => (
            <div className={styles.state} key={model.id}>
              <span className={cx(styles.dot, styles.dotWarning)} />
              <span>模型加载失败</span>
              <small>{state.error || '请检查模型资源及跨域设置'}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
