const storage = require('../../utils/storage.js')
const poiUtil = require('../../utils/poi.js')

/* 排序模式 */
const SORT_DISTANCE = 'distance'
const SORT_OPEN = 'open'        // 现在营业的优先
const SORT_NIGHT = 'night'       // 夜宵开放优先

/* 地图：高度与 nearby.wxss 的 .nb-map / .nb-map-wrap 保持一致（改样式时同步改这里） */
const MAP_H_RPX = 520
const SCALE_MIN = 15            // 最小缩放（再远就不如原来）
const SCALE_MAX = 18            // 最大缩放（再近就只剩一条街）

// 列表项在 JS 层预处理好展示文案（WXML 不支持方法调用）
function toView(p, index, ctx) {
  const isOpen = poiUtil.isOpenNow(p.openHours)
  const visited = ctx.visited.has(p.id)
  const fav = ctx.fav.has(p.id)
  return {
    id: p.id,
    key: p.id,                        // 用于 visited / fav 索引
    index: index,
    title: p.title,
    address: p.address,
    category: p.category,
    catText: poiUtil.shortCategory(p.category),
    district: p.district,
    lat: p.lat,
    lng: p.lng,
    distance: p.distance,
    distText: poiUtil.formatDistance(p.distance),
    openHours: p.openHours || '',
    isOpen: isOpen,
    nightOpen: !!p.nightOpen,
    visited: visited,
    fav: fav
  }
}

function toMarkers(list, activeIndex) {
  return list.map(function (p, i) {
    const m = {
      id: i,
      latitude: p.lat,
      longitude: p.lng,
      width: 30,
      height: 30
    }
    if (i === activeIndex) {
      m.callout = {
        content: p.title,
        color: '#3A2E26',
        fontSize: 12,
        bgColor: '#FFFFFF',
        padding: 8,
        borderRadius: 8,
        display: 'ALWAYS'
      }
    }
    return m
  })
}

