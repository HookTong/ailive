import { useEffect, useRef, useState } from 'react'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

export type DropdownValue = string | number

export type DropdownOption<Value extends DropdownValue = string> = {
  value: Value
  label: string
}

type DropdownSelectProps<Value extends DropdownValue> = {
  value: Value
  options: DropdownOption<Value>[]
  onChange: (value: Value) => void
  ariaLabel: string
  /** 触发区高度：md = 36px（默认），sm = 30px */
  size?: 'sm' | 'md'
}

export function DropdownSelect<Value extends DropdownValue>({ value, options, onChange, ariaLabel, size = 'md' }: DropdownSelectProps<Value>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const selectOption = (option: DropdownOption<Value>) => {
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div className={cx(styles.root, open && styles.open)} ref={rootRef}>
      <button
        className={cx(styles.trigger, size === 'sm' && styles.sm)}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span>{selectedOption?.label ?? value}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.menu} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cx(styles.option, option.value === value && styles.active)}
              onClick={() => selectOption(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
