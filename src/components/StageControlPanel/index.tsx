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
import { Switch } from '../Switch'
import { cx } from '../../utils/cx'
import { useMusic, useStage } from '../../hooks'
import { BACKGROUND_PRESETS, PRESET_ROTATE_OPTIONS } from '../../contexts/StageProvider/presets'
import {
  OVERLAY_OPACITY_MAX,
  OVERLAY_OPACITY_MIN,
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN,
  type BackgroundMode,
  type OverlayScaleKey,
} from '../../contexts/StageProvider/StageContext'
import type { MusicLoopMode } from '../../contexts/MusicProvider/MusicContext'
import styles from './index.module.scss'

// 背景的三种轮换方式和粒子 / 滤镜那两组完全一样（固定 / 循环 / 随机），共用一份选项。
// 面板上的背景开关不在这组里 —— 它管「铺不铺图」而不是「怎么换图」；
// 命令侧的 `[背景|开启]` / `[背景|关闭]` 就是这同一个开关的指令入口
const BACKGROUND_MODE_OPTIONS: readonly SegmentedOption<BackgroundMode>[] = PRESET_ROTATE_OPTIONS

// 三格的文案就是指令的限定词（`[音乐|单曲循环]` / `[音乐|列表循环]` / `[音乐|随机播放]`），
// 改这里要连 data/actions 的 qualifier 一起改。
// 这里没跟背景那组压成两个字：那组的「循环」「随机」单看也认得，而「单曲」「列表」离了「循环」
// 就说不清是干什么的，三格各 83px 放得下四字
const MUSIC_LOOP_OPTIONS: readonly SegmentedOption<MusicLoopMode>[] = [
  { value: 'single', label: '单曲循环' },
  { value: 'list', label: '列表循环' },
  { value: 'shuffle', label: '随机播放' },
]

// 两组滑块（大小 / 透明度）共用的文案。顺序就是舞台上的摆放顺序：
// 概览在左上，礼物动作左下，弹幕右上，指令右下
const OVERLAY_SLIDERS: ReadonlyArray<{ key: OverlayScaleKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'giftMotion', label: '礼物动作' },
  { key: 'chat', label: '弹幕' },
  { key: 'chatCommand', label: '指令' },
]

/**
 * 「全部」滑块的状态：`value` 是滑块位置，`mixed` 表示四块当前并不一致。
 *
 * 只在挂载时读一次。之后这个滑块**只向下写、不向上读** —— 拖它把四块一起设成这个数，
 * 单独拖某一块时位置原地不动，只把 `mixed` 立起来，文案从百分比换成「单独调节」。
 * 否则每调一块它都跟着跳，等真想「一起调」时又得重新找位置。
 */
type UnifiedState = { value: number; mixed: boolean }

function initialUnified(values: number[]): UnifiedState {
  const mixed = values.some((value) => value !== values[0])
  return {
    value: mixed ? values.reduce((sum, value) => sum + value, 0) / values.length : values[0],
    mixed,
  }
}

