# -*- coding: utf-8 -*-
"""小程序图标 · 规整矢量版（统一生成 result / tabbar / history 三组）

背景：旧图标是用 PIL 的椭圆、多边形拼接近似曲线生成的，典型问题是
描边忽粗忽细、圆心偏移、箭头歪斜、各图标大小不一 —— 也就是"AI 味"的来源。

这一版的原则：
  1. 形状全部来自工业图标规范（Material / Feather）的标准路径，几何严格对称；
  2. 24 单位标准网格，统一描边宽度，圆帽 + 圆角，处处等宽；
  3. 自动两遍渲染：先量实际墨迹外框，再按 20 格视觉框（keyline）缩放并居中，
     保证同组图标视觉等大、切换状态时不跳动；
  4. 4 倍超采样渲染后 LANCZOS 缩回，边缘干净。

用法：python tools/gen_icons.py
依赖：pillow, resvg-py
"""
import io
import os

from PIL import Image
import resvg_py

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'miniprogram', 'assets')

SS = 4              # 超采样倍数
SW = 1.7            # 描边宽度（24 网格单位）
KEYLINE = 20.0      # 视觉框：24 网格里内容占 20 格（四周 2 格留白，Material 规范）

# ---- 配色（沿用 app.wxss 设计令牌 / 旧图标实测值）----
C_DEFAULT = '#9B7B5E'   # 工具栏默认：暖灰棕
C_TABBAR = '#968474'    # tabBar 默认：暖灰
C_HISTORY = '#4E3526'   # 历史页：深棕
C_PRIMARY = '#DD7A3C'   # 主色：暖橙（= C_FAV）
C_GOLD = '#C9A24B'      # 成就：金
C_FAV = '#DD7A3C'       # 收藏：暖橙
C_BLACK = '#C0413E'     # 拉黑：砖红
C_REFRESH = '#7A5638'   # 换一批：暖棕
C_WHITE = '#FFFFFF'
C_PRIMARY_L1 = '#F2A06A'  # 火焰内部高光
C_PRIMARY_L4 = '#A8521B'  # 火焰深色根（保留在底部小区域）

STROKE = f'fill="none" stroke-width="{SW}" stroke-linecap="round" stroke-linejoin="round"'
P_HEART = (
    'M12 21.35 l-1.45 -1.32 '
    'C5.4 15.36 2 12.28 2 8.5 '
    'C2 5.42 4.42 3 7.5 3 '
    'C9.24 3 10.91 3.81 12 5.09 '
    'C13.09 3.81 14.76 3 16.5 3 '
    'C19.58 3 22 5.42 22 8.5 '
    'C22 12.28 18.6 15.36 13.45 20.04 Z'
)


# ==================== 形状（24 网格） ====================

def heart(color):
    return f'<path d="{P_HEART}" {STROKE} stroke="{color}"/>'

def heart_filled(color):
    return f'<path d="{P_HEART}" fill="{color}"/>'

def ban(color):
    """禁止 / 拉黑：正圆 + 45° 斜杠，斜杠端点严格落在圆周上"""
    r = (KEYLINE - SW) / 2
    d = r / 2 ** 0.5
    return (
        f'<circle cx="12" cy="12" r="{r:g}" {STROKE} stroke="{color}"/>'
        f'<line x1="{12 - d:.2f}" y1="{12 - d:.2f}" x2="{12 + d:.2f}" y2="{12 + d:.2f}" '
        f'{STROKE} stroke="{color}"/>'
    )

def card(color):
    """分享卡片：圆角矩形海报 + 山形内容"""
    return (
        f'<rect x="3" y="5" width="18" height="14" rx="2.6" {STROKE} stroke="{color}"/>'
        f'<circle cx="8.5" cy="9.6" r="1.4" {STROKE} stroke="{color}"/>'
        f'<path d="M4.2 17.6 L10 12 L14.4 15.8 L17 13.4 L20.4 16.8" {STROKE} stroke="{color}"/>'
    )

def share(color):
    """转发：三节点（Feather share-2）"""
    return (
        f'<circle cx="18" cy="5" r="3" {STROKE} stroke="{color}"/>'
        f'<circle cx="6" cy="12" r="3" {STROKE} stroke="{color}"/>'
        f'<circle cx="18" cy="19" r="3" {STROKE} stroke="{color}"/>'
        f'<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" {STROKE} stroke="{color}"/>'
        f'<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" {STROKE} stroke="{color}"/>'
    )

