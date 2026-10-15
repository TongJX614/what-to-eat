/**
 * 历史统计与本周日历
 * 纯计算，便于单测；时间以「决定吃」的时间（decidedAt，缺省回退 ts）为准。
 */

function startOfWeek(date, mondayFirst) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=周日 .. 6=周六
  let diff
  if (mondayFirst) {
    diff = day === 0 ? -6 : 1 - day
  } else {
    diff = -day
  }
  d.setDate(d.getDate() + diff)
  return d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function recTime(rec) {
  return rec.decidedAt || rec.ts || 0
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 本周 7 天，每天显示当天最后一道决定吃的菜
 */
function weeklyCalendar(history, now) {
  const base = now || new Date()
  const monday = startOfWeek(base, true)
  const list = []
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday)
    dayDate.setDate(monday.getDate() + i)
    let pick = null
    // 倒序找当天最后一道（最近决定）
    for (let j = history.length - 1; j >= 0; j--) {
      const t = recTime(history[j])
      if (t && isSameDay(new Date(t), dayDate)) {
        pick = history[j]
        break
      }
    }
    list.push({
      label: WEEK_LABELS[i],
      date: (dayDate.getMonth() + 1) + '/' + dayDate.getDate(),
      isToday: isSameDay(dayDate, base),
      id: pick ? pick.id : '',
      name: pick ? pick.name : ''
    })
  }
  return list
}

/**
 * 概览统计：本周决定次数、最常决定的菜、最爱分类
 */
function summary(history, now) {
  const monday = startOfWeek(now || new Date(), true)
  const weekRecs = history.filter(function (r) {
    const t = recTime(r)
    return t && new Date(t) >= monday
  })

  const byId = {}
  weekRecs.forEach(function (r) {
    if (!byId[r.id]) byId[r.id] = { id: r.id, name: r.name, count: 0 }
    byId[r.id].count++
  })
  let topDish = null
  Object.keys(byId).forEach(function (k) {
    if (!topDish || byId[k].count > topDish.count) topDish = byId[k]
  })

  const byCat = {}
  history.forEach(function (r) {
    byCat[r.category] = (byCat[r.category] || 0) + 1
  })
  let topCat = null
  Object.keys(byCat).forEach(function (k) {
    if (!topCat || byCat[k] > topCat.count) topCat = { category: k, count: byCat[k] }
  })

  return {
    weekCount: weekRecs.length,
    topDish: topDish ? topDish.name : '',
    topCat: topCat ? topCat.category : ''
  }
}

/**
 * 口味画像：从带评分的历史里聚合并排序出「偏爱的口味」与「想避开的口味」。
 * 同一 tag 被多次 good 累积为正、被多次 bad 累积为负，按绝对值排序取前 N。
 * @param {Array} history
 * @param {number} [topN=3]
 * @returns {{ loved: string[], hated: string[] }}
 */
/* 统计每个 tag 的「喜欢(+) / 踩雷(-)」累计分，供下面两个画像函数共用 */
function countTags(history) {
  const cnt = {}
  if (!Array.isArray(history)) return cnt
  for (let i = 0; i < history.length; i++) {
    const h = history[i]
    if (!h.rating || h.rating === 'ok') continue
    const v = h.rating === 'good' ? 1 : -1
    const tags = Array.isArray(h.tags) ? h.tags : []
    for (let t = 0; t < tags.length; t++) {
      const key = tags[t]
      cnt[key] = (cnt[key] || 0) + v
    }
  }
  return cnt
}

function sortByScore(cnt) {
  const loved = []
  const hated = []
  Object.keys(cnt).forEach(function (k) {
    if (cnt[k] > 0) loved.push({ tag: k, score: cnt[k] })
    else if (cnt[k] < 0) hated.push({ tag: k, score: -cnt[k] })
  })
  loved.sort(function (a, b) { return b.score - a.score })
  hated.sort(function (a, b) { return b.score - a.score })
  return { loved: loved, hated: hated }
}

