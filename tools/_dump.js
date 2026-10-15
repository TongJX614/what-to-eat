const dishes = require('../miniprogram/data/dishes.js')
const byCat = {}
dishes.forEach(d => {
  byCat[d.category] = byCat[d.category] || []
  byCat[d.category].push(d.id + '	' + d.name)
})
Object.keys(byCat).forEach(cat => {
  console.log('### ' + cat + ' (' + byCat[cat].length + ')')
  byCat[cat].forEach(line => console.log(line))
  console.log('')
})
console.log('TOTAL ' + dishes.length)
