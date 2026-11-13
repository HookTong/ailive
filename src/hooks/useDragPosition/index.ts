import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

type UseDragPositionOptions = {
  /** 拖动过程中附加到被移动元素上的类名（由调用方从自己的 CSS Module 传入） */
  draggingClassName?: string
  /**
   * 尺寸变了就把位置重新夹回舞台里。传卡片当前的缩放倍数即可 ——
   * 浮层放大后视觉尺寸变大，`transform` 不会自己收回，边缘就伸出舞台了。
   */
  scale?: number
  /**
   * 复位令牌：数字一变就把位移归零，回到 CSS 里的默认位置。
   *
   * 位置是各卡自己的局部 state，面板没法直接清，只能靠这条单向信号通知。
   */
  resetToken?: number
}

// 这些元素上的按下手势留给它们自己，不触发拖动
const INTERACTIVE = 'button, input, select, textarea, a, [role="button"]'

/**
 * 「最后被按下的卡片排最前」的计数器。
 *
 * 四张卡可以拖到互相重叠，层级原本写死在 CSS 里（8 / 9）—— 拖一张被压住的卡片时，
 * 手指按下的那一半还在邻居底下，看着像没抓住。所以谁被按下就把层级顶到当前最高。
 *
 * 放模块级而不是每张卡自己的 state：四张卡得共享同一个顺序。
 * 松手后不还原 —— 一放手就缩回邻居底下，等于白拖。
 * 起始 9：第一张被拖的卡片拿到 10，比写死的 8 / 9 都高。
 */
let topZIndex = 9

/**
 * 元素当前的 `zoom`。
 *
 * 浮层用 `zoom` 做等比放大，而 `offsetLeft` / `offsetWidth` 在 zoom 下仍然是**布局值**，
 * `stage.clientWidth` 却是屏幕值，两者差一个 zoom 倍数 —— 拖动和边界都得按布局值算，
 * `transform: translate` 里的 px 才会被浏览器再乘回去。
 */
function zoomOf(element: HTMLElement): number {
  const zoom = Number.parseFloat(getComputedStyle(element).zoom)
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

/**
 * 让绝对定位的元素在父容器内自由拖动，并夹紧在父容器边界内。
 *
 * `ref` 挂在被移动的元素上，`handlers` 可以挂在它自己身上，
 * 也可以挂到它内部的某个拖拽手柄（例如面板标题栏）上。
 */
export function useDragPosition<T extends HTMLElement = HTMLDivElement>({ draggingClassName, scale, resetToken }: UseDragPositionOptions = {}) {
  const ref = useRef<T>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  /** 拖动过之后才有的内联层级；`undefined` 时落回 CSS 里写的那一档 */
  const [zIndex, setZIndex] = useState<number>()
  const clampRef = useRef<{ observer: ResizeObserver; node: HTMLElement } | null>(null)

  /** 把当前位移夹回舞台。全按布局坐标算，zoom 在括号里除掉了 */
  const clampToStage = useCallback(() => {
    const container = ref.current
    const stage = container?.parentElement
    if (!container || !stage) return
    const zoom = zoomOf(container)
    const minX = -container.offsetLeft
    const minY = -container.offsetTop
    const maxX = Math.max(minX, stage.clientWidth / zoom - container.offsetLeft - container.offsetWidth)
    const maxY = Math.max(minY, stage.clientHeight / zoom - container.offsetTop - container.offsetHeight)
    setPosition((current) => {
      const x = Math.min(Math.max(current.x, minX), maxX)
      const y = Math.min(Math.max(current.y, minY), maxY)
      return x === current.x && y === current.y ? current : { x, y }
    })
  }, [])

  // 缩放倍数变了（滑块在动）就把卡片拉回舞台内。`zoom` 不改布局尺寸，
  // ResizeObserver 看不到它，只能靠这个依赖触发
  useEffect(() => {
    if (scale === undefined) return
    clampToStage()
  }, [scale, clampToStage])

  // 面板点了「复位」：位移归零，回到 CSS 里写好的默认位置。
  // 已经是 0 就返回原对象，别为一次点击平白多渲染一轮
  useEffect(() => {
    if (resetToken === undefined) return
    setPosition((current) => (current.x === 0 && current.y === 0 ? current : { x: 0, y: 0 }))
    // 层级也一起还原：复位之后四张卡应该回到原来那套前后关系
    setZIndex(undefined)
  }, [resetToken])

  /**
   * 容器尺寸变了也重新夹一次。
   *
   * 只认**宽度**变化：高度是内容驱动的（弹幕一多就长高），跟着它夹的话，
   * 每来一条弹幕卡片都会往上跳一下。
   *
   * 绑在第一次拖动时而不是 effect 里：`GiftMotionCard` / `ChatCommandCard` 在没配
   * 内容时整块 `return null`，挂载那一刻 `ref` 还是空的，effect 只跑一次就再也绑不上。
   * 而没被拖过的卡片 `position` 恒为 0，本来也不需要夹。
   */
  const ensureResizeClamp = () => {
    const container = ref.current
    if (!container) return
    if (clampRef.current?.node === container) return
    clampRef.current?.observer.disconnect()

    let lastWidth = container.offsetWidth
    const observer = new ResizeObserver(() => {
      const width = container.offsetWidth
      if (width === lastWidth) return
      lastWidth = width
      clampToStage()
    })
    observer.observe(container)
    clampRef.current = { observer, node: container }
  }

  useEffect(() => () => { clampRef.current?.observer.disconnect() }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return
    const container = ref.current
    const stage = container?.parentElement
    if (!container || !stage) return
    ensureResizeClamp()
    // 顶到最前。放在 INTERACTIVE 守卫之后：点卡片里的按钮不算「拖这张卡」
    setZIndex(++topZIndex)
    const rect = container.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
    // 捕获在「事件源」上：handlers 可能挂在容器自身，也可能挂在内部的手柄上，
    // 捕获在容器上会让手柄收不到后续的 pointermove。
    event.currentTarget.setPointerCapture(event.pointerId)
    if (draggingClassName) container.classList.add(draggingClassName)
    event.preventDefault()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    const container = ref.current
    const stage = container?.parentElement
    if (!drag || !container || !stage || drag.pointerId !== event.pointerId) return
    const zoom = zoomOf(container)
    const stageRect = stage.getBoundingClientRect()
    const baseLeft = container.offsetLeft
    const baseTop = container.offsetTop
    const minX = -baseLeft
    const minY = -baseTop
    const maxX = Math.max(minX, stage.clientWidth / zoom - baseLeft - container.offsetWidth)
    const maxY = Math.max(minY, stage.clientHeight / zoom - baseTop - container.offsetHeight)
    // 指针位移是屏幕像素，除以 zoom 换算成卡片的布局像素
    const nextX = (event.clientX - stageRect.left - drag.offsetX) / zoom - baseLeft
    const nextY = (event.clientY - stageRect.top - drag.offsetY) / zoom - baseTop
    setPosition({
      x: Math.min(Math.max(nextX, minX), maxX),
      y: Math.min(Math.max(nextY, minY), maxY),
    })
    event.preventDefault()
  }

  const stopDragging = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    dragRef.current = null
    if (draggingClassName) ref.current?.classList.remove(draggingClassName)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return {
    ref,
    transform: `translate(${position.x}px, ${position.y}px)`,
    /** 拖动过的卡片带一个内联层级，没拖过的是 `undefined`（走 CSS） */
    zIndex,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: stopDragging,
      onPointerCancel: stopDragging,
    },
  }
}
