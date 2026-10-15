// components/taste-card/taste-card.js
// 口味画像卡：从 history 自动聚合并展示偏爱 / 避开项。
//
// 数据来源：utils/stats.tasteProfileDetailed(history)，输入历史记录数组，
// 返回 { loved: [{tag,score,level,dots}], hated: [...] }。
//
// 抽成组件的好处：
//   - 样式零重复：history 页与首页共用同一份视觉与空状态文案
//   - 评分刷新后即时同步：pageLifetimes.show 在每次回到页面时重新拉 storage
const storage = require('../../utils/storage.js')
const stats = require('../../utils/stats.js')

Component({
  options: {
    addGlobalClass: true   // 让外部 .card / .glass-border 等全局类作用进来
  },

  properties: {
    // forceShow=true 时即便没有任何评分也渲染整张卡（并显示「还没打过卡」引导），
    // 用于 history 页这种「想让用户看到进度」的场景；首页不传，默认有数据才显示。
    forceShow: { type: Boolean, value: false }
  },

  data: {
    loved: [],
    hated: [],
    hasAny: false          // 任意一边有数据时为 true，外层用来决定是否整张隐藏
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  pageLifetimes: {
    show() {
      // 从 history / detail 评分回来后能即时反映
      this.refresh()
    }
  },

  methods: {
    refresh() {
      try {
        const history = storage.getHistory() || []
        const t = stats.tasteProfileDetailed(history)
        this.setData({
          loved: t.loved || [],
          hated: t.hated || [],
          hasAny: !!(t.loved && t.loved.length) || !!(t.hated && t.hated.length)
        })
      } catch (e) {
        this.setData({ loved: [], hated: [], hasAny: false })
      }
    },

    goHistory() {
      wx.navigateTo({ url: '/pages/history/history?tab=history' })
    }
  }
})
