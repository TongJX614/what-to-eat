# 今天吃什么

> 一个给「选择困难症」收尾的微信小程序。内置 350 道菜，按下「帮我选」，一秒内给你一个答案，还附菜谱。

不需要注册，不联网也能用（附近餐厅除外）。打开决定，然后去吃饭。



---

## 功能亮点

- **一秒出结果**：按「帮我选」直接给菜，动画不拖沓（预算 500ms 内，或先出结果再播动画）。结果页是扑克牌式卡片栈，左右滑动翻看候选。
- **350 道菜，9 大分类**：中餐 / 面食 / 小吃 / 快餐 / 西餐 / 日韩 / 汤品 / 饮品 / 轻食，每道菜都配了一份完整菜谱。
- **12 个筛选标签**：不辣 / 辣 / 荤 / 素 / 主食 / 下饭 / 低卡 / 快手 / 重口 / 小食 / 汤水 / 饮品。忌口在首页半屏弹层里一次性设好，之后随机结果自动避开。
- **口味画像**：吃完点一下「好吃 / 一般 / 踩雷」，它会慢慢摸清你偏爱什么、想避开什么，并标出「你爱」的菜。
- **30 个成就 + 连续打卡**：从「第一口」到「双月常驻」，纯本地统计，不涉及任何隐私上传。
- **自己的菜也能参与随机**：常吃的家常菜可以在「我的菜」里手动加进去。
- **附近餐厅**：地图 + 按距离排序的列表，支持复制店名去点评/美团搜。

## 界面预览

仓库根目录放了一份可直接双击打开的像素级预览：

```
design-preview.html   # 浏览器直接打开，像素级复刻 + 真实 CSS 动画，覆盖主要页面
```

截图占位（待补）：

| 首页 | 结果页 | 历史与打卡 |
| --- | --- | --- |
| `docs/screenshots/index.png` | `docs/screenshots/result.png` | `docs/screenshots/history.png` |

仓库里另有若干单页设计稿预览（`achv-preview.html`、`result-rate-preview.html`、`taste-card-preview.html`、`index-icon-preview.html`、`uiverse-preview.html`），以及对应的设计记录（`design-review.md`、`design-fixes.md`）。

## 页面地图

| 页面 | 作用 |
| --- | --- |
| `pages/index` | 首页：帮我选、菜系筛选、连续打卡、口味画像、成就/菜品库入口 |
| `pages/result` | 结果：卡片栈、「就吃这个 / 换一个」、分享卡片 |
| `pages/history` | 历史记录：收藏 / 黑名单、打卡评分 |
| `pages/mydishes` | 我的菜：自定义菜品，同样参与随机 |
| `pages/menu` | 菜品库：按菜名 / 分类 / 标签搜索 |
| `pages/detail` | 菜品详情 |
| `pages/recipe` | 做菜教程 |
| `pages/nearby` | 附近餐厅 |

底部 `custom-tab-bar` 是自绘的：毛玻璃底座 + 主题橙高亮，选中时缩放回弹并喷出上下粒子。

## 快速开始

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 工具里选择「导入项目」，目录指向本仓库根目录，`AppID` 选「测试号」或填你自己的小程序 AppID。
   - 仓库里的 `project.config.json` 带的是开发者的 AppID，**换成你自己的再预览**，否则部分接口会报 AppID 不匹配。
3. 点编译即可在模拟器里跑；手机上看效果点「预览」，扫码即可。

真机上要用「附近餐厅」，有**三件事必须去微信公众平台后台做**，只改代码不管用：

1. 「开发管理 → 接口设置」开通地理位置接口权限；
2. `app.json` 声明 `requiredPrivateInfos` 并配 `permission.scope.userLocation.desc`（**代码里已加**）；
3. 「设置 → 服务内容声明 → 用户隐私保护指引」勾选「位置信息」并提交审核。

## 附近餐厅的数据源

