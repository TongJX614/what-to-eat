const dishesUtil = require('../../utils/dishes.js')
const randomUtil = require('../../utils/random.js')
const storage = require('../../utils/storage.js')
const poster = require('../../utils/poster.js')
const copyUtil = require('../../utils/copy.js')
const feedback = require('../../utils/feedback.js')
const statsUtil = require('../../utils/stats.js')

/**
 * 相对时间标签。中文短标签，eyebrow 用。
 *   < 1 分钟 → 刚刚
 *   < 1 小时 → N 分钟前
 *   < 1 天   → N 小时前
 *   其它     → N 天前
 */
function relTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前'
  return Math.floor(diff / 86400000) + ' 天前'
}

/* 分类 → emoji（扑克牌栈各卡视觉用，保持暖色调和的餐饮语义） */
const CATEGORY_EMOJI = {
  '中餐': '🥢', '西餐': '🍝', '日韩': '🍣', '轻食': '🥗',
  '面食': '🍜', '快餐': '🍔', '小吃': '🍡', '饮品': '🥤', '汤品': '🍲'
}

/* 扑克牌栈：把第 i 张相对当前前牌 cur 的「环上偏移」算出来（-1 左 / 0 前 / 1 右，其余绕回） */
function stackOffset(i, cur, n) {
  let off = i - cur
  if (off > 1) off -= n
  if (off < -1) off += n
  return off
}

/* 单调递增样式序号（关键防卡死机制）。
   拖动跟手是 WXS 直改 DOM，数据层 cardStyles 并未变过；若之后某次 setData
   推出的样式串与数据层现值「完全相同」（比如换一批后重建的三条样式串和上一摞
   一模一样），小程序的 diff 会认为没变而跳过下发——视图层 DOM 就永远停在
   WXS 拖走时的 transform 上（卡片卡死、菜名与卡片内容对不上，都是这个坑）。
   每条样式串尾部追加一个无害且永不重复的 CSS 自定义属性 --gs:N，
   保证任何一次 setData 的样式都与上一版不同，必定下发重绘。 */
let __gs = 0
function gsToken() {
  return '--gs:' + (++__gs) + ';'
}

/* 单卡内联 transform：前牌居中，邻牌左右探出并轻微倾斜露边。
   性能：用 2D rotate 而非 rotateY 3D 变换——3D 会强制开启 3D 渲染上下文，
   在部分 Android WebView 上叠加圆角裁剪会非常卡；2D 位移+缩放+微倾视觉几乎一致 */
function cardStyle(off, instant) {
  const dur = instant ? '0s' : '0.32s'
  const t = 'transform ' + dur + ' cubic-bezier(.22,.61,.36,1), opacity ' + dur + ' ease'
  if (off === 0) return 'transform: translateX(0) scale(1) rotate(0deg); opacity:1; z-index:3; transition:' + t + '; ' + gsToken()
  if (off === -1) return 'transform: translateX(-42%) scale(0.9) rotate(3deg); opacity:0.55; z-index:2; transition:' + t + '; ' + gsToken()
  return 'transform: translateX(42%) scale(0.9) rotate(-3deg); opacity:0.55; z-index:2; transition:' + t + '; ' + gsToken()
}

/* 一次性算出整摞卡的 inline style 数组；instantIdx 那张用 0s 过渡（飞牌后瞬间归位，避免横穿屏幕） */
function buildStyles(cur, n, instantIdx) {
  const arr = []
  for (let i = 0; i < n; i++) arr.push(cardStyle(stackOffset(i, cur, n), instantIdx === i))
  return arr
}

