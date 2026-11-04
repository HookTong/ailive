import type { VolcengineVoicePreset } from '../../hooks/useTts/api'

const DEFAULT_VOLCENGINE_TTS_RESOURCE_ID = 'seed-tts-2.0'

/** 内置音色预设，排在自定义音色之前 */
export const VOLCENGINE_VOICE_PRESETS: readonly VolcengineVoicePreset[] = [
  { id: 'clear-female', label: '清新', voiceType: 'zh_female_vv_uranus_bigtts', resourceId: DEFAULT_VOLCENGINE_TTS_RESOURCE_ID, speedRatio: 1, pitchRatio: 1 },
  { id: 'gentle-female', label: '温柔', voiceType: 'zh_female_roumeinvyou_uranus_bigtts', resourceId: DEFAULT_VOLCENGINE_TTS_RESOURCE_ID, speedRatio: 0.95, pitchRatio: 1 },
  { id: 'lively-female', label: '活力', voiceType: 'ICL_uranus_zh_female_huoponvhai_tob', resourceId: 'seed-icl-2.0', speedRatio: 1.08, pitchRatio: 1 },
  { id: 'steady-female', label: '沉稳', voiceType: 'ICL_uranus_zh_female_qingxinshaonv_tob', resourceId: 'seed-icl-2.0', speedRatio: 0.92, pitchRatio: 1 },
  { id: 'friendly-female', label: '亲切', voiceType: 'zh_female_peiqi_uranus_bigtts', resourceId: DEFAULT_VOLCENGINE_TTS_RESOURCE_ID, speedRatio: 1, pitchRatio: 1 },
]

/**
 * 新角色 / 重置角色时使用的默认音色。
 * ModelProvider 在 VoiceProvider 外层，拿不到合并后的音色列表，
 * 所以这里单独导出一个 id 常量，避免它去引用整个预设数组。
 */
export const DEFAULT_VOLCENGINE_VOICE_PRESET_ID = VOLCENGINE_VOICE_PRESETS[0].id