def refresh(color):
    """换一批：顺时针环形箭头（Feather rotate-cw）"""
    return (
        f'<polyline points="23 4 23 10 17 10" {STROKE} stroke="{color}"/>'
        f'<path d="M20.49 15 a9 9 0 1 1 -2.12 -9.36 L23 10" {STROKE} stroke="{color}"/>'
    )

def home(color):
    """首页（Feather home）"""
    return (
        f'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {STROKE} stroke="{color}"/>'
        f'<polyline points="9 22 9 12 15 12 15 22" {STROKE} stroke="{color}"/>'
    )

def dishes(color):
    """我的菜：碗 + 筷子（半圆碗用严格半圆弧，筷子平行等长）"""
    return (
        f'<path d="M4 11.5 H20 A8 8 0 0 1 4 11.5 Z" {STROKE} stroke="{color}"/>'
        f'<line x1="12.6" y1="9.6" x2="18.6" y2="3.6" {STROKE} stroke="{color}"/>'
        f'<line x1="15.6" y1="9.6" x2="21.6" y2="3.6" {STROKE} stroke="{color}"/>'
    )

def nearby(color):
    """附近餐厅：地图钉（Feather map-pin）"""
    return (
        f'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" {STROKE} stroke="{color}"/>'
        f'<circle cx="12" cy="10" r="3" {STROKE} stroke="{color}"/>'
    )

P_THUMB_UP = (
    'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06'
    'L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22'
    'l3.02-7.05c.09-.23.14-.47.14-.73v-1z'
)
P_THUMB_DOWN = (
    'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1c0 1.1.9 2 2 2h6.31'
    'l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5'
    'c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z'
)

def thumb_up(color):
    return f'<path d="{P_THUMB_UP}" fill="{color}"/>'

def thumb_down(color):
    return f'<path d="{P_THUMB_DOWN}" fill="{color}"/>'


# ---- 首页装饰图标（替代 iOS emoji，扁平矢量、暖色系）----

def flame(color, hi=C_PRIMARY_L1):
    """连续打卡火焰：实心暖橙 + 内部高光，底部收尖"""
    outer = ('M12 22 C6.5 18.3 4 14.3 6 9.2 C7 6.3 10 3.6 12 2.4 '
             'C14 3.6 17 6.3 18 9.2 C20 14.3 17.5 18.3 12 22 Z')
    inner = ('M12 17.6 C9.2 15.4 8.2 12.4 10.2 9.6 C10.8 8.7 12 8.2 12 8.2 '
             'C12 8.2 13.2 8.7 13.8 9.6 C15.8 12.4 14.8 15.4 12 17.6 Z')
    return (
        f'<path d="{outer}" fill="{color}"/>'
        f'<path d="{inner}" fill="{hi}"/>'
    )

def book(color):
    """菜品库：闭合书本 + 书签（Material book）"""
    return (
        f'<path d="M18 2 H6 C4.9 2 4 2.9 4 4 v16 c0 1.1 0.9 2 2 2 h12 '
        f'c1.1 0 2 -0.9 2 -2 V4 c0 -1.1 -0.9 -2 -2 -2 z '
        f'M6 4 h5 v8 l-2.5 -1.5 L6 12 V4 z" {STROKE} stroke="{color}"/>'
    )

def medal(color, dot=None):
    """我的成就：圆盘 + 缎带，中心实心点"""
    dot = dot or color
    return (
        f'<circle cx="12" cy="8" r="5" {STROKE} stroke="{color}"/>'
        f'<path d="M8 12 L6.5 20 L12 16.5 L17.5 20 L16 12" '
        f'{STROKE} stroke="{color}"/>'
        f'<circle cx="12" cy="8" r="2" fill="{dot}"/>'
    )

def bowl(color):
    """引导浮层：碗 + 一双筷子（替代 🍽️）"""
    return (
        f'<path d="M4 10 H20 A8 8 0 0 1 4 10 Z" {STROKE} stroke="{color}"/>'
        f'<line x1="7.5" y1="3" x2="10" y2="10" {STROKE} stroke="{color}"/>'
        f'<line x1="16.5" y1="3" x2="14" y2="10" {STROKE} stroke="{color}"/>'
    )

