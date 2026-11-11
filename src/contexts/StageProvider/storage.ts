import { PARTICLE_PRESETS, type ParticlePreset, type ParticlePresetSettings } from '../../components/Atmosphere'
import type { FilterPreset } from '../../components/FilterSetting'
import { DEFAULT_BACKGROUND_URL, type PresetRotateMode } from './presets'
import type { BackgroundMode } from './StageContext'

export const STAGE_CONSOLE_STORAGE_KEY = 'ailive.stage-console'

/** 舞台设置的默认值。背景 / 粒子 / 滤镜三块各自初始状态的唯一来源 */
export const DEFAULT_STAGE_CONSOLE = {
  backgroundUrl: DEFAULT_BACKGROUND_URL,
  backgroundMode: 'fixed' as BackgroundMode,
  particleEnabled: true,
  particlePreset: PARTICLE_PRESETS[0].id,
  particleMode: 'fixed' as PresetRotateMode,
  filterEnabled: true,
  filterPreset: 'standard' as FilterPreset,
  filterMode: 'fixed' as PresetRotateMode,
}

/** 每个预设各自被调过的参数，没动过的键不写 */
export type ParticleOverrides = Partial<Record<ParticlePreset, Partial<ParticlePresetSettings>>>

export type StoredStageConsole = {
  backgroundUrl: string
  backgroundMode: BackgroundMode
  particleEnabled: boolean
  particlePreset: ParticlePreset
  particleMode: PresetRotateMode
  /**
   * 只记「被改过」的预设参数。23 套预设 × 5 个字段整张写进去有一千多字符，
   * 而绝大多数是没动过的默认值 —— 写差异、读的时候再和内置默认合并。
   */
  particleOverrides: ParticleOverrides
  filterEnabled: boolean
  /** 可能是 `custom:123`：能不能用要等自定义滤镜列表读出来才知道，这里只保证是字符串 */
  filterPreset: FilterPreset
  filterMode: PresetRotateMode
}

const EMPTY: StoredStageConsole = { ...DEFAULT_STAGE_CONSOLE, particleOverrides: {} }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const readNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback

const readBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

const isParticlePreset = (value: unknown): value is ParticlePreset =>
  typeof value === 'string' && PARTICLE_PRESETS.some((preset) => preset.id === value)

const readRotateMode = (value: unknown): PresetRotateMode =>
  (value === 'cycle' || value === 'random' ? value : 'fixed')

const readBackgroundMode = (value: unknown): BackgroundMode =>
  (value === 'cycle' || value === 'random' || value === 'none' ? value : 'fixed')

/** `type="color"` 和预设色点都只产出 `#rrggbb`，别的形状（rgb()、颜色名）一律不认 */
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * 把一份可能缺字段、可能超出滑块范围的参数合到默认值上。
 * 滑块的 min / max 分散在 ParticleSetting 里，这里再抄一遍是有意的 ——
 * 存进去的是上一版代码写的数，范围改过之后老数据会直接落在轨道外面。
 */
function mergeParticleSettings(
  base: ParticlePresetSettings,
  override?: Partial<ParticlePresetSettings>,
): ParticlePresetSettings {
  if (!override) return { ...base }
  return {
    color: typeof override.color === 'string' && COLOR_PATTERN.test(override.color) ? override.color : base.color,
    intensity: readNumber(override.intensity, base.intensity, 0, 1),
    speed: readNumber(override.speed, base.speed, 0.3, 2),
    opacity: readNumber(override.opacity, base.opacity, 0, 1),
    size: readNumber(override.size, base.size, 0.5, 2.5),
  }
}

/**
 * 每套预设的完整参数 = 内置默认值 + 用户改过的部分。
 * 传不传 overrides 都能用：不传就是一份干净的默认表（重置舞台走这条）。
 */
export function createParticlePresetConfigs(
  overrides?: ParticleOverrides,
): Record<ParticlePreset, ParticlePresetSettings> {
  return Object.fromEntries(
    PARTICLE_PRESETS.map(({ id, color, intensity, speed, opacity, size }) => [
      id,
      mergeParticleSettings({ color, intensity, speed, opacity, size }, overrides?.[id]),
    ]),
  ) as Record<ParticlePreset, ParticlePresetSettings>
}

/** 反过来：把当前这张表压成「和内置默认值不一样的部分」 */
export function toParticleOverrides(configs: Record<ParticlePreset, ParticlePresetSettings>): ParticleOverrides {
  const overrides: ParticleOverrides = {}
  for (const preset of PARTICLE_PRESETS) {
    const config = configs[preset.id]
    if (!config) continue
    const diff: Partial<ParticlePresetSettings> = {}
    if (config.color !== preset.color) diff.color = config.color
    if (config.intensity !== preset.intensity) diff.intensity = config.intensity
    if (config.speed !== preset.speed) diff.speed = config.speed
    if (config.opacity !== preset.opacity) diff.opacity = config.opacity
    if (config.size !== preset.size) diff.size = config.size
    if (Object.keys(diff).length > 0) overrides[preset.id] = diff
  }
  return overrides
}

