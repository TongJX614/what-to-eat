/**
 * 成就 / 勋章系统
 *
 * 设计原则：
 * - 数据全部从 storage 已有的字段算出来（history / fav / black / streak），
 *   不引入新数据源，避免破坏现有逻辑。
 * - 每条成就 = 一个 check(history, ctx) → boolean 的纯函数，
 *   加新成就在 ACHIEVEMENTS 数组里追加一项即可。
 *
 * 每条成就形态：
 *   { id, icon, title, desc, check(history, ctx) }
 *
 * 关于 icon：值是「图标名」，与 id 一致，对应
 *   assets/achv/<icon>.png（未解锁，暖灰）与 <icon>-on.png（已解锁，深暖橙）。
 *   图标由 tools/gen_icons.py 的 achv 组统一矢量绘制，禁止再用 emoji
 *   （emoji 在不同平台字形差异大、自带 3D 质感，与全站线性图标语言冲突）。
 */

const stats = require('./stats.js')

// 判断历史记录里是否存在某个小时区间内的决定（跨零点拆成两段）
function hasHourIn(history, from, to) {
  return (history || []).some(function (r) {
    const t = r.decidedAt || r.ts
    if (!t) return false
    const h = new Date(t).getHours()
    return from <= to ? (h >= from && h < to) : (h >= from || h < to)
  })
}

function countRating(history, rating) {
  return (history || []).filter(function (r) { return r.rating === rating }).length
}

function categoryCount(history) {
  const set = new Set()
  ;(history || []).forEach(function (r) { if (r.category) set.add(r.category) })
  return set.size
}

const ACHIEVEMENTS = [
  /* ---------- 起步 ---------- */
  {
    id: 'first_bite',
    icon: 'first_bite',
    title: '第一口',
    desc: '完成第一次「就吃这个」决定',
    check: function (h) { return (h || []).length >= 1 }
  },
  {
    id: 'visits_10',
    icon: 'visits_10',
    title: '十拿九稳',
    desc: '累计做 10 次决定',
    check: function (h) { return (h || []).length >= 10 }
  },
  {
    id: 'visits_30',
    icon: 'visits_30',
    title: '三十而立',
    desc: '累计做 30 次决定',
    check: function (h) { return (h || []).length >= 30 }
  },
  {
    id: 'visits_50',
    icon: 'visits_50',
    title: '五十知味',
    desc: '累计做 50 次决定',
    check: function (h) { return (h || []).length >= 50 }
  },
  {
    id: 'visits_100',
    icon: 'visits_100',
    title: '百吃不厌',
    desc: '累计做 100 次决定',
    check: function (h) { return (h || []).length >= 100 }
  },

  /* ---------- 连续打卡 ---------- */
  {
    id: 'streak_3',
    icon: 'streak_3',
    title: '三日不绝',
    desc: '连续 3 天做决定',
    check: function (h, ctx) { return (ctx && ctx.streak || 0) >= 3 }
  },
  {
    id: 'streak_7',
    icon: 'streak_7',
    title: '一周不止',
    desc: '连续 7 天做决定',
    check: function (h, ctx) { return (ctx && ctx.streak || 0) >= 7 }
  },
  {
    id: 'streak_14',
    icon: 'streak_14',
    title: '半月不辍',
    desc: '连续 14 天做决定',
    check: function (h, ctx) { return (ctx && ctx.streak || 0) >= 14 }
  },
  {
    id: 'streak_30',
    icon: 'streak_30',
    title: '满月常客',
    desc: '连续 30 天做决定',
    check: function (h, ctx) { return (ctx && ctx.streak || 0) >= 30 }
  },
  {
    id: 'streak_60',
    icon: 'streak_60',
    title: '双月常驻',
    desc: '连续 60 天做决定',
    check: function (h, ctx) { return (ctx && ctx.streak || 0) >= 60 }
  },

  /* ---------- 分类探索 ---------- */
  {
    id: 'explorer_3',
    icon: 'explorer_3',
    title: '小试牛刀',
    desc: '尝过 3 个不同分类的菜',
    check: function (h) { return categoryCount(h) >= 3 }
  },
  {
    id: 'explorer_5',
    icon: 'explorer_5',
    title: '走南闯北',
    desc: '尝过 5 个不同分类的菜',
    check: function (h) { return categoryCount(h) >= 5 }
  },
  {
    id: 'explorer_8',
    icon: 'explorer_8',
    title: '吃遍八方',
    desc: '尝过 8 个不同分类的菜',
    check: function (h) { return categoryCount(h) >= 8 }
  },
  {
    id: 'explorer_all',
    icon: 'explorer_all',
    title: '全类通吃',
    desc: '尝遍全部 9 个分类',
    check: function (h) { return categoryCount(h) >= 9 }
  },

  /* ---------- 收藏 ---------- */
  {
    id: 'fav_first',
    icon: 'fav_first',
    title: '心头好',
    desc: '收藏第 1 道菜',
    check: function (h, ctx) { return (ctx && ctx.favCount || 0) >= 1 }
  },
  {
    id: 'fav_5',
    icon: 'fav_5',
    title: '情有独钟',
    desc: '收藏 5 道菜',
    check: function (h, ctx) { return (ctx && ctx.favCount || 0) >= 5 }
  },
  {
    id: 'fav_10',
    icon: 'fav_10',
    title: '老饕之选',
    desc: '收藏 10 道菜',
    check: function (h, ctx) { return (ctx && ctx.favCount || 0) >= 10 }
  },
  {
    id: 'fav_20',
    icon: 'fav_20',
    title: '藏家',
    desc: '收藏 20 道菜',
    check: function (h, ctx) { return (ctx && ctx.favCount || 0) >= 20 }
  },

  /* ---------- 评价 ---------- */
  {
    id: 'judge',
    icon: 'judge',
    title: '敢说真话',
    desc: '第一次给一道菜「踩雷」',
    check: function (h) { return countRating(h, 'bad') >= 1 }
  },
  {
    id: 'picky_3',
    icon: 'picky_3',
    title: '挑剔的舌头',
    desc: '把 3 道菜判为「踩雷」',
    check: function (h) { return countRating(h, 'bad') >= 3 }
  },
  {
    id: 'diverse_palate',
    icon: 'diverse_palate',
    title: '百味人生',
    desc: '评分里同时出现过「好吃」与「踩雷」',
    check: function (h) {
      return countRating(h, 'good') >= 1 && countRating(h, 'bad') >= 1
    }
  },
  {
    id: 'good_10',
    icon: 'good_10',
    title: '鉴味达人',
    desc: '给 10 道菜打过「好吃」',
    check: function (h) { return countRating(h, 'good') >= 10 }
  },
  {
    id: 'good_25',
    icon: 'good_25',
    title: '好吃到飞起',
    desc: '给 25 道菜打过「好吃」',
    check: function (h) { return countRating(h, 'good') >= 25 }
  },
  {
    id: 'ok_10',
    icon: 'ok_10',
    title: '佛系吃货',
    desc: '给 10 道菜打过「一般」',
    check: function (h) { return countRating(h, 'ok') >= 10 }
  },

  /* ---------- 月度 ---------- */
  {
    id: 'monthly_10',
    icon: 'monthly_10',
    title: '本月大胃',
    desc: '单月累计 10 次决定',
    check: function (h, ctx) { return (ctx && ctx.monthlyCount || 0) >= 10 }
  },
  {
    id: 'monthly_20',
    icon: 'monthly_20',
    title: '月度常客',
    desc: '单月累计 20 次决定',
    check: function (h, ctx) { return (ctx && ctx.monthlyCount || 0) >= 20 }
  },
  {
    id: 'monthly_30',
    icon: 'monthly_30',
    title: '月度王者',
    desc: '单月累计 30 次决定',
    check: function (h, ctx) { return (ctx && ctx.monthlyCount || 0) >= 30 }
  },

  /* ---------- 尝鲜与作息 ---------- */
  {
    id: 'comeback',
    icon: 'comeback',
    title: '真香警告',
    desc: '从黑名单里移出一道菜又吃了一次',
    check: function (h, ctx) { return (ctx && ctx.comebackCount || 0) >= 1 }
  },
  {
    id: 'night_owl',
    icon: 'night_owl',
    title: '深夜食堂',
    desc: '晚上 22 点后还做过决定',
    check: function (h) { return hasHourIn(h, 22, 4) }
  },
  {
    id: 'early_bird',
    icon: 'early_bird',
    title: '早起的鸟儿',
    desc: '清早 5–9 点做过决定',
    check: function (h) { return hasHourIn(h, 5, 9) }
  }
]

