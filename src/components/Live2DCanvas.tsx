import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display'

type ExpressionSelection = { name: string; file: string }
type ExpressionDefinition = {
  Parameters?: Array<{ Id: string; Value: number; Blend?: 'Add' | 'Multiply' | 'Overwrite' }>
}
type Live2DCanvasProps = {
  modelUrl: string
  motion: string
  expressions: ExpressionSelection[]
  size: number
  positionResetKey: number
  initialPosition?: { x: number; y: number }
  onLoadStateChange?: (state: 'loading' | 'ready' | 'missing') => void
}

export type Live2DCanvasHandle = {
  hitTest: (clientX: number, clientY: number) => boolean
  beginDrag: (clientX: number, clientY: number) => boolean
  moveDrag: (clientX: number, clientY: number) => void
  endDrag: () => void
}

export const Live2DCanvas = forwardRef<Live2DCanvasHandle, Live2DCanvasProps>(function Live2DCanvas({ modelUrl, motion, expressions, size, positionResetKey, initialPosition, onLoadStateChange }, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<Live2DModel<any> | null>(null)
  const expressionStackRef = useRef<ExpressionDefinition[]>([])
  const sizeRef = useRef(size)
  const positionRatioRef = useRef<{ x: number; y: number } | null>(initialPosition ?? null)
  const initialPositionRef = useRef(initialPosition ?? null)
  const fitModelRef = useRef<(() => void) | null>(null)
  const interactionApiRef = useRef<Live2DCanvasHandle | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useImperativeHandle(ref, () => ({
    hitTest: (clientX, clientY) => interactionApiRef.current?.hitTest(clientX, clientY) ?? false,
    beginDrag: (clientX, clientY) => interactionApiRef.current?.beginDrag(clientX, clientY) ?? false,
    moveDrag: (clientX, clientY) => interactionApiRef.current?.moveDrag(clientX, clientY),
    endDrag: () => interactionApiRef.current?.endDrag(),
  }), [])

  const updateStatus = (nextStatus: 'loading' | 'ready' | 'missing') => {
    setStatus(nextStatus)
    onLoadStateChange?.(nextStatus)
  }

  useEffect(() => {
    updateStatus('loading')
    ;(window as Window & { PIXI?: typeof PIXI }).PIXI = PIXI
    Live2DModel.registerTicker(PIXI.Ticker)

    const host = hostRef.current
    if (!host) return
    let app: PIXI.Application
    try {
      app = new PIXI.Application({ backgroundAlpha: 0, resizeTo: host, antialias: true })
    } catch {
      updateStatus('missing')
      return
    }
    host.appendChild(app.view as HTMLCanvasElement)

    let disposed = false
    let removeExpressionHooks: (() => void) | null = null
    let removeDragHandlers: (() => void) | null = null
    Live2DModel.from(modelUrl, { autoInteract: true })
      .then((loaded) => {
        if (disposed) return
        const model = loaded as Live2DModel<any>
        modelRef.current = model
        model.anchor.set(0.5, 0.5)
        app.stage.addChild(model)
        const keepModelInsideStage = (x: number, y: number) => {
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
        const fitModel = () => {
          const bounds = model.getLocalBounds()
          const availableWidth = app.screen.width * 0.56
          const availableHeight = app.screen.height * 0.82
          const fitScale = Math.min(
            availableWidth / Math.max(bounds.width, 1),
            availableHeight / Math.max(bounds.height, 1),
          )
          model.scale.set(fitScale * sizeRef.current)
          const positionRatio = positionRatioRef.current
          const position = keepModelInsideStage(
            positionRatio ? positionRatio.x * app.screen.width : app.screen.width / 2,
            positionRatio ? positionRatio.y * app.screen.height : app.screen.height * 0.54,
          )
          positionRatioRef.current = {
            x: position.x / Math.max(app.screen.width, 1),
            y: position.y / Math.max(app.screen.height, 1),
          }
        }
        fitModelRef.current = fitModel
        fitModel()

        let dragging = false
        let offsetX = 0
        let offsetY = 0
        const stopDragging = () => {
          if (!dragging) return
          dragging = false
        }
        const hitTest = (clientX: number, clientY: number) => {
          const rect = app.view.getBoundingClientRect()
          const point = {
            x: ((clientX - rect.left) / Math.max(rect.width, 1)) * app.screen.width,
            y: ((clientY - rect.top) / Math.max(rect.height, 1)) * app.screen.height,
          }
          return model.getBounds().contains(point.x, point.y)
        }
        const beginDrag = (clientX: number, clientY: number) => {
          const rect = app.view.getBoundingClientRect()
          const point = {
            x: ((clientX - rect.left) / Math.max(rect.width, 1)) * app.screen.width,
            y: ((clientY - rect.top) / Math.max(rect.height, 1)) * app.screen.height,
          }
          if (!model.getBounds().contains(point.x, point.y)) return false
          dragging = true
          offsetX = point.x - model.x
          offsetY = point.y - model.y
          return true
        }
        const moveDrag = (clientX: number, clientY: number) => {
          if (!dragging) return
          const rect = app.view.getBoundingClientRect()
          const point = {
            x: ((clientX - rect.left) / Math.max(rect.width, 1)) * app.screen.width,
            y: ((clientY - rect.top) / Math.max(rect.height, 1)) * app.screen.height,
          }
          const position = keepModelInsideStage(point.x - offsetX, point.y - offsetY)
          positionRatioRef.current = {
            x: position.x / Math.max(app.screen.width, 1),
            y: position.y / Math.max(app.screen.height, 1),
          }
        }
        interactionApiRef.current = { hitTest, beginDrag, moveDrag, endDrag: stopDragging }
        removeDragHandlers = () => { stopDragging(); interactionApiRef.current = null }
        const coreModel = model.internalModel.coreModel as {
          getParameterCount?: () => number
          getParameterValueByIndex?: (index: number) => number
          setParameterValueByIndex?: (index: number, value: number) => void
          multiplyParameterValueById?: (id: string, value: number) => void
          setParameterValueById?: (id: string, value: number) => void
          addParameterValueById?: (id: string, value: number) => void
        }
        if (typeof coreModel.getParameterCount === 'function') {
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
            for (const definition of expressionStackRef.current) {
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
          removeExpressionHooks = () => {
            model.internalModel.off('beforeMotionUpdate', beforeMotionUpdate)
            model.internalModel.off('afterMotionUpdate', afterMotionUpdate)
            model.internalModel.off('beforeModelUpdate', beforeModelUpdate)
          }
        }
        setErrorMessage('')
        updateStatus('ready')
      })
      .catch((error) => {
        console.error('Live2D model failed to load', error)
        const message = error instanceof Error ? error.message : String(error)
        setErrorMessage(message.includes('Unknown settings format')
          ? '模型格式不受支持，请确认是 Cubism 2.1 或 Cubism 3/4 模型'
          : '模型资源加载失败，请检查模型地址及跨域设置')
        updateStatus('missing')
      })

    const resize = () => {
      fitModelRef.current?.()
    }
    window.addEventListener('resize', resize)
    return () => {
      disposed = true
      fitModelRef.current = null
      modelRef.current = null
      expressionStackRef.current = []
      window.removeEventListener('resize', resize)
      removeDragHandlers?.()
      removeExpressionHooks?.()
      app.destroy(true, { children: true, texture: true, baseTexture: true })
    }
  }, [modelUrl])

  useEffect(() => {
    let cancelled = false
    const loadExpressions = async () => {
      try {
        const definitions = await Promise.all(expressions.map(async ({ file }) => {
          const response = await fetch(new URL(file, new URL(modelUrl, window.location.origin)).toString())
          if (!response.ok) throw new Error(`Expression request failed: ${response.status}`)
          return response.json() as Promise<ExpressionDefinition>
        }))
        if (!cancelled) expressionStackRef.current = definitions
      } catch (error) {
        console.error('Live2D expressions failed to load', error)
        if (!cancelled) expressionStackRef.current = []
      }
    }
    void loadExpressions()
    return () => {
      cancelled = true
      expressionStackRef.current = []
    }
  }, [expressions, modelUrl])

  useEffect(() => {
    sizeRef.current = size
    fitModelRef.current?.()
  }, [size])

  useEffect(() => {
    positionRatioRef.current = initialPositionRef.current
    fitModelRef.current?.()
  }, [positionResetKey])

  useEffect(() => {
    if (status === 'ready' && motion) modelRef.current?.motion(motion, 0)
  }, [motion, status])

  return (
    <div className="live2d-stage" ref={hostRef}>
      {status !== 'ready' && (
        <div className="model-state">
          <span className={status === 'missing' ? 'state-dot warning' : 'state-dot'} />
          <span>{status === 'missing' ? '模型加载失败' : '正在加载模型'}</span>
          {status === 'missing' && <small>{errorMessage || '请检查模型资源及跨域设置'}</small>}
        </div>
      )}
    </div>
  )
})