def face(color, mood):
    """打卡评价脸：正圆轮廓 + 双点眼 + 嘴形随 mood（good/ok/bad），替代 😋😐😣"""
    r = (KEYLINE - SW) / 2          # 外圆吃满视觉框
    mouths = {
        # 微笑 / 平线 / 撇嘴（二次贝塞尔，端点对称）
        'good': f'<path d="M8 13.8 Q12 17.4 16 13.8" {STROKE} stroke="{color}"/>',
        'ok':   f'<line x1="8.6" y1="15.4" x2="15.4" y2="15.4" {STROKE} stroke="{color}"/>',
        'bad':  f'<path d="M8 16.6 Q12 13.2 16 16.6" {STROKE} stroke="{color}"/>',
    }
    return (
        f'<circle cx="12" cy="12" r="{r:g}" {STROKE} stroke="{color}"/>'
        f'<circle cx="8.8" cy="9.8" r="1" fill="{color}"/>'
        f'<circle cx="15.2" cy="9.8" r="1" fill="{color}"/>'
        + mouths[mood]
    )


# ---- 成就图标（替代 emoji，全部线性矢量；id 与图标名一致）----
# 形状库统一走 24 网格 + STROKE 描边，保证与其它三组图标同一视觉语言。
# 左右对称的图标（火焰/星/奖杯/靶心…）控制点严格镜像，镜像差应为 0。

C_ACHV_OFF = '#B5A292'   # 未解锁：暖灰（= --c-text-weak）
C_ACHV_ON = '#BE5E27'    # 已解锁：深暖橙（= --c-primary-deep）

def flame_line(color):
    """连续打卡：火焰轮廓（左右严格镜像：18.4/5.6、14.6/9.4 成对）"""
    outer = ('M12 2.2 C14.6 5.4 18.4 8.6 18.4 13.2 '
             'A6.4 6.4 0 0 1 5.6 13.2 '
             'C5.6 8.6 9.4 5.4 12 2.2 Z')
    inner = ('M12 8.6 C13.4 10.3 15 11.8 15 14 '
             'A3 3 0 0 1 9 14 '
             'C9 11.8 10.6 10.3 12 8.6 Z')
    return (f'<path d="{outer}" {STROKE} stroke="{color}"/>'
            f'<path d="{inner}" {STROKE} stroke="{color}"/>')

def star(color):
    """一周不止：五角星（顶点严格落在 12 中轴，左右 x 成对镜像）"""
    d = ('M12 2.5 l2.95 5.98 6.6 0.96 -4.78 4.65 1.13 6.57 '
         'L12 17.56 l-5.9 3.1 1.13 -6.57 -4.78 -4.65 6.6 -0.96 Z')
    return f'<path d="{d}" {STROKE} stroke="{color}"/>'

def calendar(color):
    """半月不辍：日历（圆角矩形 + 中轴横线 + 两端挂钩）"""
    return (
        f'<rect x="3" y="5" width="18" height="16" rx="2.6" {STROKE} stroke="{color}"/>'
        f'<line x1="3" y1="10" x2="21" y2="10" {STROKE} stroke="{color}"/>'
        f'<line x1="8" y1="3.2" x2="8" y2="6.8" {STROKE} stroke="{color}"/>'
        f'<line x1="16" y1="3.2" x2="16" y2="6.8" {STROKE} stroke="{color}"/>'
        f'<circle cx="12" cy="15" r="1.2" fill="{color}"/>'
    )

def trophy(color):
    """满月常客：奖杯（杯体 + 左右对称杯耳 + 立柱 + 底座）"""
    return (
        f'<path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z" {STROKE} stroke="{color}"/>'
        f'<path d="M7 5.5 H4.8 A2.6 2.6 0 0 0 7.4 10.6" {STROKE} stroke="{color}"/>'
        f'<path d="M17 5.5 H19.2 A2.6 2.6 0 0 1 16.6 10.6" {STROKE} stroke="{color}"/>'
        f'<line x1="12" y1="14" x2="12" y2="17.4" {STROKE} stroke="{color}"/>'
        f'<line x1="8" y1="19.8" x2="16" y2="19.8" {STROKE} stroke="{color}"/>'
    )

def map_icon(color):
    """小试牛刀：折叠地图（Feather map，三折等宽 8 格）"""
    return (
        f'<path d="M1 6 v16 l7 -4 l8 4 l7 -4 V2 l-7 4 l-8 -4 Z" {STROKE} stroke="{color}"/>'
        f'<line x1="8" y1="2" x2="8" y2="18" {STROKE} stroke="{color}"/>'
        f'<line x1="16" y1="6" x2="16" y2="22" {STROKE} stroke="{color}"/>'
    )

