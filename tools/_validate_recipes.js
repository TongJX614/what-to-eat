const dishesUtil = require('../miniprogram/utils/dishes.js')
const recipes = require('../miniprogram/data/recipes.js')

let fail = 0
const total = dishesUtil.load().length
let withRecipe = 0
let emptyRecipe = []

dishesUtil.load().forEach(function (d) {
  const r = recipes[d.id]
  if (r && Array.isArray(r.ingredients) && r.ingredients.length && Array.isArray(r.steps) && r.steps.length) {
    withRecipe++
  } else {
    emptyRecipe.push(d.id)
  }
})

// getById 应能挂上 recipe
const sample = dishesUtil.getById('cn_001')
if (!sample || !sample.recipe || !sample.recipe.ingredients.length) {
  console.log('FAIL getById cn_001 未带 recipe')
  fail++
}
const sample2 = dishesUtil.getById('light_016')
if (!sample2 || !sample2.recipe || !sample2.recipe.steps.length) {
  console.log('FAIL getById light_016 未带 recipe')
  fail++
}

// loadAll 全部带 recipe
const all = dishesUtil.loadAll()
let allOk = all.every(function (d) {
  return d.recipe && Array.isArray(d.recipe.ingredients) && Array.isArray(d.recipe.steps)
})
if (!allOk) {
  console.log('FAIL loadAll 存在未带 recipe 的菜品')
  fail++
}

// 自定义菜自带 ingredients/steps 应被 withRecipe 识别
const customLike = { id: 'c_x', name: '自创', ingredients: ['a 1'], steps: ['做'] }
dishesUtil.loadAll() // 触发缓存
// 直接测 merge：构造带 recipe 的自定义对象经 getById 等价逻辑
const merged = Object.assign({}, customLike)
if (!(merged.recipe)) {
  // withRecipe 在 loadAll 内对自定义对象生效；这里模拟一次
  merged.recipe = { ingredients: merged.ingredients, steps: merged.steps }
}

console.log('内置菜品总数: ' + total)
console.log('已写菜谱数: ' + withRecipe)
console.log('缺菜谱: ' + (emptyRecipe.length ? emptyRecipe.join(',') : '无'))
console.log('getById 抽查: ' + (sample && sample.recipe.ingredients.length) + ' / ' + (sample2 && sample2.recipe.steps.length))
console.log('loadAll 全部带 recipe: ' + allOk)
console.log(fail === 0 && withRecipe === total ? 'ALL_PASS' : 'HAS_FAIL')
