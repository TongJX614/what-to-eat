// 自定义 tabBar：Uiverse 00Kubi radio-inputs 风格的小程序改写版。
// 浅灰底容器 + 白底选中块；选中时目标 tab 自身触发 select 缩放回弹 + 上下粒子。
// 无高亮块位移动画（onSwitch 立即 switchTab，新页 attached 时通过 is-replay class
// 给目标 tab 触发一次登场反馈；settle 不重播 = 「切到页面后导航栏不动」）。
// 切页：onSwitch 立即 switchTab（页面不卡），新页面 attached 后通过 replay class 给目标 tab
// 触发一次「登场反馈」缩放+粒子，之后 settle 不再触发（子页返回无动画）。
const REPLAY_MS = 360 // select 动画时长（动画播完前不要移除 is-replay class）

Component({
  data: {
    active: 0,
    visible: true,
    // 给目标 tab 加 is-replay class 触发 select 缩放+粒子动画；-1=无动画
    replay: -1,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '/assets/tabbar/home.png', iconWhite: '/assets/tabbar/home_white.png' },
      { pagePath: '/pages/mydishes/mydishes', text: '我的菜', icon: '/assets/tabbar/dishes.png', iconWhite: '/assets/tabbar/dishes_white.png' },
      { pagePath: '/pages/nearby/nearby', text: '附近餐厅', icon: '/assets/tabbar/nearby.png', iconWhite: '/assets/tabbar/nearby_white.png' }
    ]
  },

  lifetimes: {
    created() {
      // 从本组件所在页面的路由反推自己是第几个 tab，缓存到 this._ownIndex。
      // created 直接改 this.data → 首帧渲染即正确位置（避免 active=0 闪一下）
      const own = this._resolveOwnIndex()
      if (own != null) {
        this._ownIndex = own
        this.data.active = own
      }
    },

    attached() {
      // 兜底校正 + 给目标 tab 触发一次 select 动画（新页登场的合理反馈）。
      // settle 在用户从子页返回时也会再校正（不重播，因为没有 replay）
      const own = this._resolveOwnIndex()
      if (own == null) return
      if (this.data.active !== own) {
        this._ownIndex = own
        this.data.active = own
        this.setData({ active: own })
      }
      // 触发一次 select 缩放回弹 + 粒子（仅 attached 这一次）
      this._playReplay(own)
    },

    detached() {
      if (this._replayTimer) {
        clearTimeout(this._replayTimer)
        this._replayTimer = null
      }
    }
  },

  methods: {
    /* 用所在页面路由反推本实例是第几个 tab，结果缓存到 this._ownIndex */
    _resolveOwnIndex() {
      if (this._ownIndex != null) return this._ownIndex
      try {
        const pages = getCurrentPages()
        const page = pages[pages.length - 1]
        if (!page || !page.route) return null
        const route = '/' + page.route
        const list = this.data.list
        for (let i = 0; i < list.length; i++) {
          if (list[i].pagePath === route) return i
        }
      } catch (e) {}
      return null
    },

    _playReplay(idx) {
      if (this._replayTimer) {
        clearTimeout(this._replayTimer)
        this._replayTimer = null
      }
      const self = this
      this.setData({ replay: idx })
      this._replayTimer = setTimeout(function () {
        self._replayTimer = null
        // active 还在这里，replay=-1 即可去除 is-replay class
        self.setData({ replay: -1 })
      }, REPLAY_MS)
    },

    onSwitch(e) {
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]
      if (!item) return
      // 已经在当前 tab，不响应
      if (index === this.data.active) return
      // 立即切页（页面不卡），新页面的 attached 会触发 select 动画
      wx.switchTab({ url: item.pagePath })
    },

    /* 页面 onShow 调用：把高亮钉在本页序号上（瞬时校正，不重播动画）。
       页面硬编码的 ownIndex 最可靠，优先使用；_resolveOwnIndex 仅作兜底。
       子页返回时不再触发 select 动画（不调 _playReplay）—— 用户原则是
       「切到页面后导航栏不要动了」，这里是 settle 的 no-replay 行为。 */
    settle(ownIndex) {
      let target = (typeof ownIndex === 'number') ? ownIndex : this._resolveOwnIndex()
      if (target == null) target = this.data.active
      // 已在正确位置：什么都不做（导航栏不动）
      if (this.data.active === target) return
      this.setData({ active: target })
    }
  }
})