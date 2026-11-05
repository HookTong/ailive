import { useId, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type ModalProps = {
  title: string
  /** 标题上方的小字，例如 MODEL IMPORT */
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  /** 底部操作区，通常是若干 Button */
  actions?: ReactNode
  /** raised = 弹窗底色，panel = 与右侧控制台同色 */
  tone?: 'raised' | 'panel'
  /** 内容超高时是否允许滚动；含下拉框的弹窗要关掉，否则菜单会被裁掉 */
  scrollable?: boolean
  width?: string
  maxHeight?: string
  zIndex?: number
}

/**
 * 弹窗外壳：遮罩 + 面板 + 标题栏 + 操作区。
 * 四个弹窗（添加模型 / 删除确认 / 自定义滤镜 / 音色）共用同一套 chrome。
 */
export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  actions,
  tone = 'raised',
  scrollable = true,
  width,
  maxHeight,
  zIndex,
}: ModalProps) {
  const titleId = useId()
  const panelStyle: CSSProperties = { width, maxHeight }

  return (
    <div
      className={styles.backdrop}
      style={zIndex == null ? undefined : { zIndex }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className={cx(styles.panel, tone === 'panel' && styles.panelSoft, scrollable && styles.scrollable)}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.header}>
          <div>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            <h2 className={styles.title} id={titleId}>{title}</h2>
          </div>
          <button className={styles.close} type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </section>
    </div>
  )
}
