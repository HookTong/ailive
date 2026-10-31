import { useEffect, useRef, useState } from 'react'
import { PARTICLE_COLOR_OPTIONS, PARTICLE_PRESETS, type ParticlePreset } from './StageAtmosphere'

export type FilterPreset = 'standard' | 'cinematic' | 'dream' | 'neon' | 'mist' | 'monochrome' | 'custom'

export const FILTER_PRESETS: ReadonlyArray<{
  id: Exclude<FilterPreset, 'custom'>
  label: string
  brightness: number
  contrast: number
  saturation: number
  blur: number
  vignette: boolean
}> = [
  { id: 'standard', label: '标准', brightness: 1, contrast: 1, saturation: 1, blur: 0, vignette: true },
  { id: 'cinematic', label: '电影', brightness: 0.9, contrast: 1.2, saturation: 0.85, blur: 0.3, vignette: true },
  { id: 'dream', label: '梦幻', brightness: 1.1, contrast: 0.95, saturation: 1.3, blur: 1.5, vignette: false },
  { id: 'neon', label: '霓虹', brightness: 1.05, contrast: 1.3, saturation: 1.45, blur: 0.2, vignette: true },
  { id: 'mist', label: '薄雾', brightness: 1.12, contrast: 0.92, saturation: 0.9, blur: 2.5, vignette: false },
  { id: 'monochrome', label: '黑白', brightness: 1.02, contrast: 1.2, saturation: 0, blur: 0, vignette: true },
]

type StageControlPanelProps = {
  backgroundUrl: string
  onBackgroundUrlChange: (value: string) => void
  onBackgroundFile: (file: File | null) => void
  onClearBackground: () => void
  onResetBackground: () => void
  particleEnabled: boolean
  onParticleEnabledChange: (enabled: boolean) => void
  particleIntensity: number
  onParticleIntensityChange: (value: number) => void
  particleSpeed: number
  onParticleSpeedChange: (value: number) => void
  particleOpacity: number
  onParticleOpacityChange: (value: number) => void
  particlePreset: ParticlePreset
  onParticlePresetChange: (preset: ParticlePreset) => void
  particleColor: string
  onParticleColorChange: (color: string) => void
  particleSize: number
  onParticleSizeChange: (size: number) => void
  filterBrightness: number
  onFilterBrightnessChange: (value: number) => void
  filterContrast: number
  onFilterContrastChange: (value: number) => void
  filterSaturation: number
  onFilterSaturationChange: (value: number) => void
  filterBlur: number
  onFilterBlurChange: (value: number) => void
  filterPreset: FilterPreset
  onFilterPresetChange: (preset: Exclude<FilterPreset, 'custom'>) => void
  filterEnabled: boolean
  onFilterEnabledChange: (enabled: boolean) => void
}

