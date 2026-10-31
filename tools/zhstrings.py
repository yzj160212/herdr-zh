#!/usr/bin/env python3
"""Herdr 中文化辅助：在「上游英文模块」与「中文副本」之间按位置转写字符串。

为什么这样做：中文副本 = 上游模块 + 逐条替换文案。上游升级后逻辑会变，
但文案位置基本不变，于是可以「保留新版逻辑 + 搬回中文文案」。
前提：两边的字符串字面量数量与类型序列一致；不一致就拒绝并报告，
交给人（或 agent）手工翻译新增的那几条。

用法：
  zhstrings.py check    <上游> <中文副本>   体检：数量/类型是否对得上，逻辑是否只差文案
  zhstrings.py transfer <上游> <中文副本> <输出>  按位置把中文文案搬到上游文件里
"""
import json
import re
import sys

# 字符串字面量：双引号 / 单引号 / 反引号（模板串）。
LITERAL = re.compile(
    r'"(?:\\.|[^"\\\n])*"'          # "..." 单行
    r"|'(?:\\.|[^'\\\n])*'"         # '...'
    r"|`(?:\\.|[^`\\])*`",          # `...`
    re.S,
)


def literals(src):
    return [m.group(0) for m in LITERAL.finditer(src)]


def kind(lit):
    return lit[0]


def code_fingerprint(src):
    """把字符串内容抹掉、去掉注释与空白，用来判断「代码逻辑」是否变了。"""
    s = LITERAL.sub('"S"', src)
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    s = re.sub(r"(?m)^\s*//.*$", "", s)
    s = re.sub(r"(?m)\s+//[^\n]*$", "", s)
    return re.sub(r"\s+", "", s)


def check(upstream, clone):
    up = open(upstream, encoding="utf-8").read()
    zh = open(clone, encoding="utf-8").read()
    a, b = literals(up), literals(zh)
    kinds_ok = [kind(x) for x in a] == [kind(x) for x in b]
    result = {
        "upstream_literals": len(a),
        "clone_literals": len(b),
        "count_equal": len(a) == len(b),
        "kinds_equal": kinds_ok,
        "code_equal": code_fingerprint(up) == code_fingerprint(zh),
        "translatable": len(a) == len(b) and kinds_ok,
    }
    if not result["translatable"]:
        # 报出差异位置附近的字面量，便于人工处理
        n = min(len(a), len(b))
        first_diff = next((i for i in range(n) if kind(a[i]) != kind(b[i]) or a[i] == b[i] and not _is_chinese(b[i])), None)
        result["first_diff_index"] = first_diff
        result["upstream_tail"] = a[n:n + 8]
        result["clone_tail"] = b[n:n + 8]
    return result


def _is_chinese(s):
    return any("\u4e00" <= c <= "\u9fff" for c in s)


def transfer(upstream, clone, out):
    """上游文件为骨架，按位置套上中文副本的字面量。"""
    up = open(upstream, encoding="utf-8").read()
    zh = open(clone, encoding="utf-8").read()
    a, b = literals(up), literals(zh)
    if len(a) != len(b) or [kind(x) for x in a] != [kind(x) for x in b]:
        print(f"拒绝对齐：上游 {len(a)} 条字面量，副本 {len(b)} 条（或类型序列不同）", file=sys.stderr)
        return 1
    spans = list(LITERAL.finditer(up))
    pieces, last = [], 0
    for m, repl in zip(spans, b):
        pieces.append(up[last:m.start()])
        pieces.append(repl)
        last = m.end()
    pieces.append(up[last:])
    open(out, "w", encoding="utf-8").write("".join(pieces))
    print(f"已写出 {out}")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "check" and len(sys.argv) == 4:
        print(json.dumps(check(sys.argv[2], sys.argv[3]), ensure_ascii=False, indent=2))
    elif cmd == "transfer" and len(sys.argv) == 5:
        sys.exit(transfer(sys.argv[2], sys.argv[3], sys.argv[4]))
    else:
        print(__doc__)
        sys.exit(2)