/**
 * 计算所有成就的当前状态。
 * @param {Object} input
 *   - history: 历史记录
 *   - now: 当前时间（决定 streak / monthly 时用）
 *   - favCount: 当前收藏数量
 *   - monthlyCount: 当前自然月已决定次数
 *   - comebackCount: 「黑名单移除后再吃」的次数（外部计算后传入）
 * @returns {Array<{id, icon, title, desc, unlocked, unlockedAt}>}
 */
function evaluate(input) {
  const input2 = input || {}
  const history = input2.history || []
  const now = input2.now || new Date()
  const ctx = {
    streak: (typeof input2.streak === 'number') ? input2.streak : stats.streak(history, now),
    favCount: input2.favCount || 0,
    monthlyCount: input2.monthlyCount || 0,
    comebackCount: input2.comebackCount || 0
  }
  return ACHIEVEMENTS.map(function (a) {
    let unlocked = false
    try {
      unlocked = !!a.check(history, ctx)
    } catch (e) {
      unlocked = false
    }
    return {
      id: a.id,
      icon: a.icon,
      title: a.title,
      desc: a.desc,
      unlocked: unlocked
    }
  })
}

/**
 * 一站式：算当前应解锁的成就，并把新增的合并到 storage，返回「这次新解锁的成就」。
 * 用法：每次 history / fav 变化后调用一次。
 */
function reconcile(input) {
  const list = evaluate(input)
  const ids = list.filter(function (a) { return a.unlocked }).map(function (a) { return a.id })
  const storage = require('./storage.js')
  const newly = storage.unlockAchievements(ids)
  const unlockedSet = new Set(storage.getAchievements())
  return {
    list: list.map(function (a) {
      return Object.assign({}, a, { unlocked: unlockedSet.has(a.id) })
    }),
    newly: newly
  }
}

module.exports = {
  ACHIEVEMENTS: ACHIEVEMENTS,
  evaluate: evaluate,
  reconcile: reconcile
}