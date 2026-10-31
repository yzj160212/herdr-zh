#!/usr/bin/env python3
"""按「代码行」对齐，把中文副本里的文案搬到新版上游模块上。

与 zhstrings.py 的区别：那个要求字面量总数完全一致；这个允许上游增删代码。
做法：先用「抹掉字符串后的代码行」做对齐，只在**对齐块**里按位置搬文案；
对齐不上的代码块原样保留上游（结构与上游完全一致），其中的英文文案作为
「待翻译」列出，交人/agent 补。宁可留英文，也不把代码配错。

用法：
  zhmerge.py <新版上游> <中文副本> <输出>
输出末尾会打印「待翻译」清单（上游新增或变更、没能搬过去的英文文案）。
"""
import difflib
import re
import sys

LITERAL = re.compile(
    r'"(?:\\.|[^"\\\n])*"'
    r"|'(?:\\.|[^'\\\n])*'"
    r"|`(?:\\.|[^`\\])*`",
    re.S,
)


def lines(src):
    return src.split("\n")


def norm_line(line):
    # 行内字面量抹成 S，去掉行尾注释，压掉空白；用于对齐
    s = LITERAL.sub("S", line)
    s = re.sub(r"//[^\n]*$", "", s)
    return re.sub(r"\s+", "", s)


def lits(line):
    return [m.group(0) for m in LITERAL.finditer(line)]


def is_ui(text):
    """像用户可见文案：含空格或多个字母，且不是路径/标识符/颜色。"""
    inner = text[1:-1]
    if not re.search(r"[A-Za-z\u4e00-\u9fff]{2}", inner):
        return False
    if inner.startswith(("mods/", "frame/", "http", "#")):
        return False
    if re.fullmatch(r"[A-Za-z0-9_.\-]+", inner):
        return False
    return True


def merge(up_src, zh_src):
    up, zh = lines(up_src), lines(zh_src)
    upn, zhn = [norm_line(l) for l in up], [norm_line(l) for l in zh]
    sm = difflib.SequenceMatcher(a=upn, b=zhn, autojunk=False)
    out = []
    todo = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                line, kept = transfer_line(up[i1 + k], zh[j1 + k])
                out.append(line)
                todo.extend(kept)
        elif tag == "replace":
            # 非对齐块一律保留上游原文：宁可留英文，也不能把代码配错。
            # 这一块里的文案会作为「待翻译」报出去，由人/agent 补。
            for k in range(i2 - i1):
                out.append(up[i1 + k])
                for x in lits(up[i1 + k]):
                    if is_ui(x):
                        todo.append(x)
        elif tag == "delete":
            # SequenceMatcher 里 delete = 上游有、副本没有的行（上游新增的代码），必须保留。
            for k in range(i2 - i1):
                out.append(up[i1 + k])
                for x in lits(up[i1 + k]):
                    if is_ui(x):
                        todo.append(x)
        # insert: 副本有、上游没有的行（旧版本残留或我自己的改动），丢掉。
        # 注意：我自己的改动需要事后手工补回，见 UPGRADE.md。
    return "\n".join(out), todo


def transfer_line(up_line, zh_line):
    """上游的这一行做骨架，把中文副本同一行的字面量按位置搬过来。
    搬不动（字面量数量不同）就保留上游原文，并把这行像文案的字面量报出去。"""
    a, b = lits(up_line), lits(zh_line)
    if not a or len(a) != len(b):
        return up_line, [x for x in a if is_ui(x)]
    spans = list(LITERAL.finditer(up_line))
    pieces, last = [], 0
    for m, repl in zip(spans, b):
        pieces.append(up_line[last:m.start()])
        pieces.append(repl)
        last = m.end()
    pieces.append(up_line[last:])
    return "".join(pieces), []


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    up_src = open(sys.argv[1], encoding="utf-8").read()
    zh_src = open(sys.argv[2], encoding="utf-8").read()
    merged, todo = merge(up_src, zh_src)
    open(sys.argv[3], "w", encoding="utf-8").write(merged)
    print(f"已写出 {sys.argv[3]}")
    seen, uniq = set(), []
    for x in todo:
        if x not in seen:
            seen.add(x)
            uniq.append(x)
    if uniq:
        print(f"待翻译 {len(uniq)} 条：")
        for x in uniq:
            print("   ", x[:120])
    else:
        print("没有待翻译的新文案")
