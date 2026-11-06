import { useEffect, useMemo, useRef } from 'react'
import { useDragPosition, useLiveData, useModel } from '../../hooks'
import { DOUYIN_GIFTS, giftIcon } from '../../data/gifts'
import { giftMotionTargets } from '../../data/giftMotions'
import { Card } from '../Card'
import styles from './index.module.scss'

/**
 * 列表装不下时自动上下滚动：按「一遍扫完约 14 秒」换算速度，
 * 再夹在 8~40px/s 之间 —— 溢出一点点不会慢到像没动，溢出很多也不会快得看不清。
 * 到顶 / 到底各停 0.7 秒再往回走。
 */
const AUTO_SCROLL_SWEEP = 14
const AUTO_SCROLL_MIN_SPEED = 8
const AUTO_SCROLL_MAX_SPEED = 40
const AUTO_SCROLL_HOLD = 0.7

/**
 * 舞台上独立浮动的「礼物动作」面板：列出每个配了动作的礼物，各自让哪些角色做什么。
 *
 * 和直播概览卡片组是两回事 —— 它不受卡片组的宽度和高度约束，可以单独拖到舞台任意角落
 * （拖标题栏，列表区域留给滚动），宽度固定 268，和弹幕面板对齐。
 */
export function GiftMotionPanel() {
  const { giftMotions } = useLiveData()
  const { modelSources, characterStates } = useModel()
  // 整张卡片都能拖：handlers 挂在 Card 根节点上，交互元素由 useDragPosition 内部的
  // INTERACTIVE 守卫排除（这个面板里没有按钮，所以等于整块都是拖拽区）
  const { ref, transform, handlers } = useDragPosition<HTMLElement>({ draggingClassName: styles.dragging })

  // 配了动作的礼物 → 每个模型各做什么。没配动作的模型不进这一行，
  // 一个模型都解析不出来的礼物（换过模型、动作没了）整条也不显示
  const rows = useMemo(() => {
    const models = modelSources.map((source) => ({
      id: source.id,
      name: source.name,
      motions: characterStates[source.id]?.manifest?.motions ?? {},
    }))
    // 按礼物目录的顺序排，和「直播配置」抽屉里看到的一致
    const catalogOrder = new Map(DOUYIN_GIFTS.map((gift, index) => [gift.name, index]))
    return Object.entries(giftMotions)
      .map(([name, entry]) => ({ name, targets: giftMotionTargets(entry, models) }))
      .filter((row) => row.targets.length > 0)
      .sort((a, b) => (catalogOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER)
        - (catalogOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER))
  }, [giftMotions, modelSources, characterStates])

  const listRef = useRef<HTMLUListElement>(null)

  // 列表装不下时自己上下滚：滚到底停一下、再往回滚到顶，如此往复。
  // 内容没超出容器就什么都不做（每帧只读一次尺寸，不写 scrollTop，不会触发布局抖动）
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // 位置自己用浮点累加：Chrome 的 scrollTop 是整数字节位，
    // 每帧 0.1px 的增量写进去会被直接抹掉，靠 scrollTop 自增会原地不动
    let position = list.scrollTop
    let frame = 0
    let direction = 1
    let hold = 0
    let last = 0

    const step = (now: number) => {
      if (!last) last = now
      // 标签页切回来时 dt 会很大，钳一下，免得一下跳到列表底部
      const dt = Math.min((now - last) / 1000, 0.064)
      last = now

      const max = list.scrollHeight - list.clientHeight
      if (max > 0) {
        // 用户自己滚过（或内容变化让位置被钳住）就跟着走，别硬拽回去
        if (Math.abs(list.scrollTop - position) > 2) position = list.scrollTop
        if (hold > 0) {
          hold -= dt
        } else {
          const speed = Math.min(AUTO_SCROLL_MAX_SPEED, Math.max(AUTO_SCROLL_MIN_SPEED, max / AUTO_SCROLL_SWEEP))
          position += direction * speed * dt
          if (position >= max) {
            position = max
            direction = -1
            hold = AUTO_SCROLL_HOLD
          } else if (position <= 0) {
            position = 0
            direction = 1
            hold = AUTO_SCROLL_HOLD
          }
          list.scrollTop = Math.round(position)
        }
      } else if (list.scrollTop !== 0) {
        // 内容变短了（换模型 / 取消配置），把位置收回去
        position = 0
        direction = 1
        hold = 0
        list.scrollTop = 0
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // 只跟「有没有内容」挂钩：每帧都会重算 max，行高变化不用重启循环；
    // 礼物触发动作会改 characterStates，若跟着它重启，滚动方向会被无谓地重置
  }, [rows.length])

  // 一个礼物都没配动作时整块不出现
  if (rows.length === 0) return null

  return (
    <Card
      as="aside"
      ref={ref}
      className={styles.panel}
      style={{ transform }}
      {...handlers}
      aria-label="礼物动作面板"
      padding="sm"
      title={<span className={styles.title}>礼物动作</span>}
      extra={<span className={styles.count}>{rows.length} 种</span>}
      headerProps={{ className: styles.headRow }}
    >
      <ul ref={listRef} className={styles.list}>
        {rows.map((row) => {
          const icon = giftIcon(row.name)
          return (
            <li key={row.name} className={styles.row}>
              <span className={styles.icon}>
                {icon
                  ? <img src={icon} alt="" aria-hidden />
                  : <span className={styles.iconFallback} aria-hidden>?</span>}
              </span>
              <span className={styles.body}>
                <span className={styles.name} title={row.name}>{row.name}</span>
                <span className={styles.targets}>
                  {row.targets.map((target) => (
                    // 268px 放不下「角色：动作 · 角色：动作」一行并排，改成每个角色独占一行
                    <span key={target.modelId} className={styles.target}>
                      <em>{target.modelName}</em>
                      <i className={styles.sep} aria-hidden>·</i>
                      <b>{target.motionLabel}</b>
                    </span>
                  ))}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
