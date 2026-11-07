import { useMemo } from 'react'
import { Card } from '../Card'
import { useDragPosition, useLiveData } from '../../hooks'
import { CHAT_COMMANDS } from '../../data/chatCommands'
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
  粒子: '粒子特效',
  滤镜: '舞台滤镜',
  音乐: '背景音乐',
}

/**
 * 舞台上的「弹幕指令」速查卡：把 `data/chatCommands` 里的指令按类列出来。
 *
 * 模板**原样显示**，`$角色名称` / `$背景名称` 这类占位符不替换成真实名字 ——
 * 这张卡是「格式说明」不是「当前配置」，替成具体值反而让人以为只能发那一个。
 * 想看现在能填哪些名字，去「直播配置 → 弹幕指令」，那里每条模板下面都列着。
 *
 * 和配置面板分工不同：那边管开关，这边是给台上看的说明卡，
 * 所以**只列开着的指令** —— 关掉的指令发出去没反应，列出来只会让人以为坏了。
 */
export function ChatCommandCard() {
  const { chatCommands } = useLiveData()
  // 整张卡片都能拖：handlers 挂在 Card 根节点上，交互元素由 useDragPosition 内部的守卫排除
  const { ref, transform, handlers } = useDragPosition<HTMLElement>({ draggingClassName: styles.dragging })

  const groups = useMemo(() => {
    // 按「第一次出现」的顺序归组：CHAT_COMMANDS 本身就是 外观 → 音色 → 背景 → 粒子 → 滤镜 → 音乐
    const order: string[] = []
    const byFamily = new Map<string, string[]>()
    for (const command of CHAT_COMMANDS) {
      if (!chatCommands[command.id]) continue
      const family = familyOf(command.template)
      const bucket = byFamily.get(family)
      if (bucket) bucket.push(command.template)
      else {
        byFamily.set(family, [command.template])
        order.push(family)
      }
    }
    return order.map((family) => ({
      family,
      label: FAMILY_LABEL[family] ?? family,
      commands: byFamily.get(family) ?? [],
    }))
  }, [chatCommands])

  // 指令全被关掉时整块不出现，别留一张空卡片
  if (groups.length === 0) return null

  return (
    <Card
      as="aside"
      ref={ref}
      className={styles.root}
      style={{ transform }}
      {...handlers}
      aria-label="弹幕指令"
      padding="sm"
      title={<span className={styles.title}>弹幕指令</span>}
      extra={<span className={styles.count}>{groups.length} 类</span>}
      headerProps={{ className: styles.headRow }}
    >
      <p className={styles.hint}>
        观众在弹幕里发这些就能远程操作，「$」开头的值写个大概也能认出来
      </p>
      <ul className={styles.list}>
        {groups.map((group) => (
          <li key={group.family}>
            <div className={styles.family}>{group.label}</div>
            <div className={styles.commands}>
              {group.commands.map((command) => (
                <code className={styles.command} key={command}>{command}</code>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
