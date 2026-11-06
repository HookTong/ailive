import { useLiveData } from '../../hooks'
import { Card } from '../Card'
import styles from './index.module.scss'

/**
 * 礼物榜：按本次连接里每种礼物的件数排名（useLiveServer 里不落盘，重连即清零）。
 * 同样自己取数据，不依赖外部传参。
 */
export function GiftRankCard() {
  const { douyinRoom } = useLiveData()
  const giftRank = douyinRoom.giftRank

  return (
    <Card className={styles.root} title="礼物榜">
      <ol className={styles.list}>
        {giftRank.length > 0
          ? giftRank.map((entry, index) => (
            <li className={styles.item} key={`${index}-${entry.name}`}>
              <i className={styles.rank}>{index + 1}</i>
              <span className={styles.name}>{entry.name}</span>
              <b className={styles.count}>{entry.count} 件</b>
            </li>
          ))
          : <li className={styles.empty}>连接直播间后按礼物件数排名</li>}
      </ol>
    </Card>
  )
}
