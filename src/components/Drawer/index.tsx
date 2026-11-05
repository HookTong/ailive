import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TransitionEvent,
} from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

/**
 * 退出动画兜底时长。正常情况下靠 transitionend 精确收尾，
 * 只有过渡被打断/被浏览器合并时才用这个定时器，所以给得宽一些。
 */
const EXIT_FALLBACK_MS = 700

export type DrawerProps = {
  open: boolean
  title: string
  /** 标题上方的小字，例如 DOUBAO */
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  /** 底部操作区，通常是若干 Button */
  actions?: ReactNode
  /** raised = 抽屉底色，panel = 与右侧控制台同色 */
  tone?: 'raised' | 'panel'
  /** 从哪一侧滑入 */
  side?: 'right' | 'left'
  /** 面板宽度，默认 600px（窄屏时最多铺满视口） */
  width?: string
  /** 内容超高时是否允许滚动；含下拉框的内容要关掉，否则菜单会被裁掉 */
  scrollable?: boolean
  zIndex?: number
}

/**
 * 侧滑抽屉：遮罩 + 贴边面板 + 标题栏 + 操作区。
 *
 * 布局契约与 Modal 一致（header / body / actions 三段 flex），
 * 区别是面板竖着占满整个视口高度，标题和底部按钮始终固定，只有内容区滚动。
 *
 * 进出动画靠 CSS transition。难点是「刚挂载的元素不会过渡」——
 * 直接在首帧就渲染成归位态的话，浏览器看不到起点。这里在 useLayoutEffect 里
 * 读一次 offsetWidth 强制样式结算，把「滑出屏幕外」这个起点记下来，再切归位态。
 * 不用 requestAnimationFrame：重负载页面掉到 15fps 时两帧就是 130ms，肉眼可见地卡一下。
 */
export function Drawer({
  open,
  title,
  eyebrow,
  onClose,
  children,
  actions,
  tone = 'raised',
  side = 'right',
  width,
  scrollable = true,
  zIndex,
}: DrawerProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  // 打开：先把元素挂上，DOM 到位之后才能量尺寸
  useLayoutEffect(() => {
    if (open) setMounted(true)
  }, [open])

  // 挂载后（或重新打开时）把 visible 切上去，触发进入过渡
  useLayoutEffect(() => {
    if (!mounted) return
    if (!open) {
      setVisible(false)
      return
    }
    const panel = panelRef.current
    if (!panel) return
    // 强制一次样式结算，否则浏览器认为首帧就是终态，过渡不会发生
    void panel.offsetWidth
    setVisible(true)
  }, [mounted, open])

  const finishExit = useCallback(() => {
    setMounted(false)
    setVisible(false)
  }, [])

  // 关闭：等退出过渡真的走完再卸载，过渡被打断时由兜底定时器兜住
  useEffect(() => {
    if (open || !mounted) return
    const timer = window.setTimeout(finishExit, EXIT_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [open, mounted, finishExit])

  const handleTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    // 进入过渡结束、或子元素冒泡上来的过渡都不处理
    if (open || event.target !== event.currentTarget || event.propertyName !== 'transform') return
    finishExit()
  }

  // 抽屉打开时按 Esc 关闭
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!mounted) return null

  // 宽度默认交给样式表（600px），只有调用方显式指定时才内联覆盖
  const panelStyle: CSSProperties | undefined = width ? { width } : undefined

  return (
    <div
      className={cx(styles.root, visible && styles.visible)}
      style={zIndex == null ? undefined : { zIndex }}
      role="presentation"
    >
      {/* 遮罩是空元素，点它就算点空白处；面板是它的兄弟节点，不会被误伤 */}
      <div className={styles.backdrop} onMouseDown={onClose} />
      <section
        ref={panelRef}
        className={cx(styles.panel, side === 'left' && styles.left, tone === 'panel' && styles.panelSoft)}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className={styles.header}>
          <div>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            <h2 className={styles.title} id={titleId}>{title}</h2>
          </div>
          <button className={styles.close} type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <div className={cx(styles.body, scrollable && styles.scrollable)}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </section>
    </div>
  )
}
