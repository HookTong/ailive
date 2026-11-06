import { useMemo, useState } from 'react'
import { BackgroundModal } from '../BackgroundModal'
import { MusicModal } from '../MusicModal'
import { FilterSetting } from '../FilterSetting'
import { ParticleSetting } from '../ParticleSetting'
import { Button } from '../Button'
import { PresetChip } from '../PresetChip'
import { ScrollArea, PRESET_GRID_MAX_HEIGHT } from '../ScrollArea'
import { Segmented, type SegmentedOption } from '../Segmented'
import { Slider } from '../Slider'
import { cx } from '../../utils/cx'
import { useMusic, useStage } from '../../hooks'
import { BACKGROUND_PRESETS } from '../../contexts/StageProvider/presets'
import type { BackgroundMode } from '../../contexts/StageProvider/StageContext'
import type { MusicLoopMode } from '../../contexts/MusicProvider/MusicContext'
import styles from './index.module.scss'

const BACKGROUND_MODE_OPTIONS: readonly SegmentedOption<BackgroundMode>[] = [
  { value: 'fixed', label: '固定' },
  { value: 'cycle', label: '循环切换' },
  { value: 'none', label: '无背景' },
]

const MUSIC_LOOP_OPTIONS: readonly SegmentedOption<MusicLoopMode>[] = [
  { value: 'single', label: '单曲循环' },
  { value: 'list', label: '列表循环' },
  { value: 'shuffle', label: '随机播放' },
]

export function StageControlPanel() {
  const {
    backgroundUrl,
    setBackgroundUrl,
    backgroundMode,
    setBackgroundMode,
    customBackgrounds,
    addBackground,
    removeBackground,
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
    removeCustomFilterPreset,
    resetStage,
  } = useStage()

  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false)
  const [musicModalOpen, setMusicModalOpen] = useState(false)

  // 内置预设在前，用户自己添加的排在后面
  const allBackgrounds = useMemo(
    () => [...BACKGROUND_PRESETS, ...customBackgrounds],
    [customBackgrounds],
  )

  const selectBackground = (url: string) => {
    setBackgroundUrl(url)
    // 点预设就是想看见它，别停在上一次选的「无背景」上
    if (backgroundMode === 'none') setBackgroundMode('fixed')
  }

  // 音乐播放统一由 MusicProvider 持有，这里只做 UI
  const {
    track,
    presetId: musicPreset,
    tracks: allTracks,
    loopMode,
    setLoopMode,
    isPlaying,
    volume,
    error: musicError,
    selectPreset,
    addTrack,
    removeTrack,
    toggle,
    setVolume,
    reset: resetMusic,
  } = useMusic()

  const handleResetStage = () => {
    resetMusic()
    resetStage()
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.eyebrow}>STAGE CONTROL</div>
      <h2 className={styles.title}>舞台控制台</h2>
      <p className={styles.intro}>调整背景、光效、滤镜与声音氛围。</p>

      <section className={styles.block}>
        <div className={styles.blockTitle}><span>舞台背景</span><span className={styles.tinyTag}>IMAGE</span></div>
        {/* 3 个一行，超过最大高度就在容器里滚动，别把整块面板顶长 */}
        <ScrollArea
          className={styles.backgroundPresets}
          columns={3}
          gap="5px"
          maxHeight={PRESET_GRID_MAX_HEIGHT}
          role="group"
          ariaLabel="舞台背景预设"
        >
          {allBackgrounds.map(({ id, label, url }) => (
            <PresetChip
              key={id}
              label={label}
              /* 选了「无背景」台上就没有背景，这组不该继续显示某一张被选中。
                 backgroundUrl 本身是留着的 —— 切回「固定」时还能接着用上次那张 */
              active={backgroundMode !== 'none' && backgroundUrl === url}
              onSelect={() => selectBackground(url)}
              // 只有自己加的能删；内置预设没传 onRemove，右侧就不会出现角标
              onRemove={id.startsWith('custom:') ? () => removeBackground(id) : undefined}
            />
          ))}
        </ScrollArea>
        <Button variant="ghost" size="sm" block onClick={() => setBackgroundModalOpen(true)}>
          ＋ 添加背景
        </Button>
        {/* 标签文案去掉了，控件靠 aria-label 说明自己是谁 */}
        <Segmented
          className={styles.modeSwitch}
          ariaLabel="背景切换方式"
          block
          value={backgroundMode}
          options={BACKGROUND_MODE_OPTIONS}
          onChange={setBackgroundMode}
        />
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

      {/* 滤镜缩略图跟着舞台走：选了「无背景」就退回默认底图，别显示一张台上没有的图 */}
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
        backgroundUrl={backgroundMode === 'none' ? '' : backgroundUrl}
        customPresets={customFilterPresets}
        onAddCustomPreset={addCustomFilterPreset}
        onRemoveCustomPreset={removeCustomFilterPreset}
      />

      <section className={cx(styles.block, styles.musicBlock)}>
        <div className={styles.blockTitle}><span>背景音乐</span><span className={styles.muted}>{track.name || '未设置音乐'}</span></div>
        {/* 3 个一行，超过最大高度就在容器里滚动，和上面的背景按钮组同一套 */}
        <ScrollArea
          className={styles.musicPresets}
          columns={3}
          gap="5px"
          maxHeight={PRESET_GRID_MAX_HEIGHT}
          role="group"
          ariaLabel="背景音乐预设"
        >
          {allTracks.map((preset) => (
            <PresetChip
              key={preset.id}
              label={preset.label}
              active={musicPreset === preset.id}
              onSelect={() => selectPreset(preset)}
              onRemove={preset.id.startsWith('custom:') ? () => removeTrack(preset.id) : undefined}
            />
          ))}
        </ScrollArea>
        <div className={styles.musicActions}>
          <Button size="sm" onClick={toggle} disabled={!track.url}>{isPlaying ? '暂停' : '播放'}</Button>
          <Button variant="ghost" size="sm" onClick={() => setMusicModalOpen(true)}>＋ 添加音乐</Button>
        </div>
        {musicError && <div className={styles.error}>{musicError}</div>}
        <Segmented
          className={styles.modeSwitch}
          ariaLabel="音乐播放模式"
          block
          value={loopMode}
          options={MUSIC_LOOP_OPTIONS}
          onChange={setLoopMode}
        />
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
      </section>
      <Button size="md" block className={styles.resetButton} onClick={handleResetStage}>↺ 重置舞台</Button>

      {backgroundModalOpen && (
        <BackgroundModal
          onClose={() => setBackgroundModalOpen(false)}
          onAdd={addBackground}
        />
      )}
      {musicModalOpen && (
        <MusicModal
          onClose={() => setMusicModalOpen(false)}
          onAdd={addTrack}
        />
      )}
    </aside>
  )
}
