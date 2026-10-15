# -*- coding: utf-8 -*-
"""
给页面级白色卡片换成"顶部受光的渐变面"。

背景：卡片的顶部内高光（inset 白色）在纯白 #FFFFFF 上等于白叠白，完全不可见。
必须让卡片自身带一点自上而下的明暗过渡，高光才立得住。

只处理同时满足以下条件的样式块，避免误伤小标签 / icon / 描边按钮：
  1) 背景是 var(--c-card)
  2) 有 border-radius（是"面"而不是纯文字容器）
  3) 有 box-shadow（是"浮起的面"）
"""
import re
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(BASE, "miniprogram", "pages")
OLD_BG = "background: var(--c-card);"
NEW_BG = "background: linear-gradient(180deg, var(--c-white) 0%, var(--c-card-2) 100%);"

changed = []
skipped = []

for dirpath, _dirs, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith(".wxss"):
            continue
        path = os.path.join(dirpath, fn)
        with open(path, "r", encoding="utf-8") as f:
            src = f.read()

        out = []
        pos = 0
        rel = os.path.relpath(path, ROOT)
        # 逐块匹配  selector { ... }
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", src):
            sel, body = m.group(1), m.group(2)
            out.append(src[pos:m.start()])
            if (
                OLD_BG in body
                and "border-radius" in body
                and "box-shadow" in body
            ):
                # 多行 box-shadow 不自动追加 inset，留人工处理，避免破坏缩进
                if "inset 0 2rpx" in body:
                    body = body.replace(OLD_BG, NEW_BG)
                    changed.append((rel, sel.strip().splitlines()[-1].strip(), "bg only (已有 inset)"))
                else:
                    body = body.replace(OLD_BG, NEW_BG)
                    changed.append((rel, sel.strip().splitlines()[-1].strip(), "bg"))
            out.append(m.group(0) if body is m.group(2) else sel + "{" + body + "}")
            pos = m.end()
        out.append(src[pos:])

        new = "".join(out)
        if new != src:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new)

print("=== 已更新 %d 处 ===" % len(changed))
for rel, sel, mode in changed:
    print("  %-28s %-24s [%s]" % (rel, sel, mode))
