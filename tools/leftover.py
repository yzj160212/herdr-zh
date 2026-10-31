#!/usr/bin/env python3
"""列出源码里「看起来还是英文文案」的字面量，用于汉化收尾检查。

用法: leftover.py <文件.js> [...]
判断规则：含空格的多词字符串（最像句子/标签），或有首字母大写的单词
（多词内的都算）。排除路径、URL、颜色、命令名、状态键、平台名等。
"""
import re
import sys

LITERAL = re.compile(
    r'"(?:\\.|[^"\\\n])*"|'
    r"'(?:\\.|[^'\\\n])*'|"
    r"`(?:\\.|[^`\\])*`",
    re.S,
)

# 这些不翻译：标识符、命令名、状态键、平台、语言、快捷键名、专有名词
SKIP_WORDS = {
    "mods", "frame", "herdr", "gpui", "macos", "windows", "linux", "darwin",
    "shell", "git", "json", "html", "yaml", "txt", "true", "false", "null",
    "unsigned", "unknown", "left", "right", "up", "down", "value", "name",
    "id", "type", "kind", "key", "text", "style", "active", "open", "close",
    "Esc", "cmd", "ctrl", "alt", "shift", "super", "fn", "win", "secondary",
    "Herdr", "Herdr 98", "herdr-core", "hc", "JetBrains Mono", "Geist",
    "graphite", "ink", "moss", "atom one dark", "paper", "Terminals",
    "Claude", "Codex", "Gemini", "Copilot",
}


def suspicious(text):
    inner = text[1:-1].strip()
    if not inner:
        return False
    if inner in SKIP_WORDS:
        return False
    if inner.startswith(("mods/", "frame/", "http", "#", "-", ".")):
        return False
    if re.search(r"[\u4e00-\u9fff]", inner):      # 已经是中文
        return False
    if re.fullmatch(r"[\w./:@\[\]${{}}-]+", inner):  # 单个标识符/路径/命令
        return False
    words = [w for w in re.split(r"[\s,;:!?()\[\]]+", inner) if w]
    if len(words) >= 2 and re.search(r"[A-Za-z]{2,}", inner):
        return True
    if len(words) == 1 and re.match(r"^[A-Z][A-Za-z]{3,}$", inner):
        return True
    return False


def in_comment(src, pos):
    """pos 处是否在注释里：看该行行首到 pos 之间有没有 //，以及是否落在 /* */ 内。"""
    line_start = src.rfind("\n", 0, pos) + 1
    if "//" in src[line_start:pos]:
        return True
    # 块注释：最后出现的 /* 与 */ 哪个更近
    open_at = src.rfind("/*", 0, pos)
    close_at = src.rfind("*/", 0, pos)
    return open_at > close_at


def scan(path):
    src = open(path, encoding="utf-8").read()
    hits = []
    for m in LITERAL.finditer(src):
        if in_comment(src, m.start()):
            continue
        if suspicious(m.group(0)):
            hits.append(m.group(0))
    return hits


if __name__ == "__main__":
    rc = 0
    for path in sys.argv[1:]:
        hits = scan(path)
        uniq = list(dict.fromkeys(hits))
        if uniq:
            rc = 1
            print(f"--- {path}: 疑似未翻译 {len(uniq)} 条")
            for x in uniq:
                print("   ", x[:120])
        else:
            print(f"--- {path}: 干净")
    sys.exit(rc)
