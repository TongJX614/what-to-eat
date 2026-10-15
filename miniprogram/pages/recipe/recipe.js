const dishesUtil = require('../../utils/dishes.js')
const storage = require('../../utils/storage.js')
const copyUtil = require('../../utils/copy.js')
const randomUtil = require('../../utils/random.js')

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
    theme: 'warm'
  },

  onLoad(options) {
    this.setData({ theme: storage.getTheme() })
    const id = options && options.id
    if (!id) {
      this.setData({ dish: null })
      return
    }
    const dish = dishesUtil.getById(id)
    if (!dish) {
      this.setData({ dish: null })
      return
    }
    const recipe = (dish && dish.recipe) || {}
    // 复用详情页派生字段，让做菜教程更详实（口味 / 热量 / 适合时段 / 搭配建议）
    const detail = dishesUtil.getDetail(id) || {}
    this.setData({
      dish: {
        id: dish.id,
        name: dish.name,
        category: dish.category,
        tags: dish.tags || [],
        desc: dish.desc || '',
        reason: dish.reason || '',
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
        tips: recipe.tips || [],
        meta: {
          servings: recipe.servings || '',
          time: recipe.time || '',
          level: recipe.level || ''
        },
        flavor: detail.flavor || '',
        kcal: detail.kcal || '',
        pairings: detail.pairings || [],
        slots: (detail.bestSlots || []).map(function (k) { return SLOT_LABEL[k] || k }),
        fun: copyUtil.line({ slot: randomUtil.timeSlot(new Date()), category: dish.category })
      }
    })
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  },

  onShareAppMessage() {
    const d = this.data.dish
    if (!d) return { title: '今天吃什么' }
    return {
      title: '今天吃 ' + d.name + '，附做菜教程',
      path: '/pages/recipe/recipe?id=' + d.id
    }
  }
})
