/** 拼接 className：过滤掉 false / null / undefined，避免出现多余空格。 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
