import { useCallback, useRef } from 'react'
import { PARTICLE_PRESETS } from '../../components/Atmosphere'
import { FILTER_PRESETS } from '../../components/FilterSetting'
import { useModel } from '../../contexts/ModelProvider/ModelContext'
import { useMusic } from '../../contexts/MusicProvider/MusicContext'
import { useStage } from '../../contexts/StageProvider/StageContext'
import { BACKGROUND_PRESETS } from '../../contexts/StageProvider/presets'
import { useVoice } from '../../contexts/VoiceProvider/VoiceContext'
import type { ChatCommandId, ParsedChatCommand } from '../../data/chatCommands'
import { findClosestMatch } from '../../utils/matchName'

export type ChatCommandResult = {
  id: ChatCommandId
  /** 指令有没有真的执行成功（没找到配置名、模型配置没加载好都算失败） */
  ok: boolean
  /** 让模型说出来的那句话：成功说结果，失败说没找到什么 */
  speech: string
  /**
   * 模型控制台指令指定的角色 —— 这条反馈必须由它来说。
   * 舞台指令（以及找不到角色时的失败）是 null，交给轮流挑人。
   */
  modelId: string | null
}

/**
 * 弹幕指令的执行器：把解析好的指令翻译成各个上下文上的实际动作。
 *
 * 里面填的名字（角色 / 外观 / 音色 / 背景 / 粒子 / 滤镜 / 音乐）全部走**模糊匹配**：
 * 观众看不到配置面板，记不全名字是常态（「赛博朋克」对「赛博」、「鲸鱼」对「DS 鲸鱼娘」），
 * 精确相等会把绝大部分指令变成「没有找到」。匹配规则见 utils/matchName。
 *
 * 这里只改状态、不负责说话 —— 说什么、谁来说、什么时候说，
 * 都在 AiChatProvider 的回复队列里统一排队（和 AI 回复共用一套节流）。
 */
export function useChatCommand() {
  const { modelSources, characterStates, updateCharacter } = useModel()
  const { voices } = useVoice()
  const stage = useStage()
  const { tracks, selectPreset, setLoopMode } = useMusic()

  /**
   * 上下文全塞进 ref，让 execute 保持稳定引用。
   * 它被挂在「弹幕事件流」那个 effect 上，每次背景 / 音乐一变就换函数会让 effect 反复重跑。
   */
  const contextRef = useRef({ modelSources, characterStates, updateCharacter, voices, stage, tracks, selectPreset, setLoopMode })
  contextRef.current = { modelSources, characterStates, updateCharacter, voices, stage, tracks, selectPreset, setLoopMode }

  return useCallback((command: ParsedChatCommand): ChatCommandResult => {
    const ctx = contextRef.current
    const { id, head, payload } = command

    const fail = (speech: string, modelId: string | null = null): ChatCommandResult =>
      ({ id, ok: false, speech, modelId })

    /**
     * 没匹配上时把「现在有哪些名字」一起报出来。
     * 观众看不到配置面板，光说一句「没有找到」他也没法自己纠正 —— 这条播报是唯一能递过去的线索。
     * 名字多的（粒子 20 来个、外观几十个）只报前几个，报全了既听不清也占满整句；
     * 6 是「背景 / 滤镜 / 音色」这类短名单的长度，正好能一次报完、不出现「等 N 个」。
     */
    const available = (labels: readonly string[], limit = 6): string => {
      // 角色名允许为空（没配名字时名牌退回 manifest.displayName），别报出一串「 / 」
      const names = labels.filter((label) => label.trim().length > 0)
      if (names.length === 0) return ''
      const shown = names.slice(0, limit).join(' / ')
      return names.length > limit ? `，可选：${shown} 等 ${names.length} 个` : `，可选：${shown}`
    }

    /** 按展示名找角色，名字记不全也认（「鲸鱼」→「鲸鱼娘」） */
    const findModel = (name: string | undefined) =>
      findClosestMatch(name, ctx.modelSources, (source) => source.name)

    switch (id) {
      case 'expression': {
        const model = findModel(head[1])
        if (!model) {
          return fail(`没有找到「${head[1] ?? ''}」这个角色${available(ctx.modelSources.map((source) => source.name))}`)
        }
        const state = ctx.characterStates[model.id]
        if (!state?.manifest) return fail(`「${model.name}」的模型配置还没加载好`, model.id)
        // 外观名由模型 manifest 提供，观众只可能照面板念个大概
        const expressions = Object.keys(state.manifest.expressions)
        const expression = findClosestMatch(payload, expressions, (name) => name)
        if (!expression) {
          return fail(`「${model.name}」没有「${payload}」这个外观${available(expressions)}`, model.id)
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
        const model = findModel(head[1])
        if (!model) {
          return fail(`没有找到「${head[1] ?? ''}」这个角色${available(ctx.modelSources.map((source) => source.name))}`)
        }
        ctx.updateCharacter(model.id, { selectedExpressions: [] })
        return { id, ok: true, speech: '外观已清除', modelId: model.id }
      }

      case 'voice': {
        const model = findModel(head[1])
        if (!model) {
          return fail(`没有找到「${head[1] ?? ''}」这个角色${available(ctx.modelSources.map((source) => source.name))}`)
        }
        const voice = findClosestMatch(payload, ctx.voices, (item) => item.label)
        if (!voice) {
          return fail(`没有找到「${payload}」这个音色${available(ctx.voices.map((item) => item.label))}`, model.id)
        }
        ctx.updateCharacter(model.id, { voicePresetId: voice.id })
        return { id, ok: true, speech: `音色已换成「${voice.label}」`, modelId: model.id }
      }

      case 'background': {
        const presets = [...BACKGROUND_PRESETS, ...ctx.stage.customBackgrounds]
        const preset = findClosestMatch(payload, presets, (item) => item.label)
        if (!preset) return fail(`没有找到「${payload}」这个背景${available(presets.map((item) => item.label))}`)
        // 换图必须切回固定，否则停在「无背景」上换了也看不见
        ctx.stage.setBackgroundUrl(preset.url)
        ctx.stage.setBackgroundMode('fixed')
        return { id, ok: true, speech: `背景已切换为「${preset.label}」`, modelId: null }
      }

      case 'backgroundNone':
        ctx.stage.setBackgroundMode('none')
        return { id, ok: true, speech: '背景已关闭', modelId: null }

      case 'backgroundFixed':
        ctx.stage.setBackgroundMode('fixed')
        return { id, ok: true, speech: '背景已固定', modelId: null }

      case 'backgroundCycle':
        ctx.stage.setBackgroundMode('cycle')
        return { id, ok: true, speech: '背景开始循环切换', modelId: null }

      case 'particle': {
        const preset = findClosestMatch(payload, PARTICLE_PRESETS, (item) => item.label)
        if (!preset) {
          return fail(`没有找到「${payload}」这个粒子特效${available(PARTICLE_PRESETS.map((item) => item.label))}`)
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

      case 'filter': {
        const presets = [...FILTER_PRESETS, ...ctx.stage.customFilterPresets]
        const preset = findClosestMatch(payload, presets, (item) => item.label)
        if (!preset) return fail(`没有找到「${payload}」这个滤镜${available(presets.map((item) => item.label))}`)
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

      case 'music': {
        const preset = findClosestMatch(payload, ctx.tracks, (item) => item.label)
        if (!preset) return fail(`没有找到「${payload}」这首音乐${available(ctx.tracks.map((item) => item.label))}`)
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

      default:
        return fail('这条指令还没实现')
    }
  }, [])
}
