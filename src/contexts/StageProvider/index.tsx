import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PARTICLE_PRESETS, type ParticlePreset, type ParticlePresetSettings } from '../../components/Atmosphere'
import { FILTER_PRESETS, type CustomFilterPreset, type FilterPreset } from '../../components/FilterSetting'
import { StageContext, type StageContextValue } from './StageContext'

const DEFAULT_BACKGROUND_URL = '/background.png'
const CUSTOM_FILTERS_STORAGE_KEY = 'ailive.custom-filters'

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

type StageProviderProps = {
  children: ReactNode
}

export function StageProvider({ children }: StageProviderProps) {
  const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKGROUND_URL)
  const backgroundObjectUrlRef = useRef<string | null>(null)

  const [particleEnabled, setParticleEnabled] = useState(true)
  const [particlePresetConfigs, setParticlePresetConfigs] = useState<Record<ParticlePreset, ParticlePresetSettings>>(
    () => createParticlePresetConfigs()
  )
  const [particlePreset, setParticlePreset] = useState<ParticlePreset>('stardust')
  const [particleIntensity, setParticleIntensity] = useState(PARTICLE_PRESETS[0].intensity)
  const [particleSpeed, setParticleSpeed] = useState(PARTICLE_PRESETS[0].speed)
  const [particleOpacity, setParticleOpacity] = useState(PARTICLE_PRESETS[0].opacity)
  const [particleColor, setParticleColor] = useState(PARTICLE_PRESETS[0].color)
  const [particleSize, setParticleSize] = useState(PARTICLE_PRESETS[0].size)

  const [filterEnabled, setFilterEnabled] = useState(true)
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('standard')
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

  // Cleanup background object URL
  useEffect(() => () => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
  }, [])

  const handleBackgroundFile = (file: File | null) => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    backgroundObjectUrlRef.current = null
    if (!file) {
      setBackgroundUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    backgroundObjectUrlRef.current = objectUrl
    setBackgroundUrl(objectUrl)
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

  const handleParticlePresetChange = (nextPreset: ParticlePreset) => {
    const config = particlePresetConfigs[nextPreset]
    if (!config) return
    setParticlePreset(nextPreset)
    setParticleColor(config.color)
    setParticleIntensity(config.intensity)
    setParticleSpeed(config.speed)
    setParticleOpacity(config.opacity)
    setParticleSize(config.size)
  }

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

  const handleFilterPresetChange = (id: FilterPreset) => {
    const preset = FILTER_PRESETS.find((item) => item.id === id) ?? customFilterPresets.find((item) => item.id === id)
    if (!preset) return
    setFilterPreset(id)
    setFilterEnabled(true)
    setFilterBrightness(preset.brightness)
    setFilterContrast(preset.contrast)
    setFilterSaturation(preset.saturation)
    setFilterBlur(preset.blur)
    setVignette(preset.vignette)
  }

  const addCustomFilterPreset = (preset: CustomFilterPreset) => {
    setCustomFilterPresets((current) => [...current, preset])
    setFilterPreset(preset.id)
    setFilterEnabled(true)
    setFilterBrightness(preset.brightness)
    setFilterContrast(preset.contrast)
    setFilterSaturation(preset.saturation)
    setFilterBlur(preset.blur)
    setVignette(preset.vignette)
  }

  const resetStage = () => {
    if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current)
    backgroundObjectUrlRef.current = null
    setBackgroundUrl(DEFAULT_BACKGROUND_URL)
    setParticleEnabled(true)
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
    setFilterEnabled(true)
    setVignette(true)
  }

  const value = useMemo<StageContextValue>(() => ({
    backgroundUrl,
    setBackgroundUrl,
    handleBackgroundFile,
    particleEnabled,
    setParticleEnabled,
    particlePreset,
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
    setFilterEnabled,
    filterPreset,
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
    resetStage,
  }), [
    backgroundUrl,
    particleEnabled,
    particlePreset,
    particleIntensity,
    particleSpeed,
    particleOpacity,
    particleColor,
    particleSize,
    filterEnabled,
    filterPreset,
    filterBrightness,
    filterContrast,
    filterSaturation,
    filterBlur,
    vignette,
    customFilterPresets,
  ])

  return (
    <StageContext.Provider value={value}>
      {children}
    </StageContext.Provider>
  )
}
