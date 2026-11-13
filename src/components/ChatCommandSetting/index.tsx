import { useMemo } from 'react'
import { PARTICLE_PRESETS } from '../Atmosphere'
import { FILTER_PRESETS } from '../FilterSetting'
import { Switch } from '../Switch'
import { Tag } from '../Tag'
import { Tooltip } from '../Tooltip'
import { cx } from '../../utils/cx'
import { useModel, useMusic, useStage, useVoice } from '../../hooks'
import { BACKGROUND_PRESETS } from '../../contexts/StageProvider/presets'
import {
  ACTIONS,
  ACTION_GROUPS,
  modeGroupTemplate,
  type ActionId,
  type ActionMeta,
  type ActionScope,
  type ActionSwitches,
} from '../../data/actions'
import styles from './index.module.scss'

export type ChatCommandSettingProps = {
  /** 动作 id → 是否启用 */
  commands: ActionSwitches
  onToggle: (id: ActionId, enabled: boolean) => void
}

const SCOPE_LABEL: Record<ActionScope, string> = {
  // 和左右两块面板的标题一字不差（左边是「角色控制台」、右边是「舞台控制台」），
  // 这里写别的叫法会让人以为指令分到了第三块地方
  model: '角色控制台',
  stage: '舞台控制台',
}

/** 提示行里的一段「标签 + 内容」，标签压暗、内容提亮，靠分色区分键和值 */
type HintPart = { label: string; value: string }

/** 一条提示（一行）。多段之间靠间距隔开，不加分隔符 —— 分色已经把键和值分清了 */
type HintLine = HintPart[]

/** 面板上的一行：单条动作，或同一功能的几种模式（共用一个开关） */
type PanelRow = {
  key: string
  label: string
  actions: ActionMeta[]
}

/** 面板上的一组：一个操作区域（外观 / 音色 / 背景 / 特效 / 滤镜 / 音乐） */
type PanelGroup = {
  /** 区域名 = 指令关键字，同时也是这组的标题 */
  area: string
  /** 这组动的是哪块控制台 —— 决定反馈由谁来说 */
  scope: ActionScope
  rows: PanelRow[]
}

/**
 * 把 `ACTIONS` 折成面板分组：**先按操作区域切，再在区域内把同一 `group` 的相邻动作并成一行**。
 *
 * 区域就是指令关键字本身 —— `[背景]…`、`[背景|循环]`、`[背景|开启]` 动的是同一块地方
 * （舞台背景），归在一组才找得到。顺序仍由 `ACTIONS` 决定：
 * 外观 → 音色 → 背景 → 特效 → 滤镜 → 音乐。
 *
 * 组内再合一次：几种互斥的轮换方式（固定 / 循环 / 随机）并成 `[背景|固定/循环/随机]`，
 * 一个开关的两头（开启 / 关闭）并成 `[背景|开启/关闭]`，共用一个开关 ——
 * 拆成一行一条会让人以为能同时开两个。解析和执行仍按单个 action 走，这里只影响展示。
 */
function buildPanelGroups(): PanelGroup[] {
  const groups: PanelGroup[] = []
  for (const action of ACTIONS) {
    const area = action.match.keyword
    let group = groups[groups.length - 1]
    if (group?.area !== area) {
      group = { area, scope: action.scope, rows: [] }
      groups.push(group)
    }
    const last = group.rows[group.rows.length - 1]
    if (action.group && last?.actions[0].group === action.group) {
      last.actions.push(action)
      continue
    }
    group.rows.push({
      key: action.group ?? action.id,
      label: action.group ? ACTION_GROUPS[action.group] : action.label,
      actions: [action],
    })
  }
  return groups
}

const PANEL_GROUPS = buildPanelGroups()

