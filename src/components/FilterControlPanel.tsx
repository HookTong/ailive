import { useState } from 'react'

export type FilterPreset = 'standard' | 'cinematic' | 'dream' | 'neon' | 'mist' | 'monochrome' | 'custom' | `custom:${number}`

export type CustomFilterPreset = {
  id: `custom:${number}`
  label: string
  brightness: number
  contrast: number
  saturation: number
  blur: number
  vignette: boolean
}

export const FILTER_PRESETS = [
  { id: 'standard', label: '标准', brightness: 1, contrast: 1, saturation: 1, blur: 0, vignette: true },
  { id: 'cinematic', label: '电影', brightness: 0.9, contrast: 1.2, saturation: 0.85, blur: 0.3, vignette: true },
  { id: 'dream', label: '梦幻', brightness: 1.1, contrast: 0.95, saturation: 1.3, blur: 1.5, vignette: false },
  { id: 'neon', label: '霓虹', brightness: 1.05, contrast: 1.3, saturation: 1.45, blur: 0.2, vignette: true },
  { id: 'mist', label: '薄雾', brightness: 1.12, contrast: 0.92, saturation: 0.9, blur: 2.5, vignette: false },
  { id: 'monochrome', label: '黑白', brightness: 1.02, contrast: 1.2, saturation: 0, blur: 0, vignette: true },
] as const

type FilterValues = Pick<CustomFilterPreset, 'brightness' | 'contrast' | 'saturation' | 'blur'>

const STANDARD_FILTER_VALUES: FilterValues = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  blur: 0,
}

const DEFAULT_PREVIEW_BACKGROUND = '/background.png'

export type FilterControlPanelProps = FilterValues & {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  preset: FilterPreset
  onPresetChange: (preset: FilterPreset) => void
  onBrightnessChange: (value: number) => void
  onContrastChange: (value: number) => void
  onSaturationChange: (value: number) => void
  onBlurChange: (value: number) => void
  backgroundUrl: string
  customPresets: CustomFilterPreset[]
  onAddCustomPreset: (preset: CustomFilterPreset) => void
}

export function FilterControlPanel({ enabled, onEnabledChange, preset, onPresetChange, brightness, onBrightnessChange, contrast, onContrastChange, saturation, onSaturationChange, blur, onBlurChange, backgroundUrl, customPresets, onAddCustomPreset }: FilterControlPanelProps) {
  const [showModal, setShowModal] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftValues, setDraftValues] = useState<FilterValues>(STANDARD_FILTER_VALUES)
  const openCustomModal = () => { setDraftName(''); setDraftValues({ ...STANDARD_FILTER_VALUES }); setShowModal(true) }
  const restoreStandardValues = () => setDraftValues({ ...STANDARD_FILTER_VALUES })
  const addCustomPreset = () => {
    const label = draftName.trim()
    if (!label) return
    const customPreset: CustomFilterPreset = { id: `custom:${Date.now()}`, label, ...draftValues, vignette: true }
    onAddCustomPreset(customPreset)
    setShowModal(false)
  }
  const updateDraft = <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => setDraftValues((current) => ({ ...current, [key]: value }))

  return (
    <>
      <section className="stage-block">
        <div className="stage-block-title"><span>舞台滤镜</span><label className="stage-switch"><input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} /><span /></label></div>
        <div className="filter-presets" role="group" aria-label="舞台滤镜快捷预设">
          {FILTER_PRESETS.map(({ id, label }) => <button key={id} type="button" className={preset === id ? 'filter-preset active' : 'filter-preset'} onClick={() => onPresetChange(id)}>{label}</button>)}
          {customPresets.map(({ id, label }) => <button key={id} type="button" className={preset === id ? 'filter-preset active' : 'filter-preset'} onClick={() => onPresetChange(id)}>{label}</button>)}
        </div>
        <button type="button" className="filter-custom-button" disabled={!enabled} onClick={openCustomModal}>添加自定义滤镜</button>
      </section>
      {showModal && <div className="modal-backdrop filter-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowModal(false)}><section className="filter-modal" role="dialog" aria-modal="true" aria-labelledby="custom-filter-title">
        <div className="modal-header"><h2 id="custom-filter-title">添加自定义滤镜</h2><button className="modal-close" type="button" aria-label="关闭" onClick={() => setShowModal(false)}>×</button></div>
        <label className="modal-field"><span>滤镜名称 <b>*</b></span><input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="请输入滤镜名称" autoFocus /></label>
        <div className="filter-modal-controls">
          <label className="stage-slider"><span>亮度 <b>{Math.round(draftValues.brightness * 100)}%</b></span><input type="range" min="0.65" max="1.35" step="0.05" value={draftValues.brightness} onChange={(event) => updateDraft('brightness', Number(event.target.value))} /></label>
          <label className="stage-slider"><span>对比度 <b>{Math.round(draftValues.contrast * 100)}%</b></span><input type="range" min="0.7" max="1.35" step="0.05" value={draftValues.contrast} onChange={(event) => updateDraft('contrast', Number(event.target.value))} /></label>
          <label className="stage-slider"><span>饱和度 <b>{Math.round(draftValues.saturation * 100)}%</b></span><input type="range" min="0" max="1.6" step="0.05" value={draftValues.saturation} onChange={(event) => updateDraft('saturation', Number(event.target.value))} /></label>
          <label className="stage-slider"><span>柔焦 <b>{draftValues.blur.toFixed(1)}px</b></span><input type="range" min="0" max="3" step="0.5" value={draftValues.blur} onChange={(event) => updateDraft('blur', Number(event.target.value))} /></label>
        </div>
        <div className="filter-preview-label">背景预览</div><div className="filter-preview" style={{ backgroundImage: `url("${backgroundUrl || DEFAULT_PREVIEW_BACKGROUND}")`, filter: `brightness(${draftValues.brightness}) contrast(${draftValues.contrast}) saturate(${draftValues.saturation}) blur(${draftValues.blur}px)` }} />
        <div className="modal-actions"><button className="modal-secondary" type="button" onClick={restoreStandardValues}>恢复标准</button><button className="modal-secondary" type="button" onClick={() => setShowModal(false)}>取消</button><button className="modal-primary" type="button" onClick={addCustomPreset} disabled={!draftName.trim()}>添加滤镜</button></div>
      </section></div>}
    </>
  )
}