def compass(color):
    """走南闯北：罗盘（正圆 + 菱形指针）"""
    r = (KEYLINE - SW) / 2
    return (
        f'<circle cx="12" cy="12" r="{r:g}" {STROKE} stroke="{color}"/>'
        f'<path d="M16.24 7.76 l-2.12 6.36 -6.36 2.12 2.12 -6.36 Z" '
        f'{STROKE} stroke="{color}"/>'
    )

def bookmark(color):
    """心头好：书签（Material bookmark）"""
    return (f'<path d="M19 21 l-7 -5 -7 5 V5 a2 2 0 0 1 2 -2 h10 a2 2 0 0 1 2 2 Z" '
            f'{STROKE} stroke="{color}"/>')

def gem(color):
    """老饕之选：宝石（钻石切割面，左右对称）"""
    return (
        f'<path d="M6 3 H18 L22 9 L12 21 L2 9 Z" {STROKE} stroke="{color}"/>'
        f'<line x1="2" y1="9" x2="22" y2="9" {STROKE} stroke="{color}"/>'
        f'<path d="M9 3 L7.6 9 L12 21" {STROKE} stroke="{color}"/>'
        f'<path d="M15 3 L16.4 9 L12 21" {STROKE} stroke="{color}"/>'
    )

def rainbow(color):
    """百味人生：彩虹（三条同心半圆 + 地平线）"""
    return (
        f'<path d="M2.5 18 A9.5 9.5 0 0 1 21.5 18" {STROKE} stroke="{color}"/>'
        f'<path d="M6 18 A6 6 0 0 1 18 18" {STROKE} stroke="{color}"/>'
        f'<path d="M9.4 18 A2.6 2.6 0 0 1 14.6 18" {STROKE} stroke="{color}"/>'
    )

def chart(color):
    """本月大胃：柱状图（中柱居中，左右柱等高对称）"""
    return (
        f'<line x1="3.5" y1="20" x2="20.5" y2="20" {STROKE} stroke="{color}"/>'
        f'<line x1="6.6" y1="20" x2="6.6" y2="14" {STROKE} stroke="{color}"/>'
        f'<line x1="12" y1="20" x2="12" y2="8.6" {STROKE} stroke="{color}"/>'
        f'<line x1="17.4" y1="20" x2="17.4" y2="11.4" {STROKE} stroke="{color}"/>'
    )

def stack_bowls(color):
    """月度常客：叠放的两只碗（小碗在上、大碗在下，同心居中）"""
    return (
        f'<path d="M6.8 8 H17.2 A5.2 5.2 0 0 1 6.8 8 Z" {STROKE} stroke="{color}"/>'
        f'<path d="M3.6 14.5 H20.4 A8.4 8.4 0 0 1 3.6 14.5 Z" {STROKE} stroke="{color}"/>'
    )

def undo(color):
    """真香警告：逆时针回转箭头（Feather rotate-ccw）"""
    return (
        f'<polyline points="1 4 1 10 7 10" {STROKE} stroke="{color}"/>'
        f'<path d="M3.51 15 a9 9 0 1 0 2.13 -9.36 L1 10" {STROKE} stroke="{color}"/>'
    )

def target(color):
    """十拿九稳：靶心（两层同心圆 + 实心靶点）"""
    r = (KEYLINE - SW) / 2
    return (
        f'<circle cx="12" cy="12" r="{r:g}" {STROKE} stroke="{color}"/>'
        f'<circle cx="12" cy="12" r="4.6" {STROKE} stroke="{color}"/>'
        f'<circle cx="12" cy="12" r="1.3" fill="{color}"/>'
    )

def bomb(color):
    """挑剔的舌头：地雷（球体 + 引线 + 火花）"""
    return (
        f'<circle cx="10.4" cy="14.2" r="6.2" {STROKE} stroke="{color}"/>'
        f'<path d="M14.8 9.4 C15.9 7.9 17.2 7.5 18.4 8.1" {STROKE} stroke="{color}"/>'
        f'<path d="M19.4 4.4 v2.6 M18.1 5.7 h2.6" {STROKE} stroke="{color}"/>'
    )

def moon(color):
    """深夜食堂：月牙（Feather moon）"""
    return (f'<path d="M21 12.79 A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79 Z" '
            f'{STROKE} stroke="{color}"/>')

