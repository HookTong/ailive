import styles from './index.module.scss'

/**
 * 字段标签后的「必填」小标记。
 * 挂在标签文本后面（如 `背景名称<RequiredMark />`），比一个孤零零的星号更明确，
 * 也让所有必填字段的说法保持一致。
 */
export function RequiredMark() {
  return <em className={styles.mark}>必填</em>
}
