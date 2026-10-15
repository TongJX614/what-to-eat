# 设计收敛 · 改后说明

基于 `design-review.md` 的 10 项问题（P0×3 / P1×3 / P2×4），除「首页长驻动画 + 小球 rAF 物理」按用户要求保留外，其余全部落地。**未改动任何业务逻辑，纯设计/样式层收敛。**

## 令牌地基（app.wxss）
新增并全局可用：
- 主色阶 `--c-primary-l1~l4`（大按钮/强调面，原散落写死）
- 新拟态面 `--c-neu-a/b`、`--shadow-neu`（左上白影提亮到纯白，米底上不再显脏）
- 漂浮球 `--c-planet-*`、遮罩 `--c-mask*`、玻璃高光 `--c-glass-*`
- **字号 type scale** `--fs-xs~mega` 共 9 级，全站只允许用这 9 级
- 阴影 `--shadow-1/2/float/primary`

## 逐项改动
| # | 级别 | 问题 | 落地 | 文件 |
|---|------|------|------|------|
| 1 | P0 | 历史页入口会消失 | last-card 改常驻，无历史渲染占位态（`.is-empty`/`.last-placeholder`）；收藏/黑名单对新用户可达 | `pages/index/index.wxml` `index.wxss` |
| 2 | P0 | 硬编码色值 45+15 处 | 主色面全走 `var()`；美术阴影/玻璃层有意保留 | `app.wxss` + 7 个页面（脚本 `tools/_apply_tokens.py`） |
| 3 | P0 | `.page` 全局污染 | 首页改 `.index-page` 并补基础布局；mydishes 删文件底覆盖 | `index.wxss` `mydishes.wxss` |
| 4 | P1 | 首屏 1434rpx 小屏放不下 | hero 620→580rpx，同步 `FLOAT_CFG.HERO=580`；margin 收紧 | `index.wxss` `index.js` |
| 5 | P1 | 三处无按压反馈 | `.my-del`/`.rtool`/`.rp-back`/`.rback`/`.rblack` 补 `:active`；全局 `.tapable` | 各页 wxss + `app.wxss` |
| 6 | P2 | 无 type scale | 9 级落地，108 处裸字号收敛 | `app.wxss` + 7 个页面 |
| 7 | P2 | 新拟态双阴影显脏 | `--shadow-neu` 白影提亮；与 `--shadow-1` 形成统一语言 | `app.wxss` |
| 8 | P2 | 空状态四种写法 | CSS 碗上提全局 `.empty`，history/mydishes/recipe 复用 | `app.wxss` + 三页 |
| 9 | P2 | rcard 100rpx 圆角债 | 收回 `--r-xl`，金色竖条从顶部横条改回左侧 | `result.wxss` |
| 10 | P2 | duel 死代码 | 删除 `pages/duel/` 四文件（未注册、零引用） | `pages/duel/`（已删） |

## 保留未动（用户指定）
- 首页 4 个常驻 CSS 动画（heroPulse / breath / 双 ripple）
- 漂浮小球 `requestAnimationFrame` 逐帧 `setData` 物理（约每秒 240 次跨线程通信）

## 校验结果
- result / recipe / mydishes / history / nearby：实体色已清零，仅剩有意保留的阴影层
- app.json 不再引用 duel；`index.js` 物理常量 `HERO=580` 与 `.hero-wrap` 一致
- `.index-page` 已含完整基础布局（min-height + 上/左右内边距 + 底色），去掉 `.page` class 后整页不塌

## 仍可后续打磨（非阻塞）
- nearby 的 `nb-empty`（列表内"无结果"）是语义不同的轻量文案，未强行套全局碗——若想统一可再议
- 部分组件级字号（按钮 32rpx、`.nb-state-ico` 36rpx）属组件特例，未强令牌化
