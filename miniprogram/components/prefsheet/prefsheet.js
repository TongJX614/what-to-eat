const dishesUtil = require('../../utils/dishes.js')
const randomUtil = require('../../utils/random.js')
const storage = require('../../utils/storage.js')

Component({
  options: {
    addGlobalClass: true
  },

  data: {
    visible: false,
    local: {},
    budgetText: '不限',
    excludeOptions: [10, 20, 50],
    totalCount: 0,
    availableCount: 0,
    // 主题已固定暖食（清爽/夜宵于 2026-09-05 移除），保留此字段供 wxml 的 theme-{{theme}} class 不报错
    theme: 'warm',
    mealList: [
      { key: 'auto', name: '自动' },
      { key: 'breakfast', name: '早餐' },
      { key: 'lunch', name: '午餐' },
      { key: 'tea', name: '下午茶' },
      { key: 'dinner', name: '晚餐' },
      { key: 'midnight', name: '夜宵' }
    ],

    // 场景：回答「这顿怎么吃」。全部走软权重，不做硬过滤
    modeList: [
      { key: 'any', name: '都行' },
      { key: 'home', name: '自己做' },
      { key: 'out', name: '出去吃' }
    ],
    partyList: [
      { key: 'any', name: '都行' },
      { key: 'solo', name: '一人食' },
      { key: 'multi', name: '几个人' }
    ],
    tasteList: [
      { key: 'any', name: '都行' },
      { key: 'hot', name: '热乎的' },
      { key: 'cool', name: '清爽的' }
    ]
  },

  methods: {
    noop() {},

    open(prefs) {
      const merged = Object.assign({}, storage.DEFAULT_PREFS, prefs || {})
      merged.categories = Array.isArray(merged.categories) ? merged.categories.slice() : []
      this.setData({
        visible: true,
        local: merged
      })
      this.syncBudgetText()
      this.syncCount()
    },

    close() {
      this.setData({ visible: false })
      // 通知父页面恢复导航栏（偏好弹层关闭时显示）
      this.triggerEvent('close', {})
    },

    syncBudgetText() {
      const budget = Number(this.data.local.budget) || 0
      this.setData({
        budgetText: budget > 0 ? '¥' + budget + ' 以内' : '不限'
      })
    },

    syncCount() {
      const all = dishesUtil.loadAll()
      this.setData({
        totalCount: all.length,
        availableCount: randomUtil.countAvailable({
          dishes: all,
          prefs: this.data.local,
          blacklist: storage.getBlack()
        })
      })
    },

    emit() {
      this.syncBudgetText()
      this.syncCount()
      this.triggerEvent('change', Object.assign({}, this.data.local))
    },

    onSwitch(e) {
      const patch = {}
      patch['local.' + e.currentTarget.dataset.field] = !!e.detail.value
      this.setData(patch)
      this.emit()
    },

    onBudget(e) {
      this.setData({ 'local.budget': Number(e.detail.value) || 0 })
      this.emit()
    },

    onExclude(e) {
      this.setData({ 'local.excludeCount': Number(e.currentTarget.dataset.value) })
      this.emit()
    },

    onReset() {
      this.setData({
        local: Object.assign({}, storage.DEFAULT_PREFS, { categories: [] })
      })
      this.syncBudgetText()
      this.syncCount()
      this.triggerEvent('reset', {})
    },

    onMeal(e) {
      const key = e.currentTarget.dataset.key
      if (!key || key === this.data.local.mealSlot) return
      this.setData({ 'local.mealSlot': key })
      this.emit()
    },

    // 场景三连（在哪吃 / 几个人 / 冷热）：字段与取值由 dataset 带过来
    onScene(e) {
      const field = e.currentTarget.dataset.field
      const value = e.currentTarget.dataset.value
      if (!field || this.data.local[field] === value) return
      const patch = {}
      patch['local.' + field] = value
      this.setData(patch)
      this.emit()
    }
  }
})
