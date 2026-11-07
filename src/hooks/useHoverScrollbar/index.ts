import { useEffect } from 'react'

/** 挂在滚动容器上的属性名：`scroll-thin` 靠它决定滚动条要不要显形 */
const HOVER_ATTR = 'data-scroll-hover'

/**
 * 滚动条只在鼠标进入容器时显形。
 *
 * 为什么不用 CSS 的 `容器:hover::-webkit-scrollbar-thumb`：**Chromium 不会因为滚动容器的
 * `:hover` 变化去重新解析 `::-webkit-scrollbar-thumb` 的样式** —— 实测 `matches(':hover')`
 * 已经是 true，thumb 依旧停在 `transparent`；而给同一个元素换一个 class / data 属性，
 * 下一帧就画出来了。所以这里只能靠 JS 挂属性。
 *
 * 全局只挂一次（`App` 里调用），从指针位置往上找最近的、真的在滚动的祖先：
 * 这样新加滚动容器不用改任何代码，只要样式里 `@include scroll-thin` 就自动生效。
 */
export function useHoverScrollbar() {
  useEffect(() => {
    let active: HTMLElement | null = null

    const clear = () => {
      active?.removeAttribute(HOVER_ATTR)
      active = null
    }

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      let found: HTMLElement | null = null

      for (let node = target; node instanceof HTMLElement; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          // 能滚但没溢出的话，滚动条本来就不显示，不算命中
          if (node.scrollHeight > node.clientHeight) {
            found = node
            break
          }
          continue
        }
        // 弹窗 / 抽屉的遮罩是 `position: fixed` 的，它是边界：再往上就是被盖住的页面。
        // 不加这一条，指针停在弹窗上时底下的列表会一直露着滚动条
        if (style.position === 'fixed') break
      }

      if (found === active) return
      clear()
      active = found
      active?.setAttribute(HOVER_ATTR, '')
    }

    // 指针移出窗口时不会有新的 pointerover，得靠 pointerout 的 relatedTarget 为空来收尾
    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) clear()
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    return () => {
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      clear()
    }
  }, [])
}
