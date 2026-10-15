/**
 * 本地存储层
 * 所有数据存在 storage，核心功能无需登录。
 */

const K_HISTORY = 'lunch_history'
const K_FAV = 'lunch_fav'
const K_BLACK = 'lunch_black'
const K_PREFS = 'lunch_prefs'
const K_LAST = 'lunch_last'
const K_THEME = 'lunch_theme'
const K_GUIDED = 'lunch_guided'
const K_ACHIEVEMENTS = 'lunch_achievements' // 已解锁成就 id 数组
const K_POI_VISITED = 'lunch_poi_visited'   // 已去过的餐厅 id（mock 体系下用 title 作主键）
const K_POI_FAV = 'lunch_poi_fav'           // 收藏的餐厅 id

const MAX_HISTORY = 100

const DEFAULT_PREFS = {
  noSpicy: false,      // 不吃辣
  vegetarian: false,   // 素食
  noCilantro: false,   // 不吃香菜
  noGarlic: false,     // 不吃蒜
  noScallion: false,   // 不吃葱
  budget: 0,           // 人均预算上限，0 表示不限
  excludeCount: 10,    // 避免近期重复条数
  categories: [],      // 参与随机的分类，空数组表示全部
  mealSlot: 'auto',    // 时段：auto=按当前时间；breakfast/lunch/tea/dinner/midnight=手动指定
  // 场景（2026-09-06 新增）：只做软权重，绝不硬过滤，避免候选池被抽空
  mealMode: 'any',     // 怎么做着吃：any=都行 / home=自己做 / out=出去吃
  party: 'any',        // 几个人吃：any=都行 / solo=一人食 / multi=几个人
  taste: 'any',        // 冷热：any=都行 / hot=想吃点热乎的 / cool=想吃点清爽的
  hurry: false,        // 赶时间：true 时偏向出餐快的品类
  shake: true,         // 摇一摇随机
  sound: true          // 决定时播放轻音效（资源缺失则自动静默）
}

function read(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    if (v === '' || v === null || v === undefined) return fallback
    return v
  } catch (e) {
    console.warn('[lunch] 读取 storage 失败：', key, e)
    return fallback
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (e) {
    console.warn('[lunch] 写入 storage 失败：', key, e)
  }
}

/* ---------- 历史记录 ---------- */

function getHistory() {
  const list = read(K_HISTORY, [])
  return Array.isArray(list) ? list : []
}

function addHistory(record) {
  const list = getHistory()
  list.unshift(record)
  write(K_HISTORY, list.slice(0, MAX_HISTORY))
  return list
}

function clearHistory() {
  write(K_HISTORY, [])
}

// 标记最近一条记录为「已决定」，用于历史页展示
function markDecided(id) {
  const list = getHistory()
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i].decidedAt = Date.now()
      break
    }
  }
  write(K_HISTORY, list)
}

function removeHistory(id) {
  write(K_HISTORY, getHistory().filter(function (item) {
    return item.id !== id
  }))
}

/**
 * 打卡评分（好吃/一般/踩雷）：按 id upsert 一条历史记录并写入 rating。
 * - 记录已存在 → 只更新 rating（并补全缺失的 tags/name/category）
 * - 记录不存在（用户还没「就吃这个」就先打卡）→ 新建一条
 * @param {string} id
 * @param {string} rating  'good' | 'ok' | 'bad'（非法值视为清空评分）
 * @param {Object} [meta]  { name, category, source, tags } 用于补全记录
 * @returns {Array} 最新历史列表
 */
function rateDish(id, rating, meta) {
  const list = getHistory()
  const valid = { good: 1, ok: 1, bad: 1 }
  const r = valid[rating] ? rating : ''
  let rec = null
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) { rec = list[i]; break }
  }
  if (rec) {
    rec.rating = r
    if (meta && meta.tags && (!rec.tags || !rec.tags.length)) rec.tags = meta.tags
    if (meta && meta.name && !rec.name) rec.name = meta.name
    if (meta && meta.category && !rec.category) rec.category = meta.category
    if (meta && meta.source && !rec.source) rec.source = meta.source
  } else {
    rec = {
      id: id,
      name: (meta && meta.name) || '',
      category: (meta && meta.category) || '其他',
      source: (meta && meta.source) || 'builtin',
      tags: (meta && meta.tags) || [],
      ts: Date.now(),
      rating: r
    }
    list.unshift(rec)
  }
  write(K_HISTORY, list.slice(0, MAX_HISTORY))
  return list
}

