/**
 * 抖音直播礼物目录。
 *
 * 价格单位统一用「元/个」：抖音礼物官方标价是抖币，这里按 10 抖币 = 1 元折算成默认值，
 * 只作为初始值 —— 实际单价可以在「直播配置」抽屉里逐个改，改完存 localStorage。
 *
 * 图标放在 public/gifts/ 下（OpenMoji 彩色 emoji，CC BY-SA 4.0，已下载到本地，
 * 不依赖外网 CDN，离线也能显示）。「666」没有对应的 emoji，是照同一套风格手画的
 * （72×72 画布 + 黑色 2px 描边）。目录外的礼物（直播间里出现、但这里没收录的）
 * 在「直播配置」里会显示一个「?」占位，遇到就把名字加进来并补一张图标。
 */
export type DouyinGift = {
  /** 礼物名，和弹幕事件里的 `event.gift` 对齐 */
  name: string
  /** 默认单价（元/个） */
  price: number
  /** public/gifts 下的文件名 */
  icon: string
}

/**
 * 目录顺序 = 单价从低到高，同价按「互动类 → 礼物类」排。
 * 「直播配置」里的礼物清单直接照这个顺序渲染，加新礼物请插到对应价位上，
 * 别一律追加到末尾 —— 那样清单看着像没排过序。
 */
export const DOUYIN_GIFTS: DouyinGift[] = [
  { name: '小心心', price: 0.1, icon: 'heart.svg' },
  { name: '玫瑰', price: 0.1, icon: 'rose.svg' },
  { name: '抖音', price: 0.1, icon: 'note.svg' },
  { name: '樱花', price: 0.1, icon: 'sakura.svg' },
  { name: '粉丝团灯牌', price: 0.1, icon: 'placard.svg' },
  { name: '点亮粉丝团', price: 0.1, icon: 'bulb.svg' },
  { name: '入团卡', price: 0.1, icon: 'idcard.svg' },
  { name: '人气票', price: 0.1, icon: 'ticket.svg' },
  { name: '666', price: 0.1, icon: 'six.svg' },
  { name: '美味烧鸡', price: 0.1, icon: 'chicken.svg' },
  { name: '人气TOP3', price: 0.1, icon: 'trophy.svg' },
  // 抖音官方没查到这一款（只有「为你打call」999 抖币），先按最低档的助威礼物填 0.1，
  // 实际单价可以在「直播配置」里改
  { name: '一起打call', price: 0.1, icon: 'megaphone.svg' },
  { name: '大啤酒', price: 0.2, icon: 'beer.svg' },
  { name: '你最好看', price: 0.2, icon: 'look.svg' },
  { name: '加油鸭', price: 0.5, icon: 'duck.svg' },
  { name: '点点星光', price: 0.8, icon: 'star.svg' },
  { name: '棒棒糖', price: 0.9, icon: 'lollipop.svg' },
  { name: '鲜花', price: 1, icon: 'bouquet.svg' },
  { name: '小皇冠', price: 1, icon: 'crown.svg' },
  { name: '爱你哟', price: 5.2, icon: 'fingerheart.svg' },
  { name: '墨镜', price: 9.9, icon: 'sunglasses.svg' },
  { name: '捏捏小脸', price: 9.9, icon: 'pinch.svg' },
  { name: '礼花筒', price: 19.9, icon: 'popper.svg' },
  { name: '为你闪耀', price: 19.9, icon: 'sparkles.svg' },
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