def sun(color):
    """早起的鸟儿：太阳（正圆 + 8 道等长光芒）"""
    import math as _m
    rays = []
    for i in range(8):
        a = _m.radians(i * 45)
        ca, sa = _m.cos(a), _m.sin(a)
        rays.append(
            f'<line x1="{12 + 7.1 * ca:.2f}" y1="{12 + 7.1 * sa:.2f}" '
            f'x2="{12 + 9.7 * ca:.2f}" y2="{12 + 9.7 * sa:.2f}" '
            f'{STROKE} stroke="{color}"/>'
        )
    return (f'<circle cx="12" cy="12" r="4.6" {STROKE} stroke="{color}"/>'
            + ''.join(rays))

def crown(color):
    """五十知味：皇冠（三峰 + 底部横杠，左右峰严格镜像，中央峰最高）"""
    return (
        f'<path d="M4.2 17.8 V8.9 L8.3 12.6 L12 6.7 L15.7 12.6 L19.8 8.9 V17.8 Z" '
        f'{STROKE} stroke="{color}"/>'
        f'<line x1="4.2" y1="17.8" x2="19.8" y2="17.8" {STROKE} stroke="{color}"/>'
        f'<circle cx="12" cy="6.7" r="1.1" fill="{color}"/>'
        f'<circle cx="8.3" cy="12.6" r="1.1" fill="{color}"/>'
        f'<circle cx="15.7" cy="12.6" r="1.1" fill="{color}"/>'
    )

P_INFINITY = (
    'M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L12 10.66 10.48 12h.01L7.8 14.39'
    'c-.64.64-1.49.99-2.4.99-1.87 0-3.39-1.51-3.39-3.38S3.53 8.62 5.4 8.62'
    'c.91 0 1.76.35 2.44 1.03l1.13 1 1.51-1.34L9.22 8.2C8.2 7.18 6.84 6.62 '
    '5.4 6.62 2.42 6.62 0 9.04 0 12s2.42 5.38 5.4 5.38c1.44 0 2.8-.56 3.77-1.53'
    'l2.83-2.5.01.01L13.52 12h-.01l1.69-1.49c.64-.64 1.49-.99 2.4-.99 '
    '1.87 0 3.39 1.51 3.39 3.38s-1.52 3.38-3.39 3.38c-.9 0-1.76-.35-2.44-1.03'
    'l-1.14-1.01-1.51 1.34 1.27 1.12c1.02 1.01 2.37 1.57 3.82 1.57 '
    '2.98 0 5.4-2.41 5.4-5.38s-2.42-5.38-5.4-5.38z'
)

def infinity(color):
    """百吃不厌：无限符号（∞，Material all-inclusive 路径）"""
    return f'<path d="{P_INFINITY}" {STROKE} stroke="{color}"/>'

def hourglass(color):
    """双月常驻：沙漏（上下对称，腰部收窄在中轴）"""
    return (
        f'<path d="M6 3.2 H18 V7 L13.4 12 L18 17 V20.8 H6 V17 L10.6 12 L6 7 Z" '
        f'{STROKE} stroke="{color}"/>'
    )

def globe(color):
    """吃遍八方：地球（正圆 + 赤道 + 子午线椭圆）"""
    r = (KEYLINE - SW) / 2
    return (
        f'<circle cx="12" cy="12" r="{r:g}" {STROKE} stroke="{color}"/>'
        f'<line x1="{12 - r:.2f}" y1="12" x2="{12 + r:.2f}" y2="12" '
        f'{STROKE} stroke="{color}"/>'
        f'<ellipse cx="12" cy="12" rx="{r * 0.52:g}" ry="{r:g}" '
        f'{STROKE} stroke="{color}"/>'
    )

def shield(color):
    """全类通吃：盾牌（左右对称，顶部平、底部收尖）"""
    return (
        f'<path d="M12 3 L19.5 5.6 V11 C19.5 15.6 16.3 19.2 12 21 '
        f'C7.7 19.2 4.5 15.6 4.5 11 V5.6 Z" {STROKE} stroke="{color}"/>'
    )

def smile(color):
    """鉴味达人：笑脸（正圆 + 双点眼 + 上扬嘴角）"""
    r = (KEYLINE - SW) / 2
    return (
        f'<circle cx="12" cy="12" r="{r:g}" {STROKE} stroke="{color}"/>'
        f'<circle cx="8.9" cy="9.6" r="1" fill="{color}"/>'
        f'<circle cx="15.1" cy="9.6" r="1" fill="{color}"/>'
        f'<path d="M8.2 13.9 Q12 17.5 15.8 13.9" {STROKE} stroke="{color}"/>'
    )

