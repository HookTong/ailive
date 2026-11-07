import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PARTICLE_PRESETS, type ParticlePreset, type ParticlePresetSettings } from '../../components/Atmosphere'
import { FILTER_PRESETS, type CustomFilterPreset, type FilterPreset } from '../../components/FilterSetting'
import {
  BACKGROUND_CYCLE_INTERVAL_MS,
  BACKGROUND_PRESETS,
  PRESET_ROTATE_INTERVAL_MS,
  type BackgroundPreset,
  type PresetRotateMode,
} from './presets'
import { StageContext, type BackgroundMode, type StageContextValue } from './StageContext'

const DEFAULT_BACKGROUND_URL = '/background.png'
const CUSTOM_FILTERS_STORAGE_KEY = 'ailive.custom-filters'
const CUSTOM_BACKGROUNDS_STORAGE_KEY = 'ailive.custom-backgrounds'

/**
 * 读取自定义背景。本地图片是 `blob:` URL，刷新后必然失效，
 * 存了也打不开，所以读的时候直接丢掉（写入时同样跳过）。
 */
function loadCustomBackgrounds(): BackgroundPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_BACKGROUNDS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is BackgroundPreset => {
      if (!item || typeof item !== 'object') return false
      const preset = item as Partial<BackgroundPreset>
      return typeof preset.id === 'string'
        && preset.id.startsWith('custom:')
        && typeof preset.label === 'string'
        && preset.label.trim().length > 0
        && typeof preset.url === 'string'
        && preset.url.trim().length > 0
        && !preset.url.startsWith('blob:')
    })
  } catch {
    return []
  }
}

function loadCustomFilterPresets(): CustomFilterPreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_FILTERS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CustomFilterPreset => {
      if (!item || typeof item !== 'object') return false
      const value = item as Partial<CustomFilterPreset>
      return typeof value.id === 'string'
        && value.id.startsWith('custom:')
        && typeof value.label === 'string'
        && typeof value.brightness === 'number'
        && typeof value.contrast === 'number'
        && typeof value.saturation === 'number'
        && typeof value.blur === 'number'
        && typeof value.vignette === 'boolean'
    })
  } catch {
    return []
  }
}

function createParticlePresetConfigs(): Record<ParticlePreset, ParticlePresetSettings> {
  return Object.fromEntries(
    PARTICLE_PRESETS.map(({ id, color, intensity, speed, opacity, size }) => [
      id,
      { color, intensity, speed, opacity, size }
    ])
  ) as Record<ParticlePreset, ParticlePresetSettings>
}

/**
 * 自动切换时挑下一个下标。
 * 随机模式下直接 `Math.random() * length` 有 1/n 的概率连着两次同一个，
 * 看起来就像「没切换」—— 偏移量取 `[1, length-1]` 天然排除自己。
 */
function pickNextIndex(length: number, currentIndex: number, mode: PresetRotateMode): number {
  if (length <= 1) return 0
  const base = currentIndex < 0 ? 0 : currentIndex
  if (mode === 'random') return (base + Math.floor(Math.random() * (length - 1)) + 1) % length
  return (base + 1) % length
}

type StageProviderProps = {
  children: ReactNode
}

