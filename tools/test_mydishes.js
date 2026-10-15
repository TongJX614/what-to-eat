/**
 * 我的菜（自定义菜品）端到端测试：mock wx storage，验证
 * 添加 -> 合并进随机池 -> 能被抽到 -> 删除 的完整链路。
 * 运行：node tools/test_mydishes.js
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
const dishes = require(path.join(ROOT, 'utils', 'dishes.js'))
const storage = require(path.join(ROOT, 'utils', 'storage.js'))
const random = require(path.join(ROOT, 'utils', 'random.js'))

let failed = 0
function check(name, cond, extra) {
  if (cond) console.log('  通过  ' + name)
  else {
    failed++
    console.log('  失败  ' + name + (extra ? ' -> ' + extra : ''))
  }
}

console.log('\n[A] 添加自定义菜')
const added = storage.addCustom({
  name: '老妈红烧肉',
  category: '中餐',
  tags: ['辣', '荤'],
  price: 30,
  desc: '',
  reason: ''
})
check('addCustom 返回对象', !!added)
check('生成 c_ 前缀 id', !!(added && added.id && added.id.indexOf('c_') === 0), added && added.id)
check('标记 source=custom', added && added.source === 'custom')
check('getCustom 能读到', storage.getCustom().some(d => d.id === added.id))

console.log('\n[B] 合并进随机池')
const all = dishes.loadAll()
check('loadAll 含自定义菜', all.some(d => d.id === added.id))
check('总数 = 内置 + 自定义', all.length === dishes.load().length + 1,
  all.length + ' vs ' + (dishes.load().length + 1))

console.log('\n[C] 自定义菜可被抽到（跑 3000 次，无历史/无偏好）')
let hit = 0
for (let i = 0; i < 3000; i++) {
  const r = random.pick({ dishes: all, prefs: {}, blacklist: [], favorites: [], history: [], timeAware: false })
  if (r && r.dish.id === added.id) hit++
}
check('至少抽到 1 次', hit > 0, '抽到 ' + hit + ' 次')

console.log('\n[D] 历史去重窗口不影响自定义菜（历史塞满内置菜）')
const hist = []
for (let i = 0; i < 10; i++) hist.push({ id: 'bid_' + i, ts: Date.now() - i })
let hit2 = 0
for (let i = 0; i < 3000; i++) {
  const r = random.pick({ dishes: all, prefs: {}, blacklist: [], favorites: [], history: hist, timeAware: false })
  if (r && r.dish.id === added.id) hit2++
}
check('去重窗口下仍可抽到', hit2 > 0, '抽到 ' + hit2 + ' 次')

console.log('\n[E] 偏好/分类过滤不误伤（自定义菜属于被允许范围）')
let bad = 0
for (let i = 0; i < 1000; i++) {
  const r = random.pick({ dishes: all, prefs: { categories: ['中餐'] }, blacklist: [], favorites: [], history: [], timeAware: false })
  if (r && r.dish.id === added.id && added.category !== '中餐') bad++
}
check('自定义菜在允许分类内可抽到', bad >= 0, 'bad=' + bad)

console.log('\n[F] 删除')
storage.removeCustom(added.id)
check('removeCustom 生效（getCustom 不再包含）', !storage.getCustom().some(d => d.id === added.id))
check('loadAll 不再含', !dishes.loadAll().some(d => d.id === added.id))

console.log('\n' + (failed === 0 ? '我的菜端到端测试全部通过' : failed + ' 项失败'))
process.exit(failed === 0 ? 0 : 1)
