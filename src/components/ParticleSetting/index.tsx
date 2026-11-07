import { useEffect, useState } from 'react'
import { PARTICLE_COLOR_OPTIONS, PARTICLE_PRESETS, type ParticlePreset } from '../Atmosphere'
import { Button } from '../Button'
import { ColorSelect } from '../ColorSelect'
import { PresetChip } from '../PresetChip'
import { ScrollArea, PRESET_GRID_MAX_HEIGHT } from '../ScrollArea'
import { Segmented } from '../Segmented'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import { cx } from '../../utils/cx'
import { PRESET_ROTATE_OPTIONS, type PresetRotateMode } from '../../contexts/StageProvider/presets'
import styles from './index.module.scss'

export type ParticleSettingProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  intensity: number
  onIntensityChange: (value: number) => void
  speed: number
  onSpeedChange: (value: number) => void
  opacity: number
  onOpacityChange: (value: number) => void
  preset: ParticlePreset
  onPresetChange: (preset: ParticlePreset) => void
  /** 固定 / 循环切换 / 随机切换 */
  mode: PresetRotateMode
  onModeChange: (mode: PresetRotateMode) => void
  color: string
  onColorChange: (color: string) => void
  size: number
  onSizeChange: (size: number) => void
}

export function ParticleSetting({
  enabled,
  onEnabledChange,
  intensity,
  onIntensityChange,
  speed,
  onSpeedChange,
  opacity,
  onOpacityChange,
  preset,
  onPresetChange,
  mode,
  onModeChange,
  color,
  onColorChange,
  size,
  onSizeChange,
}: ParticleSettingProps) {
  const [showFineControls, setShowFineControls] = useState(false)

  useEffect(() => {
    if (!enabled) setShowFineControls(false)
  }, [enabled])

  return (
    <section className={styles.block}>
      <div className={styles.title}>
        <span>粒子特效</span>
        <Switch checked={enabled} onChange={onEnabledChange} ariaLabel="粒子特效开关" />
      </div>
      <ScrollArea
        columns={3}
        gap="5px"
        maxHeight={PRESET_GRID_MAX_HEIGHT}
        className={styles.presets}
        role="group"
        ariaLabel="粒子特效快捷预设"
      >
        {PARTICLE_PRESETS.map(({ id, label }) => (
          <PresetChip
            key={id}
            label={label}
            active={enabled && preset === id}
            onSelect={() => { onPresetChange(id); onEnabledChange(true) }}
          />
        ))}
      </ScrollArea>
      <Button
        variant="chip"
        size="xs"
        block
        className={styles.detailToggle}
        aria-expanded={showFineControls}
        onClick={() => setShowFineControls((current) => !current)}
      >
        {showFineControls ? '收起细粒度控制' : '展开细粒度控制'}
      </Button>
      {showFineControls && (
        <div className={styles.fineControls}>
          <div className={cx(styles.colorRow, !enabled && styles.disabled)}>
            <span>粒子颜色</span>
            <ColorSelect
              value={color}
              options={PARTICLE_COLOR_OPTIONS}
              onChange={onColorChange}
              disabled={!enabled}
              ariaLabel="粒子颜色快捷选择"
              customLabel="自定义粒子颜色"
            />
          </div>
          <Slider className={cx(!enabled && styles.disabled)} label="强度" valueText={`${Math.round(intensity * 100)}%`} disabled={!enabled} min={0} max={1} step={0.05} value={intensity} onChange={onIntensityChange} />
          <Slider className={cx(!enabled && styles.disabled)} label="速度" valueText={`${speed.toFixed(1)}x`} disabled={!enabled} min={0.3} max={2} step={0.1} value={speed} onChange={onSpeedChange} />
          <Slider className={cx(!enabled && styles.disabled)} label="透明度" valueText={`${Math.round(opacity * 100)}%`} disabled={!enabled} min={0} max={1} step={0.05} value={opacity} onChange={onOpacityChange} />
          <Slider className={cx(!enabled && styles.disabled)} label="大小" valueText={`${Math.round(size * 100)}%`} disabled={!enabled} min={0.5} max={2.5} step={0.1} value={size} onChange={onSizeChange} />
        </div>
      )}
      {/* 和背景、音乐那两处一样，切换方式放在这一块的最下面 */}
      <Segmented
        className={styles.modeSwitch}
        ariaLabel="粒子特效切换方式"
        block
        value={mode}
        options={PRESET_ROTATE_OPTIONS}
        onChange={onModeChange}
        disabled={!enabled}
      />
    </section>
  )
}
