import { useCallback, useRef } from 'react'
import { PARTICLE_PRESETS } from '../../components/Atmosphere'
import { FILTER_PRESETS } from '../../components/FilterSetting'
import { useModel } from '../../contexts/ModelProvider/ModelContext'
import { useMusic } from '../../contexts/MusicProvider/MusicContext'
import { useStage } from '../../contexts/StageProvider/StageContext'
import { BACKGROUND_PRESETS } from '../../contexts/StageProvider/presets'
import { useVoice } from '../../contexts/VoiceProvider/VoiceContext'
import type { ActionId, ParsedAction } from '../../data/actions'
import { closestFixedValue, findFixedAction } from '../../data/actions'
import { findClosestMatch } from '../../utils/matchName'

export type ChatCommandResult = {
  id: ActionId
  /** 指令有没有真的执行成功（没找到配置名、模型配置没加载好都算失败） */
  ok: boolean
  /** 让模型说出来的那句话：成功说结果，失败说没找到什么 */
  speech: string
  /**
   * 角色控制台指令指定的角色 —— 这条反馈必须由它来说。
   * 舞台指令（以及找不到角色时的失败）是 null，交给轮流挑人。
   */
  modelId: string | null
}

/**
 * 弹幕指令的执行器：把解析好的指令翻译成各个上下文上的实际动作。
 *
 * 方括号**外面**填的名字（角色 / 外观 / 音色 / 背景 / 特效 / 滤镜 / 音乐）都是**变量**，
 * 全部走**模糊匹配**：观众看不到配置面板，记不全名字是常态（「赛博朋克」对「赛博」、
 * 「鲸鱼」对「DS 鲸鱼娘」），精确相等会把绝大部分指令变成「没有找到」。匹配规则见 utils/matchName。
 *
 * 方括号**里面**的**固定值**（`固定` / `循环` / `清除` / `单曲循环`……）不参与模糊匹配，
 * 解析阶段就一字不差地比对（`data/actions` 的 `parseAction`）。执行器这边只补最后一手：
 * 观众把固定值写到了方括号外面（`[外观]鲸鱼娘>清除`、`[背景]固定的`）时，不执行、不模糊匹配，
 * 直接把「要按模板写」递回去。
 *
 * 这里只改状态、不负责说话 —— 说什么、谁来说、什么时候说，
 * 都在 AiChatProvider 的回复队列里统一排队（和 AI 回复共用一套节流）。
 */
