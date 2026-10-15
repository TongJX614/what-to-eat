const dishesUtil = require('../../utils/dishes.js')
const storage = require('../../utils/storage.js')
const timeUtil = require('../../utils/time.js')

const SLOT_LABEL = {
  breakfast: '早餐',
  lunch: '午餐',
  tea: '下午茶',
  dinner: '晚餐',
  midnight: '夜宵'
}

Page({
  data: {
    dish: null,
    isFav: false,
    isBlack: false,
    last: null,
    lastTime: '',
    slots: [],          // [{ key, label }]
    ingredients: [],    // ['xxx', 'yyy']
    pairings: []        // ['米饭', '一份青菜']
  },

  onLoad(query) {
    const id = query && query.id
    if (!id) {
      wx.showToast({ title: '找不到这道菜', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 800)
      return
    }
    this.refresh(id)
  },

  onShow() {
    if (this.data.dish) this.refresh(this.data.dish.id)
  },

  refresh(id) {
    const detail = dishesUtil.getDetail(id)
    if (!detail) {
      wx.showToast({ title: '找不到这道菜', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 800)
      return
    }
    const slots = (detail.bestSlots || []).map(function (k) {
      return { key: k, label: SLOT_LABEL[k] || k }
    })
    this.setData({
      dish: detail,
      isFav: storage.isFav(id),
      isBlack: storage.isBlack(id),
      last: storage.getLast(),
      lastTime: storage.getLast() ? timeUtil.relative(storage.getLast().ts) : '',
      slots: slots,
      ingredients: detail.ingredients || [],
      pairings: detail.pairings || []
    })
  },

  goBack() {
    wx.navigateBack({ fail() { wx.switchTab({ url: '/pages/index/index' }) } })
  },

  goOrbit() {
    const id = this.data.dish && this.data.dish.id
    if (!id) return
    wx.redirectTo({ url: '/pages/result/result?id=' + id + '&from=detail' })
  },

  toggleFav() {
    const id = this.data.dish && this.data.dish.id
    if (!id) return
    const ok = storage.toggleFav(id)
    this.setData({ isFav: ok })
    wx.showToast({ title: ok ? '已收藏' : '已取消收藏', icon: 'none' })
  },

  toggleBlack() {
    const id = this.data.dish && this.data.dish.id
    if (!id) return
    const ok = storage.toggleBlack(id)
    this.setData({ isBlack: ok, isFav: ok ? false : this.data.isFav })
    wx.showToast({ title: ok ? '已加入黑名单' : '已移出黑名单', icon: 'none' })
  },

  goRecipe() {
    const id = this.data.dish && this.data.dish.id
    if (!id) return
    wx.navigateTo({ url: '/pages/recipe/recipe?id=' + id })
  }
})