function readParticleOverrides(value: unknown): ParticleOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const overrides: ParticleOverrides = {}
  for (const [id, item] of Object.entries(value as Record<string, unknown>)) {
    if (!isParticlePreset(id) || !item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    // 数值留到合并时再夹：那边的范围定义就在 mergeParticleSettings 里，只写一份
    const override: Partial<ParticlePresetSettings> = {}
    if (typeof raw.color === 'string') override.color = raw.color
    if (typeof raw.intensity === 'number') override.intensity = raw.intensity
    if (typeof raw.speed === 'number') override.speed = raw.speed
    if (typeof raw.opacity === 'number') override.opacity = raw.opacity
    if (typeof raw.size === 'number') override.size = raw.size
    if (Object.keys(override).length > 0) overrides[id] = override
  }
  return overrides
}

/**
 * 读回上次的舞台设置。
 *
 * 逐项校验、读不懂就退回默认 —— 这份数据是上一版代码写的，
 * 整块 JSON.parse 成功不代表里面的东西还能用（字段类型改过、预设被删过都是常事）。
 */
export function loadStageConsole(): StoredStageConsole {
  try {
    const raw = window.localStorage.getItem(STAGE_CONSOLE_STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY
    const record = parsed as Record<string, unknown>
    return {
      backgroundUrl: typeof record.backgroundUrl === 'string' && record.backgroundUrl.trim()
        ? record.backgroundUrl
        : DEFAULT_STAGE_CONSOLE.backgroundUrl,
      backgroundMode: readBackgroundMode(record.backgroundMode),
      particleEnabled: readBoolean(record.particleEnabled, DEFAULT_STAGE_CONSOLE.particleEnabled),
      particlePreset: isParticlePreset(record.particlePreset) ? record.particlePreset : DEFAULT_STAGE_CONSOLE.particlePreset,
      particleMode: readRotateMode(record.particleMode),
      particleOverrides: readParticleOverrides(record.particleOverrides),
      filterEnabled: readBoolean(record.filterEnabled, DEFAULT_STAGE_CONSOLE.filterEnabled),
      filterPreset: typeof record.filterPreset === 'string' && record.filterPreset
        ? record.filterPreset as FilterPreset
        : DEFAULT_STAGE_CONSOLE.filterPreset,
      filterMode: readRotateMode(record.filterMode),
    }
  } catch {
    return EMPTY
  }
}

/** 把一份完整设置压成「配过的那几项」：和默认值一样的不写 */
function toStoredConsole(console: StoredStageConsole): Partial<StoredStageConsole> {
  const stored: Partial<StoredStageConsole> = {}
  if (console.backgroundUrl !== DEFAULT_STAGE_CONSOLE.backgroundUrl) stored.backgroundUrl = console.backgroundUrl
  if (console.backgroundMode !== DEFAULT_STAGE_CONSOLE.backgroundMode) stored.backgroundMode = console.backgroundMode
  if (console.particleEnabled !== DEFAULT_STAGE_CONSOLE.particleEnabled) stored.particleEnabled = console.particleEnabled
  if (console.particlePreset !== DEFAULT_STAGE_CONSOLE.particlePreset) stored.particlePreset = console.particlePreset
  if (console.particleMode !== DEFAULT_STAGE_CONSOLE.particleMode) stored.particleMode = console.particleMode
  if (Object.keys(console.particleOverrides).length > 0) stored.particleOverrides = console.particleOverrides
  if (console.filterEnabled !== DEFAULT_STAGE_CONSOLE.filterEnabled) stored.filterEnabled = console.filterEnabled
  if (console.filterPreset !== DEFAULT_STAGE_CONSOLE.filterPreset) stored.filterPreset = console.filterPreset
  if (console.filterMode !== DEFAULT_STAGE_CONSOLE.filterMode) stored.filterMode = console.filterMode
  return stored
}

/** 上一次写进去的字符串。切背景这类动作很频繁，载荷没变就不必重写 */
let lastWritten = ''

/**
 * 落盘。全是默认值时把键删掉 —— 没动过设置的用户不该留一份「快照」，
 * 否则以后改默认值他也不会跟着变。
 */
export function saveStageConsole(console: StoredStageConsole): void {
  try {
    const stored = toStoredConsole(console)
    const json = Object.keys(stored).length === 0 ? '' : JSON.stringify(stored)
    if (json === lastWritten) return
    lastWritten = json
    if (!json) {
      window.localStorage.removeItem(STAGE_CONSOLE_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(STAGE_CONSOLE_STORAGE_KEY, json)
  } catch {
    // 隐私模式下存不了，只在内存里生效
  }
}
