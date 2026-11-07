import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type TabItem<T extends string> = {
  value: T
  label: string
}

export type TabsProps<T extends string> = {
  value: T
  items: readonly TabItem<T>[]
  onChange: (value: T) => void
  /** 无障碍名称，标签栏本身没有可见标题 */
  ariaLabel: string
  /** 当前标签页的内容 */
  children: ReactNode
  className?: string
}

/**
 * 标签页：上方一条标签栏，下方是对应内容。
 *
 * 布局契约：根节点撑满父容器高度，标签栏固定、内容区自己滚。
 * 调用方得给一个有确定高度的父级（抽屉的 body 就是），
 * 否则内容区撑不开，滚动会落到外层去。
 */
export function Tabs<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
  children,
  className,
}: TabsProps<T>) {
  const id = useId()
  const barRef = useRef<HTMLDivElement>(null)

  /** 切到第 index 个标签，并把焦点一起带过去 */
  const goTo = (index: number) => {
    const next = items[index]
    if (!next) return
    onChange(next.value)
    barRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus()
  }

  // 方向键在标签间移动（tablist 的键盘约定），Home / End 跳到首尾
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = items.findIndex((item) => item.value === value)
    if (index < 0) return
    const { key } = event
    if (key !== 'ArrowRight' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowUp'
      && key !== 'Home' && key !== 'End') return
    event.preventDefault()
    if (key === 'Home') goTo(0)
    else if (key === 'End') goTo(items.length - 1)
    else {
      const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1
      goTo((index + step + items.length) % items.length)
    }
  }

  return (
    <div className={cx(styles.root, className)}>
      <div ref={barRef} className={styles.bar} role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const selected = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`${id}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              // tablist 只让选中项进 Tab 序列，其余靠方向键
              tabIndex={selected ? 0 : -1}
              className={cx(styles.tab, selected && styles.tabActive)}
              onClick={() => { if (!selected) onChange(item.value) }}
              onKeyDown={handleKeyDown}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div
        className={styles.panel}
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${value}`}
        // 切标签后键盘焦点要能落进新面板，否则 Tab 键会从标签栏跳到抽屉外面
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  )
}
