import { useRef, useState } from 'react'
import { useLiveData } from '../../contexts'
import { cx } from '../../utils/cx'
import styles from './index.module.scss'

/**
 * 舞台左上角的直播概览卡片组：正在播放 / 收支面板 / 点歌排队 / 最近点歌 / 今日守护。
 * 数据直接从 LiveDataContext 取，不需要外部传参。
 */
export function LiveOverview() {
  const { liveInfo } = useLiveData()
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, select, textarea')) return
    const container = containerRef.current
    const stage = container?.parentElement
    if (!container || !stage) return
    const rect = container.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
    container.setPointerCapture(event.pointerId)
    container.classList.add(styles.dragging)
    event.preventDefault()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const container = containerRef.current
    const stage = container?.parentElement
    if (!drag || !container || !stage || drag.pointerId !== event.pointerId) return
    const stageRect = stage.getBoundingClientRect()
    const containerWidth = container.offsetWidth
    const containerHeight = container.offsetHeight
    const baseLeft = container.offsetLeft
    const baseTop = container.offsetTop
    const minX = -baseLeft
    const minY = -baseTop
    const maxX = Math.max(minX, stage.clientWidth - baseLeft - containerWidth)
    const maxY = Math.max(minY, stage.clientHeight - baseTop - containerHeight)
    const nextX = event.clientX - stageRect.left - drag.offsetX - baseLeft
    const nextY = event.clientY - stageRect.top - drag.offsetY - baseTop
    const left = Math.min(Math.max(nextX, minX), maxX)
    const top = Math.min(Math.max(nextY, minY), maxY)
    setPosition({ x: left, y: top })
    event.preventDefault()
  }

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    dragRef.current = null
    containerRef.current?.classList.remove(styles.dragging)
    if (containerRef.current?.hasPointerCapture(event.pointerId)) containerRef.current.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      ref={containerRef}
      className={styles.cards}
      aria-label="舞台信息卡片"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <div className={styles.nowPlaying}>
        <span className={styles.icon}>◉</span>
        <div>
          <strong>{liveInfo.isLive ? '正在播放' : '未开播'}</strong>
          <b>{liveInfo.nowPlaying.title}</b>
          <small>{liveInfo.nowPlaying.elapsed} / {liveInfo.nowPlaying.duration}</small>
        </div>
        <span className={styles.equalizer}>▂▅▇▅</span>
      </div>
      <div className={styles.grid}>
        <section className={cx(styles.card, styles.income)}>
          <h3>收支面板</h3>
          <strong>{liveInfo.income.balance} <small>元</small></strong>
          <div className={styles.metrics}>
            <span>收入 <b>{liveInfo.income.income}</b></span>
            <span>支出 <b>{liveInfo.income.expense}</b></span>
          </div>
          <dl>
            <dt>今日获票</dt><dd>{liveInfo.income.todayVotes}</dd>
            <dt>礼物</dt><dd>{liveInfo.income.gifts}</dd>
            <dt>今日 token</dt><dd>{liveInfo.income.tokens}</dd>
          </dl>
        </section>
        <div className={styles.stack}>
          <section className={styles.card}>
            <h3>点歌排队 <small>{liveInfo.songQueue.length} 首</small></h3>
            <div className={styles.empty}>{liveInfo.songQueue[0]?.title ?? '暂无歌曲'}</div>
          </section>
          <section className={styles.card}>
            <h3>最近点歌</h3>
            <ul>{liveInfo.recentSongs.length > 0 ? liveInfo.recentSongs.map((song) => <li key={song.title}>◈ {song.title}</li>) : <li>暂无记录</li>}</ul>
          </section>
        </div>
        <section className={cx(styles.card, styles.guard)}>
          <h3>今日守护</h3>
          <ol>
            {liveInfo.guardians.length > 0
              ? liveInfo.guardians.map((guardian) => (
                <li key={`${guardian.rank}-${guardian.name}`}>
                  <i>{guardian.highlighted ? '☺' : guardian.rank}</i>
                  <span>{guardian.name}</span>
                  <b>{guardian.amount}</b>
                </li>
              ))
              : <li className={styles.guardEmpty}>连接直播间后按礼物数排名</li>}
          </ol>
        </section>
      </div>
    </div>
  )
}
