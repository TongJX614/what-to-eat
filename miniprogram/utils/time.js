function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

/**
 * 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / M月D日
 */
function relative(ts) {
  const diff = Date.now() - ts
  if (diff < 0) return '刚刚'
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return min + ' 分钟前'
  const hour = Math.floor(min / 60)
  if (hour < 24) return hour + ' 小时前'
  const day = Math.floor(hour / 24)
  if (day < 7) return day + ' 天前'
  const d = new Date(ts)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

/**
 * 完整时间：M月D日 HH:mm
 */
function datetime(ts) {
  const d = new Date(ts)
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

module.exports = {
  relative: relative,
  datetime: datetime
}
