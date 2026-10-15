/**
 * 随机选菜算法
 *
 * 三级降级策略，保证任何极端设置下都能出结果，绝不返回空：
 *   1. 黑名单 + 忌口 + 避免近期重复
 *   2. 放弃去重窗口
 *   3. 放弃忌口条件
 *   4. 放弃黑名单
 *
 * 去重池是全局的：内置菜品随机与拍照选菜共用同一份历史记录。
 */

const DEFAULT_EXCLUDE = 10

// 收藏的菜品权重更高，让它更容易被抽到，但不会压倒其他选项
const FAV_WEIGHT = 1.5
const NORMAL_WEIGHT = 1

/**
 * 时段分类权重：让随机更「应景」。
 * 不命中的分类权重为 1（即不受影响），命中的按倍数提升。
 */
const TIME_WEIGHTS = {
  breakfast: { '饮品': 1.6, '轻食': 1.5, '面食': 1.3, '汤品': 1.2 },
  lunch:     { '快餐': 1.6, '面食': 1.5, '小吃': 1.3, '中餐': 1.2 },
  tea:       { '饮品': 1.7, '小吃': 1.4, '轻食': 1.4 },
  dinner:    { '中餐': 1.5, '西餐': 1.4, '日韩': 1.4, '汤品': 1.3, '面食': 1.2 },
  midnight:  { '小吃': 1.7, '面食': 1.5, '快餐': 1.4 }
}

/**
 * 场景权重：回答「这顿怎么吃」而不是只回答「吃什么」。
 * 数据里没有「家常/外食」这类硬字段，所以全部走软权重——
 * 宁可推得偏一点，也绝不把候选池抽空（硬过滤很容易出现 0 结果）。
 */
const SCENE_WEIGHTS = {
  // 自己做 vs 出去吃：中餐/汤品/面食/轻食偏下厨，快餐/小吃/日韩/西餐偏下馆子
  mode: {
    home: { cat: { '中餐': 1.5, '汤品': 1.5, '面食': 1.2, '轻食': 1.2 }, tag: { '下饭': 1.2, '重口': 1.2 } },
    out:  { cat: { '快餐': 1.6, '小吃': 1.5, '日韩': 1.4, '西餐': 1.4, '面食': 1.2, '饮品': 1.2 }, tag: {} }
  },
  // 一人食 vs 几个人吃
  party: {
    solo:  { cat: { '快餐': 1.4, '面食': 1.3, '小吃': 1.3, '轻食': 1.3 }, tag: {} },
    multi: { cat: { '中餐': 1.5, '汤品': 1.4, '西餐': 1.3 }, tag: { '下饭': 1.2 } }
  },
  // 想吃点热乎的 vs 想吃点清爽的
  taste: {
    hot:  { cat: { '汤品': 1.8, '中餐': 1.3, '面食': 1.3 }, tag: { '重口': 1.2 } },
    cool: { cat: { '轻食': 1.7, '饮品': 1.6, '日韩': 1.2 }, tag: { '低卡': 1.2 } }
  },
  // 赶时间：快的品类提权，慢炖/正餐降权（0.x 表示压低，不是排除）
  hurry: { cat: { '快餐': 1.8, '面食': 1.4, '小吃': 1.4, '中餐': 0.7, '汤品': 0.6, '西餐': 0.8 }, tag: {} }
}

function applyScene(acc, key, dish) {
  const rule = SCENE_WEIGHTS[key]
  if (!rule) return acc
  const catW = rule.cat && rule.cat[dish.category]
  if (catW) acc *= catW
  const tags = Array.isArray(dish.tags) ? dish.tags : []
  for (let i = 0; i < tags.length; i++) {
    const tw = rule.tag && rule.tag[tags[i]]
    if (tw) { acc *= tw; break }   // 同一规则内只取一次，避免多标签叠乘失控
  }
  return acc
}

/**
 * 场景倍率：把「做饭/外食、几人吃、冷热、赶不赶时间」换算成抽取权重
 * @returns {Number} 1 为中性
 */
