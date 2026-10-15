/**
 * 首页随机问候语工具
 *
 * 用户 2026-09-05 提案：首页"今天吃什么"按本地时间分时段显示不同问候，
 * 文案也是随机的——参考「今日宜夜宵忌早睡」那种活泼句式。
 * 让首页更有温度，而不是冷冰冰的固定标题。
 *
 * 时段切分（按 Date#getHours()）：
 *   0-4  : deepNight  深夜
 *   5-9  : morning    早上
 *   10-13: noon       中午
 *   14-17: afternoon  下午茶
 *   18-21: evening    晚餐
 *   22-23: lateNight  夜宵
 */

const GREETINGS = {
  deepNight: [
    '夜深人静，肚子咕咕叫？',
    '这会儿还饿？心疼自己一秒',
    '深夜食堂为你亮灯中',
    '睡前小饿，来口温和的？'
  ],
  morning: [
    '早安，元气满满的早餐吃啥？',
    '早上好，给胃一个温柔的起床气',
    '清晨第一顿，按心情选吧',
    '早，想好今天第一口了吗？',
    '早起的胃，先从热乎的开始'
  ],
  noon: [
    '中午好，犒劳一下努力半天的自己',
    '午饭时间，热腾腾的来一份？',
    '中午了，吃点好的吧',
    '饭点已到，拒绝对付',
    '今日宜午饭，忌将就'
  ],
  afternoon: [
    '下午茶时间到',
    '三点三，奶茶还是甜的？',
    '下午了，来点下午茶歇歇',
    '午后三点的快乐是甜品给的',
    '今日宜小甜水，忌续命式咖啡'
  ],
  evening: [
    '晚上好，今晚想吃啥？',
    '下班啦，吃顿好的犒劳自己',
    '晚餐时间，今天累了吧',
    '今晚的小确幸从一道菜开始',
    '今日宜晚饭，忌减肥'
  ],
  lateNight: [
    '夜宵来一份？',
    '今日宜夜宵，忌早睡',
    '夜未眠，来口热的吧',
    '夜宵时刻，别太油哦',
    '深夜美食局，开门'
  ]
}

function bucketByHour(h) {
  if (h < 5) return 'deepNight'
  if (h < 10) return 'morning'
  if (h < 14) return 'noon'
  if (h < 18) return 'afternoon'
  if (h < 22) return 'evening'
  return 'lateNight'
}

/**
 * 取一条该时段的随机问候语
 * @param {Date} [date] 可选，不传则用 new Date()
 * @returns {string}
 */
function pick(date) {
  const d = date || new Date()
  const list = GREETINGS[bucketByHour(d.getHours())]
  return list[Math.floor(Math.random() * list.length)]
}

module.exports = { pick, bucketByHour }
