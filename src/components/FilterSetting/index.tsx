import { useState } from 'react'
import { Button } from '../Button'
import { Input } from '../Input'
import { Modal } from '../Modal'
import { PresetChip } from '../PresetChip'
import { RequiredMark } from '../RequiredMark'
import { ScrollArea, PRESET_GRID_MAX_HEIGHT } from '../ScrollArea'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import styles from './index.module.scss'

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

export type FilterSettingProps = FilterValues & {
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
  /** 删除一个自定义滤镜；内置预设没有删除入口 */
  onRemoveCustomPreset: (id: FilterPreset) => void
}

export function FilterSetting({ enabled, onEnabledChange, preset, onPresetChange, brightness, onBrightnessChange, contrast, onContrastChange, saturation, onSaturationChange, blur, onBlurChange, backgroundUrl, customPresets, onAddCustomPreset, onRemoveCustomPreset }: FilterSettingProps) {
  const [showModal, setShowModal] = useState(false)
  const [draftName, setDraftName] = useState('')
  // 名称必填，但不要一打开就飘红：等用户离开过输入框才提示
  const [nameTouched, setNameTouched] = useState(false)
  const [draftValues, setDraftValues] = useState<FilterValues>(STANDARD_FILTER_VALUES)
  const nameMissing = !draftName.trim()
  const showNameHint = nameMissing && nameTouched
  const openCustomModal = () => {
    setDraftName('')
    setNameTouched(false)
    setDraftValues({ ...STANDARD_FILTER_VALUES })
    setShowModal(true)
  }
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
      <section className={styles.block}>
        <div className={styles.title}>
          <span>舞台滤镜</span>
          <Switch checked={enabled} onChange={onEnabledChange} ariaLabel="舞台滤镜开关" />
        </div>
        <ScrollArea
          columns={3}
          gap="5px"
          maxHeight={PRESET_GRID_MAX_HEIGHT}
          className={styles.presets}
          role="group"
          ariaLabel="舞台滤镜快捷预设"
        >
          {FILTER_PRESETS.map(({ id, label }) => (
            <PresetChip key={id} label={label} active={preset === id} onSelect={() => onPresetChange(id)} />
          ))}
          {customPresets.map(({ id, label }) => (
            <PresetChip
              key={id}
              label={label}
              active={preset === id}
              onSelect={() => onPresetChange(id)}
              onRemove={() => onRemoveCustomPreset(id)}
            />
          ))}
        </ScrollArea>
        <Button variant="ghost" size="sm" block className={styles.customButton} disabled={!enabled} onClick={openCustomModal}>
          ＋ 添加自定义滤镜
        </Button>
      </section>
      {showModal && (
        <Modal
          title="添加自定义滤镜"
          tone="panel"
          width="min(560px, calc(100vw - 32px))"
          maxHeight="min(820px, calc(100vh - 32px))"
          onClose={() => setShowModal(false)}
          actions={(
            <>
              <Button variant="secondary" size="lg" onClick={restoreStandardValues}>恢复标准</Button>
              <Button variant="secondary" size="lg" onClick={() => setShowModal(false)}>取消</Button>
              <Button size="lg" onClick={addCustomPreset} disabled={!draftName.trim()}>添加滤镜</Button>
            </>
          )}
        >
          <label className={styles.field}>
            <span>滤镜名称<RequiredMark /></span>
            <Input
              size="lg"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder="例如：暖阳"
              aria-label="滤镜名称"
              aria-invalid={showNameHint || undefined}
              aria-describedby={showNameHint ? 'filter-name-hint' : undefined}
              autoFocus
            />
            {/* 提示放在 label 里面：点提示文字也能聚焦到输入框 */}
            {showNameHint && <div className={styles.fieldHint} id="filter-name-hint">请填写滤镜名称</div>}
          </label>
          <div className={styles.modalControls}>
            <Slider label="亮度" valueText={`${Math.round(draftValues.brightness * 100)}%`} min={0.65} max={1.35} step={0.05} value={draftValues.brightness} onChange={(value) => updateDraft('brightness', value)} />
            <Slider label="对比度" valueText={`${Math.round(draftValues.contrast * 100)}%`} min={0.7} max={1.35} step={0.05} value={draftValues.contrast} onChange={(value) => updateDraft('contrast', value)} />
            <Slider label="饱和度" valueText={`${Math.round(draftValues.saturation * 100)}%`} min={0} max={1.6} step={0.05} value={draftValues.saturation} onChange={(value) => updateDraft('saturation', value)} />
            <Slider label="柔焦" valueText={`${draftValues.blur.toFixed(1)}px`} min={0} max={3} step={0.5} value={draftValues.blur} onChange={(value) => updateDraft('blur', value)} />
          </div>
          <div className={styles.previewLabel}>背景预览</div>
          <div
            className={styles.preview}
            style={{
              backgroundImage: `url("${backgroundUrl || DEFAULT_PREVIEW_BACKGROUND}")`,
              filter: `brightness(${draftValues.brightness}) contrast(${draftValues.contrast}) saturate(${draftValues.saturation}) blur(${draftValues.blur}px)`,
            }}
          />
        </Modal>
      )}
    </>
  )
}
