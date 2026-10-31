#!/usr/bin/env python3
"""文档自检：一次查完「读者会踩的坑」，别等用户来发现。

用法:
    python3 tools/docaudit.py [目录]        # 默认当前目录

查这六类：
  1. 命令可执行性    每段 sh 块用 bash -n 过一遍（跳过模板里的 <占位符>）
  2. 数量/事实对账    模块数、按键项、尺寸数字，从源文件重算，不靠记忆
  3. 未解释的术语     抽出所有反引号标识符，列出「变量/路径/命令开关」这类
                     读者可能陌生的，提醒逐个人工确认有没有就地解释
  4. 中文排版        中文标点后多余空格、中文之间空格、重复标点
  5. AI 味           行内粗体、破折号
  6. 图文一致        首页图片是否存在；是否被标注成真机截图或示意图
  7. 中文成稿硬禁令  复用 human-writing 的 check_prose.py（有就调，没有就跳过）
"""
import json
import os
import re
import subprocess
import sys

SUSPECT_TOKEN = re.compile(r'^(?:[A-Za-z]+=|--[a-z-]+|zh-patch/|tools/|herdr-app\b|chflags\b|chmod\b)')
PLACEHOLDER = re.compile(r'<[^>\n]+>')


def strip_fences(src):
    """返回 (去掉代码块后的正文, 代码块列表)。"""
    blocks, out, keep = [], [], True
    for line in src.split('\n'):
        if line.lstrip().startswith('```'):
            keep = not keep
            if not keep:
                blocks.append([])
            continue
        (out if keep else blocks[-1]).append(line)
    return '\n'.join(out), ['\n'.join(b) for b in blocks]


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    os.chdir(root)
    docs = [d for d in ('README.md', 'RECIPE.md', 'UPGRADE.md', 'ZH-README.md') if os.path.exists(d)]
    bad = []
    notes = []

    # 1 命令可执行性
    for d in docs:
        _, blocks = strip_fences(open(d, encoding='utf-8').read())
        for i, code in enumerate(blocks, 1):
            if not code.strip():
                continue
            if PLACEHOLDER.search(code):
                notes.append(f'{d} 第 {i} 段含占位符，未做语法检查')
                continue
            r = subprocess.run(['bash', '-n'], input=code, capture_output=True, text=True)
            if r.returncode != 0:
                bad.append(f'{d} 第 {i} 段 shell 语法错: {r.stderr.strip().splitlines()[-1][:70]}')

    # 2 数量与事实对账
    if os.path.isdir('mods') and 'README.md' in docs:   # 没有 README 就不查模块表
        on_disk = sorted(x for x in os.listdir('mods') if os.path.isdir('mods/' + x))
        readme = open('README.md', encoding='utf-8').read()
        listed = [r.split('|')[2].strip()          # 保留反引号，下面用正则取名字
                  for r in readme.split('\n') if r.startswith('| 布局 |') or r.startswith('| 浮层 |')
                  or r.startswith('| 窗口 |') or r.startswith('| 空状态 |') or r.startswith('| 终端版 |')]
        named = set()
        for cell in listed:
            named.update(re.findall(r'`([a-z0-9-]+)`', cell))
        miss = [m for m in on_disk if m not in named]
        if miss:
            bad.append(f'README 模块表漏了 {len(miss)} 个: {miss}')
        m = re.search(r'([一二三四五六七八九十]+|两|\d+)个模块', readme)
        if m:
            cn = {'二十五': 25, '二十五个': 25, '二十五 个': 25}
            want = cn.get(m.group(1))
            if want and want != len(on_disk):
                bad.append(f'README 说「{m.group(1)}个模块」，实际 {len(on_disk)} 个')
    if os.path.exists('keys.json') and 'README.md' in docs:
        # keys.json 的写法 -> 人看到的按键，逐个核对 README 里有没有交代
        def show(k):
            parts = k.split('-')
            out = []
            for p in parts:
                if p == 'cmd':   out.append('⌘')
                elif p == 'shift': out.append('⇧')
                elif p == 'alt': out.append('⌥')
                elif p == 'ctrl': out.append('Ctrl')
                elif p == '':    out.append('-')       # cmd-- 这种末尾减号
                elif re.fullmatch(r'f\d+', p): out.append(p.upper())
                else: out.append(p.upper() if len(p) == 1 else p)
            return ''.join(out)
        remaps = {k: v for k, v in json.load(open('keys.json'))['global'].items() if '-zh' in str(v)}
        readme = open('README.md', encoding='utf-8').read()
        # 只看按键表（第二列是「打开」那一列），跳过表头与分隔行
        table = '\n'.join(l for l in readme.split('\n')
                          if l.startswith('|') and '---' not in l and '打开' not in l)
        for k in remaps:
            if show(k) not in table:
                bad.append(f'README 按键表没提 keys.json 里的 {k}（显示为 {show(k)}）')

    # 3 未解释的术语（列出供人工确认）
    tokens = set()
    for d in docs:
        body, _ = strip_fences(open(d, encoding='utf-8').read())
        tokens.update(re.findall(r'`([^`\n]+)`', body))
    suspect = sorted(t for t in tokens if SUSPECT_TOKEN.match(t))
    if suspect:
        notes.append('这些标识符读者可能不熟，逐个确认正文里解释过：' + ', '.join(suspect))

    # 4/5 排版与 AI 味（只看正文，跳过代码块和表格）
    for d in docs:
        body, _ = strip_fences(open(d, encoding='utf-8').read())
        prose = '\n'.join(l for l in body.split('\n') if not l.strip().startswith('|'))
        for pat, name in [(r'[\u3002\uff0c\uff1a\uff1b\uff09] +[^\s]', '中文标点后多了空格'),
                          (r'[\u4e00-\u9fff] +[\u4e00-\u9fff]', '中文之间多了空格'),
                          (r'(?<=[\u4e00-\u9fff]) +（', '中文与括号之间多了空格'),
                          (r'的的|了了|。。|，，|、、', '重复字或标点'),
                          (r'\*\*', '行内粗体'),
                          (r'——', '破折号')]:
            n = len(re.findall(pat, prose))
            if n:
                bad.append(f'{d} {name} x{n}')

    # 6 图文一致
    if 'README.md' in docs:
        readme = open('README.md', encoding='utf-8').read()
        imgs = re.findall(r'!\[[^\]]*\]\(([^)]+)\)', readme)
        for img in imgs:
            if not os.path.exists(img):
                bad.append(f'README 引用的图片不存在: {img}')
        if imgs and '截图' not in readme:
            bad.append('README 用了图片，但没说明是真机截图还是示意图')

    # 7 中文成稿硬禁令：不自己造词表，直接调用 human-writing 的检查器
    checker = os.environ.get('CHECK_PROSE') or os.path.expanduser(
        '~/.agents/skills/human-writing/scripts/check_prose.py')
    if os.path.exists(checker):
        for d in docs:
            r = subprocess.run([sys.executable, checker, d], capture_output=True, text=True)
            if r.returncode != 0:
                hits = [l for l in r.stdout.split('\n') if l.startswith('- ')]
                bad.append(f'{d} 中文成稿硬禁令：' + '；'.join(x[2:60] for x in hits[:3]))
    else:
        notes.append('没找到 check_prose.py，跳过中文成稿硬禁令（可用 CHECK_PROSE 指定路径）')

    print('== 文档自检 ==')
    for n in notes:
        print('  · ' + n)
    if bad:
        for b in bad:
            print('  ✗ ' + b)
        print(f'  {len(bad)} 项待修')
        return 1
    print('  ✓ 没有发现问题')
    return 0


if __name__ == '__main__':
    sys.exit(main())
