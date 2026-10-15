/**
 * 菜品库读取层
 * 数据源为本地 JSON，首次调用后缓存在内存，避免重复解析。
 * 后续若迁移到云开发数据库，只需替换 load() 内部实现。
 */

let cache = null
let idMap = null

const storage = require('./storage.js')
const recipes = require('../data/recipes.js')

const CATEGORIES = ['中餐', '面食', '小吃', '快餐', '西餐', '日韩', '汤品', '饮品', '轻食']

// 受控标签词表，忌口过滤完全依赖它，新增标签必须登记在这里
const TAGS = ['辣', '不辣', '荤', '素', '主食', '汤水', '小食', '饮品', '低卡', '重口', '下饭', '快手']

function load() {
  if (!cache) {
    cache = require('../data/dishes')
  }
  return cache
}

/**
 * 内置 + 用户自定义菜品，参与随机与查找。
 * 自定义菜品由 storage 管理，数量少，每次合并开销可忽略。
 */
function loadAll() {
  const list = load().slice()
  const custom = storage.getCustom()
  for (let i = 0; i < custom.length; i++) {
    list.push(custom[i])
  }
  return list.map(withRecipe)
}

/**
 * 给菜品挂上做菜教程 recipe（{ ingredients, steps }）。
 * 自定义菜品自带 ingredients/steps，直接使用；内置菜品从 recipes 表按 id 查。
 */
function withRecipe(dish) {
  if (!dish) return dish
  if (Array.isArray(dish.ingredients) && dish.ingredients.length &&
      Array.isArray(dish.steps) && dish.steps.length) {
    dish.recipe = { ingredients: dish.ingredients, steps: dish.steps }
    return dish
  }
  const r = recipes[dish.id]
  if (r && Array.isArray(r.ingredients) && Array.isArray(r.steps)) {
    dish.recipe = r
  }
  return dish
}

function buildIdMap() {
  if (!idMap) {
    idMap = {}
    loadAll().forEach(function (d) {
      idMap[d.id] = d
    })
  }
  return idMap
}

function getById(id) {
  return buildIdMap()[id] || null
}

function getByIds(ids) {
  const map = buildIdMap()
  return (ids || []).map(function (id) {
    return map[id]
  }).filter(Boolean)
}

function categories() {
  return CATEGORIES.slice()
}

/**
 * 详情页用：把 dish 的原始数据派生出一份「详情卡」所需的字段。
 * 尽量复用 dish / recipe 已有的字段，不引入新数据源。
 *   - ingredients：优先用 recipe.ingredients，否则给一段通用占位
 *   - pairings：按分类给 2-3 个常见搭配
 *   - bestSlots：按 tags 与分类给合适的时段（早/午/下午茶/晚/夜）
 *   - kcal：按 tags 给一个粗略量级（低/中/高）
 *   - flavor：一句话口味关键词
 */
function getDetail(id) {
  const d = getById(id)
  if (!d) return null
  const tags = Array.isArray(d.tags) ? d.tags : []
  const cat = d.category || '其他'

  const ingredients = (d.recipe && Array.isArray(d.recipe.ingredients) && d.recipe.ingredients.length)
    ? d.recipe.ingredients.slice(0, 8)
    : (['主料（按菜谱）', '配料（按菜谱）', '调味（按菜谱）'])

  let kcal = '中'
  if (tags.indexOf('轻食') > -1 || tags.indexOf('低卡') > -1) kcal = '低'
  else if (tags.indexOf('重口') > -1 || cat === '西餐' || cat === '日韩') kcal = '高'

  const bestSlots = (function () {
    const s = new Set()
    if (cat === '饮品' || cat === '轻食') { s.add('tea'); s.add('lunch') }
    if (cat === '汤品') { s.add('breakfast'); s.add('lunch'); s.add('dinner') }
    if (tags.indexOf('快手') > -1 || cat === '小吃' || cat === '快餐') { s.add('breakfast'); s.add('midnight') }
    if (tags.indexOf('重口') > -1 || tags.indexOf('下饭') > -1) s.add('dinner')
    if (cat === '中餐' && tags.indexOf('不辣') > -1) { s.add('lunch'); s.add('dinner') }
    if (s.size === 0) { s.add('lunch'); s.add('dinner') }
    return Array.from(s)
  })()

  const pairingMap = {
    '中餐': ['米饭', '一碗清汤', '凉拌黄瓜'],
    '面食': ['卤蛋', '一份小菜', '豆浆'],
    '小吃': ['酸梅汤', '一份主食', '烤串'],
    '快餐': ['可乐', '沙拉', '水果杯'],
    '西餐': ['红酒', '蒜香面包', '凯撒沙拉'],
    '日韩': ['味噌汤', '茶碗蒸', '泡菜'],
    '汤品': ['米饭', '一份青菜', '小咸菜'],
    '饮品': ['甜点', '一份轻食', '水果'],
    '轻食': ['果蔬汁', '坚果', '酸奶']
  }
  const pairings = pairingMap[cat] || ['米饭', '一份青菜', '一杯饮品']

  const flavorMap = {
    '辣': '麻辣鲜香',
    '不辣': '温和家常',
    '素': '清爽素净',
    '荤': '扎实下饭',
    '主食': '扛饿担当',
    '汤水': '温润暖胃',
    '小食': '一口解馋',
    '饮品': '手边常备',
    '低卡': '轻盈无负担',
    '重口': '浓郁够味',
    '下饭': '米饭杀手',
    '快手': '五分钟上桌'
  }
  let flavor = ''
  for (let i = 0; i < tags.length; i++) {
    if (flavorMap[tags[i]]) {
      flavor = flavor ? flavor + ' · ' + flavorMap[tags[i]] : flavorMap[tags[i]]
      if (flavor.length > 14) break
    }
  }
  if (!flavor) flavor = '家常风味'

  return {
    id: d.id,
    name: d.name,
    category: cat,
    tags: tags,
    price: d.price || 0,
    desc: d.desc || '',
    reason: d.reason || '',
    ingredients: ingredients,
    pairings: pairings,
    bestSlots: bestSlots,
    kcal: kcal,
    flavor: flavor
  }
}

module.exports = {
  load: load,
  loadAll: loadAll,
  getById: getById,
  getByIds: getByIds,
  categories: categories,
  getDetail: getDetail,
  CATEGORIES: CATEGORIES,
  TAGS: TAGS
}
