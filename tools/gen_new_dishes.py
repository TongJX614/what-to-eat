# -*- coding: utf-8 -*-
"""把 _new_1/2/3 里的新增菜品 + 教程写入 dishes.js 与各 recipes 文件。

- 校验：tag 必须落在受控词表；每分类恰好 15 道；菜名不与现有重复；id 唯一；菜谱 1:1 覆盖。
- 写入：dishes.js 追加 135 条；recipes 各文件追加对应教程。
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _new_1 import DATA as D1
from _new_2 import DATA as D2
from _new_3 import DATA as D3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISHES_JS = os.path.join(ROOT, 'miniprogram', 'data', 'dishes.js')
RECIPES_DIR = os.path.join(ROOT, 'miniprogram', 'data', 'recipes')

# 分类 -> (id 前缀, 起始序号, 菜谱文件名)
CAT_MAP = {
    '中餐': ('cn', 50, 'cn.js'),
    '面食': ('noodle', 25, 'noodle.js'),
    '小吃': ('snack', 30, 'snack.js'),
    '快餐': ('fast', 22, 'fast.js'),
    '西餐': ('west', 23, 'west.js'),
    '日韩': ('jpk', 19, 'jpk.js'),
    '汤品': ('soup', 19, 'soup.js'),
    '饮品': ('drink', 19, 'drink.js'),
    '轻食': ('light', 17, 'light.js'),
}

TAGS = {'辣', '不辣', '荤', '素', '主食', '汤水', '小食', '饮品', '低卡', '重口', '下饭', '快手'}

# 合并三个数据文件
DATA = {}
for d in (D1, D2, D3):
    for cat, items in d.items():
        DATA.setdefault(cat, []).extend(items)


def indent_block(s, n=2):
    pad = ' ' * n
    return '\n'.join((pad + ln if ln.strip() else ln) for ln in s.split('\n'))


def dish_js(dish):
    return indent_block(json.dumps(dish, ensure_ascii=False, indent=2))


def recipe_js(recipe):
    return indent_block(json.dumps(recipe, ensure_ascii=False, indent=2))


def main():
    # 读取现有菜名做查重
    existing_names = set(re.findall(r'"name": "([^"]+)"', io.open(DISHES_JS, encoding='utf-8').read()))
    existing_ids = set(re.findall(r'"id": "([^"]+)"', io.open(DISHES_JS, encoding='utf-8').read()))

    errors = []
    all_dishes = []   # 全局顺序，用于写 dishes.js
    recipe_by_file = {}  # 文件名 -> [ (id, recipe) ]

    for cat in ['中餐', '面食', '小吃', '快餐', '西餐', '日韩', '汤品', '饮品', '轻食']:
        prefix, start, rfile = CAT_MAP[cat]
        items = DATA.get(cat, [])
        if len(items) != 15:
            errors.append('%s 应有 15 道，实际 %d' % (cat, len(items)))
        for i, item in enumerate(items):
            num = start + i
            did = '%s_%03d' % (prefix, num)
            name = item['name']
            tags = item['tags']
            # 校验 tag
            for t in tags:
                if t not in TAGS:
                    errors.append('%s 的 tag %r 不在受控词表' % (name, t))
            if name in existing_names:
                errors.append('菜名重复：%s' % name)
            if did in existing_ids:
                errors.append('id 冲突：%s' % did)
            dish = {
                'id': did,
                'name': name,
                'category': cat,
                'tags': tags,
                'price': item['price'],
                'desc': item['desc'],
                'reason': item['reason'],
            }
            all_dishes.append(dish)
            recipe_by_file.setdefault(rfile, []).append((did, item['recipe']))

    if errors:
        print('校验失败，共 %d 处：' % len(errors))
        for e in errors:
            print('  -', e)
        sys.exit(1)

    print('校验通过：共 %d 道新菜（每分类 15 道）' % len(all_dishes))

    # ---------- 写 dishes.js ----------
    src = io.open(DISHES_JS, encoding='utf-8').read()
    idx = src.rfind(']')
    assert idx != -1, 'dishes.js 未找到数组结束符'
    dish_blocks = ',\n'.join(dish_js(d) for d in all_dishes)
    new_src = src[:idx].rstrip() + ',\n' + dish_blocks + '\n]\n'
    io.open(DISHES_JS, 'w', encoding='utf-8').write(new_src)
    print('dishes.js 已追加 %d 条' % len(all_dishes))

    # ---------- 写各 recipes 文件 ----------
    for rfile, entries in recipe_by_file.items():
        path = os.path.join(RECIPES_DIR, rfile)
        src = io.open(path, encoding='utf-8').read()
        idx = src.rfind('}')
        assert idx != -1, '%s 未找到对象结束符' % rfile
        blocks = ',\n'.join('  "%s": %s' % (did, json.dumps(rcp, ensure_ascii=False, indent=2)) for did, rcp in entries)
        new_src = src[:idx].rstrip() + ',\n' + blocks + '\n}\n'
        io.open(path, 'w', encoding='utf-8').write(new_src)
        print('%s 已追加 %d 条教程' % (rfile, len(entries)))

    print('\n完成。')


if __name__ == '__main__':
    main()