export function StageControlPanel({
  backgroundUrl,
  onBackgroundUrlChange,
  onBackgroundFile,
  onClearBackground,
  onResetBackground,
  particleEnabled,
  onParticleEnabledChange,
  particleIntensity,
  onParticleIntensityChange,
  particleSpeed,
  onParticleSpeedChange,
  particleOpacity,
  onParticleOpacityChange,
  particlePreset,
  onParticlePresetChange,
  particleColor,
  onParticleColorChange,
  particleSize,
  onParticleSizeChange,
  filterBrightness,
  onFilterBrightnessChange,
  filterContrast,
  onFilterContrastChange,
  filterSaturation,
  onFilterSaturationChange,
  filterBlur,
  onFilterBlurChange,
  filterPreset,
  onFilterPresetChange,
  filterEnabled,
  onFilterEnabledChange,
}: StageControlPanelProps) {
  const [backgroundDraft, setBackgroundDraft] = useState(backgroundUrl.startsWith('blob:') ? '' : backgroundUrl)
  const [backgroundError, setBackgroundError] = useState('')
  const [backgroundApplying, setBackgroundApplying] = useState(false)
  const [musicDraft, setMusicDraft] = useState('')
  const [musicUrl, setMusicUrl] = useState('')
  const [musicName, setMusicName] = useState('未设置音乐')
  const [musicError, setMusicError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.55)
  const backgroundRequestRef = useRef(0)
  const musicObjectUrlRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    setBackgroundDraft(backgroundUrl.startsWith('blob:') ? '' : backgroundUrl)
    setBackgroundError('')
  }, [backgroundUrl])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => () => {
    if (musicObjectUrlRef.current) URL.revokeObjectURL(musicObjectUrlRef.current)
  }, [])

  const applyBackground = () => {
    const value = backgroundDraft.trim()
    if (!value) return
    const requestId = backgroundRequestRef.current + 1
    backgroundRequestRef.current = requestId
    setBackgroundApplying(true)
    setBackgroundError('')
    const image = new Image()
    image.onload = () => {
      if (requestId !== backgroundRequestRef.current) return
      setBackgroundApplying(false)
      onBackgroundUrlChange(value)
    }
    image.onerror = () => {
      if (requestId !== backgroundRequestRef.current) return
      setBackgroundApplying(false)
      setBackgroundError('背景图片加载失败，请检查 URL 是否正确')
    }
    image.src = value
  }

  const handleMusicUrl = () => {
    const value = musicDraft.trim()
    if (!value) return
    setMusicError('')
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      setMusicUrl(value)
      setMusicName(new URL(value, window.location.href).hostname)
      setIsPlaying(false)
    }
    probe.onerror = () => setMusicError('音乐加载失败，请检查 URL 是否正确')
    probe.src = value
  }

  const handleMusicFile = (file: File | null) => {
    if (musicObjectUrlRef.current) URL.revokeObjectURL(musicObjectUrlRef.current)
    musicObjectUrlRef.current = null
    setMusicError('')
    setIsPlaying(false)
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    musicObjectUrlRef.current = objectUrl
    setMusicUrl(objectUrl)
    setMusicName(file.name)
  }

  const toggleMusic = () => {
    const audio = audioRef.current
    if (!audio || !musicUrl) return
    if (audio.paused) {
      void audio.play().then(() => setIsPlaying(true)).catch(() => setMusicError('浏览器阻止了播放，请再次点击播放'))
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  return (
    <aside className="stage-controls">
      <div className="eyebrow">STAGE CONTROL</div>
      <h2>舞台控制台</h2>
      <p className="stage-intro">调整背景、光效、滤镜与声音氛围。</p>

      <section className="stage-block">
        <div className="stage-block-title"><span>舞台背景</span><span className="tiny-tag">IMAGE</span></div>
        <div className="stage-url-row">
          <input value={backgroundDraft} onChange={(event) => { setBackgroundDraft(event.target.value); setBackgroundError('') }} placeholder="粘贴背景图 URL" aria-label="舞台背景图 URL" />
          <button type="button" onClick={applyBackground} disabled={!backgroundDraft.trim() || backgroundApplying}>设置</button>
        </div>
        {backgroundError && <div className="stage-error">{backgroundError}</div>}
        <div className="stage-background-actions">
          <button type="button" onClick={onClearBackground}>清除</button>
          <label><span>本地图片</span><input type="file" accept="image/*" onChange={(event) => onBackgroundFile(event.target.files?.[0] ?? null)} /></label>
          <button type="button" onClick={onResetBackground}>默认</button>
        </div>
      </section>

      <section className="stage-block">
        <div className="stage-block-title"><span>粒子特效</span><label className="stage-switch"><input type="checkbox" checked={particleEnabled} onChange={(event) => onParticleEnabledChange(event.target.checked)} /><span /></label></div>
        <div className="particle-presets" role="group" aria-label="粒子特效快捷预设">
          {PARTICLE_PRESETS.map(({ id: preset, label }) => (
            <button key={preset} type="button" className={particleEnabled && particlePreset === preset ? 'particle-preset active' : 'particle-preset'} onClick={() => { onParticlePresetChange(preset); onParticleEnabledChange(true) }}>{label}</button>
          ))}
        </div>
        <div className={particleEnabled ? 'particle-color-row' : 'particle-color-row particle-control-disabled'}>
          <span>粒子颜色</span>
          <div className="particle-swatches" role="group" aria-label="粒子颜色快捷选择">
            {PARTICLE_COLOR_OPTIONS.map((swatch) => (
              <button key={swatch} type="button" disabled={!particleEnabled} aria-label={`设置粒子颜色 ${swatch}`} className={particleColor === swatch ? 'particle-swatch active' : 'particle-swatch'} style={{ backgroundColor: swatch }} onClick={() => onParticleColorChange(swatch)} />
            ))}
          </div>
        </div>
        <label className={particleEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>强度 <b>{Math.round(particleIntensity * 100)}%</b></span><input type="range" disabled={!particleEnabled} min="0" max="1" step="0.05" value={particleIntensity} onChange={(event) => onParticleIntensityChange(Number(event.target.value))} /></label>
        <label className={particleEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>速度 <b>{particleSpeed.toFixed(1)}x</b></span><input type="range" disabled={!particleEnabled} min="0.3" max="2" step="0.1" value={particleSpeed} onChange={(event) => onParticleSpeedChange(Number(event.target.value))} /></label>
        <label className={particleEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>透明度 <b>{Math.round(particleOpacity * 100)}%</b></span><input type="range" disabled={!particleEnabled} min="0" max="1" step="0.05" value={particleOpacity} onChange={(event) => onParticleOpacityChange(Number(event.target.value))} /></label>
        <label className={particleEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>大小 <b>{Math.round(particleSize * 100)}%</b></span><input type="range" disabled={!particleEnabled} min="0.5" max="2.5" step="0.1" value={particleSize} onChange={(event) => onParticleSizeChange(Number(event.target.value))} /></label>
      </section>

      <section className="stage-block">
        <div className="stage-block-title"><span>舞台滤镜</span><label className="stage-switch"><input type="checkbox" checked={filterEnabled} onChange={(event) => onFilterEnabledChange(event.target.checked)} /><span /></label></div>
        <div className="filter-presets" role="group" aria-label="舞台滤镜快捷预设">
          {FILTER_PRESETS.map(({ id, label }) => (
            <button key={id} type="button" className={filterPreset === id ? 'filter-preset active' : 'filter-preset'} onClick={() => onFilterPresetChange(id)}>{label}</button>
          ))}
        </div>
        <label className={filterEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>亮度 <b>{Math.round(filterBrightness * 100)}%</b></span><input type="range" disabled={!filterEnabled} min="0.65" max="1.35" step="0.05" value={filterBrightness} onChange={(event) => onFilterBrightnessChange(Number(event.target.value))} /></label>
        <label className={filterEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>对比度 <b>{Math.round(filterContrast * 100)}%</b></span><input type="range" disabled={!filterEnabled} min="0.7" max="1.35" step="0.05" value={filterContrast} onChange={(event) => onFilterContrastChange(Number(event.target.value))} /></label>
        <label className={filterEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>饱和度 <b>{Math.round(filterSaturation * 100)}%</b></span><input type="range" disabled={!filterEnabled} min="0" max="1.6" step="0.05" value={filterSaturation} onChange={(event) => onFilterSaturationChange(Number(event.target.value))} /></label>
        <label className={filterEnabled ? 'stage-slider' : 'stage-slider particle-control-disabled'}><span>柔焦 <b>{filterBlur.toFixed(1)}px</b></span><input type="range" disabled={!filterEnabled} min="0" max="3" step="0.5" value={filterBlur} onChange={(event) => onFilterBlurChange(Number(event.target.value))} /></label>
      </section>

      <section className="stage-block music-block">
        <div className="stage-block-title"><span>背景音乐</span><span className="stage-muted">{musicName}</span></div>
        <div className="stage-url-row">
          <input value={musicDraft} onChange={(event) => { setMusicDraft(event.target.value); setMusicError('') }} placeholder="粘贴音频 URL" aria-label="背景音乐 URL" />
          <button type="button" onClick={handleMusicUrl} disabled={!musicDraft.trim()}>设置</button>
        </div>
        <label className="stage-file"><span>选择本地音频</span><input type="file" accept="audio/*" onChange={(event) => handleMusicFile(event.target.files?.[0] ?? null)} /></label>
        <div className="music-controls"><button type="button" onClick={toggleMusic} disabled={!musicUrl}>{isPlaying ? '暂停' : '播放'}</button><label><span>音量</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div>
        {musicError && <div className="stage-error">{musicError}</div>}
        <audio ref={audioRef} src={musicUrl} loop onEnded={() => setIsPlaying(false)} />
      </section>
    </aside>
  )
}