`miniprogram/utils/poi.js` 做了 provider 抽象，返回结构统一，切换数据源时页面代码不用改：

```js
var CONFIG = {
  provider: 'mock', // 'mock' | 'tencent'
  key: ''           // 腾讯位置服务 Key（本地自己填，不要提交）
}
```

仓库里默认是 `mock`（内置演示数据），**直接跑就有内容**。想接真实数据：

1. 到 [lbs.qq.com](https://lbs.qq.com) 注册开发者并创建应用；
2. 添加 Key，勾选 **WebServiceAPI**，域名白名单留空；
3. 把 `CONFIG.key` 填成你自己的，并把 `CONFIG.provider` 改成 `'tencent'`；
4. 小程序后台把 `https://apis.map.qq.com` 加进 request 合法域名。

提交前记得把 Key 改回空串 —— 这是公开仓库，硬编码密钥等于送人。

## 项目结构

```
miniprogram/
├─ pages/            8 个页面（见上表）
├─ components/       prefsheet 偏好半屏、taste-card 口味画像
├─ custom-tab-bar/   自绘 tabBar
├─ data/
│  ├─ dishes.js      菜品库，350 道，本地 JS 导出
│  └─ recipes/       按分类拆的 9 份菜谱文件，共 350 份
├─ utils/            random 随机引擎 / storage 本地存储 / stats 统计
│                    achievements 成就 / poi 附近餐厅 / poster 分享卡片 / greeting / time / copy / feedback
├─ assets/           全部图标 PNG，由 gen_icons.py 统一生成
└─ app.wxss          70 个设计令牌定义在这（改配色从这里开始）
tools/               图标生成、菜谱校验、冒烟测试等脚本
```

## 数据说明

菜品是一个对象数组，字段如下：

```js
{
  id: 'cn_001',
  name: '宫保鸡丁',
  category: '中餐',            // 9 个分类之一
  tags: ['辣', '荤', '下饭'],   // 12 个标签
  price: 32,                    // 参考价，单位元
  desc: '花生米与鸡丁同炒…',
  reason: '不知道吃什么的时候点它，基本不踩雷'
}
```

数据全在本地，用 `storage` 读写，没有后端、没有云函数、没有任何上传。

## 设计语言

主题叫「安静的奢华 · 暖食风」：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--c-bg` | `#F6F0E8` | 奶油暖底色 |
| `--c-primary` | `#DD7A3C` | 唯一强调色（暖橙） |
| `--c-gold` | `#C9A24B` | 金色细描边 |
| `--c-text` | `#3A2E26` | 炭棕正文 |

70 个令牌（颜色、圆角、阴影、字号、缓动）统一定义在 `app.wxss` 的 `page{}` 里，WXSS 中一律引用变量，不写死色值。

图标全部走 `tools/gen_icons.py`：resvg + Pillow 管线，4 倍超采样后缩回，24 单位网格、统一描边宽度。这套管线是为了避开手画图标常见的粗细不均、圆心偏移：不用 emoji，也不用 Pillow 硬拼多边形去凑曲线。

## 已知限制

- **附近餐厅默认是 mock 数据**，真实数据需要你自己申请腾讯位置服务 Key（见上文）。
- **不提供餐厅的推荐菜单**。大众点评 / 美团的菜品接口要求企业主体 + 服务商资质，个人开发者拿不到，爬虫方案也有明显的合规风险。详情页只展示 POI 自带字段，并用「复制店名 + 引导去点评/美团搜索」把用户导出去。
- 菜品数据为人工整理的常识性内容，价格是参考价，因城市与店铺而异。
- `tools/` 下 `_` 前缀的脚本是一次性调试产物，未纳入版本管理。
- 尚未添加开源协议。

## 技术选型

微信小程序原生开发，不使用 uni-app / Taro 等跨端框架；不依赖任何第三方 npm 包；除腾讯位置服务（可选）外无外部服务。密钥一律不进版本库。
