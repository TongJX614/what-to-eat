/**
 * 分享卡片绘制（Canvas 2D）· 安静的奢华 · 暖食风
 * 只负责往 ctx 上画，节点获取与导出由调用方处理。
 *
 * 设计思路：
 * - 不用大色块压顶，改为奶油底 + 悬浮白纸卡，靠留白和细节体现精致
 * - 金色发丝线 + 手动字距（Canvas 2D 的 letterSpacing 兼容性差，用逐字绘制实现）
 * - 层级靠字号与灰度拉开，全卡只有一个暖橙重点色
 */

const W = 300
const H = 430

const COLOR = {
  bg: '#F6F0E8',
  card: '#FFFFFF',
  cardSoft: '#FCF8F2',
  primary: '#DD7A3C',
  primaryDeep: '#BE5E27',
  primaryTint: '#FBF1E6',
  gold: '#C9A24B',
  text: '#3A2E26',
  text2: '#6E5C4F',
  sub: '#8A7565',
  weak: '#B5A292',
  line: '#ECE1D4'
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** 逐字绘制以实现字距，返回总宽度 */
function fillTextSpaced(ctx, text, x, y, spacing) {
  const chars = Array.from(String(text || ''))
  let cx = x
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y)
    cx += ctx.measureText(chars[i]).width + spacing
  }
  return cx - x - spacing
}

function measureSpaced(ctx, text, spacing) {
  const chars = Array.from(String(text || ''))
  let w = 0
  for (let i = 0; i < chars.length; i++) {
    w += ctx.measureText(chars[i]).width + spacing
  }
  return w - spacing
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const chars = Array.from(String(text || ''))
  const out = []
  let line = ''
  let truncated = false
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      if (out.length === maxLines - 1) {
        let t = line
        while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
          t = t.slice(0, -1)
        }
        out.push(t + '…')
        truncated = true
        break
      }
      out.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (!truncated && line) out.push(line)
  return out
}

function formatDate(ts) {
  const d = ts ? new Date(ts) : new Date()
  const pad = function (n) {
    return n < 10 ? '0' + n : String(n)
  }
  return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate())
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data { name, category, desc, reason, ts }
 */
