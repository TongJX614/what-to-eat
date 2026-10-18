// 自定义 tabBar 组件逻辑自测（00Kubi 风格版）：用 Node 模拟小程序环境
// 运行：node tools/test_tabbar.js
'use strict'

const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.join(__dirname, '../miniprogram/custom-tab-bar/index.js'), 'utf8')

let registered = null
global.Component = function (def) { registered = def }
eval(src)

let currentRoute = '/pages/index/index'
global.getCurrentPages = function () {
  return [{ route: currentRoute.replace(/^\//, '') }]
}

// 定时器 mock：收集回调与 id，可手动 flush / clear
let timerSeq = 0
const timers = new Map()
global.setTimeout = function (fn, ms) {
  const id = ++timerSeq
  timers.set(id, fn)
  return id
}
global.clearTimeout = function (id) {
  timers.delete(id)
}
function flushTimers() {
  const fns = Array.from(timers.values())
  timers.clear()
  fns.forEach(fn => fn())
}

const switchCalls = []
global.wx = {
  switchTab: function (o) { switchCalls.push(o.url); currentRoute = o.url },
  nextTick: function (fn) { fn() }
}

function makeInstance(route) {
  currentRoute = route
  const inst = {}
  Object.assign(inst, registered.methods)
  inst.data = JSON.parse(JSON.stringify(registered.data))
  inst.setData = function (obj) { Object.assign(this.data, obj) }
  registered.lifetimes.created.call(inst)
  registered.lifetimes.attached.call(inst)
  return inst
}

function tap(inst, index) {
  inst.onSwitch({ currentTarget: { dataset: { index } } })
}

let passed = 0, failed = 0
function assert(name, cond) {
  if (cond) { passed++; console.log('  PASS ' + name) }
  else { failed++; console.log('  FAIL ' + name) }
}

console.log('== tabBar 自测（Uiverse 00Kubi 风格版）==')

// 1) 三个 tab 页面 created 首帧都正确
const home = makeInstance('/pages/index/index')
const dishes = makeInstance('/pages/mydishes/mydishes')
const nearby = makeInstance('/pages/nearby/nearby')
assert('首页实例 active=0', home.data.active === 0)
assert('我的菜实例 active=1', dishes.data.active === 1)
assert('附近餐厅实例 active=2', nearby.data.active === 2)

// 2) onSwitch 立即切页（不再等动画，不闪不卡）
switchCalls.length = 0; timers.clear()
tap(home, 2)
assert('点击后立即 switchTab（页面不冻结）', switchCalls.length === 1 && switchCalls[0] === '/pages/nearby/nearby')
assert('点击后无残留定时器', timers.size === 0)

// 3) 点当前 tab 不响应
switchCalls.length = 0; timers.clear()
const d2 = makeInstance('/pages/mydishes/mydishes')
tap(d2, 1)
assert('点当前 tab 不响应', switchCalls.length === 0)

// 4) attached 给目标 tab 触发 _playReplay 一次（replay=ownIndex，flush 后变 -1）
const a1 = makeInstance('/pages/mydishes/mydishes')
assert('attached 触发 _playReplay 设 replay=1', a1.data.replay === 1)
flushTimers()
assert('REPLAY_MS 后 replay 复位 -1', a1.data.replay === -1)

// 5) settle 不重播（导航栏不动）
const n2 = makeInstance('/pages/nearby/nearby')
flushTimers()
n2.data.replay = -1
n2.settle(2)
assert('settle(正确位置) 不改 active', n2.data.active === 2)
assert('settle 不触发 replay', n2.data.replay === -1)

// 6) 错误缓存兜底：settle(ownIndex) 纠正 active，且不触发 replay
const bugCase = makeInstance('/pages/mydishes/mydishes')
flushTimers()
bugCase._ownIndex = 0 // 模拟错误缓存
bugCase.data.active = 0
bugCase.data.replay = -1
bugCase.settle(1)
assert('错误缓存 _ownIndex=0 时 settle(1) 仍纠正到 1', bugCase.data.active === 1)
assert('纠正后不触发 replay（导航栏不动）', bugCase.data.replay === -1)

// 7) 连点：每次点击立即 switchTab，最终路由=最后点击的目标（微信原生行为）
switchCalls.length = 0
const h2 = makeInstance('/pages/index/index')
tap(h2, 1); tap(h2, 2); tap(h2, 1)
assert('快速连点每次都立即 switchTab（响应即时）', switchCalls.length === 3)
assert('最终路由 = 最后点击的 tab', currentRoute === '/pages/mydishes/mydishes')

// 8) 子页返回：onShow 调 settle 不触发 replay
const m3 = makeInstance('/pages/mydishes/mydishes')
flushTimers()
m3.data.replay = -1
m3.settle(1)
assert('子页返回 settle 不触发 replay', m3.data.replay === -1)
assert('子页返回 active 不变', m3.data.active === 1)

// 9) 源码无残留旧逻辑
assert('无 DRAG_MS 残留', src.indexOf('DRAG_MS') === -1)
assert('无 noTrans 数据残留', src.indexOf('noTrans') === -1)
assert('无 glider 残留', src.indexOf('glider') === -1)
assert('无 _switchTimer 残留', src.indexOf('_switchTimer') === -1)
assert('无 tabstate 残留', src.indexOf('tabstate') === -1)

// 10) wxss 关键样式
const wxss = fs.readFileSync(path.join(__dirname, '../miniprogram/custom-tab-bar/index.wxss'), 'utf8')
assert('wxss 选中态用主题橙渐变', wxss.indexOf('linear-gradient') > -1 && wxss.indexOf('--c-primary') > -1)
assert('wxss 底座是毛玻璃', wxss.indexOf('backdrop-filter') > -1)
assert('wxss 有 select 缩放动画', wxss.indexOf('@keyframes tabSelect') > -1)
assert('wxss 有粒子动画（伪元素）', wxss.indexOf('::before') > -1 && wxss.indexOf('::after') > -1)
assert('wxss 用主题色粒子', wxss.indexOf('--c-primary') > -1)
assert('wxss 无 glider 残留', wxss.indexOf('glider') === -1)

// 11) wxml 无 glider
const wxml = fs.readFileSync(path.join(__dirname, '../miniprogram/custom-tab-bar/index.wxml'), 'utf8')
assert('wxml 无 glider', wxml.indexOf('glider') === -1)
assert('wxml 用 radio class', wxml.indexOf('class="radio') > -1)
assert('wxml 有 is-replay 条件', wxml.indexOf('is-replay') > -1)

// 12) history 改用 like-unlike 图标
const histWxml = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/history/history.wxml'), 'utf8')
assert('history.wxml 用 PNG 赞图标', histWxml.indexOf('/assets/history/like.png') > -1)
assert('history.wxml 用 PNG 踩图标', histWxml.indexOf('/assets/history/unlike.png') > -1)
assert('history.wxml 无"藏"字按钮', histWxml.indexOf('>藏<') === -1)
assert('history.wxml 无"黑"字按钮', histWxml.indexOf('>黑<') === -1)

console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败')
process.exit(failed ? 1 : 0)