def spark_heart(color):
    """好吃到飞起：爱心轮廓 + 右上角星芒"""
    return (
        f'<path d="{P_HEART}" {STROKE} stroke="{color}"/>'
        f'<g transform="translate(3.4 14.4) scale(0.42)">'
        f'<path d="{P_SPARK}" fill="{color}"/></g>'
    )

def folder(color):
    """藏家：文件夹（圆角矩形 + 翻盖标签）"""
    return (
        f'<path d="M3 6.5 C3 5.1 4.1 4 5.5 4 H9.5 L11.5 6.5 H18.5 '
        f'C19.9 6.5 21 7.6 21 9 V17.5 C21 18.9 19.9 20 18.5 20 H5.5 '
        f'C4.1 20 3 18.9 3 17.5 Z" {STROKE} stroke="{color}"/>'
    )

def podium(color):
    """月度王者：领奖台（三根立柱，中间最高，两侧等高）"""
    return (
        f'<line x1="3" y1="20" x2="21" y2="20" {STROKE} stroke="{color}"/>'
        f'<path d="M4.5 20 V13 H8.5 V20" {STROKE} stroke="{color}"/>'
        f'<path d="M9.5 20 V7.5 H14.5 V20" {STROKE} stroke="{color}"/>'
        f'<path d="M15.5 20 V13 H19.5 V20" {STROKE} stroke="{color}"/>'
    )

def zen_face(color):
    """佛系吃货：淡定脸（正圆 + 两道弯弯闭眼 + 平静嘴线）"""
    r = (KEYLINE - SW) / 2
    return (
        f'<circle cx="12" cy="12" r="{r:g}" {STROKE} stroke="{color}"/>'
        f'<path d="M7.3 9.3 Q8.6 10.9 9.9 9.3" {STROKE} stroke="{color}"/>'
        f'<path d="M14.1 9.3 Q15.4 10.9 16.7 9.3" {STROKE} stroke="{color}"/>'
        f'<line x1="8.6" y1="14.6" x2="15.4" y2="14.6" {STROKE} stroke="{color}"/>'
    )

P_SPARK = ('M12 3 C12.55 7.3 13.7 8.45 18 9 C13.7 9.55 12.55 10.7 12 15 '
           'C11.45 10.7 10.3 9.55 6 9 C10.3 8.45 11.45 7.3 12 3 Z')

def sparkle(color):
    """新解锁提示：星芒（主星 + 两颗小星，用于替代 🎉）"""
    return (
        f'<path d="{P_SPARK}" fill="{color}"/>'
        f'<g transform="translate(2.46 13.72) scale(0.42)">'
        f'<path d="{P_SPARK}" fill="{color}"/></g>'
        f'<g transform="translate(12.92 15.44) scale(0.34)">'
        f'<path d="{P_SPARK}" fill="{color}"/></g>'
    )


# ==================== 渲染 ====================

def _to_png(body, size):
    px = size * SS
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
           f'width="{px}" height="{px}">{body}</svg>')
    data = resvg_py.svg_to_bytes(svg_string=svg, width=px, height=px)
    return Image.open(io.BytesIO(bytes(data))).convert('RGBA')

def _bbox_grid(img, size):
    """墨迹外框（单位：24 网格）"""
    a = img.split()[3].point(lambda v: 255 if v > 128 else 0)
    bb = a.getbbox()
    k = (size * SS) / 24.0          # 每网格单位的像素数
    return bb[0] / k, bb[1] / k, bb[2] / k, bb[3] / k

