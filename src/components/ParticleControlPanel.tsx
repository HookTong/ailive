import { useEffect, useState } from 'react'
import { PARTICLE_COLOR_OPTIONS, PARTICLE_PRESETS, type ParticlePreset } from './StageAtmosphere'

export type ParticleControlPanelProps = {
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
  color: string
  onColorChange: (color: string) => void
  size: number
  onSizeChange: (size: number) => void
}

export function ParticleControlPanel({
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
  color,
  onColorChange,
  size,
  onSizeChange,
}: ParticleControlPanelProps) {
  const [showFineControls, setShowFineControls] = useState(false)
  const sliderClass = enabled ? 'stage-slider' : 'stage-slider particle-control-disabled'
  const hasPresetColor = (PARTICLE_COLOR_OPTIONS as readonly string[]).includes(color)

  useEffect(() => {
    if (!enabled) setShowFineControls(false)
  }, [enabled])

  return (
    <section className="stage-block">
      <div className="stage-block-title"><span>粒子特效</span><label className="stage-switch"><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} /><span /></label></div>
      <div className="particle-presets" role="group" aria-label="粒子特效快捷预设">
        {PARTICLE_PRESETS.map(({ id, label }) => (
          <button key={id} type="button" className={enabled && preset === id ? 'particle-preset active' : 'particle-preset'} onClick={() => { onPresetChange(id); onEnabledChange(true) }}>{label}</button>
        ))}
      </div>
      <button type="button" className="particle-detail-toggle" aria-expanded={showFineControls} onClick={() => setShowFineControls((current) => !current)}>
        {showFineControls ? '收起细粒度控制' : '展开细粒度控制'}
      </button>
      {showFineControls && <div className="particle-fine-controls">
        <div className={enabled ? 'particle-color-row' : 'particle-color-row particle-control-disabled'}>
          <span>粒子颜色</span>
          <div className="particle-swatches" role="group" aria-label="粒子颜色快捷选择">
            {PARTICLE_COLOR_OPTIONS.map((swatch) => (
              <button key={swatch} type="button" disabled={!enabled} aria-label={`设置粒子颜色 ${swatch}`} className={color === swatch ? 'particle-swatch active' : 'particle-swatch'} style={{ backgroundColor: swatch }} onClick={() => onColorChange(swatch)} />
            ))}
            <label className={`${enabled ? 'particle-color-picker' : 'particle-color-picker disabled'}${!hasPresetColor ? ' active' : ''}`} title="自定义粒子颜色"><input type="color" disabled={!enabled} value={color} onChange={(event) => onColorChange(event.target.value)} /></label>
          </div>
        </div>
        <label className={sliderClass}><span>强度 <b>{Math.round(intensity * 100)}%</b></span><input type="range" disabled={!enabled} min="0" max="1" step="0.05" value={intensity} onChange={(event) => onIntensityChange(Number(event.target.value))} /></label>
        <label className={sliderClass}><span>速度 <b>{speed.toFixed(1)}x</b></span><input type="range" disabled={!enabled} min="0.3" max="2" step="0.1" value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))} /></label>
        <label className={sliderClass}><span>透明度 <b>{Math.round(opacity * 100)}%</b></span><input type="range" disabled={!enabled} min="0" max="1" step="0.05" value={opacity} onChange={(event) => onOpacityChange(Number(event.target.value))} /></label>
        <label className={sliderClass}><span>大小 <b>{Math.round(size * 100)}%</b></span><input type="range" disabled={!enabled} min="0.5" max="2.5" step="0.1" value={size} onChange={(event) => onSizeChange(Number(event.target.value))} /></label>
      </div>}
    </section>
  )
}