function tasteProfile(history, topN) {
  const n = Number(topN) || 3
  const s = sortByScore(countTags(history))
  return {
    loved: s.loved.slice(0, n).map(function (x) { return x.tag }),
    hated: s.hated.slice(0, n).map(function (x) { return x.tag })
  }
}

// 强度：累计分越高，口味倾向越明确（1~3 格，用于画像卡的强度点）
function levelOf(score) {
  if (score >= 3) return 3
  if (score >= 2) return 2
  return 1
}

/**
 * 带强度的口味画像，用于历史页画像卡与结果页「你爱」角标。
 * @returns {{loved: Array<{tag,score,level}>, hated: Array<{tag,score,level}>}}
 */
function tasteProfileDetailed(history, topN) {
  const n = Number(topN) || 4
  const s = sortByScore(countTags(history))
  const pack = function (arr) {
    return arr.slice(0, n).map(function (x) {
      // dots 固定 3 格，由 wxml 用 n <= level 决定点亮几个（WXS/WXML 不好直接循环数字）
      return { tag: x.tag, score: x.score, level: levelOf(x.score), dots: [1, 2, 3] }
    })
  }
  return { loved: pack(s.loved), hated: pack(s.hated) }
}

/* 把「决定吃」的时间归到当天 0 点，用于按天去重 */
function dayKey(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * 连续打卡天数：从今天往回数，某天没有任何「决定」就断。
 * 今天还没决定不算断（从昨天继续数），避免晚上打开看到 0 的挫败感。
 */
function streak(history, now) {
  const days = {}
  if (Array.isArray(history)) {
    history.forEach(function (r) {
      const t = recTime(r)
      if (t) days[dayKey(t)] = true
    })
  }
  const cursor = new Date(now || new Date())
  cursor.setHours(0, 0, 0, 0)
  if (!days[cursor.getTime()]) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (days[cursor.getTime()]) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/**
 * 自然月统计，供月度味觉报告卡使用。
 * @returns {{monthLabel, count, ratedCount, goodCount, days, topDish, topCat, loved, hated}}
 */
function monthlyReport(history, now) {
  const base = now || new Date()
  const y = base.getFullYear()
  const m = base.getMonth()
  const list = (Array.isArray(history) ? history : []).filter(function (r) {
    const t = recTime(r)
    if (!t) return false
    const d = new Date(t)
    return d.getFullYear() === y && d.getMonth() === m
  })

  const byId = {}
  const daySet = {}
  list.forEach(function (r) {
    byId[r.id] = (byId[r.id] || 0) + 1
    daySet[dayKey(recTime(r))] = true
  })
  let topDish = ''
  let topCount = 0
  Object.keys(byId).forEach(function (k) {
    if (byId[k] > topCount) { topCount = byId[k]; topDish = (list.find(function (r) { return r.id === k }) || {}).name || '' }
  })

  const byCat = {}
  list.forEach(function (r) { byCat[r.category] = (byCat[r.category] || 0) + 1 })
  let topCat = ''
  let catCount = 0
  Object.keys(byCat).forEach(function (k) {
    if (byCat[k] > catCount) { catCount = byCat[k]; topCat = k }
  })

  // 「偏爱的口味」是月度报告里的一段，必须只用本月的记录聚合。
  // 之前传的是全量 history，会把上个月甚至更早的口味标签写进本月报告。
  const taste = tasteProfile(list, 3)
  return {
    monthLabel: (m + 1) + ' 月',
    year: y,
    count: list.length,
    ratedCount: list.filter(function (r) { return !!r.rating }).length,
    goodCount: list.filter(function (r) { return r.rating === 'good' }).length,
    days: Object.keys(daySet).length,
    topDish: topDish,
    topCat: topCat,
    loved: taste.loved,
    hated: taste.hated
  }
}

module.exports = {
  startOfWeek: startOfWeek,
  streak: streak,
  monthlyReport: monthlyReport,
  weeklyCalendar: weeklyCalendar,
  summary: summary,
  tasteProfile: tasteProfile,
  tasteProfileDetailed: tasteProfileDetailed
}