def render(body, folder, name, size, keyline=KEYLINE):
    # 第一遍：按原始几何渲染，量出实际墨迹外框
    x0, y0, x1, y1 = _bbox_grid(_to_png(body, size), size)
    s = keyline / max(x1 - x0, y1 - y0)          # 按长边归一到视觉框
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # 第二遍：缩放 + 居中
    body = (f'<g transform="translate(12 12) scale({s:.4f}) '
            f'translate({-cx:.3f} {-cy:.3f})">{body}</g>')
    img = _to_png(body, size).resize((size, size), Image.LANCZOS)
    path = os.path.join(ROOT, folder, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return path, s, (round(x1 - x0, 1), round(y1 - y0, 1))


SETS = [
    # (目录, 输出尺寸, 视觉框格数, [图标])
    ('result', 96, 20, [
        ('heart.png', heart(C_DEFAULT)),
        ('heart-on.png', heart_filled(C_FAV)),
        ('cross.png', ban(C_DEFAULT)),
        ('cross-on.png', ban(C_BLACK)),
        ('card.png', card(C_DEFAULT)),
        ('share.png', share(C_DEFAULT)),
        ('refresh.png', refresh(C_REFRESH)),
        ('refresh-on.png', refresh(C_WHITE)),
        ('rate.png', bowl(C_DEFAULT)),          # 吃完来打卡（未打卡态）
        ('rate-good.png', face(C_PRIMARY, 'good')),
        ('rate-ok.png', face(C_DEFAULT, 'ok')),
        ('rate-bad.png', face(C_BLACK, 'bad')),
    ]),
    ('tabbar', 96, 19, [   # tabBar 区域密集，视觉框收 1 格
        ('home.png', home(C_TABBAR)),
        ('home_white.png', home(C_WHITE)),
        ('dishes.png', dishes(C_TABBAR)),
        ('dishes_white.png', dishes(C_WHITE)),
        ('nearby.png', nearby(C_TABBAR)),
        ('nearby_white.png', nearby(C_WHITE)),
    ]),
    ('history', 256, 20, [
        ('like.png', thumb_up(C_HISTORY)),
        ('like-on.png', thumb_up(C_FAV)),
        ('unlike.png', thumb_down(C_HISTORY)),
        ('unlike-on.png', thumb_down(C_BLACK)),
        # 历史卡「打卡」行：与 like/unlike 同规矩 —— 未选 = 深棕描边，已选 = 各自语义色
        ('rate-good.png', face(C_HISTORY, 'good')),
        ('rate-good-on.png', face(C_PRIMARY, 'good')),
        ('rate-ok.png', face(C_HISTORY, 'ok')),
        ('rate-ok-on.png', face(C_DEFAULT, 'ok')),
        ('rate-bad.png', face(C_HISTORY, 'bad')),
        ('rate-bad-on.png', face(C_BLACK, 'bad')),
    ]),
    ('index', 128, 20, [
        ('streak.png', flame(C_PRIMARY)),
        ('menu.png', book(C_DEFAULT)),
        ('medal.png', medal(C_GOLD)),
        ('bowl.png', bowl(C_DEFAULT)),
    ]),
]

# ---- 成就图标：icon 名 = 成就 id，每个出「未解锁(暖灰) / 已解锁(深暖橙)」两态 ----
ACHV_SHAPES = [
    ('first_bite', bowl),
    ('visits_10', target),
    ('visits_30', medal),
    ('visits_50', crown),
    ('visits_100', infinity),
    ('streak_3', flame_line),
    ('streak_7', star),
    ('streak_14', calendar),
    ('streak_30', trophy),
    ('streak_60', hourglass),
    ('explorer_3', map_icon),
    ('explorer_5', compass),
    ('explorer_8', globe),
    ('explorer_all', shield),
    ('fav_first', bookmark),
    ('fav_5', heart),
    ('fav_10', gem),
    ('fav_20', folder),
    ('judge', thumb_down),
    ('picky_3', bomb),
    ('diverse_palate', rainbow),
    ('good_10', smile),
    ('good_25', spark_heart),
    ('ok_10', zen_face),
    ('monthly_10', chart),
    ('monthly_20', stack_bowls),
    ('monthly_30', podium),
    ('comeback', undo),
    ('night_owl', moon),
    ('early_bird', sun),
]

SETS.append(('achv', 96, 20,
    [(name + '.png', fn(C_ACHV_OFF)) for name, fn in ACHV_SHAPES] +
    [(name + '-on.png', fn(C_ACHV_ON)) for name, fn in ACHV_SHAPES] +
    [('unlock.png', sparkle(C_PRIMARY))]      # 新解锁提示用星芒
))

if __name__ == '__main__':
    for folder, size, keyline, items in SETS:
        print(f'--- {folder} ({size}px, 视觉框 {keyline} 格) ---')
        for name, body in items:
            path, s, raw = render(body, folder, name, size, keyline)
            print('  %-18s 原始外框 %sx%s 格 -> 缩放 %.3f' % (name, raw[0], raw[1], s))
