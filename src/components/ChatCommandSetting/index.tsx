import { useMemo } from 'react'
import { PARTICLE_PRESETS } from '../Atmosphere'
import { FILTER_PRESETS } from '../FilterSetting'
import { Switch } from '../Switch'
import { Tooltip } from '../Tooltip'
import { cx } from '../../utils/cx'
import { useModel, useMusic, useStage, useVoice } from '../../hooks'
import { BACKGROUND_PRESETS } from '../../contexts/StageProvider/presets'
import { CHAT_COMMANDS, type ChatCommandId, type ChatCommandScope } from '../../data/chatCommands'
import styles from './index.module.scss'

export type ChatCommandSettingProps = {
  /** 指令 id → 是否启用 */
  commands: Record<ChatCommandId, boolean>
  onToggle: (id: ChatCommandId, enabled: boolean) => void
}

const SCOPE_LABEL: Record<ChatCommandScope, string> = {
  model: '模型控制台',
  stage: '舞台控制台',
}

/** 提示行里的一段「标签 + 内容」，标签压暗、内容提亮，靠分色区分键和值 */
type HintPart = { label: string; value: string }

/** 一条提示（一行）。多段之间靠间距隔开，不加分隔符 —— 分色已经把键和值分清了 */
type HintLine = HintPart[]

/**
 * 弹幕指令的配置面板：逐条列出指令模板，右侧一个开关决定要不要响应。
 *
 * 每个模板下面顺手列出「现在能用哪些名字」—— 背景、滤镜、音乐都能自己加，
 * 光看模板里的 `$背景名称` 根本猜不到能填什么。
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
   * 指令 id → 提示行（一行一条，渲染时逐行省略、Tooltip 里看全）。空数组表示这条没有可填的名字。
   *
   * 外观按角色分行：每个角色的外观名各不相同，挤成一行根本看不出哪个名字属于哪个角色。
   * 外观名动辄几十个，所以行内必然被截断，完整清单交给 Tooltip。
   */
  const options = useMemo<Partial<Record<ChatCommandId, HintLine[]>>>(() => {
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
        { label: '外观', value: model.expressions.join('/') },
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

  const groups: ChatCommandScope[] = ['model', 'stage']

  return (
    <div className={styles.root}>
      <p className={styles.intro}>
        观众发送下面格式的弹幕就能远程操作控制台，每条指令都会让模型说一句话播报结果
        （没找到配置也会说）。指令不依赖 AI 自动回复开关，优先级排在礼物答谢、进场欢迎之后，普通弹幕之前。
      </p>
      <div className={styles.example}>
        <span>示例</span>
        <code>[背景]电影</code>
        <code>[外观|{sampleModel}]{sampleExpression}</code>
        <code>[音乐|随机播放]</code>
      </div>

      {groups.map((scope) => {
        const list = CHAT_COMMANDS.filter((command) => command.scope === scope)
        const enabled = list.filter((command) => commands[command.id]).length
        return (
          <section className={styles.group} key={scope}>
            <div className={styles.groupHead}>
              <span>{SCOPE_LABEL[scope]}</span>
              <span className={styles.groupCount}>已启用 {enabled} / {list.length}</span>
            </div>
            <ul className={styles.list}>
              {list.map((command) => {
                const on = Boolean(commands[command.id])
                const hint = options[command.id]
                return (
                  <li className={cx(styles.row, !on && styles.rowOff)} key={command.id}>
                    <div className={styles.copy}>
                      <code className={styles.template}>{command.template}</code>
                      <small className={styles.description}>{command.description}</small>
                      {hint && hint.length > 0 && (
                        <Tooltip
                          block
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
                          <small className={styles.options}>
                            {hint.map((line, lineIndex) => (
                              <span className={styles.optionLine} key={lineIndex}>
                                {line.map((part) => (
                                  <span className={styles.optionPart} key={part.label}>
                                    <span className={styles.optionLabel}>{part.label}：</span>
                                    <span className={styles.optionValue}>{part.value}</span>
                                  </span>
                                ))}
                              </span>
                            ))}
                          </small>
                        </Tooltip>
                      )}
                    </div>
                    <Switch
                      checked={on}
                      ariaLabel={`启用指令「${command.template}」`}
                      onChange={(checked) => onToggle(command.id, checked)}
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
