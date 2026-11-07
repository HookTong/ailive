import { useCallback, useRef } from 'react'
import { PARTICLE_PRESETS } from '../../components/Atmosphere'
import { FILTER_PRESETS } from '../../components/FilterSetting'
import { useModel } from '../../contexts/ModelProvider/ModelContext'
import { useMusic } from '../../contexts/MusicProvider/MusicContext'
import { useStage } from '../../contexts/StageProvider/StageContext'
import { BACKGROUND_PRESETS } from '../../contexts/StageProvider/presets'
import { useVoice } from '../../contexts/VoiceProvider/VoiceContext'
import { normalizeCommandName, type ChatCommandId, type ParsedChatCommand } from '../../data/chatCommands'

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

    /** 按展示名找角色，忽略空白与大小写 */
    const findModel = (name: string | undefined) => {
      if (!name) return undefined
      const key = normalizeCommandName(name)
      return ctx.modelSources.find((source) => normalizeCommandName(source.name) === key)
    }

    switch (id) {
      case 'expression': {
        const model = findModel(head[1])
        if (!model) return fail(`没有找到「${head[1] ?? ''}」这个角色`)
        const state = ctx.characterStates[model.id]
        if (!state?.manifest) return fail(`「${model.name}」的模型配置还没加载好`, model.id)
        const key = normalizeCommandName(payload)
        const expression = Object.keys(state.manifest.expressions)
          .find((name) => normalizeCommandName(name) === key)
        if (!expression) return fail(`「${model.name}」没有「${payload}」这个外观`, model.id)
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
        if (!model) return fail(`没有找到「${head[1] ?? ''}」这个角色`)
        ctx.updateCharacter(model.id, { selectedExpressions: [] })
        return { id, ok: true, speech: '外观已清除', modelId: model.id }
      }

      case 'voice': {
        const model = findModel(head[1])
        if (!model) return fail(`没有找到「${head[1] ?? ''}」这个角色`)
        const key = normalizeCommandName(payload)
        const voice = ctx.voices.find((item) => normalizeCommandName(item.label) === key)
        if (!voice) return fail(`没有找到「${payload}」这个音色`, model.id)
        ctx.updateCharacter(model.id, { voicePresetId: voice.id })
        return { id, ok: true, speech: `音色已换成「${voice.label}」`, modelId: model.id }
      }

      case 'background': {
        const key = normalizeCommandName(payload)
        const preset = [...BACKGROUND_PRESETS, ...ctx.stage.customBackgrounds]
          .find((item) => normalizeCommandName(item.label) === key)
        if (!preset) return fail(`没有找到「${payload}」这个背景`)
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
        const key = normalizeCommandName(payload)
        const preset = PARTICLE_PRESETS.find((item) => normalizeCommandName(item.label) === key)
        if (!preset) return fail(`没有找到「${payload}」这个粒子特效`)
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
        const key = normalizeCommandName(payload)
        const preset = [...FILTER_PRESETS, ...ctx.stage.customFilterPresets]
          .find((item) => normalizeCommandName(item.label) === key)
        if (!preset) return fail(`没有找到「${payload}」这个滤镜`)
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
        const key = normalizeCommandName(payload)
        const preset = ctx.tracks.find((item) => normalizeCommandName(item.label) === key)
        if (!preset) return fail(`没有找到「${payload}」这首音乐`)
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
