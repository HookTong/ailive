import { useMemo } from 'react'
import { Card } from '../Card'
import { Tag } from '../Tag'
import { useAiChat, useDragPosition, useLiveData, useStage } from '../../hooks'
import { ACTIONS, modeGroupTemplate, type ActionGroupId, type ActionMeta } from '../../data/actions'
import styles from './index.module.scss'

/** 模板里 `[关键字|…]` 的关键字，也就是卡片里分的「类」 */
function familyOf(template: string): string {
  return /^\[([^|\]]+)/.exec(template)?.[1] ?? template
}

/**
 * 分类标题：比方括号里的关键字长一点、说人话。
 * 关键字本身要尽量短（观众得手打），所以卡片上换一套更清楚的叫法。
 */
const FAMILY_LABEL: Record<string, string> = {
  外观: '角色外观',
  音色: '角色音色',
  背景: '舞台背景',
  特效: '粒子特效',
  滤镜: '舞台滤镜',
  音乐: '背景音乐',
}

/** 一族里的一条展示项：单条指令，或一组模式合并成的一条 */
type CommandEntry = { key: string; template: string }

/**
 * 把一族里的动作折成展示项。同一组的几条**合成一条**：
 * 几种轮换方式并成 `[背景|固定/循环/随机]`，一个开关的两头并成 `[背景|开启/关闭]` ——
 * 拆开摆着既占地方，又像是几条互不相干的指令。
 *
 * 折的时候只拿**已启用**的组员去拼：某一条被单独关掉时，卡片上就不该再出现它。
 */
function entriesOf(actions: ActionMeta[]): CommandEntry[] {
  const grouped = new Map<ActionGroupId, ActionMeta[]>()
  for (const action of actions) {
    if (!action.group) continue
    const bucket = grouped.get(action.group)
    if (bucket) bucket.push(action)
    else grouped.set(action.group, [action])
  }

  const entries: CommandEntry[] = []
  const emitted = new Set<ActionGroupId>()
  for (const action of actions) {
    if (!action.group) {
      entries.push({ key: action.id, template: action.template })
      continue
    }
    // 一条合并项排在组里第一条出现的位置上，顺序仍由 ACTIONS 决定
    if (emitted.has(action.group)) continue
    emitted.add(action.group)
    entries.push({
      key: action.group,
      template: modeGroupTemplate(grouped.get(action.group) ?? [action]),
    })
  }
  return entries
}

/**
 * 舞台上的「弹幕指令」速查卡：把 `data/actions` 里的动作按类列出来。
 *
 * 模板**原样显示**，`$角色名称` / `$背景名称` 这类占位符不替换成真实名字 ——
 * 这张卡是「格式说明」不是「当前配置」，替成具体值反而让人以为只能发那一个。
 * 想看现在能填哪些名字，去「直播配置 → 弹幕指令」，那里每条模板下面都列着。
 *
 * 同一组的几条合成一条斜杠写法（轮换方式一组、开关的开启 / 关闭一组），
 * 别拆成一个个 Tag —— 卡片只有 268 宽，并排摆会撑成好几行还让人以为是独立指令。
 * 限定词和控制台里那排分段控件、开关一字不差（背景「循环」、音乐「单曲循环」），念出来就能对上。
 *
 * 和配置面板分工不同：那边管开关，这边是给台上看的说明卡，
 * 所以**只列开着的指令** —— 关掉的指令发出去没反应，列出来只会让人以为坏了。
 */
export function ChatCommandCard() {
  const { chatCommands } = useLiveData()
  // 自然语言控制开了没：开了才在卡上多列一行 `[AI控制]$自然语言`
  const { settings } = useAiChat()
  const aiControl = settings.nlControl && settings.apiKey.trim() !== ''
  // 整张卡片都能拖：handlers 挂在 Card 根节点上，交互元素由 useDragPosition 内部的守卫排除
  const { overlayScales, overlayResetToken } = useStage()
  const { ref, transform, zIndex, handlers } = useDragPosition<HTMLElement>({ draggingClassName: styles.dragging, scale: overlayScales.chatCommand, resetToken: overlayResetToken })

  const groups = useMemo(() => {
    // 按「第一次出现」的顺序归组：ACTIONS 本身就是 外观 → 音色 → 背景 → 特效 → 滤镜 → 音乐
    const order: string[] = []
    const byFamily = new Map<string, ActionMeta[]>()
    for (const command of ACTIONS) {
      if (!chatCommands[command.id]) continue
      const family = familyOf(command.template)
      const bucket = byFamily.get(family)
      if (bucket) bucket.push(command)
      else {
        byFamily.set(family, [command])
        order.push(family)
      }
    }
    return order.map((family) => ({
      family,
      label: FAMILY_LABEL[family] ?? family,
      entries: entriesOf(byFamily.get(family) ?? []),
    }))
  }, [chatCommands])

  // 指令全被关掉、也没开自然语言控制时整块不出现，别留一张空卡片
  if (groups.length === 0 && !aiControl) return null

  return (
    <Card
      as="aside"
      ref={ref}
      className={styles.root}
      style={{ transform, zIndex }}
      {...handlers}
      aria-label="弹幕指令"
      padding="sm"
      title={<span className={styles.title}>弹幕指令</span>}
      extra={<span className={styles.count}>{groups.length} 类</span>}
      headerProps={{ className: styles.headRow }}
    >
      {/* 自然语言不是动作、不进 ACTIONS，塞一行进列表会把最后一条挤到折叠线以下
          （卡片已经顶到 540px 上限），所以并进这句说明里 */}
      <p className={styles.hint}>
        {aiControl
          ? '斜杠表示任选一个，「$」开头的值写个大概也能认出来；说「[AI控制]」加一句话也能操作'
          : '观众发这些就能远程操作；斜杠表示任选一个，「$」开头的值写个大概也能认出来'}
      </p>
      <ul className={styles.list}>
        {groups.map((group) => (
          <li key={group.family}>
            <div className={styles.family}>{group.label}</div>
            <div className={styles.commands}>
              {group.entries.map((entry) => (
                <Tag tone="neutral" key={entry.key}>{entry.template}</Tag>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