Page({
  data: {
    theme: 'warm',
    status: 'locating', // locating | denied | loading | done | error
    errMsg: '',
    lat: 0,
    lng: 0,
    list: [],
    markers: [],
    activeIndex: -1,
    active: null,
    sheetShow: false,
    isMock: true,
    radius: 2000,     // 扫描半径（米）：1km 在郊区/新区常常只剩几十家且全挤在一条主街上，
                      // 放到 2km 能把更大范围的店一起扫进来
    scale: 17,        // 地图默认缩放级（15 太远：附近几十家店会叠成一个点，看不出分布）
    keyword: '',      // 从结果页带来的菜名，空表示「随便看附近有什么」
    kwHint: '',       // 展示用： mock 数据下命中的品类名
    sortBy: SORT_DISTANCE,   // 排序：distance / open / night
    nightOnly: false,        // 仅看夜宵店
    hoursKnown: false,       // 本次数据是否带营业时间（腾讯 POI 搜索不返回，为 false 时相关筛选禁用）
    visitedIds: [],          // 已去过 id 列表（驱动 UI 角标）
    favIds: [],              // 收藏 id 列表
    sortOptions: [           // 排序切换按钮文案（都是「优先」，不做硬过滤；硬过滤只有右侧的仅看夜宵）
      { key: SORT_DISTANCE, label: '距离最近' },
      { key: SORT_OPEN, label: '营业优先' },
      { key: SORT_NIGHT, label: '夜宵优先' }
    ]
  },

  onLoad() {
    this.setData({
      theme: storage.getTheme(),
      isMock: poiUtil.isMock()
    })
    this.start()
  },

  onShow() {
    const bar = this.getTabBar()
    if (bar) {
      bar.setData({ visible: true })
      bar.settle(2)
    }
  },

  start() {
    const that = this
    this.setData({ status: 'locating', errMsg: '' })
    // 微信隐私保护：若后台已声明「位置信息」，必须先弹授权，否则 getLocation 直接失败
    if (typeof wx.requirePrivacyAuthorize === 'function') {
      wx.requirePrivacyAuthorize({
        success: function () { that._locate() },
        fail: function () { that._locate() } // 后台未配置指引时按原逻辑走，由 getLocation 自己报错
      })
    } else {
      this._locate()
    }
  },

  _locate() {
    const that = this
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        that.setData({
          lat: res.latitude,
          lng: res.longitude,
          status: 'loading'
        })
        that.loadPoi()
      },
      fail(err) {
        const msg = (err && err.errMsg) || ''
        // 用户拒绝授权 -> 引导去设置页打开
        if (msg.indexOf('auth') > -1 || msg.indexOf('deny') > -1 || msg.indexOf('authorize') > -1) {
          that.setData({ status: 'denied', errMsg: '需要位置权限才能查看附近餐厅' })
          return
        }
        that.setData({
          status: 'error',
          errMsg: msg.indexOf('declare') > -1
            ? '定位接口未开通，请在小程序后台申请地理位置权限'
            : '定位失败，请检查手机定位是否开启'
        })
      }
    })
  },

  loadPoi() {
    const that = this
    poiUtil
      .getNearby(
        { latitude: this.data.lat, longitude: this.data.lng },
        // 菜名关键词：从结果页「附近哪家吃」带过来，空则看附近全部餐厅
        { radius: this.data.radius, keyword: this.data.keyword || '' }
      )
      .then(function (raw) {
        const ctx = {
          visited: new Set(storage.getPoiVisited()),
          fav: new Set(storage.getPoiFav())
        }
        const visitedIds = storage.getPoiVisited()
        const favIds = storage.getPoiFav()
        // 全量视图数据单独存：_resort 的过滤/排序永远基于它，
        // 否则「仅看夜宵」这类过滤会作用在已过滤的列表上，关掉后数据回不来
        const base = raw.map(function (p, i) { return toView(p, i, ctx) })
        that._rawList = base.slice()
        // 腾讯 POI 搜索接口不返回营业时间：真实数据下「营业优先 / 夜宵优先 / 仅看夜宵」无数据可用。
        // 此时自动回落到距离排序并关闭夜宵过滤，否则「仅看夜宵」会把列表滤成空、看似功能坏了。
        const hasHours = base.some(function (x) { return !!x.openHours })
        const curSort = that.data.sortBy
        const patch = { hoursKnown: hasHours }
        if (!hasHours) {
          if (curSort === SORT_OPEN || curSort === SORT_NIGHT) patch.sortBy = SORT_DISTANCE
          if (that.data.nightOnly) patch.nightOnly = false
        }
        const list = that._applyView(base, patch)
        Object.assign(patch, {
          list: list,
          markers: toMarkers(list, -1),
          activeIndex: -1,
          status: 'done',
          visitedIds: visitedIds,
          favIds: favIds,
          // 首次出图时按「本次结果铺开的范围」定缩放级，避免几十家店叠成一个点
          scale: that._fitScale(base)
        })
        that.setData(patch)
      })
      .catch(function (e) {
        that.setData({
          status: 'error',
          errMsg: (e && e.message) || '加载附近餐厅失败'
        })
      })
  },

  /* 按「本次结果实际铺开的范围」算一个合适的缩放级。
     背景：附近结果永远取距离最近的 20 家，在城里这 20 家常常全落在 100~200m 内，
     固定 scale=15 时它们会叠成一小团（看着像只有一两个点）。
     规则：结果越集中越放大；但不会比 15 更远（不比原来差），最多放大到 18。 */
  _fitScale(list) {
    const arr = list || []
    if (!arr.length) return this.data.scale
    const win = (typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync()) || {}
    const winW = win.windowWidth || 375
    const winH = MAP_H_RPX * winW / 750   // 与 nearby.wxss 的 .nb-map 高度 520rpx 对齐
    const lats = arr.map(function (p) { return p.lat }).concat([this.data.lat])
    const lngs = arr.map(function (p) { return p.lng }).concat([this.data.lng])
    const midLat = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2
    const rad = midLat * Math.PI / 180
    const mY = (Math.max.apply(null, lats) - Math.min.apply(null, lats)) * 111320
    const mX = (Math.max.apply(null, lngs) - Math.min.apply(null, lngs)) * 111320 * Math.cos(rad)
    // 留 15% 边距，省得边上的点被贴着边裁掉
    const mpp = Math.max(mY / (winH * 0.85), mX / (winW * 0.85))
    if (!(mpp > 0)) return 18   // 只有一个点（没搜到店）：直接放到最大
    const z = Math.log2(156543.03392 * Math.cos(rad) / mpp)
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(z)))
  },

  /* 按当前排序 / 夜宵过滤重排列表（不重新拉数据）
     opts：临时覆盖 sortBy / nightOnly（loadPoi 里用于无营业时间时的强制回落） */
  _applyView(list, opts) {
    const o = opts || {}
    const sortBy = (o.sortBy !== undefined ? o.sortBy : this.data.sortBy) || SORT_DISTANCE
    const nightOnly = o.nightOnly !== undefined ? o.nightOnly : !!this.data.nightOnly
    let arr = list.slice()
    if (nightOnly) arr = arr.filter(function (x) { return x.nightOpen })
    if (sortBy === SORT_OPEN) {
      arr.sort(function (a, b) {
        if (a.isOpen && !b.isOpen) return -1
        if (!a.isOpen && b.isOpen) return 1
        return a.distance - b.distance
      })
    } else if (sortBy === SORT_NIGHT) {
      arr.sort(function (a, b) {
        if (a.nightOpen && !b.nightOpen) return -1
        if (!a.nightOpen && b.nightOpen) return 1
        return a.distance - b.distance
      })
    } else {
      arr.sort(function (a, b) { return a.distance - b.distance })
    }
    // 重新写入 index（list 是带原数组下标 + index 字段，重新渲染按排序后位置）
    return arr.map(function (x, i) {
      return Object.assign({}, x, { index: i })
    })
  },

  onSort(e) {
    const key = e.currentTarget.dataset.key
    if (!key || key === this.data.sortBy) return
    if ((key === SORT_OPEN || key === SORT_NIGHT) && !this.data.hoursKnown) {
      wx.showToast({ title: '平台暂不提供营业时间', icon: 'none' })
      return
    }
    this.setData({ sortBy: key })
    this._resort()
  },

  onNightToggle() {
    if (!this.data.hoursKnown && !this.data.nightOnly) {
      wx.showToast({ title: '平台暂不提供营业时间', icon: 'none' })
      return
    }
    this.setData({ nightOnly: !this.data.nightOnly })
    this._resort()
  },

  _resort() {
    const base = this._rawList || []
    if (!base.length) return
    const resorted = this._applyView(base)
    this.setData({ list: resorted, markers: toMarkers(resorted, this.data.activeIndex) })
  },

  /* ---------- 已去过 / 收藏（store-key 用 id） ---------- */
  toggleVisited(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    storage.togglePoiVisited(id)
    const ids = storage.getPoiVisited()
    this.setData({ visitedIds: ids })
    this._refreshRow(id)
  },

  toggleFavPoi(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    storage.togglePoiFav(id)
    const ids = storage.getPoiFav()
    this.setData({ favIds: ids })
    this._refreshRow(id)
  },

  /* 单行原地更新（visited/fav 切换时只刷那一行，不重排） */
  _refreshRow(id) {
    // 展示列表和 _rawList 是两份拷贝（_applyView 重写 index 时会复制），
    // 状态必须两边同步，否则下次重排会把旧的 visited/fav 带回来
    const patch = function (x) {
      if (x.id !== id) return x
      return Object.assign({}, x, {
        visited: storage.isPoiVisited(id),
        fav: storage.isPoiFav(id)
      })
    }
    const list = this.data.list.map(patch)
    this._rawList = (this._rawList || []).map(patch)
    this.setData({ list: list })
    // 当前打开的详情卡若是同一行也同步
    const a = this.data.active
    if (a && a.id === id) {
      this.setData({
        active: Object.assign({}, a, {
          visited: storage.isPoiVisited(id),
          fav: storage.isPoiFav(id)
        })
      })
    }
  },

  // 清掉菜名，恢复成「附近所有餐厅」
  clearKeyword() {
    this.setData({ keyword: '', kwHint: '' })
    if (this.data.lat && this.data.lng) this.loadPoi()
  },

  // 点地图上的 marker
  onMarkerTap(e) {
    const idx = e.detail && e.detail.markerId
    if (typeof idx !== 'number') return
    this.select(idx)
  },

  // 点列表项
  openPoi(e) {
    const idx = e.currentTarget.dataset.index
    this.select(Number(idx))
  },

  select(idx) {
    const item = this.data.list[idx]
    if (!item) return
    this.setData({
      activeIndex: idx,
      active: item,
      markers: toMarkers(this.data.list, idx),
      sheetShow: true
    })
    // 半屏详情期间隐藏浮动 tabBar：tabBar z-index(999) 高于详情卡(100)，
    // 不隐藏会压住「复制店名」主按钮
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar) tabBar.setData({ visible: false })
  },

  closeSheet() {
    this.setData({ sheetShow: false })
    // 恢复底部自定义 tabBar
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar) tabBar.setData({ visible: true })
  },

  noop() {},

  // 复制店名，引导用户去点评/美团搜索
  copyName() {
    const name = this.data.active && this.data.active.title
    if (!name) return
    wx.setClipboardData({
      data: name,
      success() {
        wx.showToast({
          title: '已复制「' + name + '」，去点评搜索吧',
          icon: 'none',
          duration: 2200
        })
      }
    })
  },

  openSetting() {
    const that = this
    wx.openSetting({
      success(res) {
        if (res.authSetting && res.authSetting['scope.userLocation']) {
          that.start()
        }
      }
    })
  },

  retry() {
    this.start()
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  }
})