/* ---------- 收藏 ---------- */

function getFav() {
  const list = read(K_FAV, [])
  return Array.isArray(list) ? list : []
}

function isFav(id) {
  return getFav().indexOf(id) > -1
}

/**
 * 收藏/黑名单互斥：用户反馈的正确语义
 *   不在 fav 也不在 black → 标记为「中性」（什么都不标记）
 *   在 fav → 标记收藏，点同一边则取消
 *   在 black → 标记黑名单，点同一边则取消
 *   点另一边则切换（自动清除另一边的标记）
 */
function toggleFav(id) {
  const favList = getFav()
  const blackList = getBlack()
  const favIdx = favList.indexOf(id)
  if (favIdx > -1) {
    // 已在 fav → 取消收藏
    favList.splice(favIdx, 1)
    write(K_FAV, favList)
    return false
  } else {
    // 不在 fav → 加入收藏，同时移出黑名单（互斥）
    favList.unshift(id)
    write(K_FAV, favList)
    const blackIdx = blackList.indexOf(id)
    if (blackIdx > -1) {
      blackList.splice(blackIdx, 1)
      write(K_BLACK, blackList)
    }
    return true
  }
}

/* ---------- 黑名单 ---------- */

function getBlack() {
  const list = read(K_BLACK, [])
  return Array.isArray(list) ? list : []
}

function isBlack(id) {
  return getBlack().indexOf(id) > -1
}

function toggleBlack(id) {
  const favList = getFav()
  const blackList = getBlack()
  const blackIdx = blackList.indexOf(id)
  if (blackIdx > -1) {
    // 已在 black → 移出黑名单
    blackList.splice(blackIdx, 1)
    write(K_BLACK, blackList)
    return false
  } else {
    // 不在 black → 加入黑名单，同时移出收藏（互斥）
    blackList.unshift(id)
    write(K_BLACK, blackList)
    const favIdx = favList.indexOf(id)
    if (favIdx > -1) {
      favList.splice(favIdx, 1)
      write(K_FAV, favList)
    }
    return true
  }
}

function removeBlack(id) {
  write(K_BLACK, getBlack().filter(function (item) {
    return item !== id
  }))
}

/* ---------- 自定义菜品（用户手动添加，参与随机） ---------- */

const K_CUSTOM = 'lunch_custom'

function getCustom() {
  const list = read(K_CUSTOM, [])
  return Array.isArray(list) ? list : []
}

function addCustom(dish) {
  const list = getCustom()
  const item = Object.assign({
    id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    source: 'custom'
  }, dish)
  list.unshift(item)
  write(K_CUSTOM, list)
  return item
}

function removeCustom(id) {
  write(K_CUSTOM, getCustom().filter(function (d) {
    return d.id !== id
  }))
}

/* ---------- 偏好设置 ---------- */

function getPrefs() {
  const saved = read(K_PREFS, null)
  const prefs = Object.assign({}, DEFAULT_PREFS, saved || {})
  prefs.categories = Array.isArray(prefs.categories) ? prefs.categories : []
  prefs.budget = Number(prefs.budget) || 0
  prefs.excludeCount = Number(prefs.excludeCount) || DEFAULT_PREFS.excludeCount
  return prefs
}

function savePrefs(prefs) {
  write(K_PREFS, Object.assign({}, getPrefs(), prefs || {}))
}

function resetPrefs() {
  write(K_PREFS, Object.assign({}, DEFAULT_PREFS, { categories: [] }))
  return getPrefs()
}

/* ---------- 最近一次随机结果 ---------- */

function getLast() {
  return read(K_LAST, null)
}

function setLast(dish) {
    write(K_LAST, {
        id: dish.id,
        name: dish.name,
        category: dish.category,
        source: dish.source || 'builtin',
        ts: Date.now(),
        decidedAt: dish.decidedAt || Date.now()
    })
}

