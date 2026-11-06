import { useAiChat, useLiveData } from '../../hooks'
import { giftPrice } from '../../data/gifts'
import { Card } from '../Card'
import styles from './index.module.scss'

/** 金额统一两位小数 */
function money(value: number) {
  return value.toFixed(2)
}

/** token 数带千分位 */
function tokens(value: number) {
  return value.toLocaleString('zh-CN')
}

/**
 * 收支面板：礼物收入、AI token 花费与净收益。
 * 数据自己从上下文取，不依赖外部传参 —— 这样它既能放在概览卡片组里，
 * 也能单独摆到舞台任意位置，不用改调用方。
 */
export function IncomeCard() {
  const { douyinRoom, giftPrices } = useLiveData()
  const { settings, usage } = useAiChat()

  // 收入按「每种礼物的件数 × 该礼物单价」累加；
  // 花费按 token 用量 × 单价折算（单价单位是元/百万 tokens）
  const revenue = douyinRoom.giftTotals.reduce(
    (sum, item) => sum + giftPrice(giftPrices, item.name) * item.count,
    0,
  )
  const cost = (usage.promptTokens * settings.inputPrice + usage.completionTokens * settings.outputPrice) / 1_000_000

  return (
    <Card className={styles.root} title="收支面板">
      <strong className={styles.amount}>{money(revenue - cost)} <small>元</small></strong>
      <div className={styles.metrics}>
        <span>收入 <b>{money(revenue)}</b></span>
        <span>花费 <b>{money(cost)}</b></span>
      </div>
      <dl>
        <dt>礼物</dt><dd>{douyinRoom.stats.giftCount} 件</dd>
        <dt>今日 token</dt><dd>{tokens(usage.totalTokens)}</dd>
      </dl>
    </Card>
  )
}
