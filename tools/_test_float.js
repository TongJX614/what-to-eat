/* 临时：验证首页漂浮小球物理不会飞出或重叠 */
const HERO = 440
const BIG_R = 150
const BALL_R = 48
const center = HERO / 2
const margin = 6
const safeR = BIG_R + BALL_R + margin + 4

function scatter(n) {
  const planets = Array.from({ length: n }, () => ({ r: BALL_R, x: center, y: center, vx: 0, vy: 0 }))
  const minGap = BALL_R * 2 + margin + 8
  let attempts = 0
  for (let i = 0; i < n; i++) {
    let placed = false
    while (!placed && attempts < 5000) {
      attempts++
      const x = BALL_R + margin + Math.random() * (HERO - 2 * BALL_R - 2 * margin)
      const y = BALL_R + margin + Math.random() * (HERO - 2 * BALL_R - 2 * margin)
      const dx = x - center
      const dy = y - center
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < safeR) continue
      let ok = true
      for (let j = 0; j < i; j++) {
        const dx = x - planets[j].x
        const dy = y - planets[j].y
        if (Math.sqrt(dx * dx + dy * dy) < minGap) { ok = false; break }
      }
      if (ok) { planets[i].x = x; planets[i].y = y; placed = true }
    }
    if (!placed) {
      const slot = i % 4
      const base = Math.PI / 4 + slot * (Math.PI / 2)
      const angle = base + (Math.random() - 0.5) * 0.3
      const dist = safeR + 18 + Math.random() * 28
      let x = center + Math.cos(angle) * dist
      let y = center + Math.sin(angle) * dist
      x = Math.max(BALL_R + margin, Math.min(HERO - BALL_R - margin, x))
      y = Math.max(BALL_R + margin, Math.min(HERO - BALL_R - margin, y))
      const dx = x - center
      const dy = y - center
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      if (d < safeR) {
        const nx = dx / d, ny = dy / d
        x = center + nx * safeR
        y = center + ny * safeR
        x = Math.max(BALL_R + margin, Math.min(HERO - BALL_R - margin, x))
        y = Math.max(BALL_R + margin, Math.min(HERO - BALL_R - margin, y))
      }
      planets[i].x = x
      planets[i].y = y
    }
  }
  for (let i = 0; i < n; i++) {
    const p = planets[i]
    const dx = p.x - center
    const dy = p.y - center
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const tangentX = -dy / dist
    const tangentY = dx / dist
    const speed = 0.32 + Math.random() * 0.42
    p.vx = tangentX * speed
    p.vy = tangentY * speed
  }
  return planets
}

function tick(planets) {
  const maxSpeed = 1.05
  const damp = 0.996
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i]
    p.x += p.vx
    p.y += p.vy
    if (Math.random() < 0.05) {
      p.vx += (Math.random() - 0.5) * 0.16
      p.vy += (Math.random() - 0.5) * 0.16
    }
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
    if (sp > maxSpeed) { p.vx = (p.vx / sp) * maxSpeed; p.vy = (p.vy / sp) * maxSpeed }
    if (p.x < p.r + margin) { p.x = p.r + margin; p.vx = Math.abs(p.vx) * 0.85 + 0.08 }
    if (p.x > HERO - p.r - margin) { p.x = HERO - p.r - margin; p.vx = -Math.abs(p.vx) * 0.85 - 0.08 }
    if (p.y < p.r + margin) { p.y = p.r + margin; p.vy = Math.abs(p.vy) * 0.85 + 0.08 }
    if (p.y > HERO - p.r - margin) { p.y = HERO - p.r - margin; p.vy = -Math.abs(p.vy) * 0.85 - 0.08 }
  }
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i]
    const dx = p.x - center
    const dy = p.y - center
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const minDist = BIG_R + p.r + margin
    if (dist < minDist) {
      const nx = dx / dist, ny = dy / dist
      p.x = center + nx * minDist
      p.y = center + ny * minDist
      const vdotn = p.vx * nx + p.vy * ny
      p.vx -= 2 * vdotn * nx
      p.vy -= 2 * vdotn * ny
      p.vx += nx * 0.28
      p.vy += ny * 0.28
    }
  }
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i], b = planets[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const minDist = a.r + b.r + margin
      if (dist < minDist) {
        const nx = dx / dist, ny = dy / dist
        const overlap = minDist - dist
        a.x -= nx * overlap * 0.5
        a.y -= ny * overlap * 0.5
        b.x += nx * overlap * 0.5
        b.y += ny * overlap * 0.5
        const vrelDot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        a.vx -= vrelDot * nx * 0.9
        a.vy -= vrelDot * ny * 0.9
        b.vx += vrelDot * nx * 0.9
        b.vy += vrelDot * ny * 0.9
      }
    }
  }
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i]
    p.vx *= damp
    p.vy *= damp
  }
}

function check(planets, label) {
  let bad = []
  for (const p of planets) {
    if (p.x - p.r < -0.5 || p.x + p.r > HERO + 0.5 || p.y - p.r < -0.5 || p.y + p.r > HERO + 0.5) bad.push('out')
    const d = Math.sqrt((p.x - center) ** 2 + (p.y - center) ** 2)
    if (d < BIG_R + p.r + margin - 0.5) bad.push('big')
    if (Math.sqrt(p.vx ** 2 + p.vy ** 2) > 1.3) bad.push('fast')
  }
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i], b = planets[j]
      if (Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) < a.r + b.r + margin - 0.5) bad.push('overlap')
    }
  }
  if (bad.length) console.log(label, bad)
  return bad.length === 0
}

let allOk = true
for (let run = 0; run < 50; run++) {
  const planets = scatter(4)
  if (!check(planets, 'init')) allOk = false
  for (let t = 0; t < 1000; t++) {
    tick(planets)
    if (!check(planets, `run${run} tick${t}`)) { allOk = false; break }
  }
}
console.log(allOk ? 'FLOAT_PHYSICS_OK' : 'FLOAT_PHYSICS_FAIL')
process.exit(allOk ? 0 : 1)
