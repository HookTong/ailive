import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

type ExpressionSelection = { name: string; file: string }

type ExpressionDefinition = {
  Parameters?: Array<{ Id: string; Value: number; Blend?: 'Add' | 'Multiply' | 'Overwrite' }>
}

export type StageModel = {
  id: string
  modelUrl: string
  motion: string
  expressions: ExpressionSelection[]
  size: number
  positionResetKey: number
  initialPosition?: { x: number; y: number }
  zIndex: number
  speechText?: string
}

export type StageLoadState = 'loading' | 'ready' | 'missing'

type StageEntry = {
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
}

type CoreModelLike = {
  getParameterCount?: () => number
  getParameterValueByIndex?: (index: number) => number
  setParameterValueByIndex?: (index: number, value: number) => void
  multiplyParameterValueById?: (id: string, value: number) => void
  setParameterValueById?: (id: string, value: number) => void
  addParameterValueById?: (id: string, value: number) => void
}

type StageProps = {
  models: StageModel[]
  activeModelId?: string
  onActivateModel?: (id: string) => void
  /** 模型加载状态变化时回调（弹窗预览用它判断能不能点「添加」） */
  onModelStateChange?: (id: string, state: StageLoadState, message?: string) => void
}

const DEFAULT_POSITION = { x: 0.5, y: 0.54 }

const createEntry = (model: StageModel): StageEntry => ({
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
})

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

/**
 * 一个 Stage 实例 = 一个 PIXI 应用 + 一张 canvas。
 * 传进来的所有 Live2D 模型都作为 app.stage 的子节点，靠 zIndex 决定前后层级，
 * 所以「一个舞台不管放多少模型都只有一张 canvas」。
 * 首页和弹窗预览各自挂一个 Stage 实例即可。
 */
export function Stage({ models, activeModelId, onActivateModel, onModelStateChange }: StageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const entriesRef = useRef(new Map<string, StageEntry>())
  const bubbleRefs = useRef(new Map<string, HTMLDivElement>())
  const draggingIdRef = useRef<string | null>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const mountedRef = useRef(false)
  const activeIdRef = useRef(activeModelId)
  const activateRef = useRef(onActivateModel)
  const stateChangeRef = useRef(onModelStateChange)
  const reportedStateRef = useRef<Record<string, StageLoadState>>({})
  const [statuses, setStatuses] = useState<Record<string, { status: StageLoadState; error: string }>>({})

  activeIdRef.current = activeModelId
  activateRef.current = onActivateModel
  stateChangeRef.current = onModelStateChange

  const updateStatus = (id: string, next: { status: StageLoadState; error: string } | null) => {
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

  const fitModel = (entry: StageEntry) => {
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

  const loadExpressions = async (entry: StageEntry, selections: ExpressionSelection[]) => {
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

  const attachExpressionHooks = (entry: StageEntry, model: Live2DModel) => {
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

  const loadEntry = async (entry: StageEntry) => {
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
      app.stage.addChild(loaded)
      attachExpressionHooks(entry, loaded)
      fitModel(entry)
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

  const disposeEntry = (entry: StageEntry) => {
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

  const applyModelProps = (entry: StageEntry, next: StageModel) => {
    const sizeChanged = entry.size !== next.size
    const resetChanged = entry.positionResetKey !== next.positionResetKey
    const motionChanged = entry.motion !== next.motion
    const zChanged = entry.zIndex !== next.zIndex
    const expressionKey = next.expressions.map((item) => item.file).join('|')
    const expressionsChanged = expressionKey !== entry.expressionKey

    entry.size = next.size
    entry.motion = next.motion
    entry.zIndex = next.zIndex
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
    if (sizeChanged || resetChanged) fitModel(entry)
    if (motionChanged && next.motion) void model.motion(next.motion, 0).catch(() => undefined)
    if (expressionsChanged) {
      entry.expressionKey = expressionKey
      void loadExpressions(entry, next.expressions)
    }
  }

  const syncModels = (nextModels: StageModel[]) => {
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
      .filter((entry) => entry.model)
      .sort((left, right) => {
        const leftActive = left.id === activeId ? 1 : 0
        const rightActive = right.id === activeId ? 1 : 0
        if (leftActive !== rightActive) return rightActive - leftActive
        return right.zIndex - left.zIndex
      })
    return candidates.find((entry) => entry.model?.getBounds().contains(point.x, point.y)) ?? null
  }

  const updateBubbles = () => {
    const app = appRef.current
    const host = canvasHostRef.current
    if (!app || !host || bubbleRefs.current.size === 0) return
    const scaleX = (host.clientWidth || 1) / Math.max(app.screen.width, 1)
    const scaleY = (host.clientHeight || 1) / Math.max(app.screen.height, 1)
    for (const [id, element] of bubbleRefs.current) {
      const model = entriesRef.current.get(id)?.model
      if (!model) {
        element.style.visibility = 'hidden'
        continue
      }
      const bounds = model.getBounds()
      element.style.visibility = 'visible'
      element.style.left = `${(bounds.x + bounds.width / 2) * scaleX}px`
      element.style.top = `${(bounds.y + bounds.height * 0.06) * scaleY}px`
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
      console.error('Stage failed to create the WebGL renderer', error)
      return
    }
    app.stage.sortableChildren = true
    host.appendChild(app.view as HTMLCanvasElement)
    appRef.current = app

    let frame = 0
    const tick = () => {
      frame += 1
      if (frame % 4 === 0) updateBubbles()
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
      appRef.current = null
      app.destroy(true, { children: true })
    }
    // 只在挂载时创建一次渲染器，后续模型变更由下面的同步 effect 处理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    syncModels(models)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models])

  useLayoutEffect(() => {
    updateBubbles()
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

  const pending = models
    .map((model) => ({ model, state: statuses[model.id] }))
    .filter((item): item is { model: StageModel; state: { status: StageLoadState; error: string } } => Boolean(item.state) && item.state!.status !== 'ready')

  return (
    <div
      className={styles.stage}
      ref={hostRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div className={styles.canvas} ref={canvasHostRef} aria-hidden="true" />
      {models.filter((model) => model.speechText).map((model) => (
        <div
          key={model.id}
          className={styles.bubble}
          ref={(element) => {
            if (element) bubbleRefs.current.set(model.id, element)
            else bubbleRefs.current.delete(model.id)
          }}
        >
          {model.speechText}
        </div>
      ))}
      {pending.length > 0 && (
        <div className={styles.status} aria-live="polite">
          {pending.map(({ model, state }) => (
            <div className={styles.state} key={model.id}>
              <span className={cx(styles.dot, state.status === 'missing' && styles.dotWarning)} />
              <span>{state.status === 'missing' ? '模型加载失败' : '正在加载模型'}</span>
              {state.status === 'missing' && <small>{state.error || '请检查模型资源及跨域设置'}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
