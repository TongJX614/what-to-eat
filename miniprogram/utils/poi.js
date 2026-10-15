// 附近餐厅数据源
// provider 可切换：mock（内置演示数据）/ tencent（腾讯位置服务 WebServiceAPI）
//
// 切到真实数据的步骤：
//   1. 去 https://lbs.qq.com 注册开发者并创建应用
//   2. 添加 Key，勾选「WebServiceAPI」（域名白名单留空）
//   3. 把下面 CONFIG.key 填好，并把 CONFIG.provider 改成 'tencent'
//   4. 小程序后台「开发管理 -> 开发设置 -> 服务器域名」里，
//      把 https://apis.map.qq.com 加进 request 合法域名
//
// 对外统一返回形状（两个 provider 一致）：
//   { id, title, category, address, district, lat, lng, distance }
// distance 单位：米

// 安全约定：Key 属于私有凭据，不得硬编码进版本库。
// 本地开发时把下面 key 填成你自己的，提交前务必清空回 ''。
var CONFIG = {
  provider: 'mock', // 'mock' | 'tencent'
  key: '' // 腾讯位置服务 Key（WebServiceAPI），本地填自用，勿提交
}

// ---------- 工具 ----------

var EARTH_R = 6371000

function rad(d) {
  return d * Math.PI / 180
}

// 两点球面距离（米）
function distanceOf(lat1, lng1, lat2, lng2) {
  var dLat = rad(lat2 - lat1)
  var dLng = rad(lng2 - lng1)
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return Math.round(2 * EARTH_R * Math.asin(Math.sqrt(a)))
}

// 从中心点按「距离 + 方位角」偏移出一个新坐标
function offsetPoint(lat, lng, dist, bearingDeg) {
  var brg = rad(bearingDeg)
  var dLat = (dist * Math.cos(brg)) / 111320
  var dLng = (dist * Math.sin(brg)) / (111320 * Math.cos(rad(lat)))
  return { lat: lat + dLat, lng: lng + dLng }
}

// ---------- mock ----------

var MOCK_POOL = [
  { title: '川小馆', category: '美食:中餐厅:川菜', address: '玉林南路 18 号', openHours: '11:00-21:30', nightOpen: false },
  { title: '老碗面', category: '美食:中餐厅:面食', address: '青羊正街 42 号', openHours: '07:00-20:30', nightOpen: false },
  { title: '牛巷口火锅', category: '美食:中餐厅:火锅', address: '建设路 5 号附 3', openHours: '11:00-02:00', nightOpen: true },
  { title: '粤香茶餐厅', category: '美食:中餐厅:粤菜', address: '天河支路 7 号', openHours: '10:00-22:00', nightOpen: false },
  { title: '沙县小吃', category: '美食:快餐', address: '科华北路 66 号', openHours: '06:30-22:00', nightOpen: false },
  { title: '老乡鸡', category: '美食:快餐', address: '人民南路四段 12 号', openHours: '06:30-21:30', nightOpen: false },
  { title: '兰州牛肉拉面', category: '美食:中餐厅:面食', address: '武侯祠大街 88 号', openHours: '07:00-21:00', nightOpen: false },
  { title: '巷子烤肉', category: '美食:烧烤', address: '望平街 25 号', openHours: '17:00-02:00', nightOpen: true },
  { title: '一膳日料', category: '美食:日韩料理', address: '春熙路商圈 B1', openHours: '11:30-22:00', nightOpen: false },
  { title: '首尔炸鸡', category: '美食:日韩料理', address: '太古里 3 层', openHours: '11:00-02:00', nightOpen: true },
  { title: '意面小屋', category: '美食:西餐', address: '锦江区红星路 9 号', openHours: '11:00-22:00', nightOpen: false },
  { title: '轻食研究所', category: '美食:轻食', address: '天府三街 199 号', openHours: '10:00-21:00', nightOpen: false },
  { title: '甜时光烘焙', category: '美食:甜品', address: '玉林西路 2 号', openHours: '08:00-22:30', nightOpen: false },
  { title: '晨光豆浆油条', category: '美食:早餐', address: '青羊小区东门', openHours: '05:30-13:00', nightOpen: false },
  { title: '麻辣烫小铺', category: '美食:小吃', address: '建设巷 11 号', openHours: '11:00-01:00', nightOpen: true },
  { title: '素心斋', category: '美食:素食', address: '文殊院街 30 号', openHours: '11:00-20:30', nightOpen: false }
]