function draw(ctx, data) {
  const d = data || {}
  const name = d.name || '今天吃什么'
  const category = d.category || '推荐'

  ctx.clearRect(0, 0, W, H)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  /* ---------- 奶油底 ---------- */
  ctx.fillStyle = COLOR.bg
  ctx.fillRect(0, 0, W, H)

  /* 极淡的暖色晕，制造纸张厚度感（不抢主体） */
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = COLOR.primaryTint
  ctx.beginPath()
  ctx.arc(W - 30, 46, 96, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  /* ---------- 悬浮白纸卡 ---------- */
  const cardX = 22
  const cardY = 26
  const cardW = W - 44
  const cardH = H - 96
  ctx.save()
  ctx.shadowColor = 'rgba(58, 46, 38, 0.13)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 10
  ctx.fillStyle = COLOR.card
  roundRect(ctx, cardX, cardY, cardW, cardH, 20)
  ctx.fill()
  ctx.restore()

  const inX = cardX + 26
  const inW = cardW - 52

  /* ---------- 卡头：金线 + 小标 + 日期 ---------- */
  let y = cardY + 34

  ctx.fillStyle = COLOR.gold
  roundRect(ctx, inX, y - 5, 22, 2, 1)
  ctx.fill()

  ctx.font = '10px sans-serif'
  ctx.fillStyle = COLOR.weak
  fillTextSpaced(ctx, '今日之选', inX + 32, y, 2.4)

  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR.weak
  ctx.font = '10px sans-serif'
  ctx.fillText(formatDate(d.ts), inX + inW, y)
  ctx.textAlign = 'left'

  /* ---------- 分类小标（无底色，靠字距和灰度） ---------- */
  y += 34
  ctx.font = '11px sans-serif'
  ctx.fillStyle = COLOR.primaryDeep
  const catW = measureSpaced(ctx, category, 2)
  ctx.fillStyle = COLOR.primaryTint
  roundRect(ctx, inX, y - 13, catW + 22, 22, 11)
  ctx.fill()
  ctx.fillStyle = COLOR.primaryDeep
  fillTextSpaced(ctx, category, inX + 11, y + 1, 2)

  /* ---------- 菜名（主视觉） ---------- */
  y += 46
  ctx.fillStyle = COLOR.text
  ctx.font = '500 28px sans-serif'
  const nameLines = wrapText(ctx, name, inW, 2)
  nameLines.forEach(function (line, i) {
    ctx.fillText(line, inX, y + i * 38)
  })
  y += (nameLines.length - 1) * 38 + 26

  /* ---------- 趣味文案 ---------- */
  if (d.fun) {
    ctx.font = 'italic 11px sans-serif'
    ctx.fillStyle = COLOR.primaryDeep
    const funLines = wrapText(ctx, d.fun, inW, 2)
    funLines.forEach(function (line, i) {
      ctx.fillText(line, inX, y + i * 18)
    })
    y += funLines.length * 18 + 6
  }

  /* ---------- 描述 ---------- */
  if (d.desc) {
    ctx.font = '12.5px sans-serif'
    ctx.fillStyle = COLOR.sub
    const descLines = wrapText(ctx, d.desc, inW, 2)
    descLines.forEach(function (line, i) {
      ctx.fillText(line, inX, y + i * 21)
    })
    y += descLines.length * 21 + 12
  }

  /* ---------- 推荐理由：浅底块 + 金色竖线 ---------- */
  if (d.reason) {
    ctx.font = '12.5px sans-serif'
    const reasonLines = wrapText(ctx, d.reason, inW - 22, 3)
    const blockH = reasonLines.length * 20 + 24
    const maxBottom = cardY + cardH - 20
    if (y + blockH <= maxBottom) {
      ctx.fillStyle = COLOR.cardSoft
      roundRect(ctx, inX, y, inW, blockH, 10)
      ctx.fill()

      ctx.fillStyle = COLOR.gold
      roundRect(ctx, inX + 12, y + 14, 2, blockH - 28, 1)
      ctx.fill()

      ctx.fillStyle = COLOR.text2
      reasonLines.forEach(function (line, i) {
        ctx.fillText(line, inX + 24, y + 26 + i * 20)
      })
    }
  }

  /* ---------- 卡外底部品牌区 ---------- */
  const footY = cardY + cardH + 30

  ctx.strokeStyle = COLOR.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 46, footY - 12)
  ctx.lineTo(W / 2 - 14, footY - 12)
  ctx.moveTo(W / 2 + 14, footY - 12)
  ctx.lineTo(W / 2 + 46, footY - 12)
  ctx.stroke()

  ctx.fillStyle = COLOR.gold
  ctx.beginPath()
  ctx.arc(W / 2, footY - 12, 2.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR.text
  ctx.font = '500 13px sans-serif'
  ctx.fillText('午饭选择困难症', W / 2, footY + 10)

  /* 逐字绘制必须回到 left 对齐，否则每个字会各自居中 */
  ctx.textAlign = 'left'
  ctx.fillStyle = COLOR.weak
  ctx.font = '10px sans-serif'
  const sloganW = measureSpaced(ctx, '帮你做决定 不再纠结', 2.2)
  fillTextSpaced(ctx, '帮你做决定 不再纠结', W / 2 - sloganW / 2, footY + 28, 2.2)

  return { width: W, height: H }
}

/**
 * 月度味觉报告卡：把「这个月吃了什么」画成一张可分享的卡片。
 * 视觉语言与单菜卡片一致（奶油底 + 悬浮白卡 + 金色发丝线 + 单一暖橙重点）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} data { monthLabel, count, ratedCount, goodCount, days,
 *                        topDish, topCat, loved[], hated[], ts }
 */
function drawMonthly(ctx, data) {
  const d = data || {}
  const FONT = '-apple-system, "PingFang SC", "Helvetica Neue", sans-serif'

  ctx.clearRect(0, 0, W, H)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  /* ---------- 奶油底 + 暖色晕 ---------- */
  ctx.fillStyle = COLOR.bg
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = COLOR.primaryTint
  ctx.beginPath()
  ctx.arc(W - 30, 46, 96, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  /* ---------- 悬浮白卡 ---------- */
  const cardX = 22
  const cardY = 26
  const cardW = W - 44
  const cardH = H - 96
  ctx.save()
  ctx.shadowColor = 'rgba(74, 52, 32, 0.16)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 6
  ctx.fillStyle = COLOR.card
  roundRect(ctx, cardX, cardY, cardW, cardH, 16)
  ctx.fill()
  ctx.restore()

  const px = cardX + 26
  const maxW = cardW - 52
  let py = cardY + 48

  /* 小标签 + 标题 */
  ctx.fillStyle = COLOR.gold
  ctx.font = '600 10px ' + FONT
  fillTextSpaced(ctx, 'MONTHLY TASTE', px, py, 2.4)
  py += 30

  ctx.fillStyle = COLOR.text
  ctx.font = '600 24px ' + FONT
  fillTextSpaced(ctx, (d.monthLabel || '') + '味觉报告', px, py, 1.5)
  py += 28

  /* 大数字：本月决定次数 */
  const countText = String(d.count || 0)
  ctx.fillStyle = COLOR.primaryDeep
  ctx.font = '700 44px ' + FONT
  ctx.fillText(countText, px, py + 32)
  const numW = ctx.measureText(countText).width
  ctx.fillStyle = COLOR.text2
  ctx.font = '400 13px ' + FONT
  ctx.fillText('次决定', px + numW + 8, py + 32)
  py += 58

  /* 副统计一行 */
  ctx.fillStyle = COLOR.sub
  ctx.font = '400 12px ' + FONT
  ctx.fillText(
    '打卡 ' + (d.ratedCount || 0) + ' 次 · 好吃 ' + (d.goodCount || 0) +
    ' 次 · 覆盖 ' + (d.days || 0) + ' 天',
    px, py
  )
  py += 24

  /* 金色发丝线 */
  ctx.fillStyle = COLOR.line
  ctx.fillRect(px, py, maxW, 1)
  py += 30

  /* 最常吃的一道 */
  ctx.fillStyle = COLOR.weak
  ctx.font = '400 11px ' + FONT
  fillTextSpaced(ctx, '本月最常吃', px, py, 1.5)
  py += 24
  ctx.fillStyle = COLOR.text
  ctx.font = '600 19px ' + FONT
  let line = wrapText(ctx, d.topDish || '还没攒够数据', maxW, 1)
  ctx.fillText(line[0] || '', px, py)
  py += 22
  ctx.fillStyle = COLOR.sub
  ctx.font = '400 12px ' + FONT
  ctx.fillText('最常分类 · ' + (d.topCat || '—'), px, py)
  py += 30

  /* 偏爱的口味：胶囊标签，最多 3 个 */
  ctx.fillStyle = COLOR.weak
  ctx.font = '400 11px ' + FONT
  fillTextSpaced(ctx, '偏爱的口味', px, py, 1.5)
  py += 10

  const loved = d.loved || []
  if (loved.length) {
    let tx = px
    for (let i = 0; i < loved.length && i < 3; i++) {
      ctx.font = '400 12px ' + FONT
      const tw = ctx.measureText(loved[i]).width
      const pw = tw + 22
      if (tx + pw > cardX + cardW - 26) break
      ctx.fillStyle = COLOR.primaryTint
      roundRect(ctx, tx, py, pw, 24, 12)
      ctx.fill()
      ctx.fillStyle = COLOR.primaryDeep
      ctx.textBaseline = 'middle'
      ctx.fillText(loved[i], tx + 11, py + 13)
      ctx.textBaseline = 'alphabetic'
      tx += pw + 8
    }
  } else {
    ctx.fillStyle = COLOR.weak
    ctx.font = '400 12px ' + FONT
    ctx.fillText('多打几次卡，它就知道你爱吃什么了', px, py + 16)
  }
  py += 34

  /* 想避开的（有才画） */
  const hated = d.hated || []
  if (hated.length) {
    ctx.fillStyle = COLOR.weak
    ctx.font = '400 11px ' + FONT
    fillTextSpaced(ctx, '想避开', px, py, 1.5)
    py += 20
    ctx.fillStyle = COLOR.sub
    ctx.font = '400 12px ' + FONT
    ctx.fillText(hated.slice(0, 3).join(' · '), px, py)
  }

  /* 落款 */
  ctx.fillStyle = COLOR.weak
  ctx.font = '400 10px ' + FONT
  ctx.textAlign = 'center'
  ctx.fillText(formatDate(d.ts) + ' · 挑饭小助手', W / 2, H - 34)
  ctx.textAlign = 'left'
}

module.exports = {
  draw: draw,
  drawMonthly: drawMonthly,
  WIDTH: W,
  HEIGHT: H
}
