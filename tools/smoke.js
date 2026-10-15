/**
 * 随机算法冒烟测试（Node 环境，mock 掉 wx storage）
 * 运行：node tools/smoke.js
 */
const path = require('path')

const store = {}
global.wx = {
  getStorageSync(k) {
    return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : ''
  },
  setStorageSync(k, v) {
    store[k] = v
  }
}

const ROOT = path.join(__dirname, '..', 'miniprogram')
const dishes = require(path.join(ROOT, 'data', 'dishes.js'))
const random = require(path.join(ROOT, 'utils', 'random.js'))
const storage = require(path.join(ROOT, 'utils', 'storage.js'))

let failed = 0
function check(name, cond, extra) {
  if (cond) {
    console.log('  通过  ' + name)
  } else {
    failed++
    console.log('  失败  ' + name + (extra ? ' -> ' + extra : ''))
  }
}

console.log('\n[1] 基础抽取')
const first = random.pick({ dishes })
check('返回非空结果', !!first && !!first.dish)
check('无降级提示', first && first.relaxed === '', first && first.relaxed)
console.log('  抽到：' + first.dish.name + ' / ' + first.dish.category)

console.log('\n[2] 避免近期重复（默认 10 条）')
const recent = []
for (let i = 0; i < 10; i++) {
  recent.push({ id: dishes[i].id, name: dishes[i].name, ts: Date.now() - i })
}
let hit = 0
for (let i = 0; i < 300; i++) {
  const r = random.pick({ dishes, history: recent })
  if (recent.some((h) => h.id === r.dish.id)) hit++
}
check('300 次抽取均未落在最近 10 条内', hit === 0, '命中 ' + hit + ' 次')

console.log('\n[3] 忌口过滤')
let bad = 0
for (let i = 0; i < 200; i++) {
  const r = random.pick({ dishes, prefs: { noSpicy: true } })
  if (r.dish.tags.indexOf('辣') > -1) bad++
}
check('不吃辣：无含辣菜品', bad === 0, bad + ' 道含辣')

bad = 0
for (let i = 0; i < 200; i++) {
  const r = random.pick({ dishes, prefs: { vegetarian: true } })
  if (r.dish.tags.indexOf('荤') > -1) bad++
}
check('素食：无含荤菜品', bad === 0, bad + ' 道含荤')

bad = 0
for (let i = 0; i < 200; i++) {
  const r = random.pick({ dishes, prefs: { budget: 20 } })
  if (r.dish.price > 20) bad++
}
check('预算 20：无超价菜品', bad === 0, bad + ' 道超价')

bad = 0
for (let i = 0; i < 200; i++) {
  const r = random.pick({ dishes, prefs: { categories: ['面食', '汤品'] } })
  if (['面食', '汤品'].indexOf(r.dish.category) === -1) bad++
}
check('限定分类：只出面食与汤品', bad === 0, bad + ' 道越界')

console.log('\n[4] 黑名单')
const blackIds = dishes.slice(0, 30).map((d) => d.id)
bad = 0
for (let i = 0; i < 200; i++) {
  const r = random.pick({ dishes, blacklist: blackIds })
  if (blackIds.indexOf(r.dish.id) > -1) bad++
}
check('黑名单 30 道：均未被抽到', bad === 0, bad + ' 次命中')

console.log('\n[5] 极端设置的降级')
const allIn = {
  dishes: dishes,
  prefs: { noSpicy: true, vegetarian: true, budget: 5, categories: [] },
  blacklist: dishes.map((d) => d.id),
  history: dishes.slice(0, 50).map((d) => ({ id: d.id }))
}
const degraded = random.pick(allIn)
check('全部条件互斥时仍返回结果', !!degraded && !!degraded.dish)
check('给出了降级说明', !!(degraded && degraded.relaxed))
console.log('  降级说明：' + (degraded && degraded.relaxed))

console.log('\n[6] 收藏加权')
const favIds = [dishes[0].id, dishes[1].id]
let favHit = 0
const runs = 4000
for (let i = 0; i < runs; i++) {
  const r = random.pick({ dishes, favorites: favIds })
  if (favIds.indexOf(r.dish.id) > -1) favHit++
}
const rate = favHit / runs
const expected = (1.5 * 2) / (1.5 * 2 + (dishes.length - 2))
console.log('  收藏命中率 ' + (rate * 100).toFixed(2) + '%，理论值 ' + (expected * 100).toFixed(2) + '%')
check('收藏权重生效且未失控', rate > expected * 0.6 && rate < expected * 1.6)

console.log('\n[7] 存储层')
storage.addHistory({ id: 'cn_001', name: '宫保鸡丁', category: '中餐', source: 'builtin', ts: Date.now() })
check('历史写入成功', storage.getHistory().length === 1)
storage.markDecided('cn_001')
check('标记已决定', storage.getHistory()[0].decidedAt > 0)
check('收藏切换', storage.toggleFav('cn_001') === true && storage.isFav('cn_001'))
check('收藏取消', storage.toggleFav('cn_001') === false && !storage.isFav('cn_001'))
check('黑名单切换', storage.toggleBlack('cn_002') === true && storage.isBlack('cn_002'))
// 互斥：点收藏 → 自动移出黑名单
storage.toggleBlack('cn_003')
check('点黑名单前：cn_003 在黑名单', storage.isBlack('cn_003'))
storage.toggleFav('cn_003')
check('点收藏后：cn_003 在收藏', storage.isFav('cn_003'))
check('点收藏后：cn_003 移出黑名单（互斥）', !storage.isBlack('cn_003'))
// 互斥：点黑名单 → 自动移出收藏
storage.toggleFav('cn_004')
storage.toggleBlack('cn_004')
check('点黑名单后：cn_004 在黑名单', storage.isBlack('cn_004'))
check('点黑名单后：cn_004 移出收藏（互斥）', !storage.isFav('cn_004'))
// 点同一边取消
storage.toggleFav('cn_005')
check('加入收藏 cn_005', storage.isFav('cn_005'))
storage.toggleFav('cn_005')
check('再点收藏：cn_005 取消', !storage.isFav('cn_005'))
storage.toggleBlack('cn_006')
storage.toggleBlack('cn_006')
check('再点黑名单：cn_006 取消', !storage.isBlack('cn_006'))
storage.savePrefs({ noSpicy: true, budget: 30 })
const p = storage.getPrefs()
check('偏好持久化', p.noSpicy === true && p.budget === 30 && p.excludeCount === 10)
storage.clearHistory()
check('清空历史', storage.getHistory().length === 0)
for (let i = 0; i < 150; i++) {
  storage.addHistory({ id: 'x_' + i, name: 'x', ts: Date.now() })
}
check('历史上限为 ' + storage.MAX_HISTORY, storage.getHistory().length === storage.MAX_HISTORY)

console.log('\n[8] 数据完整性')
check('菜品数量不少于 200', dishes.length >= 200, dishes.length + ' 道')
const cats = {}
dishes.forEach((d) => {
  cats[d.category] = (cats[d.category] || 0) + 1
})
check('分类覆盖 9 类', Object.keys(cats).length === 9, JSON.stringify(cats))
check('字段完整', dishes.every((d) => d.id && d.name && d.category && d.tags.length && d.price > 0 && d.desc && d.reason))
console.log('  分类分布：' + JSON.stringify(cats))

console.log('\n========================================')
console.log(failed === 0 ? '全部测试通过' : failed + ' 项测试失败')
console.log('========================================\n')
process.exit(failed === 0 ? 0 : 1)
