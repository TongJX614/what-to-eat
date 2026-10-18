# 今天吃什么 · what-to-eat

> 给「选择困难症」收尾的微信小程序。内置 350 道菜，按下「帮我选」，一秒内给一个答案，还附菜谱。

![Platform](https://img.shields.io/badge/platform-WeChat%20MiniProgram-07C160?style=flat-square)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen?style=flat-square)
![Dishes](https://img.shields.io/badge/dishes-350-DD7A3C?style=flat-square)
![Recipes](https://img.shields.io/badge/recipes-350%2F350-C9A24B?style=flat-square)
![Offline](https://img.shields.io/badge/offline-first-3A2E26?style=flat-square)

---

## 这是什么

「今天吃什么」只解决一个很具体的问题：**到饭点了，挑不出来。**

打开小程序 → 按「帮我选」→ 一秒后拿到一道菜，带参考价、一句推荐理由，和一份能照着做的菜谱。不满意就左右滑牌，换下一张。

它刻意做得很轻：

- **不注册、不登录**。没有账号体系，历史、忌口、成就全部存在手机本地，卸载即清空。
- **不联网也能用**。350 道菜和 350 份菜谱都打包在小程序里，断网照样抽；只有「附近餐厅」需要网络和定位。
- **不打扰**。没有签到弹窗、没有广告位、没有推送，也没有「分享给三个好友解锁」。

原生小程序手写，不依赖任何第三方 npm 包；除可选的腾讯位置服务外没有外部服务。

---

## 目录

- [功能](#功能)
- [界面预览](#界面预览)
- [快速开始](#快速开始)
- [配置清单](#配置清单)
- [项目结构](#项目结构)
- [数据与本地存储](#数据与本地存储)
- [设计语言](#设计语言)
- [开发与测试](#开发与测试)
- [常见问题](#常见问题)
- [已知限制](#已知限制)

---

## 功能

| 模块 | 能力 |
| --- | --- |
| **首页 · 帮我选** | 按一下直接出结果，目标 500ms 内；也支持摇一摇。可选「自己做 / 出去吃」「一人食 / 几个人」「想吃热乎的 / 清爽的」「赶时间」等场景软权重 |
| **结果页** | 扑克牌式卡片栈，左右滑动翻候选；「就吃这个 / 换一个」；一键生成分享卡片 |
| **菜品库** | 350 道菜 · 9 大分类（中餐 / 面食 / 小吃 / 快餐 / 西餐 / 日韩 / 汤品 / 饮品 / 轻食），按菜名、分类、标签搜索 |
| **菜谱** | 350 份一对一菜谱（食材 + 步骤），不需要跳第三方 |
| **筛选标签** | 12 个：辣 / 不辣 / 荤 / 素 / 主食 / 下饭 / 低卡 / 快手 / 重口 / 小食 / 汤水 / 饮品 |
| **忌口与偏好** | 首页半屏弹层里一次设好：不吃辣 / 素食 / 不吃香菜、蒜、葱、人均预算、避开近 N 次重复、参与随机的分类。之后结果自动避开 |
| **口味画像** | 吃完点「好吃 / 一般 / 踩雷」，逐步摸清偏好并标出「你爱」的菜 |
| **历史记录** | 最近 100 条，可收藏、可拉黑，拉黑的菜不再出现 |
| **我的菜** | 常吃的家常菜可以手动加进池子，同样参与随机 |
| **成就与打卡** | 30 个成就 + 连续打卡天数，纯本地统计 |
| **附近餐厅** | 地图 + 按距离排序的列表；支持复制店名去点评 / 美团搜 |

---

## 界面预览

在线看：**https://what-to-eat-preview-72924.app.workbuddy.host/** — 不用装开发者工具，手机也能打开。

仓库里的 `design-preview.html` 是同一份页面，clone 后双击也能打开（单文件 HTML，无外链、无构建，95KB）。注意它的图标是相对路径引用的 `miniprogram/assets/` 下那 10 个 PNG，别把 HTML 单独拷走。

> 预览页与 `miniprogram/` 下的真实实现保持同步，用来在不开模拟器的情况下快速过视觉。改动后需要重新发布，线上才会更新。

---

## 快速开始

三步跑起来：

**1. 装工具** — [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版即可）。

**2. 导入项目** — 「导入项目」→ 目录选**仓库根目录**（不是 `miniprogram/`）→ AppID 填你自己的。

> ⚠️ 仓库里 `project.config.json` 的 `appid` 填的是 `touristappid`（游客模式）。想在真机预览或上传，换成你自己的 AppID 再编译。

**3. 编译** — 模拟器里就能跑。手机上看效果点「预览」扫码。

项目不依赖云开发，控制台应该是干净的（见[常见问题](#常见问题)）。

---

## 配置清单

只有第 1 项是必须的，其余都按需勾选。

| 配置项 | 位置 | 必需 | 默认 / 说明 |
| --- | --- | --- | --- |
| 小程序 AppID | `project.config.json` → `appid` | ✅ | 仓库里是 `touristappid`（游客模式），换成你自己的 |
| 本机工具偏好 | `project.private.config.json` | — | 已忽略入库，开发者工具自动生成 |
| 附近餐厅数据源 | `miniprogram/utils/poi.js` → `CONFIG.provider` | 可选 | `'mock'`：内置演示数据，开箱即用 |
| 腾讯位置服务 Key | `miniprogram/utils/poi.js` → `CONFIG.key` | 可选 | 空串；切到 `'tencent'` 时必填 |
| 请求域名白名单 | 小程序后台 → 开发管理 → 服务器域名 | 可选 | 接真实 POI 时加 `https://apis.map.qq.com` |
| 位置接口权限 | 小程序后台 → 开发管理 → 接口设置 | 可选 | 「附近餐厅」真机必需 |
| 用户隐私保护指引 | 小程序后台 → 设置 → 服务内容声明 | 可选 | 勾选「位置信息」并提交审核 |
| 云开发环境 ID | `miniprogram/app.js` → `globalData.envId` | 可选 | 空串：不初始化云开发 |

### 1. 小程序 AppID

`project.config.json` 里 `appid` 换成你自己的。仓库里的值只用于作者本地调试。

### 2. 附近餐厅：数据源与 Key

`miniprogram/utils/poi.js` 做了 provider 抽象，两种数据源返回结构一致，切的时候页面代码不用改：

```js
var CONFIG = {
  provider: 'mock', // 'mock' | 'tencent'
  key: ''           // 腾讯位置服务 Key（WebServiceAPI），本地填，勿提交
}
```

仓库里默认 `mock`，**直接跑就有内容**。要接真实数据：

1. 到 [lbs.qq.com](https://lbs.qq.com) 注册开发者，创建应用；
2. 添加 Key，勾选 **WebServiceAPI**，域名白名单留空；
3. `CONFIG.key` 填自己的 Key，`CONFIG.provider` 改成 `'tencent'`；
4. 小程序后台 → 开发管理 → 服务器域名 → request 合法域名，加入 `https://apis.map.qq.com`。

> ⚠️ 小程序包是可以被解包查看的，Key 写在 `poi.js` 里等于公开。请务必在腾讯位置服务后台给这个 Key **配好配额和来源限制**，别用有高额配额的账号 Key。
>
> 提交代码前把 `CONFIG.key` 改回空串。

### 3. 位置权限与隐私声明

真机上要用「附近餐厅」，**光改代码不够**，后台还得做三件事：

1. 开发管理 → 接口设置 → 开通「地理位置」接口；
2. `app.json` 声明 `requiredPrivateInfos` 与 `permission.scope.userLocation.desc`（**代码里已加，别删**）；
3. 设置 → 服务内容声明 → 用户隐私保护指引，勾选「位置信息」并提交审核。

第 3 步没提交过，真机上定位授权弹窗不会出现，页面只会安静地拿不到坐标。

### 4. 云开发（默认关闭）

`miniprogram/app.js` 留了一个 `globalData.envId`，是为后续「附近餐厅真实数据 / 拍照识别」预留的入口。**默认是空串，不会初始化，也不会发起任何请求** —— 核心功能是纯本地的。

要接云开发：把 `envId` 填成你自己的环境 ID，`wx.cloud.init()` 会自动生效。

---

## 项目结构

```
what-to-eat/
├─ miniprogram/              小程序主体（miniprogramRoot）
│  ├─ pages/                 8 个页面
│  │  ├─ index/              首页：帮我选、菜系筛选、打卡、口味画像
│  │  ├─ result/             结果：卡片栈、换一个、分享卡片
│  │  ├─ history/            历史：收藏 / 黑名单 / 评分
│  │  ├─ mydishes/           我的菜：自定义菜品
│  │  ├─ menu/               菜品库：搜索与筛选
│  │  ├─ detail/             菜品详情
│  │  ├─ recipe/             做菜教程
│  │  └─ nearby/             附近餐厅（地图 + 列表）
│  ├─ components/
│  │  ├─ prefsheet/          偏好半屏弹层（忌口、预算、场景）
│  │  └─ taste-card/         口味画像卡
│  ├─ custom-tab-bar/        自绘 tabBar：毛玻璃底座 + 主题橙高亮 + 缩放回弹 + 粒子
│  ├─ data/
│  │  ├─ dishes.js           菜品库（350 道，本地 JS 导出）
│  │  └─ recipes/            9 个分类文件，共 350 份菜谱
│  ├─ utils/                 random 随机引擎 / storage 本地存储 / stats 统计
│  │                         achievements 成就 / poi 附近餐厅 / poster 分享卡片
│  │                         greeting / time / copy / feedback / dishes
│  ├─ assets/                全部图标 PNG（由 tools/gen_icons.py 统一生成）
│  ├─ app.js / app.json / app.wxss    全局入口；70 个设计令牌定义在 app.wxss
│  └─ sitemap.json
├─ cloudfunctions/           云开发占位目录（当前为空，可整目录删除）
├─ tools/                    图标生成、数据生成、校验与测试脚本（不参与运行）
├─ design-preview.html       像素级界面预览，浏览器直接打开
├─ project.config.json       项目配置（miniprogramRoot 指向 miniprogram/）
└─ project.private.config.json   本机偏好，已忽略入库
```

---

## 数据与本地存储

菜品是对象数组：

```js
{
  id: 'cn_001',
  name: '宫保鸡丁',
  category: '中餐',            // 9 个分类之一
  tags: ['辣', '荤', '下饭'],   // 12 个标签
  price: 32,                   // 参考价，单位元
  desc: '花生米与鸡丁同炒，酸甜微辣裹着一层亮油',
  reason: '不知道吃什么的时候点它，基本不踩雷'
}
```

菜谱按菜品 id 一一对应：`recipes[id] = { ingredients: [...], steps: [...] }`。

**没有后端，没有接口，没有任何上传。** 用户状态全部走 `wx.setStorageSync`，键名集中定义在 `miniprogram/utils/storage.js`：

| Storage key | 内容 |
| --- | --- |
| `lunch_history` | 历史记录，上限 100 条 |
| `lunch_fav` / `lunch_black` | 收藏 / 拉黑 |
| `lunch_prefs` | 忌口、预算、时段、场景、去重条数等偏好 |
| `lunch_last` | 上一次的结果 |
| `lunch_achievements` | 已解锁成就 id |
| `lunch_poi_visited` / `lunch_poi_fav` | 去过的 / 收藏的餐厅 |
| `lunch_theme` / `lunch_guided` | 主题与新手引导标记 |

换手机、清缓存 = 数据归零。这是有意的取舍：不需要登录，也就不需要隐私政策里那一堆账号条款。

---

## 设计语言

主题叫「安静的奢华 · 暖食风」：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--c-bg` | `#F6F0E8` | 奶油暖底色 |
| `--c-primary` | `#DD7A3C` | 唯一强调色（暖橙） |
| `--c-gold` | `#C9A24B` | 金色细描边 |
| `--c-text` | `#3A2E26` | 炭棕正文 |

70 个令牌（颜色、圆角、阴影、字号、缓动）统一定义在 `app.wxss` 的 `page{}` 里，**WXSS 一律引用变量，不写死色值**。改配色只需要动这一处。

图标全部由 `tools/gen_icons.py` 生成：resvg 渲染 + Pillow 4 倍超采样后缩回，24 单位网格、统一描边宽度、按 20 格视觉框（Material keyline）居中，保证同组图标视觉等大、切换状态不跳动。不用 emoji，也不用 Pillow 硬拼多边形凑曲线。

---

## 开发与测试

`tools/` 下的脚本都不参与小程序运行，只是开发辅助。全部是 Node / Python 单文件，不需要装依赖（图标生成除外）。

| 脚本 | 作用 | 运行 |
| --- | --- | --- |
| `smoke.js` | 随机引擎冒烟测试：分类分布、去重、边界 | `node tools/smoke.js` |
| `validate_recipes.js` | 菜谱完整性：每道菜都必须有食材和步骤 | `node tools/validate_recipes.js` |
| `test_tabbar.js` | 自绘 tabBar 结构与残留代码检查 | `node tools/test_tabbar.js` |
| `test_mydishes.js` | 「我的菜」端到端：添加 → 入池 → 抽到 → 删除 | `node tools/test_mydishes.js` |
| `gen_dishes.py` | 从纯文本表格生成 `data/dishes.js` | `python tools/gen_dishes.py` |
| `gen_icons.py` | 重新生成全部图标 PNG | `python tools/gen_icons.py`（需 `pip install pillow resvg-py`） |
| `gen_history_icons.py` | 历史页点赞 / 踩雷达图标 | `python tools/gen_history_icons.py` |
| `gen_new_dishes.py` | 历史一次性脚本：追加 135 道菜与菜谱（已执行，留档） | — |
| `upgrade-card-face.py` | 历史一次性脚本：卡片改为顶部受光渐变面（已执行，留档） | — |

---

## 常见问题

**Q：导入后编译报 AppID 相关的错，或者「预览」点不了。**
`project.config.json` 里的 AppID 换成你自己的。想先看看效果，导入时选「测试号」也能编译。

**Q：控制台打印「云开发初始化失败，已降级为纯本地模式」。**
只在你填了 `envId` 但那个环境不存在时出现。仓库默认留空，不会初始化，也不会有这条日志。核心功能纯本地，不影响使用。

**Q：「附近餐厅」永远是同一批店，还都是虚构的。**
`poi.js` 的 `provider` 还是 `mock`。按[配置清单 · 附近餐厅](#2-附近餐厅数据源与-key)切到 `tencent`。

**Q：真机上报 `request:fail url not in domain list`。**
request 合法域名里没加 `https://apis.map.qq.com`。注意开发者工具里勾了「不校验合法域名」的话看不出来，真机一定会拦。

**Q：真机上不弹定位授权。**
「用户隐私保护指引」里没勾「位置信息」，或者没提交审核。这一步只在后台做，代码里改不了。

**Q：换了手机，收藏和历史都没了。**
数据在本地 storage，不跟随微信账号。卸载重装也会清空。

**Q：想换配色 / 圆角 / 字号。**
改 `miniprogram/app.wxss` 的 `page{}` 令牌，不要改各个页面里的具体值。

**Q：菜品数据能改成自己的吗？**
能。`data/dishes.js` 是纯 JS 数组，`data/recipes/` 按 id 对应。改完跑一次 `node tools/validate_recipes.js` 确认没漏菜谱。

---

## 已知限制

- **附近餐厅默认是 mock 数据。** 真实数据要自己申请腾讯位置服务 Key，见上文。
- **不提供餐厅的推荐菜单。** 大众点评 / 美团的菜品接口要求企业主体 + 服务商资质，个人开发者拿不到，爬虫方案也有明显合规风险。详情页只展示 POI 自带字段，并用「复制店名 + 引导去点评 / 美团搜索」把用户导出去。
- **菜品数据是人工整理的常识性内容**，价格是参考价，因城市与店铺而异。
- **一次性调试脚本用完即清**，仓库里只留可复用的工具脚本（见「开发与测试」）。
- **尚未添加开源协议。** 二次使用 / 商用前请先联系作者。

---

## 技术选型

微信小程序原生开发，不使用 uni-app / Taro 等跨端框架；不依赖任何第三方 npm 包；除腾讯位置服务（可选）外无外部服务。

密钥一律不进版本库 —— `project.private.config.json`、`tools/` 下的一次性脚本、设计过程稿都已在 `.gitignore` 里排除。