export function StageProvider({ children }: StageProviderProps) {
  const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKGROUND_URL)
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('fixed')
  const [customBackgrounds, setCustomBackgrounds] = useState<BackgroundPreset[]>(loadCustomBackgrounds)

  // 内置预设 + 用户自己加的，循环切换按这个顺序走
  const allBackgrounds = useMemo(
    () => [...BACKGROUND_PRESETS, ...customBackgrounds],
    [customBackgrounds],
  )

  const [particleEnabled, setParticleEnabled] = useState(true)
  const [particlePresetConfigs, setParticlePresetConfigs] = useState<Record<ParticlePreset, ParticlePresetSettings>>(
    () => createParticlePresetConfigs()
  )
  const [particlePreset, setParticlePreset] = useState<ParticlePreset>('stardust')
  const [particleMode, setParticleMode] = useState<PresetRotateMode>('fixed')
  const [particleIntensity, setParticleIntensity] = useState(PARTICLE_PRESETS[0].intensity)
  const [particleSpeed, setParticleSpeed] = useState(PARTICLE_PRESETS[0].speed)
  const [particleOpacity, setParticleOpacity] = useState(PARTICLE_PRESETS[0].opacity)
  const [particleColor, setParticleColor] = useState(PARTICLE_PRESETS[0].color)
  const [particleSize, setParticleSize] = useState(PARTICLE_PRESETS[0].size)

  // 开关和选中项分开存：关掉只是「不渲染」，选中项和那套参数都留着。
  // 对外暴露的是 handleFilterEnabledChange（带「选中项还在不在」的兜底），不是这个裸 setter
  const [filterEnabled, setFilterEnabledState] = useState(true)
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('standard')
  const [filterMode, setFilterMode] = useState<PresetRotateMode>('fixed')
  const [filterBrightness, setFilterBrightness] = useState(1)
  const [filterContrast, setFilterContrast] = useState(1)
  const [filterSaturation, setFilterSaturation] = useState(1)
  const [filterBlur, setFilterBlur] = useState(0)
  const [vignette, setVignette] = useState(true)
  const [customFilterPresets, setCustomFilterPresets] = useState<CustomFilterPreset[]>(loadCustomFilterPresets)

  // Persist custom filter presets
  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_FILTERS_STORAGE_KEY, JSON.stringify(customFilterPresets))
    } catch {
      // Storage unavailable
    }
  }, [customFilterPresets])

  // 循环切换：每停满一个间隔就换下一张预设背景。
  // 依赖里带 backgroundUrl，换一张就重新计时 —— 手动点预设也会把计时器重置，
  // 不会出现「刚点完就被轮播换走」。
  useEffect(() => {
    if (backgroundMode !== 'cycle') return
    const timer = window.setTimeout(() => {
      setBackgroundUrl((current) => {
        const index = allBackgrounds.findIndex((preset) => preset.url === current)
        // 当前是自定义图（不在列表里）时，从第一张开始轮
        return allBackgrounds[(index + 1) % allBackgrounds.length].url
      })
    }, BACKGROUND_CYCLE_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [backgroundMode, backgroundUrl, allBackgrounds])

  // 自定义背景落盘。blob: 那种刷新就失效，不写进去
  useEffect(() => {
    try {
      const persistable = customBackgrounds.filter((preset) => !preset.url.startsWith('blob:'))
      window.localStorage.setItem(CUSTOM_BACKGROUNDS_STORAGE_KEY, JSON.stringify(persistable))
    } catch {
      // 隐私模式下存不了，只在内存里生效
    }
  }, [customBackgrounds])

  const addBackground = (name: string, url: string) => {
    const preset: BackgroundPreset = {
      id: `custom:${Date.now()}`,
      label: name.trim() || '自定义背景',
      url,
    }
    setCustomBackgrounds((current) => [...current, preset])
    setBackgroundUrl(url)
    // 刚加的背景得能看见，别停在上一次选的「无背景」上
    setBackgroundMode('fixed')
  }

  /**
   * 删掉一张自定义背景。
   * 删的正是台面上那张时退回默认底图 —— 否则舞台会继续请求一个已经不在列表里的地址，
   * 本地图片的话还会是一个即将被回收的 blob。
   */
  const removeBackground = (id: string) => {
    const target = customBackgrounds.find((preset) => preset.id === id)
    if (!target) return
    setCustomBackgrounds((current) => current.filter((preset) => preset.id !== id))
    if (target.url === backgroundUrl) setBackgroundUrl(DEFAULT_BACKGROUND_URL)
    // 本地图片的对象地址只有这一处在用，删了就回收
    if (target.url.startsWith('blob:')) URL.revokeObjectURL(target.url)
  }

  const updateParticleSetting = <K extends keyof ParticlePresetSettings>(
    key: K,
    value: ParticlePresetSettings[K]
  ) => {
    setParticlePresetConfigs((current) => ({
      ...current,
      [particlePreset]: { ...current[particlePreset], [key]: value },
    }))
  }

  // useCallback 是必须的：自动切换的 effect 依赖它，每次渲染换一个新函数会让计时器永远重启
  const handleParticlePresetChange = useCallback((nextPreset: ParticlePreset) => {
    const config = particlePresetConfigs[nextPreset]
    if (!config) return
    setParticlePreset(nextPreset)
    setParticleColor(config.color)
    setParticleIntensity(config.intensity)
    setParticleSpeed(config.speed)
    setParticleOpacity(config.opacity)
    setParticleSize(config.size)
  }, [particlePresetConfigs])

  const handleParticleColorChange = (color: string) => {
    setParticleColor(color)
    updateParticleSetting('color', color)
  }

  const handleParticleIntensityChange = (intensity: number) => {
    setParticleIntensity(intensity)
    updateParticleSetting('intensity', intensity)
  }

  const handleParticleSpeedChange = (speed: number) => {
    setParticleSpeed(speed)
    updateParticleSetting('speed', speed)
  }

  const handleParticleOpacityChange = (opacity: number) => {
    setParticleOpacity(opacity)
    updateParticleSetting('opacity', opacity)
  }

  const handleParticleSizeChange = (size: number) => {
    setParticleSize(size)
    updateParticleSetting('size', size)
  }

  /** 把一套滤镜参数铺到舞台上。只管参数 —— 开关和选中项由调用方决定 */
  const applyFilterPreset = useCallback((preset: { brightness: number; contrast: number; saturation: number; blur: number; vignette: boolean }) => {
    setFilterBrightness(preset.brightness)
    setFilterContrast(preset.contrast)
    setFilterSaturation(preset.saturation)
    setFilterBlur(preset.blur)
    setVignette(preset.vignette)
  }, [])

  const handleFilterPresetChange = useCallback((id: FilterPreset) => {
    const preset = FILTER_PRESETS.find((item) => item.id === id) ?? customFilterPresets.find((item) => item.id === id)
    if (!preset) return
    setFilterPreset(id)
    setFilterEnabledState(true)
    applyFilterPreset(preset)
  }, [customFilterPresets, applyFilterPreset])

  // 内置 + 自定义，自动切换按这个顺序走
  const allFilterPresets = useMemo(
    () => [...FILTER_PRESETS, ...customFilterPresets],
    [customFilterPresets],
  )

  /**
   * 开关舞台滤镜。
   *
   * 关掉只是「不渲染」，选中的预设和那套参数都原样留着 —— 重新打开要回到关掉前的样子。
   * 所以这里**不能**顺手切到「标准」：那样用户关一下再开，选好的滤镜就没了、画面也回到原色。
   * 唯一该退回「标准」的情况是选中项已经指不到东西 —— 关着的时候那个自定义滤镜被删了。
   */
  const handleFilterEnabledChange = useCallback((enabled: boolean) => {
    if (!enabled) {
      setFilterEnabledState(false)
      return
    }
    if (allFilterPresets.some((item) => item.id === filterPreset)) setFilterEnabledState(true)
    else handleFilterPresetChange('standard')
  }, [allFilterPresets, filterPreset, handleFilterPresetChange])

  /**
   * 粒子自动切换。依赖里带 `particlePreset`：换完一次这个 effect 会重跑、计时自然重置，
   * 手动点预设也会把计时重置（不会出现「刚点完就被换走」）。
   * 关掉粒子时整段跳过 —— 后台默默换预设，重新打开时会看到一个没选过的效果。
   */
  useEffect(() => {
    if (particleMode === 'fixed' || !particleEnabled) return
    const timer = window.setTimeout(() => {
      const index = PARTICLE_PRESETS.findIndex((item) => item.id === particlePreset)
      handleParticlePresetChange(PARTICLE_PRESETS[pickNextIndex(PARTICLE_PRESETS.length, index, particleMode)].id)
    }, PRESET_ROTATE_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [particleMode, particleEnabled, particlePreset, handleParticlePresetChange])

  // 滤镜自动切换，规则和粒子一致
  useEffect(() => {
    if (filterMode === 'fixed' || !filterEnabled) return
    const timer = window.setTimeout(() => {
      const index = allFilterPresets.findIndex((item) => item.id === filterPreset)
      const next = allFilterPresets[pickNextIndex(allFilterPresets.length, index, filterMode)]
      if (next) handleFilterPresetChange(next.id)
    }, PRESET_ROTATE_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [filterMode, filterEnabled, filterPreset, allFilterPresets, handleFilterPresetChange])

  const addCustomFilterPreset = (preset: CustomFilterPreset) => {
    setCustomFilterPresets((current) => [...current, preset])
    setFilterPreset(preset.id)
    setFilterEnabledState(true)
    applyFilterPreset(preset)
  }

  /**
   * 删掉一个自定义滤镜。
   * 删的正是当前滤镜时退回「标准」—— 不然画面还停在那套参数上，
   * 胶囊却没了，用户找不到是谁在起作用。
   *
   * 这里**只退参数和选中项，不动开关**：滤镜本来就关着的话，不能因为删了一个预设
   * 就自己弹回开启。
   */
  const removeCustomFilterPreset = (id: FilterPreset) => {
    if (!customFilterPresets.some((item) => item.id === id)) return
    setCustomFilterPresets((current) => current.filter((item) => item.id !== id))
    if (filterPreset !== id) return
    setFilterPreset('standard')
    applyFilterPreset(FILTER_PRESETS[0])
  }

  const resetStage = () => {
    setBackgroundUrl(DEFAULT_BACKGROUND_URL)
    setBackgroundMode('fixed')
    setParticleEnabled(true)
    setParticleMode('fixed')
    setParticlePresetConfigs(createParticlePresetConfigs())
    setParticleIntensity(PARTICLE_PRESETS[0].intensity)
    setParticleSpeed(PARTICLE_PRESETS[0].speed)
    setParticleOpacity(PARTICLE_PRESETS[0].opacity)
    setParticlePreset('stardust')
    setParticleColor(PARTICLE_PRESETS[0].color)
    setParticleSize(PARTICLE_PRESETS[0].size)
    setFilterBrightness(1)
    setFilterContrast(1)
    setFilterSaturation(1)
    setFilterBlur(0)
    setFilterPreset('standard')
    setFilterEnabledState(true)
    setFilterMode('fixed')
    setVignette(true)
  }

  const value = useMemo<StageContextValue>(() => ({
    backgroundUrl,
    setBackgroundUrl,
    backgroundMode,
    setBackgroundMode,
    customBackgrounds,
    addBackground,
    removeBackground,
    particleEnabled,
    setParticleEnabled,
    particlePreset,
    particleMode,
    setParticleMode,
    particleIntensity,
    particleSpeed,
    particleOpacity,
    particleColor,
    particleSize,
    handleParticlePresetChange,
    handleParticleColorChange,
    handleParticleIntensityChange,
    handleParticleSpeedChange,
    handleParticleOpacityChange,
    handleParticleSizeChange,
    filterEnabled,
    // 对外就是「开关」，不是裸 setter：重新打开时会把选中项还回去（见 handleFilterEnabledChange）
    setFilterEnabled: handleFilterEnabledChange,
    filterPreset,
    filterMode,
    setFilterMode,
    filterBrightness,
    filterContrast,
    filterSaturation,
    filterBlur,
    vignette,
    setVignette,
    customFilterPresets,
    handleFilterPresetChange,
    setFilterBrightness,
    setFilterContrast,
    setFilterSaturation,
    setFilterBlur,
    addCustomFilterPreset,
    removeCustomFilterPreset,
    resetStage,
  }), [
    backgroundUrl,
    backgroundMode,
    customBackgrounds,
    particleEnabled,
    particlePreset,
    particleMode,
    particleIntensity,
    particleSpeed,
    particleOpacity,
    particleColor,
    particleSize,
    filterEnabled,
    filterPreset,
    filterMode,
    filterBrightness,
    filterContrast,
    filterSaturation,
    filterBlur,
    vignette,
    customFilterPresets,
    // 不放进依赖的话，value 会一直攥着第一次渲染时那个闭包，
    // 里面的 filterPreset / customFilterPresets 都是旧的，兜底判断会失效
    handleFilterEnabledChange,
  ])

  return (
    <StageContext.Provider value={value}>
      {children}
    </StageContext.Provider>
  )
}
