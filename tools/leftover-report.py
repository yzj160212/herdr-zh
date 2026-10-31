#!/usr/bin/env python3
"""verify.sh 用的残留英文过滤：只报「双引号包裹的纯文本」，滤掉模板串/代码/路径。"""
import re
import subprocess
import sys
import os

here = os.path.dirname(os.path.abspath(__file__))
targets = sys.argv[1:]
out = subprocess.run([sys.executable, os.path.join(here, "leftover.py"), *targets],
                     capture_output=True, text=True).stdout
title, items = None, []
blocks = []
for line in out.splitlines():
    if line.startswith("---"):
        if title:
            blocks.append((title, items))
        title, items = line.rstrip(), []
    elif title and line.startswith("    ") and not line.startswith("      "):
        t = line.strip()
        if t.startswith('"') and t.endswith('"') and " " in t and not re.search(r"[$()=|/]", t):
            items.append(t)
if title:
    blocks.append((title, items))
for title, items in blocks:
    if items:
        print(title)
        for i in items:
            print("     ", i[:110])
