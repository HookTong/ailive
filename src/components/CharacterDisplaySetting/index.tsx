import { HintIcon } from '../HintIcon'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import type { BubbleMode } from '../../contexts/ModelProvider/ModelContext'
import styles from './index.module.scss'

export type CharacterDisplaySettingProps = {
  /** 气泡显示策略：speaking = 只有说话时显示，always = 常显 */
  bubbleMode: BubbleMode
  onBubbleModeChange: (mode: BubbleMode) => void
  /** 舞台上该角色脚下的名称名牌是否显示 */
  nameplateVisible: boolean
  onNameplateVisibleChange: (visible: boolean) => void
  /** 模型在舞台上的大小（0.2 ~ 0.95） */
  modelSize: number
  onModelSizeChange: (size: number) => void
}

/**
 * 角色在舞台上的显示设置：气泡常显、名牌、大小。
 *
 * 这三项都只决定「看起来怎样」，和音色、动作那种功能设置分开 —— 它们原来散在
 * 角色控制台的不同位置（大小在上、气泡在音色区里），凑到一起才好找。
 * 一条上边框把这一组和上面的内容隔开，和 StageControlPanel 里的分块是同一种做法。
 *
 * 三项都是「开 / 关」或「一个值」，所以统一成左文右控件的一行，不再用分段控件 ——
 * 气泡只有「说话时显示」和「常显」两态，一个开关就够了，还省掉一整行的高度。
 */
export function CharacterDisplaySetting({
  bubbleMode, onBubbleModeChange,
  nameplateVisible, onNameplateVisibleChange,
  modelSize, onModelSizeChange,
}: CharacterDisplaySettingProps) {
  return (
    <section className={styles.root}>
      <div className={styles.row}>
        <span>
          气泡常显
          <HintIcon placement="right" hint="角色说话时头顶的气泡框，关闭时仅说话会显示" />
        </span>
        <Switch
          checked={bubbleMode === 'always'}
          onChange={(always) => onBubbleModeChange(always ? 'always' : 'speaking')}
          ariaLabel="气泡常显"
        />
      </div>
      <div className={styles.row}>
        <span>
          名牌显示
          <HintIcon placement="right" hint="角色底部的名称标签" />
        </span>
        <Switch
          checked={nameplateVisible}
          onChange={onNameplateVisibleChange}
          ariaLabel="名牌显示"
        />
      </div>
      {/* 滑块自带「标签 + 数值」那一行，和其他两项的间距由 .root 的 gap 统一给 */}
      <Slider
        className={styles.slider}
        label="模型大小"
        valueText={`${Math.round(modelSize * 100)}%`}
        ariaLabel="模型大小"
        min={0.2}
        max={0.95}
        step={0.05}
        value={modelSize}
        onChange={onModelSizeChange}
      />
    </section>
  )
}
