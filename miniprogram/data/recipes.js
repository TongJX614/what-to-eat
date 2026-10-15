// 菜谱合并入口：按分类拆分，便于维护；运行时合并为单一 id->recipe map
const cn = require('./recipes/cn.js')
const noodle = require('./recipes/noodle.js')
const snack = require('./recipes/snack.js')
const fast = require('./recipes/fast.js')
const west = require('./recipes/west.js')
const jpk = require('./recipes/jpk.js')
const soup = require('./recipes/soup.js')
const drink = require('./recipes/drink.js')
const light = require('./recipes/light.js')

module.exports = Object.assign({}, cn, noodle, snack, fast, west, jpk, soup, drink, light)
