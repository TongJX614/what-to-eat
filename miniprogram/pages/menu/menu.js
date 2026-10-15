const dishesUtil = require('../../utils/dishes.js')
const storage = require('../../utils/storage.js')

Page({
  data: {
    keyword: '',
    activeCat: '__ALL__',
    cats: [],
    all: [],            // 全量（已过滤黑名单）
    list: [],           // 当前展示
    recent: [],         // 最近吃过（最多 6 条）
    catCounts: {},      // { 分类: count }
    totalCount: 0,
    blacklistCount: 0
  },

  onLoad() {
    const all = dishesUtil.loadAll()
    const cats = dishesUtil.categories()
    const black = new Set(storage.getBlack())
    const visible = all.filter(function (d) { return !black.has(d.id) })
    const history = storage.getHistory().slice(0, 6)

    // 分类计数
    const catCounts = { __ALL__: visible.length }
    cats.forEach(function (c) {
      catCounts[c] = visible.filter(function (d) { return d.category === c }).length
    })

    // 最近吃过：拿全 dish 对象
    const recent = history.map(function (h) {
      const d = dishesUtil.getById(h.id)
      if (!d) return null
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        rating: h.rating || ''
      }
    }).filter(Boolean)

    this.setData({
      cats: [{ name: '__ALL__', label: '全部' }].concat(cats.map(function (c) { return { name: c, label: c } })),
      all: visible,
      list: visible,
      recent: recent,
      catCounts: catCounts,
      totalCount: visible.length,
      blacklistCount: black.size
    })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter()
  },

  clearInput() {
    this.setData({ keyword: '' })
    this.applyFilter()
  },

  onCat(e) {
    const name = e.currentTarget.dataset.name
    this.setData({ activeCat: name })
    this.applyFilter()
  },

  applyFilter() {
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const cat = this.data.activeCat
    let list = this.data.all
    if (cat && cat !== '__ALL__') {
      list = list.filter(function (d) { return d.category === cat })
    }
    if (kw) {
      list = list.filter(function (d) {
        if (d.name && d.name.toLowerCase().indexOf(kw) > -1) return true
        if (d.category && d.category.toLowerCase().indexOf(kw) > -1) return true
        if (Array.isArray(d.tags)) {
          for (let i = 0; i < d.tags.length; i++) {
            if (d.tags[i] && d.tags[i].toLowerCase().indexOf(kw) > -1) return true
          }
        }
        if (d.desc && d.desc.toLowerCase().indexOf(kw) > -1) return true
        return false
      })
    }
    this.setData({ list: list })
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  goResult(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.redirectTo({ url: '/pages/result/result?id=' + id + '&from=menu' })
  },

  goBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/index/index' }) } })
  }
})