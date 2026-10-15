/**
 * 趣味文案生成器
 * 根据时段 + 分类产出俏皮的推荐语，用于结果页与分享卡片，增强传播性。
 * 纯本地，零依赖。
 */

const randomUtil = require('./random.js')

const SLOT_LABEL = {
  breakfast: '清晨',
  lunch: '午市',
  tea: '午后',
  dinner: '晚市',
  midnight: '夜宵'
}

// 每个时段的俏皮文案池
const LINES = {
  breakfast: [
    '清晨的第一口，值得认真对待。',
    '早饭吃好，一上午没烦恼。',
    '今日宜吃饱，忌空腹搬砖。'
  ],
  lunch: [
    '午市正当时，干饭要趁热。',
    '中午不决，下午崩溃——快定一个。',
    '今日宜吃辣，忌纠结。'
  ],
  tea: [
    '午后有点饿，先垫一口再说。',
    '下午茶时间到，甜咸都行。',
    '今日宜摸鱼，忌饿着肚子。'
  ],
  dinner: [
    '晚市开启，好好犒劳自己。',
    '一天辛苦了，吃顿好的不过分。',
    '今日宜放纵，忌节食。'
  ],
  midnight: [
    '夜宵是勇敢者的专属奖励。',
    '这个点还饿，说明你很自律（大概）。',
    '今日宜宵夜，忌早睡。'
  ]
}

// 「今日宜 X 忌 Y」式短句，用于分享卡
const MOOD = {
  breakfast: { yi: '吃饱', ji: '空腹' },
  lunch: { yi: '干饭', ji: '纠结' },
  tea: { yi: '加餐', ji: '饿着' },
  dinner: { yi: '放纵', ji: '节食' },
  midnight: { yi: '宵夜', ji: '早睡' }
}

function slotOf(date) {
  return randomUtil.timeSlot(date || new Date())
}

/**
 * 随机一句俏皮推荐语
 * @param {Object} opts { slot?, category? }
 */
function line(opts) {
  const o = opts || {}
  const slot = o.slot || slotOf(o.now ? new Date(o.now) : new Date())
  const arr = LINES[slot] || LINES.lunch
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 「今日宜 X 忌 Y」式短句
 */
function mood(opts) {
  const o = opts || {}
  const slot = o.slot || slotOf(o.now ? new Date(o.now) : new Date())
  const m = MOOD[slot] || MOOD.lunch
  return '今日宜' + m.yi + '，忌' + m.ji
}

function slotLabel(slot) {
  return SLOT_LABEL[slot] || ''
}

module.exports = {
  line: line,
  mood: mood,
  slotOf: slotOf,
  slotLabel: slotLabel
}
