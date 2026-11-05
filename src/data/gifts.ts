/**
 * 抖音直播礼物目录。
 *
 * 价格单位统一用「元/个」：抖音礼物官方标价是抖币，这里按 10 抖币 = 1 元折算成默认值，
 * 只作为初始值 —— 实际单价可以在「直播配置」抽屉里逐个改，改完存 localStorage。
 *
 * 图标放在 public/gifts/ 下（OpenMoji 彩色 emoji，CC BY-SA 4.0，已下载到本地，
 * 不依赖外网 CDN，离线也能显示）。
 */
export type DouyinGift = {
  /** 礼物名，和弹幕事件里的 `event.gift` 对齐 */
  name: string
  /** 默认单价（元/个） */
  price: number
  /** public/gifts 下的文件名 */
  icon: string
}

export const DOUYIN_GIFTS: DouyinGift[] = [
  { name: '小心心', price: 0.1, icon: 'heart.svg' },
  { name: '玫瑰', price: 0.1, icon: 'rose.svg' },
  { name: '抖音', price: 0.1, icon: 'note.svg' },
  { name: '樱花', price: 0.1, icon: 'sakura.svg' },
  { name: '大啤酒', price: 0.2, icon: 'beer.svg' },
  { name: '加油鸭', price: 0.5, icon: 'duck.svg' },
  { name: '棒棒糖', price: 0.9, icon: 'lollipop.svg' },
  { name: '鲜花', price: 1, icon: 'bouquet.svg' },
  { name: '墨镜', price: 9.9, icon: 'sunglasses.svg' },
  { name: '礼花筒', price: 19.9, icon: 'popper.svg' },
  { name: '大金链', price: 29.9, icon: 'gem.svg' },
  { name: '跑车', price: 500, icon: 'car.svg' },
  { name: '抖音1号', price: 1000, icon: 'medal.svg' },
  { name: '嘉年华', price: 3000, icon: 'ferris.svg' },
]

/** 礼物名 -> 默认单价，作为用户没改过时的兜底 */
export const DEFAULT_GIFT_PRICES: Record<string, number> = Object.fromEntries(
  DOUYIN_GIFTS.map((gift) => [gift.name, gift.price]),
)

const ICON_BY_NAME = new Map(DOUYIN_GIFTS.map((gift) => [gift.name, gift.icon]))

/** 弹幕里的礼物名偶尔带空格或全角符号，统一一下再查表 */
export function normalizeGiftName(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/g, '').trim()
}

export function giftIcon(name: string | null | undefined): string | null {
  const icon = ICON_BY_NAME.get(normalizeGiftName(name))
  return icon ? `${import.meta.env.BASE_URL}gifts/${icon}` : null
}

/** 某个礼物的单价；没配过就用目录默认值，目录里也没有就按 0 算 */
export function giftPrice(prices: Record<string, number>, name: string | null | undefined): number {
  const key = normalizeGiftName(name)
  if (!key) return 0
  const value = prices[key]
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  return DEFAULT_GIFT_PRICES[key] ?? 0
}
