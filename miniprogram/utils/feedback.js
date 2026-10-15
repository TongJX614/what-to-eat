/**
 * 反馈层：震动 + 轻音效
 * - 微信基础库保证 vibrateShort 在大多数机型可用，这里统一包一层 try/catch。
 * - 音效文件需后续放到 /assets/audio/ 下；文件缺失或用户关闭时静默降级，绝不报错。
 */

// 音效资源目录（缺文件时 createInnerAudioContext 会触发 onError，已被吞掉）
var TONE_DECIDE = '/assets/audio/decide.mp3'
var TONE_TICK = '/assets/audio/tick.mp3'

function vibrate(type) {
  try {
    wx.vibrateShort({ type: type || 'light', fail: function () {} })
  } catch (e) {
    // 极少数基础库不支持带 type 参数，退化到无参调用
    try { wx.vibrateShort() } catch (e2) {}
  }
}

function play(src) {
  if (!src) return
  try {
    var a = wx.createInnerAudioContext()
    a.src = src
    a.onError(function () { /* 资源缺失，静默降级 */ })
    a.play()
  } catch (e) {}
}

// 决定时刻：中震动 + 轻音效（受 sound 开关控制）
function onDecide(soundOn) {
  vibrate('medium')
  if (soundOn) play(TONE_DECIDE)
}

// 随机定格：重震动，制造仪式感
function onRollSettle() {
  vibrate('heavy')
}

// 滚动中的轻 tick（可选，受 sound 开关控制，默认不启用以免打扰）
function onTick(soundOn) {
  if (soundOn) play(TONE_TICK)
}

module.exports = {
  vibrate: vibrate,
  play: play,
  onDecide: onDecide,
  onRollSettle: onRollSettle,
  onTick: onTick
}
