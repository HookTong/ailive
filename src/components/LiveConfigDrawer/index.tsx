import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveData } from '../../hooks'
import { normalizeWebRid } from '../../hooks/useLiveServer/api'
import { describeRoomState } from '../../hooks'
import { DOUYIN_GIFTS, giftIcon, giftPrice } from '../../data/gifts'
import { Button } from '../Button'
import { Drawer } from '../Drawer'
import { Input } from '../Input'
import styles from './index.module.scss'

/** 单价只接受非负有限数 */
function normalizePrice(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * 直播配置抽屉：房间号连接 + 每种礼物的单价。
 * 房间连接即时生效（有明确的状态反馈），礼物单价随「完成」保存。
 */
export function LiveConfigDrawer() {
  const {
    liveConfigOpen,
    closeLiveConfig,
    douyinRoomId,
    douyinRoom,
    handleDouyinRoomChange,
    giftPrices,
    setGiftPrices,
  } = useLiveData()

  const [draftRoom, setDraftRoom] = useState(douyinRoomId ?? '')
  const [draftPrices, setDraftPrices] = useState<Record<string, number>>(giftPrices)
  const [inputError, setInputError] = useState<string | null>(null)
  const wasOpenRef = useRef(false)

  const { state, room, error: roomError, giftTotals } = douyinRoom
  const connected = state === 'live' || state === 'connecting' || state === 'reconnecting'

  // 礼物清单 = 内置目录 + 本次连接里出现过但目录里没有的礼物
  const giftRows = useMemo(() => {
    const known = new Set(DOUYIN_GIFTS.map((gift) => gift.name))
    const extras = [...new Set(giftTotals.map((item) => item.name))].filter((name) => !known.has(name))
    return [
      ...DOUYIN_GIFTS.map((gift) => ({ name: gift.name, icon: giftIcon(gift.name) })),
      ...extras.map((name) => ({ name, icon: null })),
    ]
  }, [giftTotals])

  // 只在「打开」这一刻同步草稿，避免上次取消的改动残留。
  // 不能跟着 douyinRoomId 一起变：点了断开之后房间号会变成 null，
  // 那样会把输入框冲掉，想重连还得重新输一遍。
  useEffect(() => {
    if (liveConfigOpen && !wasOpenRef.current) {
      setDraftRoom(douyinRoomId ?? '')
      const next: Record<string, number> = {}
      for (const gift of DOUYIN_GIFTS) next[gift.name] = giftPrice(giftPrices, gift.name)
      for (const item of douyinRoom.giftTotals) {
        if (!(item.name in next)) next[item.name] = giftPrice(giftPrices, item.name)
      }
      setDraftPrices(next)
      setInputError(null)
    }
    wasOpenRef.current = liveConfigOpen
  }, [liveConfigOpen, douyinRoomId, giftPrices, douyinRoom.giftTotals])

  const connect = () => {
    const rid = normalizeWebRid(draftRoom)
    if (!rid) {
      setInputError('请输入房间号或 live.douyin.com 链接')
      return
    }
    setInputError(null)
    handleDouyinRoomChange(rid)
  }

  const disconnect = () => {
    setInputError(null)
    handleDouyinRoomChange(null)
  }

  const save = () => {
    // 从已存的表出发：目录外的礼物只在「本次连接出现过」时才有行，
    // 直接用空表重写会把上次配过、这次没出现的礼物单价抹掉
    const next: Record<string, number> = { ...giftPrices }
    for (const row of giftRows) {
      next[row.name] = normalizePrice(draftPrices[row.name] ?? 0)
    }
    setGiftPrices(next)
    closeLiveConfig()
  }

  return (
    <Drawer
      open={liveConfigOpen}
      title="直播配置"
      eyebrow="LIVE"
      tone="panel"
      zIndex={31}
      onClose={closeLiveConfig}
      actions={(
        <>
          <Button variant="secondary" size="lg" onClick={closeLiveConfig}>取消</Button>
          <Button size="lg" onClick={save}>完成</Button>
        </>
      )}
    >
      <label className={styles.field}>
        <span>直播间房间号</span>
        <div className={styles.roomRow}>
          <Input
            size="lg"
            value={draftRoom}
            onChange={(event) => setDraftRoom(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && connect()}
            placeholder="房间号或 live.douyin.com 链接"
            aria-label="抖音直播间房间号"
          />
          <Button variant={connected ? 'secondary' : 'primary'} size="lg" onClick={connected ? disconnect : connect}>
            {connected ? '断开' : '连接'}
          </Button>
        </div>
        <small className={styles.hint}>
          {inputError ?? roomError ?? describeRoomState(state, room)}
        </small>
      </label>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span>礼物单价 <em>元/个</em></span>
          <span>共 {giftRows.length} 种</span>
        </div>
        <small className={styles.hint}>
          按礼物名匹配弹幕里的送礼事件，收入 = Σ 各礼物件数 × 单价；模型花费在 AI 配置里按 token 单价计算
        </small>
        <ul className={styles.giftList}>
          {giftRows.map((row) => (
            <li key={row.name}>
              <span className={styles.giftIcon}>
                {row.icon
                  ? <img src={row.icon} alt="" aria-hidden />
                  : <span className={styles.giftIconFallback} aria-hidden>?</span>}
              </span>
              <span className={styles.giftName} title={row.name}>{row.name}</span>
              <span className={styles.giftPrice}>
                <Input
                  size="md"
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label={`${row.name} 单价`}
                  value={draftPrices[row.name] ?? 0}
                  onChange={(event) => setDraftPrices({
                    ...draftPrices,
                    [row.name]: Number(event.target.value),
                  })}
                />
                <em>元</em>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  )
}
