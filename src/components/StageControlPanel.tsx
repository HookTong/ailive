import { useEffect, useRef, useState } from 'react'
import { FilterControlPanel, type CustomFilterPreset, type FilterPreset } from './FilterControlPanel'
import { ParticleControlPanel } from './ParticleControlPanel'
import type { ParticlePreset } from './StageAtmosphere'

const MUSIC_PRESETS = [
  { id: 'music-01', label: '轻柔', url: '/audio/music-01-lofi-chill.wav' },
  { id: 'music-02', label: '赛博', url: '/audio/music-02-cyberpunk.wav' },
  { id: 'music-03', label: '雨声', url: '/audio/music-03-rainy-piano.wav' },
  { id: 'music-04', label: '专注', url: '/audio/music-04-gaming-focus.wav' },
  { id: 'music-05', label: '星光', url: '/audio/music-05-starlight.wav' },
] as const

const BACKGROUND_PRESETS = [
  { id: 'default', label: '默认', url: '/background.png' },
  { id: 'cinematic', label: '电影', url: '/bg_cinematic.png' },
  { id: 'cyberpunk', label: '赛博', url: '/bg_cyberpunk.png' },
  { id: 'fantasy', label: '幻想', url: '/bg_fantasy.png' },
  { id: 'lofi', label: 'Lo-fi', url: '/bg_lofi.png' },
] as const

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
  onFilterPresetChange: (preset: FilterPreset) => void
  filterEnabled: boolean
  onFilterEnabledChange: (enabled: boolean) => void
  customFilterPresets: CustomFilterPreset[]
  onAddCustomFilterPreset: (preset: CustomFilterPreset) => void
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
  customFilterPresets,
  onAddCustomFilterPreset,
}: StageControlPanelProps) {
  const [backgroundDraft, setBackgroundDraft] = useState(backgroundUrl.startsWith('blob:') ? '' : backgroundUrl)
  const [backgroundError, setBackgroundError] = useState('')
  const [backgroundApplying, setBackgroundApplying] = useState(false)
  const [musicDraft, setMusicDraft] = useState<string>(MUSIC_PRESETS[0].url)
  const [musicUrl, setMusicUrl] = useState<string>(MUSIC_PRESETS[0].url)
  const [musicName, setMusicName] = useState<string>(MUSIC_PRESETS[0].label)
  const [musicPreset, setMusicPreset] = useState<string>(MUSIC_PRESETS[0].id)
  const [musicError, setMusicError] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.55)
  const backgroundRequestRef = useRef(0)
  const musicObjectUrlRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const playAudioSource = (source: string, showError = true) => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.src = source
    audio.volume = volume
    const retryAfterLoad = () => {
      void audio.play().then(() => setIsPlaying(true)).catch((error: unknown) => {
        setIsPlaying(false)
        if (showError && !(error instanceof DOMException && error.name === 'AbortError')) setMusicError('浏览器阻止了播放，请再次点击播放')
      })
    }
    audio.addEventListener('canplay', retryAfterLoad, { once: true })
    void audio.play().then(() => setIsPlaying(true)).catch((error: unknown) => {
      setIsPlaying(false)
      if (showError && !(error instanceof DOMException && error.name === 'AbortError')) setMusicError('浏览器阻止了播放，请再次点击播放')
    })
  }

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

  const getMusicDisplayName = (value: string, preset?: typeof MUSIC_PRESETS[number]) => {
    if (preset) return preset.label
    if (value.startsWith('blob:')) return musicName || '本地音频'
    try {
      const parsed = new URL(value, window.location.href)
      const fileName = decodeURIComponent(parsed.pathname.split('/').pop() ?? '').trim()
      return fileName || parsed.hostname || '在线音频'
    } catch {
      return value.trim() || '未设置音乐'
    }
  }

  const handleMusicUrl = () => {
    const value = musicDraft.trim()
    if (!value) return
    setMusicError('')
    const probe = new Audio()
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      const matchedPreset = MUSIC_PRESETS.find((preset) => preset.url === value)
      setMusicUrl(value)
      setMusicPreset(matchedPreset?.id ?? '')
      setMusicName(getMusicDisplayName(value, matchedPreset))
      playAudioSource(value)
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
    const filePath = (file as File & { path?: string }).path || objectUrl
    musicObjectUrlRef.current = objectUrl
    setMusicUrl(objectUrl)
    setMusicPreset('')
    setMusicDraft(filePath)
    setMusicName(file.name)
    setIsPlaying(true)
    playAudioSource(objectUrl, false)
  }

  const selectMusicPreset = (preset: typeof MUSIC_PRESETS[number]) => {
    setMusicPreset(preset.id)
    setMusicDraft(preset.url)
    setMusicUrl(preset.url)
    setMusicName(preset.label)
    setIsPlaying(true)
    setMusicError('')
    playAudioSource(preset.url, false)
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
        <div className="background-presets" role="group" aria-label="舞台背景预设">
          {BACKGROUND_PRESETS.map(({ id, label, url }) => (
            <button key={id} type="button" className={backgroundUrl === url ? 'background-preset active' : 'background-preset'} onClick={() => onBackgroundUrlChange(url)}>{label}</button>
          ))}
        </div>
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

      <ParticleControlPanel
        enabled={particleEnabled}
        onEnabledChange={onParticleEnabledChange}
        intensity={particleIntensity}
        onIntensityChange={onParticleIntensityChange}
        speed={particleSpeed}
        onSpeedChange={onParticleSpeedChange}
        opacity={particleOpacity}
        onOpacityChange={onParticleOpacityChange}
        preset={particlePreset}
        onPresetChange={onParticlePresetChange}
        color={particleColor}
        onColorChange={onParticleColorChange}
        size={particleSize}
        onSizeChange={onParticleSizeChange}
      />

      <FilterControlPanel
        enabled={filterEnabled}
        onEnabledChange={onFilterEnabledChange}
        preset={filterPreset}
        onPresetChange={onFilterPresetChange}
        brightness={filterBrightness}
        onBrightnessChange={onFilterBrightnessChange}
        contrast={filterContrast}
        onContrastChange={onFilterContrastChange}
        saturation={filterSaturation}
        onSaturationChange={onFilterSaturationChange}
        blur={filterBlur}
        onBlurChange={onFilterBlurChange}
        backgroundUrl={backgroundUrl}
        customPresets={customFilterPresets}
        onAddCustomPreset={onAddCustomFilterPreset}
      />

      <section className="stage-block music-block">
        <div className="stage-block-title"><span>背景音乐</span><span className="stage-muted">{musicName || '未设置音乐'}</span></div>
        <div className="music-presets" role="group" aria-label="背景音乐预设">
          {MUSIC_PRESETS.map((preset) => (
            <button key={preset.id} type="button" className={musicPreset === preset.id ? 'music-preset active' : 'music-preset'} onClick={() => selectMusicPreset(preset)}>{preset.label}</button>
          ))}
        </div>
        <div className="stage-url-row">
          <input value={musicDraft} onChange={(event) => { setMusicDraft(event.target.value); setMusicError('') }} placeholder="粘贴音频 URL" aria-label="背景音乐 URL" />
          <button type="button" onClick={handleMusicUrl} disabled={!musicDraft.trim()}>设置</button>
        </div>
        {musicError && <div className="stage-error">{musicError}</div>}
        <div className="music-file-row"><button type="button" className="music-play-toggle" onClick={toggleMusic} disabled={!musicUrl}>{isPlaying ? '暂停' : '播放'}</button><label className="stage-file"><span>选择本地音频</span><input type="file" accept="audio/*" onChange={(event) => handleMusicFile(event.target.files?.[0] ?? null)} /></label></div>
        <div className="music-controls"><label><span>音量</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div>
        <audio ref={audioRef} src={musicUrl} loop preload="auto" onEnded={() => setIsPlaying(false)} />
      </section>
    </aside>
  )
}
