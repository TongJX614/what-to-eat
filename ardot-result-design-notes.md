# Ardot 设计稿 · 想吃什么 result 页（uiverse 视觉语言）

画布文件：https://ardot.tencent.com/file/722855253656267
视口：375 × 812 (iPhone 13/14)
主色：暖食暖橙 #DD7A3C + 金 #C9A24B + 米底 #F6F0E8

## 节点结构（53 个 frame/text/ellipse，顶级 1 frame）

```
Screen · 结果页 (375×812, clipsContent, 米底 #F6F0E8)
├── Status Bar (62px, 13:44 + SVG signal + battery)
├── BG Decoration · Orange Glow Top-Right (RADIAL 渐变)
├── BG Decoration · Gold Glow Bottom-Left (RADIAL 渐变)
├── Nav Bar (56px, SPACE_BETWEEN)
│   ├── Back Button (40×40 玻璃圆形 + ←)
│   ├── 标题 "今天，你的答案"
│   └── Option Button (40×40 玻璃圆形 + ···)
├── App Content (vertical, gap 22, padding 16)
│   ├── Title Section
│   │   ├── Eyebrow (你的答案 · 已决定 + 发光小圆点)
│   │   ├── 大字 "盖浇饭" (52px Bold)
│   │   └── 副标题 "中午不决，下午崩溃——快定一个"
│   ├── Result Card (玻璃 + 渐变描边 + 顶部高光带 + 顶部彩色细带)
│   │   ├── Top Row (SPACE_BETWEEN)
│   │   │   ├── Category Chip "快餐" (暖橙渐变 + 描边)
│   │   │   └── Price Chip "参考价 ¥25" (深橙发光)
│   │   ├── Description
│   │   ├── Tags Row
│   │   │   ├── Tag "不辣" (普通玻璃)
│   │   │   ├── Tag "荤" (普通玻璃)
│   │   │   ├── Tag "主食" (普通玻璃)
│   │   │   └── Tag "快手" (橙色高亮 chip)
│   │   ├── Reason Box (暖橙软底 + 发光小点 + 标题 + 内容)
│   │   ├── Card Divider (渐变中线)
│   │   └── Recipe Link "查看做菜教程 →"
│   ├── Tools Row (4 个玻璃按钮, fill_container)
│   │   ├── Tool · 收藏 (心形 SVG + 文字)
│   │   ├── Tool · 不想吃 (× SVG + 文字)
│   │   ├── Tool · 分享卡片 (卡 SVG + 文字)
│   │   └── Tool · 转发 (分享 SVG + 文字)
│   └── Secondary Action "换且拉黑 · 返回首页"
└── Glass CTA Bar (96px, ABSOLUTE 贴底, 多层玻璃)
    ├── CTA Top Highlight (顶部高光带)
    ├── Primary CTA "换一个" (橙金渐变 + glow border + 3 重投影, flex-grow 3)
    └── Ghost CTA "就吃这个" (透明玻璃 + 渐变描边, flex-grow 2)
```

## uiverse 视觉语言落地清单

| 技法 | 用在哪里 |
|------|---------|
| Gradient buttons | 主 CTA 「换一个」三段渐变 #F2A06A → #DD7A3C → #BE5E27 |
| Glow border | 主 CTA 内阴影暖色光带 + 外发光 |
| 3 重投影 | 主 CTA 暖色发光 + 顶部白高光 + 底部暗影 |
| Glassmorphism | 整个 Glass CTA Bar (BACKGROUND_BLUR 20px) + 4 个工具按钮 |
| Gradient strokes | Result Card 描边渐变（白→金→橙）；副 CTA 描边渐变 |
| Multi-layer shadows | Result Card 顶部高光斜带 + 暖色软影 + 暖色发光 |
| Glass chips | 工具按钮玻璃 + Eyebrow 橙色发光 chip |
| Hover-capable borders | Tags chip「快手」用主题橙描边强调 |
| Decorative light blobs | 右上橙 + 左下金，营造氛围 |
| 顶部高光带 | Result Card + Glass CTA Bar 都有白→透明高光斜带 |
| 彩色细带锚点 | Result Card 顶部左上的「金→橙→淡橙」96×4 渐变细带（uiverse 标志） |