/* ---------- 主题（只保留暖食，清爽/夜宵已于 2026-09-05 移除） ---------- */

function getTheme() {
  return 'warm'
}

// 主题选择已下线，保留函数签名避免调用方报错，实际不存储
function setTheme() {}

/* ---------- 首次引导标记 ---------- */

function getGuided() {
  return read(K_GUIDED, false) === true
}

function setGuided(v) {
  write(K_GUIDED, !!v)
}

/* ---------- 清空所有本地数据 ---------- */
function clearAll() {
  clearHistory()
  write(K_FAV, [])
  write(K_BLACK, [])
  write(K_LAST, null)
}

/* ---------- 成就 ---------- */

function getAchievements() {
  const list = read(K_ACHIEVEMENTS, [])
  return Array.isArray(list) ? list : []
}

function setAchievements(ids) {
  write(K_ACHIEVEMENTS, Array.isArray(ids) ? ids : [])
}

// 把刚解锁的成就合并进已解锁列表，返回「新增的成就 id」
function unlockAchievements(newIds) {
  if (!newIds || !newIds.length) return []
  const cur = getAchievements()
  const set = new Set(cur)
  const added = []
  for (let i = 0; i < newIds.length; i++) {
    if (!set.has(newIds[i])) {
      set.add(newIds[i])
      added.push(newIds[i])
    }
  }
  write(K_ACHIEVEMENTS, Array.from(set))
  return added
}

/* ---------- 附近餐厅：已去过 / 收藏 ----------
   mock 数据 id 是动态生成的，用 title 作主键更稳定；真数据切到 tencent 时也兼容 id 字段。 */

function getPoiVisited() {
  const list = read(K_POI_VISITED, [])
  return Array.isArray(list) ? list : []
}

function togglePoiVisited(key) {
  const list = getPoiVisited()
  const idx = list.indexOf(key)
  if (idx > -1) {
    list.splice(idx, 1)
    write(K_POI_VISITED, list)
    return false
  }
  list.unshift(key)
  write(K_POI_VISITED, list)
  return true
}

function isPoiVisited(key) {
  return getPoiVisited().indexOf(key) > -1
}

function getPoiFav() {
  const list = read(K_POI_FAV, [])
  return Array.isArray(list) ? list : []
}

function togglePoiFav(key) {
  const list = getPoiFav()
  const idx = list.indexOf(key)
  if (idx > -1) {
    list.splice(idx, 1)
    write(K_POI_FAV, list)
    return false
  }
  list.unshift(key)
  write(K_POI_FAV, list)
  return true
}

function isPoiFav(key) {
  return getPoiFav().indexOf(key) > -1
}

module.exports = {
  MAX_HISTORY: MAX_HISTORY,
  DEFAULT_PREFS: DEFAULT_PREFS,
  getHistory: getHistory,
  addHistory: addHistory,
  clearHistory: clearHistory,
  markDecided: markDecided,
  removeHistory: removeHistory,
  rateDish: rateDish,
  getFav: getFav,
  isFav: isFav,
  toggleFav: toggleFav,
  getBlack: getBlack,
  isBlack: isBlack,
  toggleBlack: toggleBlack,
  removeBlack: removeBlack,
  getCustom: getCustom,
  addCustom: addCustom,
  removeCustom: removeCustom,
  getPrefs: getPrefs,
  savePrefs: savePrefs,
  resetPrefs: resetPrefs,
  getLast: getLast,
  setLast: setLast,
  getTheme: getTheme,
  setTheme: setTheme,
  getGuided: getGuided,
  setGuided: setGuided,
  getAchievements: getAchievements,
  setAchievements: setAchievements,
  unlockAchievements: unlockAchievements,
  getPoiVisited: getPoiVisited,
  togglePoiVisited: togglePoiVisited,
  isPoiVisited: isPoiVisited,
  getPoiFav: getPoiFav,
  togglePoiFav: togglePoiFav,
  isPoiFav: isPoiFav,
  clearAll: clearAll
}
