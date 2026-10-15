const dishesUtil = require('../../utils/dishes.js')
const randomUtil = require('../../utils/random.js')
const storage = require('../../utils/storage.js')
const timeUtil = require('../../utils/time.js')
const feedback = require('../../utils/feedback.js')
const greetingUtil = require('../../utils/greeting.js')
const statsUtil = require('../../utils/stats.js')
const achievements = require('../../utils/achievements.js')

const SHAKE_THRESHOLD = 1.6
const SHAKE_COOLDOWN = 1200

// 漂浮小球配置（与 index.wxss 中的 .hero-wrap / .hero-btn / .float-planet 尺寸严格对应）
// ⚠️ 改 HERO 时必须同步改 index.wxss 的 .hero-wrap / .hero-ring 尺寸，否则小球轨道会错位
const FLOAT_CFG = {
  HERO: 580,      // 舞台边长 rpx（与 .hero-wrap 一致）
  BIG_R: 140,     // 大球半径 rpx
  BALL_R: 48,     // 小球半径 rpx（直径 96rpx）
  MARGIN: 8,      // 安全间隙 rpx
  COUNT: 7        // 小球数量
}

function mealHint(slot) {
  return ({
    breakfast: '早起吃顿热乎的',
    lunch: '该吃午饭啦',
    tea: '下午茶时间到',
    dinner: '晚饭想好没',
    midnight: '夜宵走起'
  })[slot] || '点我开始'
}

