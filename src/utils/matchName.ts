/**
 * 名称模糊匹配。
 *
 * 弹幕指令里 `$背景名称` / `$滤镜名称` 这些变量是让观众自己填的，而观众多半不知道
 * 配置里到底叫什么：可能多打几个字（「赛博朋克城市」对「赛博」）、只记得前半截
 * （「赛博」对「赛博朋克」）、或者差一个字。所以这里不做精确相等，而是算一个
 * 相似度、挑最像的那个；一个都够不上就返回空，让调用方去报「没找到」。
 */

/**
 * 归一化：全角转半角、去掉空白和标点、统一小写。
 * 手机上打「Ｌｏｆｉ」「Lofi P1」「lofi-p1」都该能对上配置里的「Lofi-P1」。
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .toLocaleLowerCase()
}

/**
 * 够像就算命中。
 * 包含关系最低也有 0.6（单字包含在长名字里），编辑距离那条最高 0.667（3 字错 1 个），
 * 取 0.6 两边都能过；再往下放就会把「电车」匹配到「电影」上了。
 */
const MATCH_THRESHOLD = 0.6

/** 编辑距离（Levenshtein）。名字都很短，逐行滚动的朴素实现足够 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]
}

/**
 * 两个（已归一化的）名字有多像，0 ~ 1。
 *
 * 只处理三种情况，够用且不会乱匹配：
 * - 一模一样 → 1
 * - 一个是另一个的子串 → 0.6 ~ 1，按长度差给分（「赛博」对「赛博朋克」0.8）
 * - 只差一个字、且不短于 3 个字 → 0.6 ~ 0.9（两个字还错一个基本就是另一个词了）
 */
export function nameSimilarity(query: string, candidate: string): number {
  if (!query || !candidate) return 0
  if (query === candidate) return 1
  const shorter = query.length <= candidate.length ? query : candidate
  const longer = query.length <= candidate.length ? candidate : query
  if (longer.includes(shorter)) {
    return 0.6 + 0.4 * (shorter.length / longer.length)
  }
  const distance = editDistance(query, candidate)
  if (distance > 1 || longer.length < 3) return 0
  return 1 - distance / longer.length
}

/**
 * 在一组候选里挑最像的那个。没有够像的就返回 undefined —— 宁可报「没找到」，
 * 也不要给观众一个莫名其妙的结果。
 */
export function findClosestMatch<T>(
  query: string | undefined,
  items: readonly T[],
  labelOf: (item: T) => string,
): T | undefined {
  const key = normalizeName(query ?? '')
  if (!key) return undefined
  let best: T | undefined
  let bestScore = MATCH_THRESHOLD
  for (const item of items) {
    const score = nameSimilarity(key, normalizeName(labelOf(item)))
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  return best
}
