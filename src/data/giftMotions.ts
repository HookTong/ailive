/**
 * 礼物 →（模型 id → 动作分组名）。
 * 同一个礼物可以给每个模型各配一个动作，收到礼物时各自触发自己的那个；没配的模型不触发。
 */
export type GiftMotionMap = Record<string, Record<string, string>>

/**
 * 通配模型键。早期版本只存一个动作名、不区分模型，迁移时归到这个键下：
 * 哪个模型自己也有同名动作，就跟着用。真正的模型 id 是 `whale-local` / `online:…`，不会撞上。
 */
export const GIFT_MOTION_ANY_MODEL = '*'

/** 解析要用到的最小模型信息 */
export type MotionModel = {
  id: string
  name: string
  /** 这个模型可用的动作分组 */
  motions: Record<string, { label?: string }>
}

export type GiftMotionTarget = {
  modelId: string
  modelName: string
  motion: string
  motionLabel: string
}

/**
 * 一个礼物在某个模型上真正会触发的动作。
 * 先看模型自己配的，没有再回落到通配键（旧格式迁移过来的），
 * 最后还要确认这个模型确实有该动作 —— 换过模型后旧配置会失效。
 */
export function resolveGiftMotion(
  entry: Record<string, string> | undefined,
  modelId: string,
  motions: Record<string, unknown>,
): string {
  const motion = entry?.[modelId] ?? entry?.[GIFT_MOTION_ANY_MODEL] ?? ''
  return motion && motions[motion] ? motion : ''
}

/** 一个礼物在整组模型上会触发的所有动作，顺序跟传入的模型顺序一致 */
export function giftMotionTargets(
  entry: Record<string, string> | undefined,
  models: MotionModel[],
): GiftMotionTarget[] {
  if (!entry) return []
  const targets: GiftMotionTarget[] = []
  for (const model of models) {
    const motion = resolveGiftMotion(entry, model.id, model.motions)
    if (!motion) continue
    targets.push({
      modelId: model.id,
      modelName: model.name,
      motion,
      motionLabel: model.motions[motion]?.label ?? motion,
    })
  }
  return targets
}