function sceneMultiplier(dish, prefs) {
  if (!prefs) return 1
  let m = 1
  if (prefs.mealMode === 'home' || prefs.mealMode === 'out') m = applyScene(m, prefs.mealMode === 'home' ? 'home' : 'out', dish)
  if (prefs.party === 'solo' || prefs.party === 'multi') m = applyScene(m, prefs.party, dish)
  if (prefs.taste === 'hot' || prefs.taste === 'cool') m = applyScene(m, prefs.taste, dish)
  if (prefs.hurry) m = applyScene(m, 'hurry', dish)
  return Math.max(0.35, Math.min(2.2, m))
}

function timeSlot(date) {
  const h = date.getHours()
  if (h >= 5 && h < 10) return 'breakfast'
  if (h >= 10 && h < 14) return 'lunch'
  if (h >= 14 && h < 17) return 'tea'
  if (h >= 17 && h < 21) return 'dinner'
  return 'midnight'
}

// 忌口关键词（按菜名 + 食材文本扫描，避免给菜品逐个打标签）
const FORBID_KEYS = {
  noCilantro: ['香菜', '芫荽'],
  noGarlic: ['蒜', '蒜末', '蒜蓉', '蒜泥'],
  noScallion: ['葱', '葱花', '大葱', '小葱', '葱白', '葱段']
}

function hasAny(text, keys) {
  for (let i = 0; i < keys.length; i++) {
    if (text.indexOf(keys[i]) > -1) return true
  }
  return false
}

/**
 * 解析实际生效的时段：
 * - 显式选了（非 auto）直接用该时段权重
 * - 没选（auto）则按当前时间
 * - 老数据 timeAware=false 表示完全关闭时段加权
 */
function resolveSlot(prefs, now) {
  const s = prefs && prefs.mealSlot
  if (s && s !== 'auto') return s
  if (prefs && prefs.timeAware === false) return null
  return timeSlot(now)
}

function timeWeights(slot) {
  const map = {}
  if (!slot) return map
  const w = TIME_WEIGHTS[slot] || {}
  for (const k in w) map[k] = w[k]
  return map
}

function matchPrefs(dish, prefs) {
  if (!prefs) return true
  if (prefs.noSpicy && dish.tags.indexOf('辣') > -1) return false
  if (prefs.vegetarian && dish.tags.indexOf('荤') > -1) return false
  if (prefs.budget > 0 && dish.price > prefs.budget) return false
  if (prefs.categories && prefs.categories.length &&
      prefs.categories.indexOf(dish.category) === -1) return false
  const text = (dish.name || '') + ' ' + (Array.isArray(dish.ingredients) ? dish.ingredients.join(' ') : '')
  if (prefs.noCilantro && hasAny(text, FORBID_KEYS.noCilantro)) return false
  if (prefs.noGarlic && hasAny(text, FORBID_KEYS.noGarlic)) return false
  if (prefs.noScallion && hasAny(text, FORBID_KEYS.noScallion)) return false
  return true
}

/**
 * 口味画像权重：扫描带评分的历史记录，按 tag / 分类累计「喜欢(+) / 踩雷(-)」亲和度。
 * - 评分 good → +1 / tag，+0.5 / 分类
 * - 评分 bad  → -1 / tag，-0.5 / 分类
 * - 评分 ok   → 不计入（中性）
 * 返回 { tagOrCategory: 累计分 }，供 tasteMultiplier 使用。
 */
function buildTasteWeights(history) {
  const score = {}
  if (!Array.isArray(history)) return score
  for (let i = 0; i < history.length; i++) {
    const h = history[i]
    const r = h.rating
    if (!r || r === 'ok') continue
    const v = r === 'good' ? 1 : -1
    const tags = Array.isArray(h.tags) ? h.tags : []
    for (let t = 0; t < tags.length; t++) {
      const key = tags[t]
      score[key] = (score[key] || 0) + v
    }
    if (h.category) score[h.category] = (score[h.category] || 0) + v * 0.5
  }
  return score
}

/**
 * 把口味亲和度换算成单道菜的抽取倍率（1 为中性，无评分时恒为 1）。
 * 用线性映射 + clamp，保证温和：评分越多越「懂你」，但不会把某道菜锁死。
 */