Page({
  data: {
    last: null,
    lastTime: '',
    prefs: {},
    prefOn: false,
    totalCount: 0,
    availableCount: 0,
    rolling: false,
    rollName: '',
    rollCategory: '',
    rollTip: '正在挑选中…',
    theme: 'warm',
    guide: false,
    planets: [],
    heroHint: '点我开始',
    heroTitle: '',  // 运行时由 greetingUtil.pick() 填充
    planetHover: '',
    cats: [],
    catSel: [],
    catAll: true,
    streak: 0,
    monthly: {},
    reportOpen: false,
    achievements: [],
    achievementUnlocked: 0,
    achievementTotal: 0,
    showAchieveModal: false,
    newlyUnlocked: []
  },

  onLoad() {
    this.refresh()
    // 首次进入随机一条
    this.setData({ heroTitle: greetingUtil.pick(new Date()) })
  },

  onShow() {
    const bar = this.getTabBar()
    if (bar) {
      bar.setData({ visible: true })
      bar.settle(0)
    }
    // 从结果页返回时，如果残留了挑选遮罩状态，这里兜底清掉
    if (this.data.rolling) {
      if (this._rollTimer) {
        clearTimeout(this._rollTimer)
        this._rollTimer = null
      }
      this.setData({ rolling: false })
      this.setTabBarVisible(true)
    }
    this.refresh()
    this.setData({ theme: storage.getTheme() })
    this.buildPlanets()
    // 每次进入首页重抽一条随时间问候语（让用户每次开屏都能看到不同）
    this.setData({ heroTitle: greetingUtil.pick(new Date()) })
    this.setData({ heroHint: mealHint(randomUtil.timeSlot(new Date())) })
    if (this.data.prefs.shake) {
      this.startShake()
    } else {
      this.stopShake()
    }
    // 首次进入展示轻引导（含「添加到我的小程序」提示），关闭后不再弹
    if (!storage.getGuided()) {
      // 引导是全屏遮罩，同样收起底部导航（否则浮动 tabBar 会露在遮罩上方）
      this.setTabBarVisible(false)
      this.setData({ guide: true })
    }
  },

  onHide() {
    this.stopShake()
    this.stopFloat()
  },

  onUnload() {
    this.stopShake()
    this.stopFloat()
  },

  refresh() {
    const prefs = storage.getPrefs()
    const last = storage.getLast()
    const all = dishesUtil.loadAll()
    const cats = dishesUtil.categories()
    const selCats = prefs.categories || []
    const catAll = selCats.length === 0
    const avail = randomUtil.countAvailable({
      dishes: all,
      prefs: prefs,
      blacklist: storage.getBlack()
    })
    const now = new Date()
    const history = storage.getHistory()
    this.setData({
      prefs: prefs,
      last: last,
      lastTime: last ? timeUtil.relative(last.ts) : '',
      totalCount: all.length,
      cats: cats.map(function (name) {
        return { name: name, on: selCats.indexOf(name) > -1 }
      }),
      catSel: selCats,
      catAll: catAll,
      availableCount: avail,
      prefOn: prefs.noSpicy || prefs.vegetarian || prefs.budget > 0 ||
        prefs.noCilantro || prefs.noGarlic || prefs.noScallion ||
        (prefs.categories.length > 0 && prefs.categories.length < all.length) ||
        (prefs.mealSlot && prefs.mealSlot !== 'auto') ||
        prefs.excludeCount !== storage.DEFAULT_PREFS.excludeCount ||
        !prefs.shake,
      // 首页连续打卡与月度报告：从 history 算出来驱动卡片
      streak: statsUtil.streak(history, now),
      monthly: statsUtil.monthlyReport(history, now)
    })

    // 成就：根据历史 / 收藏 / 黑名单实时计算，写入 storage（去重），首屏展示
    const monthlyCount = statsUtil.monthlyReport(history, now).count || 0
    const favCount = storage.getFav().length
    // 「黑名单移除后又吃」的次数：把历史里 rating 的 id 与历史里 id 比对不是重点，
    // 这里用「当前黑名单为空」+「历史里有最近条目」做弱判定；首屏粗不触发。
    const achRes = achievements.reconcile({
      history: history,
      now: now,
      favCount: favCount,
      monthlyCount: monthlyCount,
      comebackCount: 0
    })
    const unlocked = achRes.list.filter(function (a) { return a.unlocked }).length
    this.setData({
      achievements: achRes.list,
      achievementUnlocked: unlocked,
      achievementTotal: achRes.list.length
    })
    // 新解锁的：弹一个轻量提示（用半屏 toast，避免打断流程）
    if (achRes.newly && achRes.newly.length) {
      this.setData({ newlyUnlocked: achRes.newly })
    }
  },

  /* ---------- 首页菜系快捷筛选 ---------- */
  onCat(e) {
    const name = e.currentTarget.dataset.name
    const cats = this.data.cats.map(function (c) { return c.name })
    let sel = this.data.catSel.slice()
    if (name === '__ALL__') {
      sel = []
    } else {
      const idx = sel.indexOf(name)
      if (idx > -1) sel.splice(idx, 1)
      else sel.push(name)
      // 全选等价于「不限制」，存空数组
      if (sel.length >= cats.length) sel = []
    }
    // 同步写入偏好（与偏好弹层内的「参与随机的分类」共用同一份数据）
    storage.savePrefs(Object.assign({}, storage.getPrefs(), { categories: sel }))
    this.setData({ catSel: sel })
    this.refresh()
    // 让漂浮小球也换成对应菜系，但不打断物理（仅在非挑选态重排）
    if (!this.data.rolling) this.buildPlanets()
  },

  goRandom() {
    if (this.data.rolling) return
    this.startRoll()
  },

  startRoll() {
    const all = dishesUtil.loadAll()
    const prefs = this.data.prefs
    const res = randomUtil.pick({
      dishes: all,
      prefs: prefs,
      blacklist: storage.getBlack(),
      favorites: storage.getFav(),
      history: storage.getHistory()
    })

    if (!res || !res.dish) {
      wx.showToast({ title: '没有可选菜品，检查偏好设置', icon: 'none' })
      return
    }

    this.setData({
      rolling: true,
      rollTip: '正在挑选中…',
      rollName: '今天吃什么',
      rollCategory: ''
    })
    this.setTabBarVisible(false)

    const finalDish = res.dish
    const relaxedParam = res.relaxed ? '&relaxed=' + encodeURIComponent(res.relaxed) : ''
    const pool = all.filter(d => d.id !== finalDish.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 18)
    pool.push(finalDish)

    // 各阶段切换间隔：慢起 → 加速 → 减速 → 定格
    // msFor 按"下一帧序号"取间隔，最后兜底 280ms，保证每一帧都会被调度
    const stages = [
      { until: 4, ms: 90 },
      { until: 12, ms: 50 },
      { until: 17, ms: 110 }
    ]
    const msFor = (i) => {
      for (const s of stages) {
        if (i <= s.until) return s.ms
      }
      return 280
    }

    let idx = 0
    this._rollTimer = null

    const show = () => {
      const d = pool[idx]
      this.setData({
        rollName: d.name,
        rollCategory: d.category
      })
      idx++
      if (idx >= pool.length) {
        this._rollTimer = null
        this.setData({ rollTip: '就它了！' })
        feedback.onRollSettle()
        // 直接跳转结果页，让新页面盖住首页，避免「先关遮罩回首页再跳结果」的空窗
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/result/result?id=' + finalDish.id + '&from=roll' + relaxedParam,
            fail: () => {
              this.setData({ rolling: false })
              this.setTabBarVisible(true)
            }
          })
        }, 220)
        return
      }
      this._rollTimer = setTimeout(show, msFor(idx))
    }

    show()
  },

  stopRoll() {
    if (this._rollTimer) {
      clearTimeout(this._rollTimer)
      this._rollTimer = null
    }
    if (this.data.rolling) {
      this.setData({ rolling: false })
      this.setTabBarVisible(true)
    }
  },

  /* 挑选遮罩弹出时把底部导航收起来，避免半透明遮罩下还透出一条 */
  setTabBarVisible(visible) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ visible: visible })
    }
  },

  noop() {},

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goMyDishes() {
    wx.switchTab({ url: '/pages/mydishes/mydishes' })
  },

  /* ---------- 漂浮小球：自由游动 + 碰撞弹开 ---------- */

  buildPlanets() {
    if (this.data.rolling) return
    const all = dishesUtil.loadAll()
    const black = new Set(storage.getBlack())
    const recent = new Set(storage.getHistory().slice(0, 12).map(function (h) {
      return h.id
    }))
    let pool = all.filter(function (d) {
      return !black.has(d.id) && !recent.has(d.id) && randomUtil.matchPrefs(d, this.data.prefs)
    }, this)
    if (pool.length < FLOAT_CFG.COUNT) {
      pool = all.filter(function (d) {
        return !black.has(d.id) && randomUtil.matchPrefs(d, this.data.prefs)
      }, this)
    }
    if (pool.length < FLOAT_CFG.COUNT) pool = all.slice()
    const shuffled = pool.slice().sort(function () {
      return Math.random() - 0.5
    })
    const { HERO, BIG_R, BALL_R, COUNT } = FLOAT_CFG
    const center = HERO / 2
    const planets = shuffled.slice(0, COUNT).map(function (d) {
      // 每颗球一个独立的基础速度（0.3~0.5 随机），运动更自然
      const spd = 0.30 + Math.random() * 0.20
      return { id: d.id, name: d.name, r: BALL_R, x: center, y: center, vx: 0, vy: 0, spd: spd }
    })
    this._scatterPlanets(planets, center, BIG_R, BALL_R, FLOAT_CFG.MARGIN)
    this.setData({ planets: planets })
    this.startFloat()
  },

  _scatterPlanets(planets, center, bigR, ballR, margin) {
    const { HERO } = FLOAT_CFG
    const safeR = bigR + ballR + margin
    const maxR = center - ballR - margin
    const homeR = (safeR + maxR) / 2
    const minGap = ballR * 2 + margin + 8

    for (let i = 0; i < planets.length; i++) {
      const baseAngle = (i / planets.length) * Math.PI * 2 + Math.random() * 0.4
      let placed = false
      let attempts = 0
      while (!placed && attempts < 60) {
        attempts++
        const angle = baseAngle + (Math.random() - 0.5) * 0.7
        const radius = homeR + (Math.random() - 0.5) * (maxR - safeR) * 0.85
        let x = center + Math.cos(angle) * radius
        let y = center + Math.sin(angle) * radius
        x = Math.max(ballR + margin, Math.min(HERO - ballR - margin, x))
        y = Math.max(ballR + margin, Math.min(HERO - ballR - margin, y))

        let ok = true
        for (let j = 0; j < i; j++) {
          const dx = x - planets[j].x
          const dy = y - planets[j].y
          if (Math.sqrt(dx * dx + dy * dy) < minGap) {
            ok = false
            break
          }
        }
        if (ok) {
          planets[i].x = x
          planets[i].y = y
          placed = true
        }
      }
      // 兜底：均匀角度 + 环绕半径
      if (!placed) {
        const angle = baseAngle
        const radius = homeR
        planets[i].x = center + Math.cos(angle) * radius
        planets[i].y = center + Math.sin(angle) * radius
      }
    }
    // 给一个慢速切向初速度，开始自由游动
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i]
      const dx = p.x - center
      const dy = p.y - center
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const tangentX = -dy / dist
      const tangentY = dx / dist
      const speed = p.spd
      p.vx = tangentX * speed
      p.vy = tangentY * speed
    }
  },

  startFloat() {
    this.stopFloat()
    this._floatRunning = true
    const self = this
    const raf = (typeof requestAnimationFrame !== 'undefined')
      ? requestAnimationFrame
      : function (cb) { return setTimeout(cb, 16) }
    const step = function () {
      if (!self._floatRunning) return
      self.tickPlanets()
      self._floatRAF = raf(step)
    }
    this._floatRAF = raf(step)
  },

  stopFloat() {
    this._floatRunning = false
    if (this._floatRAF) {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._floatRAF)
      else clearTimeout(this._floatRAF)
      this._floatRAF = null
    }
  },

  tickPlanets() {
    const planets = this.data.planets
    if (!planets || planets.length === 0) return

    const { HERO, BIG_R, MARGIN } = FLOAT_CFG
    const center = HERO / 2
    const homeK = 0.0016        // 环绕引力强度（温和）

    const next = planets.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        r: p.r,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        spd: p.spd
      }
    })

    for (let i = 0; i < next.length; i++) {
      const p = next[i]
      const dx = p.x - center
      const dy = p.y - center
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const safeR = BIG_R + p.r + MARGIN
      const maxR = center - p.r - MARGIN
      const homeR = (safeR + maxR) / 2

      // 环绕引力：轻柔把小球维持在理想轨道半径附近，避免乱撞墙
      const radial = (dist - homeR) * homeK
      p.vx -= (dx / dist) * radial
      p.vy -= (dy / dist) * radial

      // 缓慢随机扰动，制造无规律的游动感
      if (Math.random() < 0.03) {
        p.vx += (Math.random() - 0.5) * 0.045
        p.vy += (Math.random() - 0.5) * 0.045
      }

      p.x += p.vx
      p.y += p.vy

      // 容器边缘弹性碰撞
      if (p.x < p.r + MARGIN) {
        p.x = p.r + MARGIN
        p.vx = Math.abs(p.vx) * 0.8 + 0.03
      }
      if (p.x > HERO - p.r - MARGIN) {
        p.x = HERO - p.r - MARGIN
        p.vx = -Math.abs(p.vx) * 0.8 - 0.03
      }
      if (p.y < p.r + MARGIN) {
        p.y = p.r + MARGIN
        p.vy = Math.abs(p.vy) * 0.8 + 0.03
      }
      if (p.y > HERO - p.r - MARGIN) {
        p.y = HERO - p.r - MARGIN
        p.vy = -Math.abs(p.vy) * 0.8 - 0.03
      }
    }

    // 与大球碰撞：碰到「帮我选」就弹开
    for (let i = 0; i < next.length; i++) {
      const p = next[i]
      const dx = p.x - center
      const dy = p.y - center
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const minDist = BIG_R + p.r + MARGIN
      if (dist < minDist) {
        const nx = dx / dist
        const ny = dy / dist
        p.x = center + nx * minDist
        p.y = center + ny * minDist
        const vdotn = p.vx * nx + p.vy * ny
        p.vx -= 2 * vdotn * nx
        p.vy -= 2 * vdotn * ny
        // 额外外向推力，防粘
        p.vx += nx * 0.14
        p.vy += ny * 0.14
      }
    }

    // 小球之间互斥
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const a = next[i]
        const b = next[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const minDist = a.r + b.r + MARGIN
        if (dist < minDist) {
          const nx = dx / dist
          const ny = dy / dist
          const overlap = minDist - dist
          a.x -= nx * overlap * 0.5
          a.y -= ny * overlap * 0.5
          b.x += nx * overlap * 0.5
          b.y += ny * overlap * 0.5
          const vrelDot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
          a.vx -= vrelDot * nx * 0.8
          a.vy -= vrelDot * ny * 0.8
          b.vx += vrelDot * nx * 0.8
          b.vy += vrelDot * ny * 0.8
        }
      }
    }

    // 维持各自基础速度：碰撞/扰动只改方向，速度大小回归各自基准，运动始终顺滑且快慢不一
    for (let i = 0; i < next.length; i++) {
      const p = next[i]
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 0.0001
      const target = p.spd || 0.40
      p.vx = (p.vx / sp) * target
      p.vy = (p.vy / sp) * target
    }

    this.setData({ planets: next })
  },

  goOrbit(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/result/result?id=' + id })
  },

  onPlanetTouch(e) {
    this.setData({ planetHover: e.currentTarget.dataset.id })
  },

  onPlanetTouchEnd() {
    this.setData({ planetHover: '' })
  },

  goNearby() {
    wx.switchTab({ url: '/pages/nearby/nearby' })
  },

  // 关闭首次引导，并标记已引导
  closeGuide() {
    storage.setGuided(true)
    this.setData({ guide: false })
    this.setTabBarVisible(true)
  },

  openPref() {
    // 打开偏好时隐藏底部导航栏（避免半屏弹层与导航栏重叠显得突兀）
    this.setTabBarVisible(false)
    const sheet = this.selectComponent('#prefsheet')
    if (sheet) sheet.open(this.data.prefs)
  },

  onPrefClose() {
    // 关闭偏好时恢复导航栏显示
    this.setTabBarVisible(true)
  },

  onPrefChange(e) {
    storage.savePrefs(e.detail)
    this.refresh()
    // 偏好弹层内切换摇一摇需即时生效，不等下次 onShow
    if (this.data.prefs.shake) {
      this.startShake()
    } else {
      this.stopShake()
    }
  },

  onPrefReset() {
    storage.resetPrefs()
    this.refresh()
    wx.showToast({ title: '已恢复默认', icon: 'none' })
  },

  /* ---------- 摇一摇 ---------- */

  startShake() {
    if (this._shaking) return
    this._shaking = true
    this._lastAcc = null
    this._lastShakeAt = 0

    this._accHandler = (res) => {
      const now = Date.now()
      if (!this._lastAcc) {
        this._lastAcc = res
        return
      }
      const dx = res.x - this._lastAcc.x
      const dy = res.y - this._lastAcc.y
      const dz = res.z - this._lastAcc.z
      this._lastAcc = res
      const delta = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (delta > SHAKE_THRESHOLD && now - this._lastShakeAt > SHAKE_COOLDOWN) {
        this._lastShakeAt = now
        wx.vibrateShort({ type: 'light', fail() {} })
        this.stopShake()
        this.goRandom()
      }
    }

    wx.startAccelerometer({ interval: 'game', fail() {} })
    wx.onAccelerometerChange(this._accHandler)
  },

  stopShake() {
    if (!this._shaking) return
    this._shaking = false
    this._lastAcc = null
    if (this._accHandler) {
      wx.offAccelerometerChange(this._accHandler)
    }
    wx.stopAccelerometer({ fail() {} })
    this._accHandler = null
  },

  /* ---------- 连续打卡与月度报告（纯 WXML 预览，无需 canvas / 下载） ---------- */

  showMonthly() {
    const m = this.data.monthly || {}
    if (!m.count) {
      wx.showToast({ title: '这个月还没有记录', icon: 'none' })
      return
    }
    // 遮罩期间收起底部导航栏：浮动 tabBar 的选中块会压在遮罩之上（z-index 盖不住），
    // 且导航仍可点击——用户能带着「报告还开着」的状态切走页面。沿用成就浮层同一套做法。
    this.setTabBarVisible(false)
    this.setData({ reportOpen: true })
  },

  closeMonthly() {
    this.setData({ reportOpen: false })
    this.setTabBarVisible(true)
  },

  /* ---------- 成就：打开/关闭浮层 ---------- */
  openAchieve() {
    this.setData({ showAchieveModal: true })
    // 弹窗期间隐藏底部自定义 tabBar，避免导航栏露在遮罩下方
    this.setTabBarVisible(false)
  },
  closeAchieve() {
    this.setData({ showAchieveModal: false })
    // 恢复底部自定义 tabBar
    this.setTabBarVisible(true)
  },
  dismissNewUnlock() {
    this.setData({ newlyUnlocked: [] })
  },

  /* ---------- 菜单浏览入口 ---------- */
  goMenu() {
    wx.navigateTo({ url: '/pages/menu/menu' })
  }
})