/**
 * 弹幕指令的配置面板：逐条列出「控制哪个功能」，右侧一个开关决定要不要响应。
 *
 * 按**操作区域**分组（外观 / 音色 / 背景 / 特效 / 滤镜 / 音乐），区域就是指令关键字 ——
 * 观众找的是「我要动哪块地方」，而不是「这功能在哪个面板」，所以不按角色 / 舞台控制台切。
 * 每组标题右边补一句它属于哪块控制台：那决定指令的反馈由谁来说。
 *
 * 每行两句：功能名 → 指令模板。模板放在第二行而不是当标题：
 * `[背景]$背景名称` 这种串扫一眼认不出是干什么的，而这一页要回答的第一个问题是
 * 「我要不要开着它」。能填哪些名字挂在模板的 Tooltip 上 —— 那是查手册时才要的细节。
 *
 * 模板是**唯一真相**：它由动作表的 `match` + `params` 生成，解析器也按同一份规则匹配
 * （方括号里全是固定值、外面全是变量），所以这里显示什么，观众就得怎么发。
 *
 * 同一功能的几条指令合成一行、共用一个开关：几种互斥的轮换方式（固定 / 循环 / 随机）
 * 并成 `[背景|固定/循环/随机]`，一个开关的两头（开启 / 关闭）并成 `[背景|开启/关闭]`，
 * 见 `buildPanelGroups` / `modeGroupTemplate`。
 *
 * 这里的固定值和控制台里那排分段控件是**同一套文案**（面板上写「循环」，指令就是
 * `[背景|循环]`）—— 观众对着控制台念、照着这行抄，两边差一个字就发不出去。
 */