/* 菜品 → 店铺品类关键词：mock 数据没有真实店铺名，只能按品类匹配。
   真实数据（腾讯）直接拿菜名去搜，效果更准，不走这里。 */
var KEYWORD_ALIAS = {
  '面': '面食', '拉面': '面食', '拌面': '面食', '粉': '面食',
  '火锅': '火锅', '冒菜': '火锅', '串串': '火锅',
  '快餐': '快餐', '盖饭': '快餐', '便当': '快餐',
  '小吃': '小吃', '麻辣烫': '小吃',
  '日料': '日韩料理', '寿司': '日韩料理', '韩': '日韩料理', '烤肉': '烧烤',
  '西餐': '西餐', '意面': '西餐', '披萨': '西餐', '牛排': '西餐',
  '轻食': '轻食', '沙拉': '轻食',
  '素': '素食', '粥': '早餐', '包': '早餐', '油条': '早餐', '豆浆': '早餐',
  '甜': '甜品', '蛋糕': '甜品', '茶': '甜品', '咖啡': '甜品',
  '烧烤': '烧烤', '串': '烧烤',
  '中餐': '中餐厅', '川': '川菜', '粤': '粤菜', '汤': '中餐厅'
}

/* 菜名 → mock 池能理解的品类词；命中不了返回 ''（调用方回退到全量） */
function aliasOf(keyword) {
  var kw = String(keyword || '').trim()
  if (!kw) return ''
  var keys = Object.keys(KEYWORD_ALIAS)
  // 长词优先，避免「牛肉面」里的「肉」先命中
  keys.sort(function (a, b) { return b.length - a.length })
  for (var i = 0; i < keys.length; i++) {
    if (kw.indexOf(keys[i]) > -1) return KEYWORD_ALIAS[keys[i]]
  }
  // 分类本身就是品类词的情况（如「面食」「快餐」）
  for (var j = 0; j < keys.length; j++) {
    if (KEYWORD_ALIAS[keys[j]].indexOf(kw) > -1) return KEYWORD_ALIAS[keys[j]]
  }
  return ''
}

function mockSearch(loc, radius, keyword) {
  var target = aliasOf(keyword)
  var pool = MOCK_POOL
  if (target) {
    var hit = MOCK_POOL.filter(function (p) {
      return p.category.indexOf(target) > -1 || p.title.indexOf(target) > -1
    })
    // 命中为空时回退到全量：给用户看附近有什么，总比空白好
    if (hit.length) pool = hit
  }
  var list = pool.map(function (p, i) {
    // 黄金角散布方位，距离按索引错开，保证每次结果稳定且分布均匀。
    // 演示数据把铺开范围封顶在 700m：真实半径调到 2km 后，mock 若跟着铺满 2km，
    // 初始视野里就剩几个点，演示效果反而更差。
    var spread = Math.min(radius, 700)
    var bearing = (i * 137.5) % 360
    var dist = 60 + ((i * 173) % Math.max(1, Math.floor(spread - 60)))
    var pt = offsetPoint(loc.latitude, loc.longitude, dist, bearing)
    return {
      id: 'mock_' + i,
      title: p.title,
      category: p.category,
      address: p.address,
      district: '',
      lat: pt.lat,
      lng: pt.lng,
      distance: distanceOf(loc.latitude, loc.longitude, pt.lat, pt.lng),
      openHours: p.openHours || '',
      nightOpen: !!p.nightOpen
    }
  })

  list.sort(function (a, b) { return a.distance - b.distance })
  return Promise.resolve(list)
}