function tasteMultiplier(dish, score) {
  if (!score || !Object.keys(score).length) return 1
  let s = 0
  const tags = Array.isArray(dish.tags) ? dish.tags : []
  for (let i = 0; i < tags.length; i++) s += (score[tags[i]] || 0)
  if (dish.category) s += (score[dish.category] || 0) * 0.5
  const m = 1 + 0.14 * s
  return Math.max(0.4, Math.min(1.8, m))
}

/**
 * 单道菜的抽取权重：收藏 → 时段 → 口味画像 → 场景，逐层相乘
 * @param {Object} ctx { favSet, timeW, tasteW, prefs }
 */
function dishWeight(d, ctx) {
  let w = ctx.favSet.has(d.id) ? FAV_WEIGHT : NORMAL_WEIGHT
  const tw = ctx.timeW && ctx.timeW[d.category]
  if (tw) w *= tw
  const mw = tasteMultiplier(d, ctx.tasteW)
  if (mw !== 1) w *= mw
  const sw = sceneMultiplier(d, ctx.prefs)
  if (sw !== 1) w *= sw
  return w
}

/**
 * 按权重抽一个，返回索引（pick 与 pickThree 共用，保证权重口径一致）
 * @returns {Number} -1 表示池为空
 */
function pickIndex(pool, ctx) {
  if (!pool.length) return -1
  const weights = pool.map(function (d) {
    return dishWeight(d, ctx)
  })
  const total = weights.reduce(function (a, b) {
    return a + b
  }, 0)
  let r = Math.random() * total
  let idx = 0
  for (; idx < weights.length; idx++) {
    r -= weights[idx]
    if (r <= 0) break
  }
  if (idx >= pool.length) idx = pool.length - 1
  return idx
}

/**
 * 从候选池中按权重随机抽取一个
 * @param {Array} pool
 * @param {Object} ctx { favSet, timeW, tasteW, prefs }
 * @returns {Object}
 */
function weightedPick(pool, ctx) {
  const idx = pickIndex(pool, ctx)
  return idx < 0 ? null : pool[idx]
}

/**
 * 构建候选池（四档降级），pick 与 pickThree 共用，保证约束一致。
 * @returns {{pool: Array, relaxed: string}}
 */
function buildPool(options) {
  const opts = options || {}
  const dishes = opts.dishes || []
  const prefs = opts.prefs || {}
  const blacklist = opts.blacklist || []
  const history = opts.history || []
  const base = opts.pool && opts.pool.length ? opts.pool : dishes

  const blackSet = new Set(blacklist)
  const excludeCount = Number(prefs.excludeCount) || DEFAULT_EXCLUDE
  const recentIds = new Set(history.slice(0, excludeCount).map(function (h) {
    return h.id
  }))

  let pool = null
  let relaxed = ''

  // 1. 全条件
  pool = base.filter(function (d) {
    return !blackSet.has(d.id) && !recentIds.has(d.id) && matchPrefs(d, prefs)
  })

  // 2. 放弃去重窗口
  if (!pool.length) {
    pool = base.filter(function (d) {
      return !blackSet.has(d.id) && matchPrefs(d, prefs)
    })
    if (pool.length) relaxed = '近期菜品都抽过了，本次已忽略去重限制'
  }

  // 3. 放弃忌口条件
  if (!pool.length) {
    pool = base.filter(function (d) {
      return !blackSet.has(d.id)
    })
    if (pool.length) relaxed = '按当前忌口没有可选项，本次已放宽忌口条件'
  }

  // 4. 放弃黑名单
  if (!pool.length) {
    pool = base.slice()
    if (pool.length) relaxed = '黑名单剔得太多了，本次已忽略黑名单'
  }

  return { pool: pool || [], relaxed: relaxed }
}

/**
 * 随机选一道菜
 * @param {Object} options
 * @param {Array}  options.dishes     菜品全量数据
 * @param {Object} options.prefs      偏好设置
 * @param {Array}  options.blacklist  黑名单 id 列表
 * @param {Array}  options.favorites  收藏 id 列表
 * @param {Array}  options.history    历史记录（含内置与拍照来源）
 * @param {Array}  [options.pool]     限定候选池（例如只在收藏里抽）
 * @returns {Object|null} { dish, relaxed, poolSize }
 */
