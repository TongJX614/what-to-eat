App({
  globalData: {
    // 云开发环境 ID：本项目核心功能是纯本地的，留空即可。
    // 要接云开发（如附近餐厅真实数据）时，填你自己的环境 ID。
    envId: '',
    cloudReady: false
  },

  onLaunch() {
    // 没配 envId 就不初始化，避免控制台刷「云开发初始化失败」的噪音
    if (wx.cloud && this.globalData.envId) {
      try {
        wx.cloud.init({
          env: this.globalData.envId,
          traceUser: true
        })
        this.globalData.cloudReady = true
      } catch (e) {
        // 云开发未开通或环境不存在时静默降级，随机选菜功能不依赖云端
        console.warn('[lunch] 云开发初始化失败，已降级为纯本地模式：', e)
      }
    }
  },

  onError(err) {
    console.error('[lunch] 全局错误：', err)
  }
})