export function StageControlPanel() {
  const {
    backgroundUrl,
    setBackgroundUrl,
    backgroundMode,
    setBackgroundMode,
    backgroundModeBeforeOff,
    setBackgroundVisible,
    customBackgrounds,
    addBackground,
    removeBackground,
    particleEnabled,
    setParticleEnabled,
    particleIntensity,
    particleSpeed,
    particleOpacity,
    particlePreset,
    particleMode,
    setParticleMode,
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
    filterMode,
    setFilterMode,
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
    overlayScales,
    setOverlayScale,
    overlayOpacities,
    setOverlayOpacity,
    resetOverlayScales,
    resetOverlayOpacities,
    resetStage,
  } = useStage()

  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false)
  const [musicModalOpen, setMusicModalOpen] = useState(false)
  // 逐块调整默认收起：四块一起放大是常态，单独调是少数情况。
  // 和「展开细粒度控制」一样不落盘 —— 它只是这一屏的展开状态
  const [showScaleDetails, setShowScaleDetails] = useState(false)
  const [showOpacityDetails, setShowOpacityDetails] = useState(false)

  // 「全部」滑块自己的值。只在挂载时从四块推一次，之后独立 —— 见 initialUnified
  const [scaleAll, setScaleAll] = useState(() => initialUnified(OVERLAY_SLIDERS.map(({ key }) => overlayScales[key])))
  const [opacityAll, setOpacityAll] = useState(() => initialUnified(OVERLAY_SLIDERS.map(({ key }) => overlayOpacities[key])))

  /** 统一滑块一动就四块一起写，四块回到同一个数，`mixed` 随之清掉。
   *  逐个 set 用的是函数式更新，四次会依次叠上去 */
  const handleAllScalesChange = (value: number) => {
    setScaleAll({ value, mixed: false })
    for (const { key } of OVERLAY_SLIDERS) setOverlayScale(key, value)
  }
  const handleAllOpacitiesChange = (value: number) => {
    setOpacityAll({ value, mixed: false })
    for (const { key } of OVERLAY_SLIDERS) setOverlayOpacity(key, value)
  }

  /** 单独拖某一块：只写那一块，统一滑块位置不动，仅标记「四块已不一致」 */
  const handleScaleChange = (key: OverlayScaleKey, value: number) => {
    setOverlayScale(key, value)
    setScaleAll((current) => (current.mixed ? current : { ...current, mixed: true }))
  }
  const handleOpacityChange = (key: OverlayScaleKey, value: number) => {
    setOverlayOpacity(key, value)
    setOpacityAll((current) => (current.mixed ? current : { ...current, mixed: true }))
  }

  /** 每块管自己的复位。滑块也一起拉回 100%，不然它还停在旧数值上，一碰就把四块拽回去 */
  const resetScaleGroup = () => {
    setScaleAll({ value: 1, mixed: false })
    resetOverlayScales()
  }
  const resetOpacityGroup = () => {
    setOpacityAll({ value: 1, mixed: false })
    resetOverlayOpacities()
  }

  // 内置预设在前，用户自己添加的排在后面
  const allBackgrounds = useMemo(
    () => [...BACKGROUND_PRESETS, ...customBackgrounds],
    [customBackgrounds],
  )

  const selectBackground = (url: string) => {
    // 开关关着时这排胶囊是禁用的，能点到这儿就说明台上正铺着图，直接换
    setBackgroundUrl(url)
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
    // resetStage 已经把四块设回 100%，滑块自己也得跟上，否则一碰就把它们拽回旧数值
    setScaleAll({ value: 1, mixed: false })
    setOpacityAll({ value: 1, mixed: false })
  }

  return (
    <aside className={styles.panel}>
      <h2 className={styles.title}>舞台控制台</h2>
      <p className={styles.intro}>调整背景、光效、滤镜与声音氛围。</p>

      <section className={styles.block}>
        <div className={styles.blockTitle}>
          <span>舞台背景</span>
          {/* 开关管「铺不铺图」，位置和粒子 / 滤镜那两处一样 */}
          <Switch
            checked={backgroundMode !== 'none'}
            onChange={setBackgroundVisible}
            ariaLabel="舞台背景开关"
          />
        </div>
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
              /* 选中态只看「台上该是哪一张」，和开关无关 —— 关掉时这张依然亮着，
                 只是整排点不动。backgroundUrl 本来就留着，打开还是它 */
              active={backgroundUrl === url}
              // 开关关着时整排点不动，和下面那行切换方式一起变灰
              disabled={backgroundMode === 'none'}
              onSelect={() => selectBackground(url)}
              // 只有自己加的能删；内置预设没传 onRemove，右侧就不会出现角标
              onRemove={id.startsWith('custom:') ? () => removeBackground(id) : undefined}
            />
          ))}
        </ScrollArea>
        {/* 只剩「添加背景」一个，走整宽 —— 和滤镜那块的「＋ 添加自定义滤镜」同一套。
            开关关着时也一起变灰：台上不铺图，加进来也看不见 */}
        <Button
          variant="ghost"
          size="sm"
          block
          disabled={backgroundMode === 'none'}
          onClick={() => setBackgroundModalOpen(true)}
        >
          ＋ 添加背景
        </Button>
        {/* 标签文案去掉了，控件靠 aria-label 说明自己是谁 */}
        <Segmented
          className={styles.modeSwitch}
          ariaLabel="背景切换方式"
          block
          /* 关掉时不换值：选中项留在关之前那一种上，只是整块点不动 ——
             清零会让人以为「关一次就把轮换方式忘了」 */
          value={backgroundMode === 'none' ? backgroundModeBeforeOff : backgroundMode}
          options={BACKGROUND_MODE_OPTIONS}
          onChange={setBackgroundMode}
          // 台上没图就没有「怎么换」可言，和粒子 / 滤镜关掉时一样整块变灰
          disabled={backgroundMode === 'none'}
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
        mode={particleMode}
        onModeChange={setParticleMode}
        color={particleColor}
        onColorChange={handleParticleColorChange}
        size={particleSize}
        onSizeChange={handleParticleSizeChange}
      />

      {/* 滤镜缩略图跟着舞台走：选了「无背景」就退回默认底图，别显示一张台上没有的图 */}
      <FilterSetting
        enabled={filterEnabled}
        // 开关语义在 StageProvider 里：关掉只是不渲染，重新打开会回到关掉前选的那一项
        onEnabledChange={setFilterEnabled}
        preset={filterPreset}
        onPresetChange={handleFilterPresetChange}
        mode={filterMode}
        onModeChange={setFilterMode}
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
        <div className={styles.actionRow}>
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

      {/* 放在音乐之后：舞台控制台最后一组「看的效果」设置，再往下就是重置 */}
      <section className={styles.block}>
        <div className={styles.blockTitle}>
          <span>浮层大小</span>
          {/* 原来这里是「手机观看调大」的说明。改成一键复位：四路调过之后
              很难再一个个拖回 100%，位置更是没地方归零 —— 位置没有单独的块，归这里管 */}
          <Button variant="bare" className={styles.resetOverlay} onClick={resetScaleGroup}>复位</Button>
        </div>
        {/* 默认只有一根统一滑块：四块一起放大是常态，逐块调是少数情况，
            八根滑块天天摊在面板上只会把常用的那两根淹掉 */}
        <div className={styles.overlaySliders}>
          <Slider
            label="全部"
            valueText={scaleAll.mixed ? '单独调节' : `${Math.round(scaleAll.value * 100)}%`}
            min={OVERLAY_SCALE_MIN}
            max={OVERLAY_SCALE_MAX}
            step={0.05}
            value={scaleAll.value}
            onChange={handleAllScalesChange}
            ariaLabel="全部浮层大小"
          />
        </div>
        <Button
          variant="chip"
          size="xs"
          block
          className={styles.overlayToggle}
          aria-expanded={showScaleDetails}
          onClick={() => { setShowScaleDetails((current) => !current) }}
        >
          {showScaleDetails ? '收起单独调节' : '展开单独调节'}
        </Button>
        {showScaleDetails && (
          <div className={styles.overlaySliders}>
            {OVERLAY_SLIDERS.map(({ key, label }) => (
              <Slider
                key={key}
                label={label}
                valueText={`${Math.round(overlayScales[key] * 100)}%`}
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={0.05}
                value={overlayScales[key]}
                onChange={(value) => { handleScaleChange(key, value) }}
                ariaLabel={`${label}浮层大小`}
              />
            ))}
          </div>
        )}
      </section>

      {/* 和大小分成两块：八行滑块挤在一个块里，看不出哪四行管哪件事 */}
      <section className={styles.block}>
        <div className={styles.blockTitle}>
          <span>浮层透明度</span>
          {/* 只复位透明度，不动大小和位置 —— 两块各管各的，不用猜该点哪个 */}
          <Button variant="bare" className={styles.resetOverlay} onClick={resetOpacityGroup}>复位</Button>
        </div>
        <div className={styles.overlaySliders}>
          <Slider
            label="全部"
            valueText={opacityAll.mixed ? '单独调节' : `${Math.round(opacityAll.value * 100)}%`}
            min={OVERLAY_OPACITY_MIN}
            max={OVERLAY_OPACITY_MAX}
            step={0.05}
            value={opacityAll.value}
            onChange={handleAllOpacitiesChange}
            ariaLabel="全部浮层透明度"
          />
        </div>
        <Button
          variant="chip"
          size="xs"
          block
          className={styles.overlayToggle}
          aria-expanded={showOpacityDetails}
          onClick={() => { setShowOpacityDetails((current) => !current) }}
        >
          {showOpacityDetails ? '收起单独调节' : '展开单独调节'}
        </Button>
        {showOpacityDetails && (
          <div className={styles.overlaySliders}>
            {OVERLAY_SLIDERS.map(({ key, label }) => (
              <Slider
                key={key}
                label={label}
                valueText={`${Math.round(overlayOpacities[key] * 100)}%`}
                min={OVERLAY_OPACITY_MIN}
                max={OVERLAY_OPACITY_MAX}
                step={0.05}
                value={overlayOpacities[key]}
                onChange={(value) => { handleOpacityChange(key, value) }}
                ariaLabel={`${label}浮层透明度`}
              />
            ))}
          </div>
        )}
      </section>
      {/* 底部操作：和左侧角色控制台的「重置角色」同一套结构（分隔线 + 18px 上留白） */}
      <div className={styles.footer}>
        <Button size="md" block className={styles.resetButton} onClick={handleResetStage}>↺ 重置舞台</Button>
      </div>

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
