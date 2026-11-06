import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveGiftMotion, useLiveData, useModel, type GiftMotionMap } from '../../hooks'
import { DOUYIN_GIFTS, giftIcon, giftPrice } from '../../data/gifts'
import { cx } from '../../utils/cx'
import { Button } from '../Button'
import { Drawer } from '../Drawer'
import { DropdownSelect, type DropdownOption } from '../DropdownSelect'
import { Input } from '../Input'
import { Modal } from '../Modal'
import styles from './index.module.scss'

/** 单价只接受非负有限数 */
function normalizePrice(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/** 一个模型的选项：动作清单 + 这个礼物给它配的动作 */
type MotionRow = {
  id: string
  name: string
  /** 该模型可用的动作分组，解析「这个礼物到底触发什么」时要拿它校验 */
  motions: Record<string, { label?: string }>
  options: DropdownOption[]
  /** 是不是当前控制台选中的那个角色 */
  current: boolean
}

/**
 * 直播配置抽屉：逐个礼物的单价，以及收到该礼物时每个角色各做什么动作。
 * 房间号的连接入口在弹幕面板里（弹幕就在那儿看，连接也该在那儿），
 * 这里只管「这个礼物值多少钱、让角色做什么」。
 */
export function LiveConfigDrawer() {
  const {
    liveConfigOpen,
    closeLiveConfig,
    douyinRoom,
    giftPrices,
    setGiftPrices,
    giftMotions,
    setGiftMotions,
  } = useLiveData()
  const { modelSources, activeModelId, characterStates } = useModel()

  const [draftPrices, setDraftPrices] = useState<Record<string, number>>(giftPrices)
  const [draftMotions, setDraftMotions] = useState<GiftMotionMap>(giftMotions)
  /** 正在配置动作的礼物名，null 表示弹窗关着 */
  const [motionTarget, setMotionTarget] = useState<string | null>(null)
  /** 弹窗里每个模型的临时选择，点「确定」才写回草稿 */
  const [motionDraft, setMotionDraft] = useState<Record<string, string>>({})
  const wasOpenRef = useRef(false)

  const { giftTotals } = douyinRoom

  // 舞台上所有模型各一行，每个都带自己的动作清单。当前角色排最前，其余按控制台顺序
  const motionRows = useMemo<MotionRow[]>(() => {
    const active = modelSources.find((source) => source.id === activeModelId)
    const rest = modelSources.filter((source) => source.id !== activeModelId)
    return [...(active ? [active] : []), ...rest].map((source) => {
      const motions = characterStates[source.id]?.manifest?.motions ?? {}
      return {
        id: source.id,
        name: source.name,
        motions,
        current: source.id === activeModelId,
        options: [
          { value: '', label: '不触发' },
          ...Object.entries(motions).map(([group, config]) => ({
            value: group,
            label: config.label ?? group,
          })),
        ],
      }
    })
  }, [modelSources, activeModelId, characterStates])

  // 取这个礼物给某个模型配的动作；模型自己没配时看通配键（旧格式迁移过来的），
  // 再校验这个模型确实有该动作 —— 换过模型后旧配置会失效
  const motionOf = (entry: Record<string, string> | undefined, row: MotionRow) =>
    resolveGiftMotion(entry, row.id, row.motions)

  /** 行按钮的悬停提示：哪些模型配了什么 */
  const describeMotions = (entry: Record<string, string> | undefined) => {
    if (!entry) return ''
    const parts: string[] = []
    for (const row of motionRows) {
      const motion = motionOf(entry, row)
      if (!motion) continue
      const label = row.options.find((option) => option.value === motion)?.label ?? motion
      parts.push(`${row.name}·${label}`)
    }
    return parts.join(' · ')
  }

  // 礼物清单 = 内置目录 + 目录外的礼物。
  // 目录外有两个来源：本次连接里真的有人送的（giftTotals），
  // 以及之前配过价、已经落在 giftPrices 里的 —— 后者即使这次没人送、
  // 甚至没连直播间，也得能看见、能改，否则「配过的价」等于白配。
  const giftRows = useMemo(() => {
    const known = new Set(DOUYIN_GIFTS.map((gift) => gift.name))
    const extras: string[] = []
    const seen = new Set<string>()
    for (const name of [...Object.keys(giftPrices), ...giftTotals.map((item) => item.name)]) {
      if (known.has(name) || seen.has(name)) continue
      seen.add(name)
      extras.push(name)
    }
    return [
      ...DOUYIN_GIFTS.map((gift) => ({ name: gift.name, icon: giftIcon(gift.name) })),
      ...extras.map((name) => ({ name, icon: null })),
    ]
  }, [giftPrices, giftTotals])

  // 只在「打开」这一刻同步草稿，避免上次取消的改动残留。
  // 按 giftRows 走一遍，保证每一行都有草稿值（含目录外那些已经存过价的）
  useEffect(() => {
    if (liveConfigOpen && !wasOpenRef.current) {
      const next: Record<string, number> = {}
      for (const row of giftRows) next[row.name] = giftPrice(giftPrices, row.name)
      setDraftPrices(next)
      setDraftMotions({ ...giftMotions })
      setMotionTarget(null)
    }
    wasOpenRef.current = liveConfigOpen
  }, [liveConfigOpen, giftRows, giftPrices, giftMotions])

  const openMotionModal = (name: string) => {
    const entry = draftMotions[name]
    const next: Record<string, string> = {}
    for (const row of motionRows) next[row.id] = motionOf(entry, row)
    setMotionDraft(next)
    setMotionTarget(name)
  }

  const confirmMotion = () => {
    if (!motionTarget) return
    const next: Record<string, string> = {}
    for (const row of motionRows) {
      const motion = motionDraft[row.id] ?? ''
      if (motion) next[row.id] = motion
    }
    setDraftMotions((current) => {
      const copy = { ...current }
      // 每个模型都已经有明确选择了，通配键不再需要，写回时丢掉
      if (Object.keys(next).length > 0) copy[motionTarget] = next
      else delete copy[motionTarget]
      return copy
    })
    setMotionTarget(null)
  }

  const save = () => {
    // 从已存的表出发：目录外的礼物只在「本次连接出现过」时才有行，
    // 直接用空表重写会把上次配过、这次没出现的礼物单价抹掉
    const nextPrices: Record<string, number> = { ...giftPrices }
    for (const row of giftRows) {
      nextPrices[row.name] = normalizePrice(draftPrices[row.name] ?? 0)
    }
    setGiftPrices(nextPrices)

    // 空串 = 该模型不触发，从表里删掉，别把没用的键留在 localStorage
    const nextMotions: GiftMotionMap = {}
    for (const [name, entry] of Object.entries(draftMotions)) {
      const perModel: Record<string, string> = {}
      for (const [modelId, motion] of Object.entries(entry ?? {})) {
        if (motion) perModel[modelId] = motion
      }
      if (Object.keys(perModel).length > 0) nextMotions[name] = perModel
    }
    setGiftMotions(nextMotions)

    closeLiveConfig()
  }

  return (
    <>
      <Drawer
        open={liveConfigOpen}
        title="直播配置"
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
        <div className={styles.sectionHead}>
          <span>礼物单价 <em>元/个</em></span>
          <span>共 {giftRows.length} 种</span>
        </div>
        <small className={styles.hint}>
          按礼物名匹配弹幕里的送礼事件，收入 = Σ 各礼物件数 × 单价；模型花费在 AI 配置里按 token 单价计算
        </small>
        <ul className={styles.giftList}>
          {giftRows.map((row) => {
            const summary = describeMotions(draftMotions[row.name])
            return (
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
                    addon="元"
                  />
                </span>
                <Button
                  variant="ghost"
                  className={cx(styles.motionButton, summary && styles.motionButtonOn)}
                  aria-label={`配置「${row.name}」触发的角色动作`}
                  title={summary ? `已配置：${summary}` : '未配置'}
                  onClick={() => openMotionModal(row.name)}
                >
                  触发角色动作
                </Button>
              </li>
            )
          })}
        </ul>
      </Drawer>

      {/* 弹窗要放在 Drawer 外面：抽屉内容区是 overflow: auto，放在里面会被裁掉 */}
      {motionTarget && (
        <Modal
          title="触发角色动作"
          tone="panel"
          zIndex={40}
          scrollable={false}
          width="min(460px, 100%)"
          onClose={() => setMotionTarget(null)}
          actions={(
            <>
              <Button variant="secondary" size="lg" onClick={() => setMotionTarget(null)}>取消</Button>
              <Button size="lg" onClick={confirmMotion}>确定</Button>
            </>
          )}
        >
          <div className={styles.motionBody}>
            <div className={styles.motionGift}>
              <span className={styles.giftIcon}>
                {giftIcon(motionTarget)
                  ? <img src={giftIcon(motionTarget) ?? ''} alt="" aria-hidden />
                  : <span className={styles.giftIconFallback} aria-hidden>?</span>}
              </span>
              <div>
                <strong>{motionTarget}</strong>
                <small>收到这个礼物时，让每个角色各做一次自己配的动作；没配的角色不动</small>
              </div>
            </div>

            <div className={styles.motionModels}>
              <span className={styles.motionLabel}>角色动作</span>
              <ul>
                {motionRows.map((row) => (
                  <li key={row.id}>
                    <span className={styles.modelName} title={row.name}>
                      <b>{row.name}</b>
                      {row.current && <em>当前</em>}
                    </span>
                    <DropdownSelect
                      size="sm"
                      ariaLabel={`「${row.name}」触发的角色动作`}
                      value={motionDraft[row.id] ?? ''}
                      options={row.options}
                      onChange={(value) => setMotionDraft({ ...motionDraft, [row.id]: value })}
                    />
                  </li>
                ))}
              </ul>
              {motionRows.every((row) => row.options.length <= 1) && (
                <small className={styles.hint}>
                  当前没有可用的动作配置，先在控制台换一个带动作的模型
                </small>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