// ---------- tencent ----------

function normalizeTencent(item) {
  var l = item.location || {}
  var ad = item.ad_info || {}
  return {
    id: item.id || '',
    title: item.title || '',
    category: item.category || '',
    address: item.address || '',
    district: ad.district || '',
    lat: l.lat,
    lng: l.lng,
    distance: item._distance ? Math.round(item._distance) : 0,
    openHours: (item.business_hours && item.business_hours.length) ? item.business_hours[0] : '',
    nightOpen: !!item.business_hours && /2[0-9]:00|0[0-9]:00/.test(JSON.stringify(item.business_hours || []))
  }
}

function tencentSearch(loc, radius, keyword) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: 'https://apis.map.qq.com/ws/place/v1/search',
      data: {
        boundary: 'nearby(' + loc.latitude + ',' + loc.longitude + ',' + radius + ')',
        keyword: keyword || '餐厅',
        orderby: '_distance',
        page_size: 20,
        key: CONFIG.key
      },
      success: function (res) {
        var d = res.data || {}
        if (d.status !== 0) {
          reject(new Error(d.message || 'POI 查询失败'))
          return
        }
        resolve((d.data || []).map(normalizeTencent))
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '网络请求失败'))
      }
    })
  })
}

// ---------- 对外 ----------

/**
 * 查询附近餐厅
 * @param {Object} loc     { latitude, longitude }，坐标系 gcj02
 * @param {Object} options { radius = 1000, keyword = '餐厅' }
 * @returns {Promise<Array>}
 */
function getNearby(loc, options) {
  var opts = options || {}
  var radius = opts.radius || 1000
  var keyword = opts.keyword || '餐厅'

  if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
    return Promise.reject(new Error('缺少定位坐标'))
  }
  if (CONFIG.provider === 'tencent') {
    if (!CONFIG.key) return Promise.reject(new Error('未配置腾讯位置服务 Key'))
    // 菜名可能召回不到店铺（店名里未必有这道菜）：空结果时回退到「餐厅」再搜一次，
    // 保证「附近哪家吃」不会给出空白页
    return tencentSearch(loc, radius, keyword).then(function (list) {
      if (list.length || !keyword || keyword === '餐厅') return list
      return tencentSearch(loc, radius, '餐厅')
    })
  }
  return mockSearch(loc, radius)
}

// 品类字符串「美食:中餐厅:川菜」-> 「川菜」，取最后一段
function shortCategory(category) {
  if (!category) return ''
  var parts = String(category).split(':')
  return parts[parts.length - 1]
}

// 距离友好展示：800 米以内用米，以上用公里
function formatDistance(distance) {
  var d = Number(distance) || 0
  if (d < 1000) return d + 'm'
  return (d / 1000).toFixed(1) + 'km'
}

/* 判断 openHours 字符串（如 "11:00-22:00"）是否覆盖当前时间。
   跨夜的（如 "17:00-02:00"）单独处理：从起点到 24:00 + 从 0:00 到终点。
   无营业时间或解析失败返回 false。 */
function parseHourMin(str) {
  var m = String(str || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function isOpenNow(openHours, now) {
  if (!openHours) return false
  var seg = String(openHours).split('-')
  if (seg.length !== 2) return false
  var start = parseHourMin(seg[0])
  var end = parseHourMin(seg[1])
  if (start === null || end === null) return false
  var d = now || new Date()
  var cur = d.getHours() * 60 + d.getMinutes()
  if (end > start) return cur >= start && cur <= end
  // 跨夜：start..24:00 + 0..end
  return cur >= start || cur <= end
}

module.exports = {
  getNearby: getNearby,
  aliasOf: aliasOf,
  shortCategory: shortCategory,
  formatDistance: formatDistance,
  distanceOf: distanceOf,
  isOpenNow: isOpenNow,
  isMock: function () { return CONFIG.provider !== 'tencent' },
  getProvider: function () { return CONFIG.provider }
}
