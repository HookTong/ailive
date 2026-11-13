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

// 四块浮层的操作区，顺序就是舞台上的摆放顺序：
// 概览在左上，礼物动作左下，弹幕右上，指令右下
const OVERLAY_CARDS: ReadonlyArray<{ key: OverlayScaleKey; label: string }> = [
  { key: 'overview', label: '直播概览' },
  { key: 'giftMotion', label: '礼物动作' },
  { key: 'chat', label: '直播弹幕' },
  { key: 'chatCommand', label: '弹幕指令' },
]

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
    overlayVisible,
    setOverlayVisible,
    resetOverlayCard,
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
    // 四块卡片的显隐 / 大小 / 透明度 / 位置也在这里面一起回默认
    resetStage()
  }

  return (
    <aside className={styles.panel}>
      <h2 className={styles.title}>舞台控制台</h2>
      <p className={styles.intro}>调整背景、光效、滤镜、声音与舞台卡片。</p>

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

      {/* 四块浮层各占一块操作区：开关管显不显示，两根滑块管大小和透明度。
          原来开关在顶部工具条、大小在面板最底下，调一张卡要在两个地方来回找 */}
      {OVERLAY_CARDS.map(({ key, label }) => {
        // 卡片收起来时，大小 / 透明度 / 复位都作用不到任何看得见的东西 ——
        // 整组禁用。但开关本身必须留着，否则关掉就再也打不开了
        const visible = overlayVisible[key]

        return (
          <section key={key} className={styles.block}>
            <div className={styles.blockTitle}>
              <span>{label}</span>
              <div className={styles.cardActions}>
                {/* 单块复位：大小 / 透明度回 100%、卡片回默认位置。开关不跟着变 ——
                    那是旁边那个 Switch 的事，复位顺手把藏起来的卡片放出来会很意外 */}
                <Button
                  variant="bare"
                  className={styles.resetOverlay}
                  disabled={!visible}
                  onClick={() => resetOverlayCard(key)}
                >
                  复位
                </Button>
                <Switch
                  checked={visible}
                  onChange={(on) => setOverlayVisible(key, on)}
                  ariaLabel={`${label}显示`}
                />
              </div>
            </div>
            <div className={cx(styles.overlaySliders, !visible && styles.cardDisabled)}>
              <Slider
                label="大小"
                valueText={`${Math.round(overlayScales[key] * 100)}%`}
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={0.05}
                value={overlayScales[key]}
                disabled={!visible}
                onChange={(value) => setOverlayScale(key, value)}
                ariaLabel={`${label}卡片大小`}
              />
              <Slider
                label="透明度"
                valueText={`${Math.round(overlayOpacities[key] * 100)}%`}
                min={OVERLAY_OPACITY_MIN}
                max={OVERLAY_OPACITY_MAX}
                step={0.05}
                value={overlayOpacities[key]}
                disabled={!visible}
                onChange={(value) => setOverlayOpacity(key, value)}
                ariaLabel={`${label}卡片透明度`}
              />
            </div>
          </section>
        )
      })}

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
