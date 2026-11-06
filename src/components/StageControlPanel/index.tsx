import { useEffect, useRef, useState } from 'react'
import { FilterSetting } from '../FilterSetting'
import { ParticleSetting } from '../ParticleSetting'
import { Button } from '../Button'
import { Input } from '../Input'
import { Segmented, type SegmentedOption } from '../Segmented'
import { Slider } from '../Slider'
import { Tooltip } from '../Tooltip'
import { cx } from '../../utils/cx'
import { useMusic, useStage } from '../../hooks'
import { MUSIC_PRESETS } from '../../contexts/MusicProvider/presets'
import { BACKGROUND_PRESETS } from '../../contexts/StageProvider/presets'
import type { BackgroundMode } from '../../contexts/StageProvider/StageContext'
import type { MusicLoopMode } from '../../contexts/MusicProvider/MusicContext'
import styles from './index.module.scss'

const BACKGROUND_MODE_OPTIONS: readonly SegmentedOption<BackgroundMode>[] = [
  { value: 'fixed', label: '固定' },
  { value: 'cycle', label: '循环切换' },
]

const MUSIC_LOOP_OPTIONS: readonly SegmentedOption<MusicLoopMode>[] = [
  { value: 'single', label: '单曲循环' },
  { value: 'list', label: '列表循环' },
]

export function StageControlPanel() {
  const {
    backgroundUrl,
    setBackgroundUrl,
    backgroundMode,
    setBackgroundMode,
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
  const backgroundRequestRef = useRef(0)

  // 音乐播放统一由 MusicProvider 持有，这里只做 UI
  const {
    track,
    presetId: musicPreset,
    loopMode,
    setLoopMode,
    isPlaying,
    volume,
    error: musicError,
    selectPreset,
    playUrl,
    playFile,
    toggle,
    setVolume,
    clearError: clearMusicError,
    reset: resetMusic,
  } = useMusic()

  useEffect(() => {
    setBackgroundDraft(backgroundUrl.startsWith('blob:') ? '' : backgroundUrl)
    setBackgroundError('')
  }, [backgroundUrl])

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

  const handleMusicFile = (file: File | null) => {
    clearMusicError()
    if (!file) return
    setMusicDraft('')
    playFile(file)
  }

  const handleResetStage = () => {
    resetMusic()
    resetStage()
    setMusicDraft(MUSIC_PRESETS[0].url)
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
        <div className={styles.modeRow}>
          <span>切换方式</span>
          <Segmented
            ariaLabel="背景切换方式"
            block
            value={backgroundMode}
            options={BACKGROUND_MODE_OPTIONS}
            onChange={setBackgroundMode}
          />
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
        <div className={styles.blockTitle}><span>背景音乐</span><span className={styles.muted}>{track.name || '未设置音乐'}</span></div>
        <div className={styles.musicPresets} role="group" aria-label="背景音乐预设">
          {MUSIC_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="chip"
              size="xs"
              active={musicPreset === preset.id}
              onClick={() => selectPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className={styles.urlRow}>
          <Input
            className={styles.urlInput}
            value={musicDraft}
            onChange={(event) => { setMusicDraft(event.target.value); clearMusicError() }}
            placeholder="粘贴音频 URL"
            aria-label="背景音乐 URL"
          />
          <Tooltip placement="top" title="加载并播放音乐">
            <Button size="sm" aria-label="加载并播放音乐" onClick={() => playUrl(musicDraft)} disabled={!musicDraft.trim()}>▶</Button>
          </Tooltip>
        </div>
        {musicError && <div className={styles.error}>{musicError}</div>}
        <div className={styles.musicFileRow}>
          <Button size="sm" className={styles.playToggle} onClick={toggle} disabled={!track.url}>{isPlaying ? '暂停' : '播放'}</Button>
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
        <div className={styles.modeRow}>
          <span>播放模式</span>
          <Segmented
            ariaLabel="音乐播放模式"
            block
            value={loopMode}
            options={MUSIC_LOOP_OPTIONS}
            onChange={setLoopMode}
          />
        </div>
      </section>
      <Button size="md" block className={styles.resetButton} onClick={handleResetStage}>↺ 重置舞台</Button>
    </aside>
  )
}
