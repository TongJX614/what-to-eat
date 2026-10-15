"""根据 Uiverse Zain-Muhammad 的 SVG path 关键角点直接绘制大拇指图标。

cairosvg/sharp 在 Windows 装不上 cairo native lib，
用 Pillow 的 polygon 按比例画 SVG 的关键控制点（直线段原样、曲线段用
cubic Bezier 解算后再细分 16 步插值），256x256 大图保留细节。

SVG 来自用户 2026-09-05 给的 Uiverse Zain-Muhammad like-unlike-radio：
  https://uiverse.io/Zain-Muhammad/like-unlike-radio

Like (27x27 viewBox)：
  M0.7229 26.5 H5.92292 V10.9008 H0.7229 Z       # 左手基底小竖矩形
  M26.6299 15.2618 L24.372 23.7566
    C23.9989 25.3696 22.5621 26.5 20.9072 26.5
    H8.52293 V10.9278
    L10.7573 2.87293
    C10.9669 1.50799 12.1418 0.5 13.524 0.5
    C15.0699 0.5 16.323 1.7527 16.323 3.29837
    V10.8998 H23.1651
    C25.4519 10.9009 27.1453 13.0335 26.6299 15.2618 Z

Unlike 是 like 的 y 镜像（图中上下翻转）。
"""

from PIL import Image, ImageDraw

S = 256 / 27  # 缩放比

INK = (78, 53, 38, 255)      # 深棕 #4E3526（未选中）
INK_ON = (221, 122, 60, 255) # 主题橙 #DD7A3C（赞选中态，与 var(--c-primary) 一致，更显眼）
INK_ON_BLACK = (192, 65, 62, 255)  # 危险红 #C0413E（黑名单选中态，与 var(--c-danger) 一致）


def cubic_bezier(p0, c1, c2, p3, steps=16):
    """cubic Bezier 等距采样 16 段（不含终点，由调用方 concat）"""
    pts = []
    for i in range(1, steps):  # 不含 0（起点）和 1（终点），由外层管
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * c1[0] + 3 * u * t**2 * c2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * c1[1] + 3 * u * t**2 * c2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def to_xy(x, y):
    return (x * S, y * S)


def like_rect():
    """拳头竖矩形（底部左侧那条）"""
    # M0.7229 26.5 H5.92292 V10.9008 H0.7229 Z
    return [
        to_xy(0.7229, 10.9008),
        to_xy(5.92292, 10.9008),
        to_xy(5.92292, 26.5),
        to_xy(0.7229, 26.5),
    ]


def like_thumb():
    """主拇指多边形（直线段 + 3 段 cubic Bezier 细分）"""
    # 起点（path 起点是右指根外侧拐点）
    pts = [to_xy(26.6299, 15.2618)]

    # L24.372 23.7566 — 直线到右下拐点
    pts.append(to_xy(24.372, 23.7566))

    # C23.9989 25.3696 22.5621 26.5 20.9072 26.5 — 弧到拳右上
    pts.extend(cubic_bezier(
        to_xy(24.372, 23.7566),
        to_xy(23.9989, 25.3696),
        to_xy(22.5621, 26.5),
        to_xy(20.9072, 26.5),
    ))

    # H8.52293 — 横到拳右下
    pts.append(to_xy(8.52293, 26.5))

    # V10.9278 — 竖上到拳左上
    pts.append(to_xy(8.52293, 10.9278))

    # L10.7573 2.87293 — 斜上到拇指根
    pts.append(to_xy(10.7573, 2.87293))

    # C10.9669 1.50799 12.1418 0.5 13.524 0.5 — 顶部左弧
    pts.extend(cubic_bezier(
        to_xy(10.7573, 2.87293),
        to_xy(10.9669, 1.50799),
        to_xy(12.1418, 0.5),
        to_xy(13.524, 0.5),
    ))

    # C15.0699 0.5 16.323 1.7527 16.323 3.29837 — 顶部右弧
    pts.extend(cubic_bezier(
        to_xy(13.524, 0.5),
        to_xy(15.0699, 0.5),
        to_xy(16.323, 1.7527),
        to_xy(16.323, 3.29837),
    ))

    # V10.8998 — 竖下到指根右
    pts.append(to_xy(16.323, 10.8998))

    # H23.1651 — 横到指根右
    pts.append(to_xy(23.1651, 10.8998))

    # C25.4519 10.9009 27.1453 13.0335 26.6299 15.2618 — 闭合弧回起点
    pts.extend(cubic_bezier(
        to_xy(23.1651, 10.8998),
        to_xy(25.4519, 10.9009),
        to_xy(27.1453, 13.0335),
        to_xy(26.6299, 15.2618),
    ))

    return pts


def draw_thumb(rect_pts, thumb_pts, ink):
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.polygon(rect_pts, fill=ink)
    draw.polygon(thumb_pts, fill=ink)
    return img


def main():
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.normpath(os.path.join(here, '..', 'miniprogram', 'assets', 'history'))
    os.makedirs(out_dir, exist_ok=True)

    like = draw_thumb(like_rect(), like_thumb(), INK)
    like.save(os.path.join(out_dir, 'like.png'))

    # Unlike = like y 镜像
    def mirror(pts):
        return [(x, 256 - y) for (x, y) in pts]

    unlike = draw_thumb(mirror(like_rect()), mirror(like_thumb()), INK)
    unlike.save(os.path.join(out_dir, 'unlike.png'))

    # 选中态：赞=主题橙 / 黑名单=危险红（wxml 按 inFav/inBlack 切换 src）
    like_on = draw_thumb(like_rect(), like_thumb(), INK_ON)
    like_on.save(os.path.join(out_dir, 'like-on.png'))

    unlike_on = draw_thumb(mirror(like_rect()), mirror(like_thumb()), INK_ON_BLACK)
    unlike_on.save(os.path.join(out_dir, 'unlike-on.png'))

    print('icons ok ->', out_dir)
    print('saved like/unlike.png (深棕) + like-on/unlike-on.png (主题橙)')


if __name__ == '__main__':
    main()
