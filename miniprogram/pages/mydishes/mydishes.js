const dishesUtil = require('../../utils/dishes.js')
const storage = require('../../utils/storage.js')

/**
 * 自定义我的菜：手动添加常吃的菜，进入随机池。
 * 也是 M3 拍照选菜手动编辑流程的前置能力。
 */
function freshTags() {
  return dishesUtil.TAGS.map(function (t) {
    return { name: t, on: false }
  })
}

Page({
  data: {
    list: [],
    cats: dishesUtil.CATEGORIES,
    tagList: freshTags(),
    form: { name: '', category: '', price: '', desc: '', ingredients: '', steps: '' },
    // textarea 多行占位文案：WXML 属性里的 &#10; 不会被解码（会原样显示），
    // 换行必须走数据绑定的真实 \n
    phIngredients: '每行一种，可带用量，例如：\n鸡胸肉 300g\n花生米 50g',
    phSteps: '每行一步，例如：\n鸡肉切丁腌10分钟\n热油下干辣椒爆香',
    catIndex: -1,
    editing: false,
    theme: 'warm',
    statusBarHeight: 44
  },

  onLoad() {
    // 自定义导航：读状态栏高度，避免顶栏顶进系统状态栏（结果页同款）
    try {
      const win = typeof wx.getWindowInfo === 'function'
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync()
      if (win && win.statusBarHeight) this.setData({ statusBarHeight: win.statusBarHeight })
    } catch (e) { /* 保底 44px */ }
  },

  onShow() {
    const bar = this.getTabBar()
    if (bar) {
      bar.setData({ visible: true })
      bar.settle(1)
    }
    this.refresh()
    this.setData({ theme: storage.getTheme() })
  },

  refresh() {
    const list = storage.getCustom().map(function (d) {
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        tags: d.tags || [],
        price: d.price,
        desc: d.desc || ''
      }
    })
    this.setData({ list: list })
  },

  openForm() {
    this.setData({
      editing: true,
      form: { name: '', category: '', price: '', desc: '', ingredients: '', steps: '' },
      tagList: freshTags(),
      catIndex: -1
    })
    // 表单期间隐藏浮动 tabBar：否则压住底部「做法」字段和操作按钮，
    // 也避免误触 tab 切页丢掉填了一半的表单
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar) tabBar.setData({ visible: false })
  },

  cancelForm() {
    this.setData({ editing: false })
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar) tabBar.setData({ visible: true })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    const patch = {}
    patch['form.' + field] = e.detail.value
    this.setData(patch)
  },

  onCat(e) {
    const i = Number(e.detail.value)
    this.setData({ catIndex: i, 'form.category': this.data.cats[i] })
  },

  // WXML 的 {{}} 不支持成员方法调用，改为在 JS 层维护带 on 字段的 tagList
  toggleTag(e) {
    const name = e.currentTarget.dataset.name
    const list = this.data.tagList.map(function (t) {
      if (t.name === name) return { name: t.name, on: !t.on }
      return t
    })
    this.setData({ tagList: list })
  },

  save() {
    const f = this.data.form
    if (!f.name || !f.name.trim()) {
      wx.showToast({ title: '先给菜起个名', icon: 'none' })
      return
    }
    if (!f.category) {
      wx.showToast({ title: '选个分类', icon: 'none' })
      return
    }
    const ingredients = (f.ingredients || '').split('\n')
      .map(function (s) { return s.trim() })
      .filter(function (s) { return s })
    const steps = (f.steps || '').split('\n')
      .map(function (s) { return s.trim() })
      .filter(function (s) { return s })
    storage.addCustom({
      name: f.name.trim(),
      category: f.category,
      tags: this.data.tagList.filter(function (t) {
        return t.on
      }).map(function (t) {
        return t.name
      }),
      price: Number(f.price) || 0,
      desc: (f.desc || '').trim(),
      reason: '',
      ingredients: ingredients,
      steps: steps
    })
    this.setData({
      editing: false,
      form: { name: '', category: '', price: '', desc: '', ingredients: '', steps: '' },
      tagList: freshTags(),
      catIndex: -1
    })
    // 保存成功，恢复底部 tabBar
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tabBar) tabBar.setData({ visible: true })
    wx.showToast({ title: '已加入菜单', icon: 'none' })
    this.refresh()
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    storage.removeCustom(id)
    this.refresh()
  },

  openDish(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/recipe/recipe?id=' + id })
  }
})
