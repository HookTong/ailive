import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

type UseDragPositionOptions = {
  /** 拖动过程中附加到被移动元素上的类名（由调用方从自己的 CSS Module 传入） */
  draggingClassName?: string
}

// 这些元素上的按下手势留给它们自己，不触发拖动
const INTERACTIVE = 'button, input, select, textarea, a, [role="button"]'

/**
 * 让绝对定位的元素在父容器内自由拖动，并夹紧在父容器边界内。
 *
 * `ref` 挂在被移动的元素上，`handlers` 可以挂在它自己身上，
 * 也可以挂到它内部的某个拖拽手柄（例如面板标题栏）上。
 */
export function useDragPosition<T extends HTMLElement = HTMLDivElement>({ draggingClassName }: UseDragPositionOptions = {}) {
  const ref = useRef<T>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return
    const container = ref.current
    const stage = container?.parentElement
    if (!container || !stage) return
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
    const stageRect = stage.getBoundingClientRect()
    const baseLeft = container.offsetLeft
    const baseTop = container.offsetTop
    const minX = -baseLeft
    const minY = -baseTop
    const maxX = Math.max(minX, stage.clientWidth - baseLeft - container.offsetWidth)
    const maxY = Math.max(minY, stage.clientHeight - baseTop - container.offsetHeight)
    const nextX = event.clientX - stageRect.left - drag.offsetX - baseLeft
    const nextY = event.clientY - stageRect.top - drag.offsetY - baseTop
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
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: stopDragging,
      onPointerCancel: stopDragging,
    },
  }
}
