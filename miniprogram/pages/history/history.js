const dishesUtil = require('../../utils/dishes.js')
const storage = require('../../utils/storage.js')
const timeUtil = require('../../utils/time.js')
const statsUtil = require('../../utils/stats.js')

Page({
  data: {
    tab: 'history',
    list: [],
    chosenList: [],
    otherList: [],
    counts: {
      history: 0,
      fav: 0,
      black: 0
    },
    calendar: [],
    stats: { weekCount: 0, topDish: '', topCat: '' },
    emptyTitle: '还没有记录',
    emptyDesc: '回首页点一下大按钮试试',
    maxHistory: storage.MAX_HISTORY,
    theme: 'warm'
  },

  onShow() {
    this.refresh()
    this.setData({ theme: storage.getTheme() })
  },

  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  },

  refresh() {
    const history = storage.getHistory()
    const favIds = storage.getFav()
    const blackIds = storage.getBlack()

    this._history = history
    this._favIds = favIds
    this._blackIds = blackIds

    const now = new Date()
    this.setData({
      counts: {
        history: history.length,
        fav: favIds.length,
        black: blackIds.length
      },
      calendar: statsUtil.weeklyCalendar(history, now),
      stats: statsUtil.summary(history, now),
    })
    this.buildList()
  },

  buildList() {
    const tab = this.data.tab
    const self = this
    let list = []

    if (tab === 'history') {
      list = this._history.map(function (item) {
        const id = item.id
        return {
          id: id,
          name: item.name,
          category: item.category || '其他',
          timeText: timeUtil.relative(item.ts),
          decided: !!item.decidedAt,
          rating: item.rating || '',
          sourceText: item.source === 'manual' ? '拍照选菜' : '',
          inFav: self._favIds.indexOf(id) > -1,
          inBlack: self._blackIds.indexOf(id) > -1
        }
      })
    } else if (tab === 'fav') {
      list = dishesUtil.getByIds(this._favIds).map(function (d) {
        return {
          id: d.id,
          name: d.name,
          category: d.category,
          desc: d.desc,
          price: d.price,
          inFav: true,
          inBlack: self._blackIds.indexOf(d.id) > -1
        }
      })
    } else {
      list = dishesUtil.getByIds(this._blackIds).map(function (d) {
        return {
          id: d.id,
          name: d.name,
          category: d.category,
          desc: d.desc,
          price: d.price,
          inFav: self._favIds.indexOf(d.id) > -1,
          inBlack: true
        }
      })
    }

    const emptyMap = {
      history: ['还没有随机记录', '回首页点一下那个大按钮试试'],
      fav: ['还没有收藏', '抽到喜欢的菜记得点收藏'],
      black: ['黑名单是空的', '不想再抽到的菜可以点「不想吃」']
    }

    // 历史页按「有没有选它」拆分：已决定的置顶，只抽过没决定的单独一组
    const chosenList = []
    const otherList = []
    if (tab === 'history') {
      list.forEach(function (item) {
        if (item.decided) chosenList.push(item)
        else otherList.push(item)
      })
    }

    this.setData({
      list: list,
      chosenList: chosenList,
      otherList: otherList,
      emptyTitle: emptyMap[tab][0],
      emptyDesc: emptyMap[tab][1]
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab: tab })
    this.buildList()
  },

  openDish(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/recipe/recipe?id=' + id })
  },

  openDay(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/recipe/recipe?id=' + id })
  },

  rollInFav() {
    if (!this._favIds.length) return
    wx.navigateTo({ url: '/pages/result/result?pool=fav' })
  },

  // 收藏与拉黑互斥（与结果页一致）：收藏=喜欢，拉黑=不想再吃，不能同时成立
  toggleFav(e) {
    const id = e.currentTarget.dataset.id
    const added = storage.toggleFav(id)
    let toast = added ? '已收藏' : '已取消收藏'
    if (added && storage.isBlack(id)) {
      storage.toggleBlack(id)
      toast = '已收藏，并移出黑名单'
    }
    wx.showToast({ title: toast, icon: 'none' })
    this.refresh()
  },

  toggleBlack(e) {
    const id = e.currentTarget.dataset.id
    const added = storage.toggleBlack(id)
    let toast = added ? '已加入黑名单' : '已移出黑名单'
    if (added && storage.isFav(id)) {
      storage.toggleFav(id)
      toast = '已拉黑，并取消收藏'
    }
    wx.showToast({ title: toast, icon: 'none' })
    this.refresh()
  },

  // 历史项随手打卡：把评分写入历史记录，口味画像与随机加权即时生效
  rateItem(e) {
    const id = e.currentTarget.dataset.id
    const r = e.currentTarget.dataset.r
    if (!id) return
    const rec = this._history.filter(function (h) { return h.id === id })[0]
    const d = dishesUtil.getById(id)
    storage.rateDish(id, r, {
      name: rec ? rec.name : (d ? d.name : ''),
      category: rec ? rec.category : (d ? d.category : '其他'),
      source: rec ? rec.source : (d ? d.source : 'builtin'),
      tags: d ? d.tags : (rec ? rec.tags : [])
    })
    const label = r === 'good' ? '好吃 😋' : r === 'ok' ? '一般 😐' : '踩雷 😣'
    wx.showToast({ title: label, icon: 'none' })
    this.refresh()
  },

  removeFromBlack(e) {
    const id = e.currentTarget.dataset.id
    storage.removeBlack(id)
    wx.showToast({ title: '已移出黑名单', icon: 'none' })
    this.refresh()
  },

  clearHistory() {
    if (!this._history.length) return
    const self = this
    wx.showModal({
      title: '清空历史记录',
      content: '将删除全部 ' + this._history.length + ' 条随机记录，收藏和黑名单不受影响。此操作不可恢复。',
      confirmText: '清空',
      confirmColor: '#C0413E',
      cancelText: '再想想',
      success(res) {
        if (res.confirm) {
          storage.clearHistory()
          wx.showToast({ title: '已清空', icon: 'none' })
          self.refresh()
        }
      }
    })
  }
})
