import { useEffect, useState } from 'react'
import { useLiveData } from '../../hooks'
import { normalizeWebRid } from '../../hooks/useLiveServer/api'
import { describeRoomState } from '../../hooks'
import { Button } from '../Button'
import { Input } from '../Input'
import { Modal } from '../Modal'
import styles from './index.module.scss'

/**
 * 直播配置弹窗：房间号连接 + 礼物单价。
 * 房间连接是即时生效的（有明确的状态反馈），礼物单价随「完成」保存。
 */
export function LiveConfigModal() {
  const {
    liveConfigOpen,
    closeLiveConfig,
    douyinRoomId,
    douyinRoom,
    handleDouyinRoomChange,
    giftPrice,
    setGiftPrice,
  } = useLiveData()

  const [draftRoom, setDraftRoom] = useState(douyinRoomId ?? '')
  const [draftPrice, setDraftPrice] = useState(giftPrice)
  const [inputError, setInputError] = useState<string | null>(null)

  const { state, room, error: roomError } = douyinRoom
  const connected = state === 'live' || state === 'connecting' || state === 'reconnecting'

  // 每次打开都从当前状态重新起草，避免上次取消的改动残留
  useEffect(() => {
    if (!liveConfigOpen) return
    setDraftRoom(douyinRoomId ?? '')
    setDraftPrice(giftPrice)
    setInputError(null)
  }, [liveConfigOpen, douyinRoomId, giftPrice])

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
    setGiftPrice(Number.isFinite(draftPrice) && draftPrice >= 0 ? draftPrice : 0)
    closeLiveConfig()
  }

  if (!liveConfigOpen) return null

  return (
    <Modal
      title="直播配置"
      eyebrow="LIVE"
      tone="panel"
      width="min(440px, calc(100vw - 32px))"
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

      <label className={styles.field}>
        <span>礼物单价 <em>元/件</em></span>
        <Input
          size="lg"
          type="number"
          min="0"
          step="0.1"
          value={draftPrice}
          onChange={(event) => setDraftPrice(Number(event.target.value))}
          placeholder="1"
        />
        <small className={styles.hint}>
          收入按「礼物件数 × 单价」估算；模型花费在 AI 配置里按 token 单价计算
        </small>
      </label>
    </Modal>
  )
}
