import { useEffect, useRef, useState } from 'react'
import { FilterSetting } from '../FilterSetting'
import { ParticleSetting } from '../ParticleSetting'
import { Button } from '../Button'
import { Input } from '../Input'
import { Slider } from '../Slider'
import { Tooltip } from '../Tooltip'
import { cx } from '../../utils/cx'
import { useStage } from '../../contexts'
import styles from './index.module.scss'

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

export function StageControlPanel() {
  const {
    backgroundUrl,
    setBackgroundUrl,
    handleBackgroundFile,
    particleEnabled,
    setParticleEnabled,
    particleIntensity,
    particleSpeed,
    particleOpacity,
    particlePreset,
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
    customFilterPresets,
    handleFilterPresetChange,
    setFilterBrightness,
    setFilterContrast,
    setFilterSaturation,
    setFilterBlur,
    addCustomFilterPreset,
    resetStage,
  } = useStage()

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
      void audio.play().catch((error: unknown) => {
        if (showError && !(error instanceof DOMException && error.name === 'AbortError')) {
          setMusicError('浏览器阻止了播放，请再次点击播放')
        }
      })
    }
    audio.addEventListener('canplay', retryAfterLoad, { once: true })
    void audio.play().catch((error: unknown) => {
      if (showError && !(error instanceof DOMException && error.name === 'AbortError')) {
        setMusicError('浏览器阻止了播放，请再次点击播放')
      }
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
      setBackgroundUrl(value)
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
    if (value.startsWith('blob:')) return '未知音乐'
    try {
      const parsed = new URL(value, window.location.href)
      const fileName = decodeURIComponent(parsed.pathname.split('/').pop() ?? '').trim()
      return fileName || parsed.hostname || '未知音乐'
    } catch {
      return value.trim() || '未知音乐'
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
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    musicObjectUrlRef.current = objectUrl
    setMusicUrl(objectUrl)
    setMusicPreset('')
    setMusicDraft('')
    setMusicName(file.name)
    playAudioSource(objectUrl, false)
  }

  const selectMusicPreset = (preset: typeof MUSIC_PRESETS[number]) => {
    setMusicPreset(preset.id)
    setMusicDraft(preset.url)
    setMusicUrl(preset.url)
    setMusicName(preset.label)
    setMusicError('')
    playAudioSource(preset.url, false)
  }

  const toggleMusic = () => {
    const audio = audioRef.current
    if (!audio || !musicUrl) return
    if (audio.paused) {
      void audio.play().catch(() => setMusicError('浏览器阻止了播放，请再次点击播放'))
    } else {
      audio.pause()
    }
  }

  const handleResetStage = () => {
    if (musicObjectUrlRef.current) URL.revokeObjectURL(musicObjectUrlRef.current)
    musicObjectUrlRef.current = null
    audioRef.current?.pause()
    resetStage()
    setMusicDraft(MUSIC_PRESETS[0].url)
    setMusicUrl(MUSIC_PRESETS[0].url)
    setMusicName(MUSIC_PRESETS[0].label)
    setMusicPreset(MUSIC_PRESETS[0].id)
    setMusicError('')
    setVolume(0.55)
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.eyebrow}>STAGE CONTROL</div>
      <h2 className={styles.title}>舞台控制台</h2>
      <p className={styles.intro}>调整背景、光效、滤镜与声音氛围。</p>

      <section className={styles.block}>
        <div className={styles.blockTitle}><span>舞台背景</span><span className={styles.tinyTag}>IMAGE</span></div>
        <div className={styles.backgroundPresets} role="group" aria-label="舞台背景预设">
          {BACKGROUND_PRESETS.map(({ id, label, url }) => (
            <Button
              key={id}
              variant="chip"
              size="xs"
              active={backgroundUrl === url}
              onClick={() => setBackgroundUrl(url)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className={styles.urlRow}>
          <Input
            className={styles.urlInput}
            value={backgroundDraft}
            onChange={(event) => { setBackgroundDraft(event.target.value); setBackgroundError('') }}
            placeholder="粘贴背景图 URL"
            aria-label="舞台背景图 URL"
          />
          <Button size="sm" onClick={applyBackground} disabled={!backgroundDraft.trim() || backgroundApplying}>设置</Button>
        </div>
        {backgroundError && <div className={styles.error}>{backgroundError}</div>}
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" className={styles.actionButton} onClick={() => setBackgroundUrl('')}>无背景</Button>
          <label className={styles.fileLabel}>
            <span>本地图片</span>
            <input type="file" accept="image/*" onChange={(event) => handleBackgroundFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      </section>

      <ParticleSetting
        enabled={particleEnabled}
        onEnabledChange={setParticleEnabled}
        intensity={particleIntensity}
        onIntensityChange={handleParticleIntensityChange}
        speed={particleSpeed}
        onSpeedChange={handleParticleSpeedChange}
        opacity={particleOpacity}
        onOpacityChange={handleParticleOpacityChange}
        preset={particlePreset}
        onPresetChange={handleParticlePresetChange}
        color={particleColor}
        onColorChange={handleParticleColorChange}
        size={particleSize}
        onSizeChange={handleParticleSizeChange}
      />

      <FilterSetting
        enabled={filterEnabled}
        onEnabledChange={(enabled) => {
          if (enabled) {
            handleFilterPresetChange('standard')
          } else {
            setFilterEnabled(false)
          }
        }}
        preset={filterPreset}
        onPresetChange={handleFilterPresetChange}
        brightness={filterBrightness}
        onBrightnessChange={(value) => { setFilterBrightness(value) }}
        contrast={filterContrast}
        onContrastChange={(value) => { setFilterContrast(value) }}
        saturation={filterSaturation}
        onSaturationChange={(value) => { setFilterSaturation(value) }}
        blur={filterBlur}
        onBlurChange={(value) => { setFilterBlur(value) }}
        backgroundUrl={backgroundUrl}
        customPresets={customFilterPresets}
        onAddCustomPreset={addCustomFilterPreset}
      />

      <section className={cx(styles.block, styles.musicBlock)}>
        <div className={styles.blockTitle}><span>背景音乐</span><span className={styles.muted}>{musicName || '未设置音乐'}</span></div>
        <div className={styles.musicPresets} role="group" aria-label="背景音乐预设">
          {MUSIC_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="chip"
              size="xs"
              active={musicPreset === preset.id}
              onClick={() => selectMusicPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className={styles.urlRow}>
          <Input
            className={styles.urlInput}
            value={musicDraft}
            onChange={(event) => { setMusicDraft(event.target.value); setMusicError('') }}
            placeholder="粘贴音频 URL"
            aria-label="背景音乐 URL"
          />
          <Tooltip placement="top" title="加载并播放音乐">
            <Button size="sm" aria-label="加载并播放音乐" onClick={handleMusicUrl} disabled={!musicDraft.trim()}>▶</Button>
          </Tooltip>
        </div>
        {musicError && <div className={styles.error}>{musicError}</div>}
        <div className={styles.musicFileRow}>
          <Button size="sm" className={styles.playToggle} onClick={toggleMusic} disabled={!musicUrl}>{isPlaying ? '暂停' : '播放'}</Button>
          <label className={styles.fileLabel}>
            <span>本地音乐</span>
            <input type="file" accept="audio/*" onChange={(event) => handleMusicFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className={styles.musicControls}>
          <Slider
            className={styles.volume}
            label="音量"
            valueText={`${Math.round(volume * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={setVolume}
          />
        </div>
        <audio ref={audioRef} src={musicUrl} loop preload="auto" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
      </section>
      <Button size="md" block className={styles.resetButton} onClick={handleResetStage}>↺ 重置舞台</Button>
    </aside>
  )
}