export function useChatCommand() {
  const { modelSources, characterStates, updateCharacter } = useModel()
  const { voices } = useVoice()
  const stage = useStage()
  const { tracks, selectPreset, setLoopMode, isPlaying, play, pause } = useMusic()

  /**
   * 上下文全塞进 ref，让 execute 保持稳定引用。
   * 它被挂在「弹幕事件流」那个 effect 上，每次背景 / 音乐一变就换函数会让 effect 反复重跑。
   */
  const contextRef = useRef({ modelSources, characterStates, updateCharacter, voices, stage, tracks, selectPreset, setLoopMode, isPlaying, play, pause })
  contextRef.current = { modelSources, characterStates, updateCharacter, voices, stage, tracks, selectPreset, setLoopMode, isPlaying, play, pause }

  return useCallback((command: ParsedAction): ChatCommandResult => {
    const ctx = contextRef.current
    // 方括号里是固定值（第 0 段是关键字），外面是变量，顺序同 data/actions 的 params
    const { id, fixed, vars } = command
    const keyword = fixed[0]

    /**
     * 失败播报只说「没找到什么」，**不列可选值**。
     *
     * 列出来本来是想帮观众纠正，可这条话是要念出来的：
     * 「没有找到「赛博朋克」这个背景，可选：默认 / 电影 / 赛博 / 幻想 / Lo-fi」——
     * 后面半句又长又听不清，还常常盖住前一句。要查名字看面板就行，播报只负责说清结果。
     *
     * 也**不写角色名**：这句话本来就是由那个角色说出口的（`modelId` 已经指定了谁来说），
     * 再说一遍「「DS 鲸鱼娘」没有……」等于让它用第三人称称呼自己。
     */
    const fail = (speech: string, modelId: string | null = null): ChatCommandResult =>
      ({ id, ok: false, speech, modelId })

    /** 按展示名找角色，名字记不全也认（「鲸鱼」→「鲸鱼娘」） */
    const findModel = (name: string | undefined) =>
      findClosestMatch(name, ctx.modelSources, (source) => source.name)

    /**
     * 变量槽里写的是**固定写法**（`[外观]鲸鱼娘>清除`、`[背景]固定的`）——
     * 别拿它去和名字模糊匹配：方括号里的是确定的值，一字不差、还得写进方括号里。
     * 返回 null 表示这确实只是个（写错或没配的）名字，交给调用方报「没有找到」。
     *
     * 只在名字**查不到之后**才问一句，免得挡住真叫这个名字的预设。
     */
    const fixedMismatch = (value: string, label: string): ChatCommandResult | null => {
      // 一字不差的固定值写到了方括号外面：不执行，直接把模板递过去
      const exact = findFixedAction(keyword, value)
      if (exact) return fail(`「${value}」是固定写法，要按模板写：${exact.template}`)
      // 写错一个字的固定值（`[背景]固定的`）：报固定写法，别和名字混
      if (!closestFixedValue(keyword, value)) return null
      return fail(`「${value}」不是${label}，固定写法要一字不差`)
    }

    switch (id) {
      case 'expression': {
        const [modelName, expressionName] = vars
        const model = findModel(modelName)
        if (!model) {
          return fail(`没有找到「${modelName}」这个角色`)
        }
        const state = ctx.characterStates[model.id]
        // 播报里不写角色名：这句话本来就是由这个角色说的，再说一遍「XX 的模型配置」
        // 等于让它自称第三人称
        if (!state?.manifest) return fail('模型配置还没加载好', model.id)
        // 外观名由模型 manifest 提供，观众只可能照面板念个大概
        const expressions = Object.keys(state.manifest.expressions)
        const expression = findClosestMatch(expressionName, expressions, (name) => name)
        if (!expression) {
          return fixedMismatch(expressionName, '外观名')
            ?? fail(`没有找到「${expressionName}」这个外观`, model.id)
        }
        const selected = state.selectedExpressions.includes(expression)
        ctx.updateCharacter(model.id, {
          selectedExpressions: selected
            ? state.selectedExpressions.filter((name) => name !== expression)
            : [...state.selectedExpressions, expression],
        })
        return {
          id,
          ok: true,
          speech: `外观「${expression}」已${selected ? '关闭' : '开启'}`,
          modelId: model.id,
        }
      }

      case 'expressionClear': {
        const [modelName] = vars
        const model = findModel(modelName)
        if (!model) {
          return fail(`没有找到「${modelName}」这个角色`)
        }
        ctx.updateCharacter(model.id, { selectedExpressions: [] })
        return { id, ok: true, speech: '外观已清除', modelId: model.id }
      }

      case 'voice': {
        const [modelName, voiceName] = vars
        const model = findModel(modelName)
        if (!model) {
          return fail(`没有找到「${modelName}」这个角色`)
        }
        const voice = findClosestMatch(voiceName, ctx.voices, (item) => item.label)
        if (!voice) {
          return fixedMismatch(voiceName, '音色名')
            ?? fail(`没有找到「${voiceName}」这个音色`, model.id)
        }
        ctx.updateCharacter(model.id, { voicePresetId: voice.id })
        return { id, ok: true, speech: `音色已换成「${voice.label}」`, modelId: model.id }
      }

      case 'background': {
        const [backgroundName] = vars
        const presets = [...BACKGROUND_PRESETS, ...ctx.stage.customBackgrounds]
        const preset = findClosestMatch(backgroundName, presets, (item) => item.label)
        if (!preset) {
          return fixedMismatch(backgroundName, '背景名')
            ?? fail(`没有找到「${backgroundName}」这个背景`)
        }
        // 换图必须切回固定，否则停在「关闭」上换了也看不见
        ctx.stage.setBackgroundUrl(preset.url)
        ctx.stage.setBackgroundMode('fixed')
        return { id, ok: true, speech: `背景已切换为「${preset.label}」`, modelId: null }
      }

      case 'backgroundFixed':
        ctx.stage.setBackgroundMode('fixed')
        return { id, ok: true, speech: '背景已固定', modelId: null }

      case 'backgroundCycle':
        ctx.stage.setBackgroundMode('cycle')
        return { id, ok: true, speech: '背景开始循环切换', modelId: null }

      case 'backgroundRandom':
        ctx.stage.setBackgroundMode('random')
        return { id, ok: true, speech: '背景开始随机切换', modelId: null }

      case 'backgroundOn':
        // 和面板上那个开关同一条路径：只铺图，轮换方式和选中项都回到关掉前
        ctx.stage.setBackgroundVisible(true)
        return { id, ok: true, speech: '背景已开启', modelId: null }

      case 'backgroundOff':
        ctx.stage.setBackgroundVisible(false)
        return { id, ok: true, speech: '背景已关闭', modelId: null }

      case 'particle': {
        const [particleName] = vars
        const preset = findClosestMatch(particleName, PARTICLE_PRESETS, (item) => item.label)
        if (!preset) {
          return fixedMismatch(particleName, '特效名')
            ?? fail(`没有找到「${particleName}」这个粒子特效`)
        }
        ctx.stage.handleParticlePresetChange(preset.id)
        // 粒子开关关着的时候换了也看不见，顺手打开
        ctx.stage.setParticleEnabled(true)
        return { id, ok: true, speech: `粒子特效已切换为「${preset.label}」`, modelId: null }
      }

      case 'particleFixed':
        ctx.stage.setParticleMode('fixed')
        ctx.stage.setParticleEnabled(true)
        return { id, ok: true, speech: '粒子特效已固定', modelId: null }

      case 'particleCycle':
        ctx.stage.setParticleMode('cycle')
        ctx.stage.setParticleEnabled(true)
        return { id, ok: true, speech: '粒子特效开始循环切换', modelId: null }

      case 'particleRandom':
        ctx.stage.setParticleMode('random')
        ctx.stage.setParticleEnabled(true)
        return { id, ok: true, speech: '粒子特效开始随机切换', modelId: null }

      case 'particleOn':
        ctx.stage.setParticleEnabled(true)
        return { id, ok: true, speech: '粒子特效已开启', modelId: null }

      case 'particleOff':
        ctx.stage.setParticleEnabled(false)
        return { id, ok: true, speech: '粒子特效已关闭', modelId: null }

      case 'filter': {
        const [filterName] = vars
        const presets = [...FILTER_PRESETS, ...ctx.stage.customFilterPresets]
        const preset = findClosestMatch(filterName, presets, (item) => item.label)
        if (!preset) {
          return fixedMismatch(filterName, '滤镜名')
            ?? fail(`没有找到「${filterName}」这个滤镜`)
        }
        ctx.stage.handleFilterPresetChange(preset.id)
        return { id, ok: true, speech: `舞台滤镜已切换为「${preset.label}」`, modelId: null }
      }

      case 'filterFixed':
        ctx.stage.setFilterMode('fixed')
        ctx.stage.setFilterEnabled(true)
        return { id, ok: true, speech: '舞台滤镜已固定', modelId: null }

      case 'filterCycle':
        ctx.stage.setFilterMode('cycle')
        ctx.stage.setFilterEnabled(true)
        return { id, ok: true, speech: '舞台滤镜开始循环切换', modelId: null }

      case 'filterRandom':
        ctx.stage.setFilterMode('random')
        ctx.stage.setFilterEnabled(true)
        return { id, ok: true, speech: '舞台滤镜开始随机切换', modelId: null }

      case 'filterOn':
        // setFilterEnabled 是包装过的：重新打开会把关掉前选的那一项还回来
        ctx.stage.setFilterEnabled(true)
        return { id, ok: true, speech: '舞台滤镜已开启', modelId: null }

      case 'filterOff':
        ctx.stage.setFilterEnabled(false)
        return { id, ok: true, speech: '舞台滤镜已关闭', modelId: null }

      case 'music': {
        const [musicName] = vars
        const preset = findClosestMatch(musicName, ctx.tracks, (item) => item.label)
        if (!preset) {
          return fixedMismatch(musicName, '音乐名')
            ?? fail(`没有找到「${musicName}」这首音乐`)
        }
        ctx.selectPreset(preset)
        return { id, ok: true, speech: `背景音乐已切换为「${preset.label}」`, modelId: null }
      }

      case 'musicSingle':
        ctx.setLoopMode('single')
        return { id, ok: true, speech: '播放模式已设为「单曲循环」', modelId: null }

      case 'musicList':
        ctx.setLoopMode('list')
        return { id, ok: true, speech: '播放模式已设为「列表循环」', modelId: null }

      case 'musicShuffle':
        ctx.setLoopMode('shuffle')
        return { id, ok: true, speech: '播放模式已设为「随机播放」', modelId: null }

      // 「播放」「暂停」是两条独立指令，各自**幂等** —— 连发两次「播放」不该把歌停掉。
      // 已经处在目标状态时照实说，别硬报一句「已开始播放」（观众听得出没动）
      case 'musicPlay':
        if (ctx.isPlaying) return { id, ok: true, speech: '音乐正在播放', modelId: null }
        ctx.play()
        return { id, ok: true, speech: '音乐已开始播放', modelId: null }

      case 'musicPause':
        if (!ctx.isPlaying) return { id, ok: true, speech: '音乐当前是暂停的', modelId: null }
        ctx.pause()
        return { id, ok: true, speech: '音乐已暂停', modelId: null }

      default:
        return fail('这条指令还没实现')
    }
  }, [])
}
