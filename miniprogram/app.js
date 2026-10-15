App({
  globalData: {
    // 云开发环境 ID，后续接入附近餐厅与拍照 OCR 时使用
    envId: 'cloudbase-d5g1uaw61be68503c',
    cloudReady: false
  },

  onLaunch() {
    if (wx.cloud) {
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
