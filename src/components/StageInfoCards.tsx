import { useRef, useState } from 'react'
import type { LiveDataSnapshot } from '../live/types'

type StageInfoCardsProps = {
  snapshot: LiveDataSnapshot
}

export function StageInfoCards({ snapshot }: StageInfoCardsProps) {
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
    container.classList.add('dragging')
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
    containerRef.current?.classList.remove('dragging')
    if (containerRef.current?.hasPointerCapture(event.pointerId)) containerRef.current.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      ref={containerRef}
      className="stage-info-cards"
      aria-label="舞台信息卡片"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <div className="stage-now-playing"><span className="stage-card-icon">◉</span><div><strong>{snapshot.isLive ? '正在播放' : '未开播'}</strong><b>{snapshot.nowPlaying.title}</b><small>{snapshot.nowPlaying.elapsed} / {snapshot.nowPlaying.duration}</small></div><span className="stage-equalizer">▂▅▇▅</span></div>
      <div className="stage-card-grid">
        <section className="stage-info-card stage-income-card"><h3>收支面板</h3><strong>{snapshot.income.balance} <small>元</small></strong><div className="stage-card-metrics"><span>收入 <b>{snapshot.income.income}</b></span><span>支出 <b>{snapshot.income.expense}</b></span></div><dl><dt>今日获票</dt><dd>{snapshot.income.todayVotes}</dd><dt>礼物</dt><dd>{snapshot.income.gifts}</dd><dt>今日 token</dt><dd>{snapshot.income.tokens}</dd></dl></section>
        <div className="stage-card-stack"><section className="stage-info-card"><h3>点歌排队 <small>{snapshot.songQueue.length} 首</small></h3><div className="stage-card-empty">{snapshot.songQueue[0]?.title ?? '暂无歌曲'}</div></section><section className="stage-info-card"><h3>最近点歌</h3><ul>{snapshot.recentSongs.length > 0 ? snapshot.recentSongs.map((song) => <li key={song.title}>◈ {song.title}</li>) : <li>暂无记录</li>}</ul></section></div>
        <section className="stage-info-card stage-guard-card"><h3>今日守护</h3><ol>{snapshot.guardians.map((guardian) => <li key={`${guardian.rank}-${guardian.name}`}><i>{guardian.highlighted ? '☺' : guardian.rank}</i><span>{guardian.name}</span><b>{guardian.amount}</b></li>)}</ol></section>
      </div>
    </div>
  )
}