function pick(options) {
  const opts = options || {}
  const dishes = opts.dishes || []
  if (!dishes.length) return null

  const prefs = opts.prefs || {}
  const favorites = opts.favorites || []
  const history = opts.history || []
  const now = opts.now ? new Date(opts.now) : new Date()
  const slot = resolveSlot(prefs, now)
  const timeW = timeWeights(slot)
  // 口味画像：据历史评分构建 tag/分类亲和度，让抽取越来越贴用户
  const tasteW = buildTasteWeights(history)

  const res = buildPool({
    dishes: dishes,
    prefs: prefs,
    blacklist: opts.blacklist,
    history: history,
    pool: opts.pool
  })
  const pool = res.pool
  if (!pool.length) return null

  return {
    dish: weightedPick(pool, {
      favSet: new Set(favorites),
      timeW: timeW,
      tasteW: tasteW,
      prefs: prefs
    }),
    relaxed: res.relaxed,
    poolSize: pool.length
  }
}

/**
 * 一次挑 N 道（默认 3）不同的候选，仍按权重抽取（无放回）。
 * 用于「三选一」模式：先给多个候选，由用户挑一个，把否定循环变成选择。
 * @param {Object} options 同 pick
 * @param {Number} [options.count=3]
 * @returns {{dishes: Array, relaxed: string, poolSize: Number}}
 */
function pickThree(options) {
  const opts = options || {}
  const dishes = opts.dishes || []
  const count = (Number(opts.count) || 3)
  if (!dishes.length) return { dishes: [], relaxed: '' }

  const prefs = opts.prefs || {}
  const favorites = opts.favorites || []
  const history = opts.history || []
  const now = opts.now ? new Date(opts.now) : new Date()
  const slot = resolveSlot(prefs, now)
  const timeW = timeWeights(slot)
  const tasteW = buildTasteWeights(history)

  const res = buildPool({
    dishes: dishes,
    prefs: prefs,
    blacklist: opts.blacklist,
    history: history,
    pool: opts.pool
  })
  let pool = res.pool.slice()
  const ctx = {
    favSet: new Set(favorites),
    timeW: timeW,
    tasteW: tasteW,
    prefs: prefs
  }
  const chosen = []

  while (chosen.length < count && pool.length) {
    const idx = pickIndex(pool, ctx)
    if (idx < 0) break
    chosen.push(pool[idx])
    pool.splice(idx, 1)
  }

  return { dishes: chosen, relaxed: res.relaxed, poolSize: res.pool.length }
}

/**
 * 统计当前设置下有多少道菜可以被抽到，用于首页提示
 */
function countAvailable(options) {
  const opts = options || {}
  const dishes = opts.dishes || []
  const prefs = opts.prefs || {}
  const blackSet = new Set(opts.blacklist || [])
  return dishes.filter(function (d) {
    return !blackSet.has(d.id) && matchPrefs(d, prefs)
  }).length
}

/**
 * 单道菜的「合你口味」匹配度（0~100），用于三选一卡片展示。
 * 结合时段应景度、口味画像、忌口命中三项，给一个直观百分比。
 */
function scoreDish(dish, options) {
  const opts = options || {}
  const prefs = opts.prefs || {}
  const history = opts.history || []
  const now = opts.now ? new Date(opts.now) : new Date()
  const slot = resolveSlot(prefs, now)
  const timeW = timeWeights(slot)
  const tasteW = buildTasteWeights(history)

  let score = 58
  const tw = timeW[dish.category]
  if (tw) score += (tw - 1) * 26
  const m = tasteMultiplier(dish, tasteW)
  score += (m - 1) * 50
  if (matchPrefs(dish, prefs)) score += 8
  if (prefs.categories && prefs.categories.length &&
      prefs.categories.indexOf(dish.category) > -1) score += 4
  score = Math.max(6, Math.min(99, Math.round(score)))
  return score
}

module.exports = {
  pick: pick,
  pickThree: pickThree,
  scoreDish: scoreDish,
  matchPrefs: matchPrefs,
  countAvailable: countAvailable,
  timeSlot: timeSlot,
  timeWeights: timeWeights,
  resolveSlot: resolveSlot,
  buildTasteWeights: buildTasteWeights,
  tasteMultiplier: tasteMultiplier,
  sceneMultiplier: sceneMultiplier,
  DEFAULT_EXCLUDE: DEFAULT_EXCLUDE
}