export function ChatCommandSetting({ commands, onToggle }: ChatCommandSettingProps) {
  const { modelSources, characterStates } = useModel()
  const { voices } = useVoice()
  const { tracks } = useMusic()
  const { customBackgrounds, customFilterPresets } = useStage()

  // 只列台上看得见的模型：藏起来的角色观众根本看不到，写进提示只会误导
  // （指令本身对隐藏模型仍然生效，这里只决定文案里出现谁）
  const visibleModels = useMemo(
    () => modelSources.filter((source) => characterStates[source.id]?.modelVisible !== false),
    [modelSources, characterStates],
  )

  // 外观名一个都没有的模型也跳过 —— 提示里留个「外观：」后面空着更费解
  const expressionModels = useMemo(
    () => visibleModels
      .map((source) => ({
        name: source.name,
        expressions: Object.keys(characterStates[source.id]?.manifest?.expressions ?? {}),
      }))
      .filter((model) => model.expressions.length > 0),
    [visibleModels, characterStates],
  )

  // 示例用真实存在的「角色 + 它的外观」，照着抄就能跑通；一个都没有时退回和模板一致的占位符
  const sample = expressionModels[0]
  const sampleModel = sample?.name ?? visibleModels[0]?.name ?? '$角色名称'
  const sampleExpression = sample?.expressions[0] ?? '$外观名称'

  /**
   * 指令 id → 提示行（一行一条，全部收在模板的 Tooltip 里）。空数组表示这条没有可填的名字。
   *
   * 外观按角色分行：每个角色的外观名各不相同，挤成一行根本看不出哪个名字属于哪个角色。
   * 外观名动辄几十个，Tooltip 宽度上限 360px，靠 `pre-line` 折行。
   */
  const options = useMemo<Partial<Record<ActionId, HintLine[]>>>(() => {
    const models = visibleModels.map((source) => source.name).join(' / ')
    // 清除外观和「+ 外观名」一样得挑有外观的角色 —— 没外观的角色清无可清，列出来只会误导
    const expressionNames = expressionModels.map((model) => model.name).join(' / ')
    const backgrounds = [...BACKGROUND_PRESETS, ...customBackgrounds].map((preset) => preset.label).join(' / ')
    const particles = PARTICLE_PRESETS.map((preset) => preset.label).join(' / ')
    const filters = [...FILTER_PRESETS, ...customFilterPresets].map((preset) => preset.label).join(' / ')
    const music = tracks.map((track) => track.label).join(' / ')
    return {
      expression: expressionModels.map((model) => [
        { label: '角色', value: model.name },
        // 名字之间留空格：Tooltip 里几十个名字挤成 `a/b/c` 是一堵墙，`a / b / c` 才认得出边界
        { label: '外观', value: model.expressions.join(' / ') },
      ]),
      expressionClear: expressionNames ? [[{ label: '角色', value: expressionNames }]] : [],
      voice: models
        ? [[
            { label: '角色', value: models },
            { label: '音色', value: voices.map((voice) => voice.label).join(' / ') },
          ]]
        : [],
      background: [[{ label: '背景', value: backgrounds }]],
      particle: [[{ label: '特效', value: particles }]],
      filter: [[{ label: '滤镜', value: filters }]],
      music: [[{ label: '音乐', value: music }]],
    }
  }, [visibleModels, expressionModels, voices, tracks, customBackgrounds, customFilterPresets])

  return (
    <div className={styles.root}>
      {/* 整段写在一行：JSX 的换行会折叠成一个空格，中文里的「。（」之间不该有缝。
          每句只高亮一处，三句三个重点，再多就等于没重点 */}
      <p className={styles.intro}>
        观众发下面格式的弹幕就能远程操作控制台，每条都会让模型播报一句结果。<strong>方括号里是固定写法</strong>，要一字不差，斜杠表示任选一个；外面是变量，多个用「&gt;」隔开，<strong>「$」开头的变量名写个大概就行</strong>。想让模型听懂自然语言，写成<strong>「[AI控制]换个赛博背景」</strong>，开关在「AI 配置」里。
      </p>
      <div className={styles.example}>
        <span>示例</span>
        <Tag>[背景]电影</Tag>
        <Tag>[外观]{sampleModel}&gt;{sampleExpression}</Tag>
        <Tag>[音乐|随机播放]</Tag>
      </div>

      {PANEL_GROUPS.map((group) => {
        // 一行算一项：模式组里只要有一条被关掉，这一行就不算「全开」
        const enabled = group.rows.filter((row) => row.actions.every((action) => commands[action.id])).length
        return (
          <section className={styles.group} key={group.area}>
            <div className={styles.groupHead}>
              <span className={styles.groupName}>{group.area}</span>
              {/* 区域已经按「动哪儿」切开了，控制台只作补充：它决定这句反馈由谁来说 */}
              <span className={styles.groupScope}>{SCOPE_LABEL[group.scope]}</span>
              <span className={styles.groupCount}>已启用 {enabled} / {group.rows.length}</span>
            </div>
            <ul className={styles.list}>
              {group.rows.map((row) => {
                const on = row.actions.every((action) => commands[action.id])
                // 单条动作才可能带「能填哪些名字」，模式组的几条都是固定写法
                const single = row.actions.length === 1 ? row.actions[0] : null
                const hint = single ? options[single.id] : undefined
                const template = single ? single.template : modeGroupTemplate(row.actions)
                return (
                  <li className={cx(styles.row, !on && styles.rowOff)} key={row.key}>
                    <div className={styles.copy}>
                      {/* 标题只说「控制的是哪个功能」，指令模板退到第二行当参考 ——
                          一眼扫的是功能名，要发什么再往下看 */}
                      <span className={styles.label}>{row.label}</span>
                      {/* 能填哪些名字收进模板的 Tooltip：单独占一行时它只在「配指令」
                          那一刻有用，平时全是噪音。模板本身就是「这里要填东西」的位置 */}
                      {hint && hint.length > 0 ? (
                        <Tooltip
                          // Tooltip 里同样分色，多行（= 多个角色）之间用一条细线隔开
                          title={hint.map((line, lineIndex) => (
                            <span className={styles.tipLine} key={lineIndex}>
                              {line.map((part) => (
                                <span className={styles.optionPart} key={part.label}>
                                  <span className={styles.optionLabel}>{part.label}：</span>
                                  <span className={styles.optionValue}>{part.value}</span>
                                </span>
                              ))}
                            </span>
                          ))}
                        >
                          <code className={cx(styles.template, styles.hinted)}>{template}</code>
                        </Tooltip>
                      ) : (
                        <code className={styles.template}>{template}</code>
                      )}
                    </div>
                    <Switch
                      checked={on}
                      ariaLabel={`启用「${row.label}」`}
                      onChange={(checked) => row.actions.forEach((action) => onToggle(action.id, checked))}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