Page({
  data: {
    dish: null,
    fav: false,
    black: false,
    anim: '',
    theme: 'warm',
    // 自定义导航：状态栏高度（px），wxml 里给顶栏让位用
    statusBarHeight: 44,
    // 底部 CTA「就吃这个」的"高亮回弹"开关：第一次 onLoad 默认 true 触发入场动画；
    // 每次翻菜 (rollAgain) 后短暂 reset + 再 set 回 true 重启动画。
    ctaReplay: true,
    // 打卡：当前这道已评的分（'' | good | ok | bad）+ 评分弹层开关
    myRating: '',
    rateOpen: false,
    // 扑克牌卡片栈：候选列表 + 当前前牌索引 + 每卡内联 transform + 是否多卡 + 飞牌锁（传 WXS 守卫用）
    candidates: [],
    cur: 0,
    cardStyles: ['', '', ''],
    multi: false,
    flung: false,
    stackH: 640
  },

  _replayTimer: null,
  _replayCta() {
    // 50ms 内 reset → set，强制 CSS animation 重启动画（0.5s 期间）
    this.setData({ ctaReplay: false })
    if (this._replayTimer) clearTimeout(this._replayTimer)
    this._replayTimer = setTimeout(() => {
      this.setData({ ctaReplay: true })
    }, 50)
  },

  onLoad(options) {
    // 自定义导航：读取状态栏高度，避免顶栏顶到系统状态栏里
    try {
      const win = typeof wx.getWindowInfo === 'function'
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync()
      if (win && win.statusBarHeight) this.setData({ statusBarHeight: win.statusBarHeight })
    } catch (e) { /* 保底 44px */ }

    this.all = dishesUtil.loadAll()
    this.prefs = storage.getPrefs()
    this.pool = null

    // 指定菜品直接展示；记录推迟到用户点「就吃这个」时，避免打开即写历史
    if (options && options.id) {
      const fixed = dishesUtil.getById(options.id)
      if (fixed) {
        const relaxed = options.from === 'roll' && options.relaxed
          ? decodeURIComponent(options.relaxed)
          : ''
        if (options.from === 'roll') {
          // 「帮我选」来的：以命中的这道菜为前牌，再补 2 张邻牌组成扑克牌栈（中间一张、左右各探一张）
          const front = this.viewOf(fixed, { relaxed: relaxed })
          this._mount([front].concat(this._pickOthers(fixed.id, 2)), relaxed)
        } else {
          // 直达（历史/漂浮小球/分享卡片）：单卡展示，不可翻
          this._mount([this.viewOf(fixed, { relaxed: relaxed })], relaxed)
        }
        return
      }
    }

    // 限定候选池，例如只在收藏里抽
    if (options && options.pool === 'fav') {
      const favDishes = dishesUtil.getByIds(storage.getFav())
      if (favDishes.length) {
        this.pool = favDishes
      } else {
        wx.showToast({ title: '收藏还是空的', icon: 'none' })
      }
    }

    this.roll()
  },

  onShow() {
    this.setData({ theme: storage.getTheme() })
  },

  getDpr() {
    let dpr = 2
    try {
      const info = typeof wx.getWindowInfo === 'function'
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync()
      dpr = info.pixelRatio || 2
    } catch (e) {
      dpr = 2
    }
    return Math.min(dpr, 3)
  },

  /**
   * 一次替你抽 3 张（加权无放回），放进扑克牌栈
   */
  roll() {
    const res = randomUtil.pickThree({
      dishes: this.all,
      pool: this.pool,
      prefs: this.prefs,
      blacklist: storage.getBlack(),
      favorites: storage.getFav(),
      history: storage.getHistory()
    })
    if (!res || !res.dishes || !res.dishes.length) {
      wx.showToast({ title: '没有可抽的菜了', icon: 'none' })
      return
    }
    const cands = res.dishes.map((d) => this.viewOf(d, { relaxed: res.relaxed }))
    this._mount(cands, res.relaxed || '')
  },

  // 从候选池里再挑 N 张「邻牌」（排除已定的前牌），供扑克牌栈使用；尊重 fav 池限定
  _pickOthers(excludeId, count) {
    const base = (this.pool && this.pool.length ? this.pool : this.all).filter((d) => d.id !== excludeId)
    const res = randomUtil.pickThree({
      dishes: this.all,
      pool: base,
      prefs: this.prefs,
      blacklist: storage.getBlack(),
      favorites: storage.getFav(),
      history: storage.getHistory(),
      count: count
    })
    return ((res && res.dishes) || []).map((d) => this.viewOf(d, { relaxed: '' }))
  },

  // 口味画像里「偏爱」的标签集合（供卡片上的「你爱」角标用），按需算一次
  _lovedSet() {
    if (!this.__loved) {
      const loved = {}
      const profile = statsUtil.tasteProfile(storage.getHistory(), 6)
      profile.loved.forEach(function (t) { loved[t] = true })
      this.__loved = loved
    }
    return this.__loved
  },

  // 打卡后口味画像变了：清缓存并重算所有候选的角标
  _refreshTagViews() {
    this.__loved = null
    const loved = this._lovedSet()
    const cands = this.data.candidates.map(function (c) {
      return Object.assign({}, c, {
        tagViews: (c.tags || []).map(function (t) {
          return { text: t, loved: !!loved[t] }
        })
      })
    })
    const cur = this.data.cur
    this.setData({ candidates: cands, dish: cands[cur] || cands[0] })
  },

  // 单道菜 → 视图模型（含 emoji / 匹配度 / 历史态）
  viewOf(dish, opts) {
    const hist = storage.getHistory()
    const hit = hist.find((h) => h.id === dish.id)
    const decidedAt = (hit && hit.decidedAt) || 0
    const recent = {
      decidedAt: decidedAt,
      label: decidedAt ? relTime(decidedAt) : '',
      isLast: !!storage.getLast() && storage.getLast().id === dish.id && (storage.getLast().decidedAt || 0) > 0
    }
    return {
      id: dish.id,
      name: dish.name,
      category: dish.category,
      source: dish.source || 'builtin',
      tags: dish.tags || [],
      // 单独给标签行的视图结构：原 tags 保持字符串数组，海报/文案不受影响
      tagViews: (dish.tags || []).map((t) => ({ text: t, loved: !!this._lovedSet()[t] })),
      price: dish.price,
      desc: dish.desc || '',
      reason: dish.reason || '',
      relaxed: (opts && opts.relaxed) || '',
      fun: copyUtil.line({ slot: randomUtil.timeSlot(new Date()), category: dish.category }),
      recent: recent,
      emoji: CATEGORY_EMOJI[dish.category] || '🍽️',
      score: randomUtil.scoreDish(dish, { prefs: this.prefs, history: hist })
    }
  },

  // 把候选列表挂到卡片栈，并刷新当前前牌（dish / fav / black / myRating）
  _mount(cands, relaxed) {
    const cur = 0
    const n = cands.length
    const styles = buildStyles(cur, n)
    const front = cands[cur]
    const fav = storage.isFav(front.id)
    let black = storage.isBlack(front.id)
    if (fav && black) {
      storage.toggleBlack(front.id)
      black = false
    }
    const myRating = (() => {
      const h = storage.getHistory().find((h) => h.id === front.id)
      return (h && h.rating) || ''
    })()
    this.setData({
      candidates: cands,
      cur: cur,
      cardStyles: styles,
      multi: n > 1,
      dish: front,
      fav: fav,
      black: black,
      myRating: myRating,
      anim: ''
    })
    if (this._animTimer) clearTimeout(this._animTimer)
    this._animTimer = setTimeout(() => {
      this.setData({ anim: 'is-in' })
    }, 20)
  },

  // 切换前牌时同步 dish / fav / black / myRating；
  // instantIdx 用于飞牌后让离场的那张"瞬间归位"到邻位，避免横穿屏幕
  _applyCur(newCur, instantIdx) {
    const cands = this.data.candidates
    const n = cands.length
    const styles = buildStyles(newCur, n, instantIdx)
    const front = cands[newCur]
    const fav = storage.isFav(front.id)
    let black = storage.isBlack(front.id)
    if (fav && black) {
      storage.toggleBlack(front.id)
      black = false
    }
    const myRating = (() => {
      const h = storage.getHistory().find((h) => h.id === front.id)
      return (h && h.rating) || ''
    })()
    this.setData({
      cur: newCur,
      cardStyles: styles,
      dish: front,
      fav: fav,
      black: black,
      myRating: myRating,
      flung: false          // 飞牌归位完成，解锁手势（tapCard 直转场景本就不是锁定态，置 false 无害）
    })
  },

  rollAgain() {
    this.roll()
    // 重新抽 3 张后给「就吃这个」按钮重播一次入场动画（缩放回弹 + 上下粒子）
    this._replayCta()
  },

  /* ---------- 扑克牌卡片栈：滑动切换 ----------
     纯 JS 触摸手势（早期版本已验证稳定；WXS 手势链路在部分开发者工具版本
     上 touchend 不可靠，三轮修复无效后整体弃用，勿再引入）。
     流畅度四件套：路径式 setData（每帧只推前牌一条样式串）+ 像素量化去重
     + 32ms 稳帧节流 + 渲染侧减负（无 backdrop-filter、2D 变换、will-change，见 wxss）。 */

  _onStackStart(e) {
    if (this.data.candidates.length < 2 || this.data.flung) return
    const t = e.touches[0]
    this._sx = t.clientX
    this._sy = t.clientY
    this._dragging = false
    this._moved = false
    this._lastDx = null
  },

  _onStackMove(e) {
    if (this._sx === undefined || this._sx === null) return
    if (this.data.candidates.length < 2) return
    const t = e.touches[0]
    const dx = t.clientX - this._sx
    const dy = t.clientY - this._sy
    if (!this._dragging) {
      // 横向位移明显才进入拖拽；纵向明显则让给页面滚动
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) this._dragging = true
      else if (Math.abs(dy) > 16) return
    }
    if (!this._dragging) return
    this._moved = true
    // 像素量化 + 去重：亚像素位移直接跳过，不浪费一次 JS↔原生桥往返
    const qdx = Math.round(dx)
    if (qdx === this._lastDx) return
    // 稳帧节流 32ms：桥吞吐有限，30fps 稳定节奏比 60fps 时断时续观感更顺；
    // 最后一帧不用补——touchend 的飞牌/弹回会设置终态样式
    const now = Date.now()
    if (now - (this._lastMoveSet || 0) < 32) return
    this._lastMoveSet = now
    this._lastDx = qdx
    const rot = Math.round(qdx * 5) / 100   // dx * 0.05，保留两位小数，样式串更短
    // 路径式 setData：只推当前前牌这一条样式字符串，不把整个数组反复过桥。
    // 拖动中把前牌三层阴影临时换成单层（内联覆盖 class）——多层阴影 + 大圆角
    // 逐帧重绘是真机掉帧大户；松手后 cardStyle/_fling 不带 box-shadow，自动恢复
    const patch = {}
    patch['cardStyles[' + this.data.cur + ']'] =
      'transform: translateX(' + qdx + 'px) rotate(' + rot + 'deg); z-index:4; opacity:1;' +
      ' transition:none; box-shadow: 0 16rpx 32rpx rgba(74,52,32,0.16);'
    this.setData(patch)
  },

  _onStackEnd(e) {
    if (!this._dragging) return  // 不是滑动，交给 tapCard / 页面滚动
    this._dragging = false
    const t = e.changedTouches[0]
    const dx = t.clientX - this._sx
    const TH = 64
    if (dx <= -TH) {
      this._fling(-1)           // 往左滑：前牌飞左，右侧邻牌转正
    } else if (dx >= TH) {
      this._fling(1)            // 往右滑：前牌飞右，左侧邻牌转正
    } else {
      // 没到阈值：前牌弹回中央（只推这一张的样式）
      const patch = {}
      patch['cardStyles[' + this.data.cur + ']'] = cardStyle(0, false)
      this.setData(patch)
    }
  },

  _fling(dir) {
    const cur = this.data.cur
    const n = this.data.candidates.length
    const flyLeft = dir < 0
    const patch = {}
    patch['cardStyles[' + cur + ']'] =
      'transform: translateX(' + (flyLeft ? '-130%' : '130%') +
      ') rotate(' + (flyLeft ? '-20deg' : '20deg') + ') scale(0.9); opacity:0; z-index:4;' +
      ' transition: transform 0.28s cubic-bezier(.3,.7,.4,1), opacity 0.28s ease;'
    patch.flung = true          // 上锁：飞牌动画期间 _onStackStart / tapCard 不再响应手势
    this.setData(patch)
    setTimeout(() => {
      const newCur = (cur + (flyLeft ? 1 : -1) + n) % n
      // 离场前牌瞬间归位到邻位（不横穿），新前牌从邻位滑入中央；_applyCur 内一并解锁
      this._applyCur(newCur, cur)
    }, 280)
  },

  // 点卡片：侧卡直接转正；前牌或拖拽后的点击忽略
  tapCard(e) {
    if (this._moved) { this._moved = false; return }
    const idx = e.currentTarget.dataset.idx
    if (idx === undefined || idx === this.data.cur) return
    if (this.data.flung) return
    this._applyCur(idx)
  },

  eatThis() {
    const dish = this.data.dish
    if (!dish) return
    // 记录到历史与「上次吃的」：已存在则只标记已决定，避免重复
    const hist = storage.getHistory()
    const exist = hist.some(function (h) { return h.id === dish.id })
    if (exist) {
      storage.markDecided(dish.id)
    } else {
      storage.addHistory({
        id: dish.id,
        name: dish.name,
        category: dish.category,
        source: dish.source || 'builtin',
        tags: dish.tags || [],
        ts: Date.now(),
        decidedAt: Date.now()
      })
    }
    storage.setLast(dish)
    feedback.onDecide(this.prefs && this.prefs.sound)
    wx.showToast({
      title: '就吃这个，祝你胃口好',
      icon: 'none',
      duration: 1600
    })
    setTimeout(() => {
      if (getCurrentPages().length > 1) {
        wx.navigateBack()
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 900)
  },

  goHome() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  },

  // 进入独立菜谱页，查看食材与做法。卡片栈里每张卡各自跳自己的菜谱（读 dataset.id），兜底用当前前牌
  goRecipe(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) ||
      (this.data.dish && this.data.dish.id)
    if (!id) return
    wx.navigateTo({ url: '/pages/recipe/recipe?id=' + id })
  },

  // 详情卡：从每张卡上方的「详情」按钮进，catchtap 避免触发翻牌
  goDetail(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) ||
      (this.data.dish && this.data.dish.id)
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  /* ---------- 转发 / 分享（C11，原生能力，免费） ---------- */

  onShareAppMessage() {
    const dish = this.data.dish
    if (!dish) {
      return { title: '今天吃什么？让我帮你做决定', path: '/pages/index/index' }
    }
    const title = '今天吃「' + dish.name + '」 — ' + (dish.fun || '帮你搞定选择困难')
    return {
      title: title,
      path: '/pages/result/result?id=' + dish.id
    }
  },

  onShareTimeline() {
    const dish = this.data.dish
    if (!dish) {
      return { title: '今天吃什么？让我帮你做决定' }
    }
    return {
      title: '今天吃「' + dish.name + '」 — ' + (dish.fun || '帮你搞定选择困难'),
      query: 'id=' + dish.id
    }
  },

  // 收藏与拉黑互斥：已收藏时「不想吃」锁定，已拉黑时「收藏」锁定。
  // 不再自动帮用户取消另一边——想换边先手动取消，语义更清楚
  toggleFav() {
    const dish = this.data.dish
    if (!dish) return
    if (this.data.black) {
      wx.showToast({ title: '已拉黑的菜不能收藏，先取消拉黑', icon: 'none' })
      return
    }
    const added = storage.toggleFav(dish.id)
    this.setData({ fav: added })
    wx.showToast({ title: added ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  toggleBlack() {
    const dish = this.data.dish
    if (!dish) return
    if (this.data.fav) {
      wx.showToast({ title: '已收藏的菜就不拉黑啦', icon: 'none' })
      return
    }
    const added = storage.toggleBlack(dish.id)
    this.setData({ black: added })
    wx.showToast({ title: added ? '已拉黑，以后不抽它' : '已移出黑名单', icon: 'none' })
  },

  /* ---------- 吃完打卡（口味画像入口） ---------- */

  openRate() {
    this.setData({ rateOpen: true })
  },

  closeRate() {
    this.setData({ rateOpen: false })
  },

  rate(e) {
    const r = e.currentTarget.dataset.r
    const dish = this.data.dish
    if (!dish) return
    storage.rateDish(dish.id, r, {
      name: dish.name,
      category: dish.category,
      source: dish.source || 'builtin',
      tags: dish.tags || []
    })
    this.setData({ myRating: r, rateOpen: false })
    // 打分会改变口味画像：立刻重算卡片上的「你爱」角标，让反馈当场可见
    this._refreshTagViews()
    const label = r === 'good' ? '已记录：好吃 😋'
      : r === 'ok' ? '已记录：一般 😐'
      : '已记录：踩雷 😣'
    wx.showToast({ title: label, icon: 'none' })
  },

  /* ---------- 分享卡片 ---------- */

  savePoster() {
    const dish = this.data.dish
    if (!dish) return

    wx.showLoading({ title: '生成中', mask: true })
    const dpr = this.getDpr()

    wx.createSelectorQuery()
      .in(this)
      .select('#poster')
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res && res[0] && res[0].node
        if (!node) {
          wx.hideLoading()
          wx.showToast({ title: '生成失败，请重试', icon: 'none' })
          return
        }
        const canvas = node
        const ctx = canvas.getContext('2d')
        canvas.width = poster.WIDTH * dpr
        canvas.height = poster.HEIGHT * dpr
        ctx.scale(dpr, dpr)
        poster.draw(ctx, {
          name: dish.name,
          category: dish.category,
          desc: dish.desc,
          reason: dish.reason,
          fun: dish.fun,
          ts: Date.now()
        })

        wx.canvasToTempFilePath({
          canvas: canvas,
          x: 0,
          y: 0,
          width: poster.WIDTH,
          height: poster.HEIGHT,
          destWidth: poster.WIDTH * dpr,
          destHeight: poster.HEIGHT * dpr,
          fileType: 'png',
          success: (r) => {
            wx.hideLoading()
            this.doSave(r.tempFilePath)
          },
          fail: (err) => {
            wx.hideLoading()
            console.error('[lunch] 卡片导出失败：', err)
            wx.showToast({ title: '生成失败，请重试', icon: 'none' })
          }
        })
      })
  },

  doSave(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success() {
        wx.showToast({ title: '已保存到相册' })
      },
      fail(err) {
        const msg = String((err && err.errMsg) || '')
        if (msg.indexOf('auth deny') > -1 || msg.indexOf('authorize') > -1 || msg.indexOf('deny') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存分享卡片需要访问你的相册，是否去开启？',
            confirmText: '去设置',
            cancelText: '取消',
            success(r) {
              if (r.confirm) wx.openSetting()
            }
          })
        } else {
          // 兜底：打开预览，用户可长按保存
          wx.previewImage({ urls: [filePath], current: filePath })
        }
      }
    })
  }
})
