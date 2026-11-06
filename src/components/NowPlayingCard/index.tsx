import { useEffect, useRef } from 'react'
import { cx } from '../../utils/cx'
import { Card } from '../Card'
import styles from './index.module.scss'

const BAR_COUNT = 4

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, '0')}`
}

export type NowPlayingCardProps = {
  /** 顶部状态文案，例如「正在播放」「已暂停」 */
  status: string
  /** 曲目名 */
  title: string
  /** 已播放秒数 */
  elapsed: number
  /** 总时长（秒），0 表示未知 */
  duration: number
  /** 是否正在播放：决定圆环呼吸动画与律动条 */
  playing?: boolean
  /** 频谱分析节点；有就用真实频谱驱动律动条，没有就退回 CSS 动画 */
  analyser?: AnalyserNode | null
  /**
   * 提供后左侧圆环变成播放/暂停按钮。
   * 舞台上的卡片不传（那里只管展示），弹窗里的试听卡片传 toggle 才有得停。
   */
  onToggle?: () => void
  className?: string
}

/**
 * 正在播放卡片：左侧呼吸圆环 + 曲目信息 + 右侧律动条。
 * 只负责展示，播放状态由调用方传入。
 */
export function NowPlayingCard({
  status,
  title,
  elapsed,
  duration,
  playing = false,
  analyser = null,
  onToggle,
  className,
}: NowPlayingCardProps) {
  const barsRef = useRef<HTMLSpanElement>(null)
  const live = playing && analyser !== null

  useEffect(() => {
    const container = barsRef.current
    if (!container) return
    const bars = Array.from(container.children) as HTMLElement[]
    const reset = () => bars.forEach((bar) => bar.style.setProperty('--level', '0'))

    if (!live || !analyser) {
      reset()
      return
    }

    const data = new Uint8Array(analyser.frequencyBinCount)
    const binCount = data.length
    const nyquist = analyser.context.sampleRate / 2
    // 按倍频程切频段：60Hz ~ 12kHz 对数均分，四根条分别对应低频/中低/中高/高频。
    // 线性切分的话能量全挤在头一两根上，后面几根几乎不动。
    const MIN_HZ = 60
    const MAX_HZ = 12000
    const edges = Array.from({ length: bars.length + 1 }, (_, index) => {
      const hz = MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, index / bars.length)
      return Math.min(binCount - 1, Math.max(1, Math.round((hz / nyquist) * binCount)))
    })
    // 每根条自己的慢速平均能量，作为基准：各频段绝对能量差着几个数量级，
    // 直接按绝对值画会有的顶满有的贴底，按各自基准归一化才都跳得起来
    const averages = new Array<number>(bars.length).fill(0)
    let frame = 0
    const tick = () => {
      analyser.getByteFrequencyData(data)
      for (let index = 0; index < bars.length; index += 1) {
        const from = edges[index]
        const to = Math.max(from + 1, edges[index + 1])
        // 取频段均值而不是最大值：单个 bin 很容易长期饱和在 255，条形就不动了
        let sum = 0
        for (let cursor = from; cursor < to; cursor += 1) sum += data[cursor]
        const raw = sum / (to - from) / 255

        // 约 0.8 秒的时间常数：鼓点能冲上去，又不会一路抖成噪点
        averages[index] = averages[index] === 0 ? raw : averages[index] * 0.98 + raw * 0.02
        const ratio = raw / Math.max(averages[index], 0.03)
        // 均值附近给 0.6 左右的底高，上下浮动映射到 0.12 ~ 1
        const level = Math.min(1, Math.max(0.12, (ratio - 0.55) / 0.75))
        bars[index].style.setProperty('--level', level.toFixed(3))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      reset()
    }
  }, [live, analyser])

  return (
    <Card padding="none" className={cx(styles.card, playing && styles.playing, className)}>
      {onToggle
        ? (
          <button
            type="button"
            className={cx(styles.orb, styles.orbButton)}
            aria-label={playing ? '暂停' : '播放'}
            onClick={onToggle}
          >
            <i />
          </button>
        )
        : <span className={styles.orb} aria-hidden="true"><i /></span>}
      <div className={styles.meta}>
        <strong className={styles.status}>{status}</strong>
        <b className={styles.title}>{title}</b>
        <small className={styles.time}>{formatTime(elapsed)} / {duration > 0 ? formatTime(duration) : '--:--'}</small>
      </div>
      <span
        ref={barsRef}
        className={cx(styles.bars, playing && !live && styles.animated)}
        aria-hidden="true"
      >
        {Array.from({ length: BAR_COUNT }, (_, index) => <i key={index} className={styles.bar} />)}
      </span>
    </Card>
  )
}
