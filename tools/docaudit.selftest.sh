#!/bin/bash
# docaudit.py 的自检：造一份「故意有已知缺陷」的文档，看它是否逐条报出来。
# 为什么需要：这个脚本自己出过两次 bug（一次把反引号提前剥掉导致集合为空、
# 一次把表头当数据行凑巧让数量对上），都会让它「永远全绿」。所以它必须能被证伪。
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

mkdir -p "$T/mods/aaa-zh" "$T/mods/bbb-zh"
printf '{"global":{"cmd-p":"mod.open:picker-zh"}}\n' > "$T/keys.json"
cat > "$T/README.md" <<'DOC'
# 测试

![图](missing.png)

写错字了。 这里多一个空格，还有 **粗体** 和 —— 破折号。

说白了，这一行只有 human-writing 的 check_prose.py 才会判违规，用来验证接线没断。

```sh
if true; then
```

| 位置 | 模块 | 说明 |
| --- | --- | --- |
| 布局 | `aaa-zh` | 只写了一个 |
DOC

out="$(python3 "$HERE/docaudit.py" "$T" 2>&1)"

check() { # $1 = 期望出现的片段
  if ! grep -q "$1" <<<"$out"; then
    echo "自检失败：没报出「$1」"
    echo "---- 实际输出 ----"; echo "$out"
    exit 1
  fi
}
check 'shell 语法错'
check '漏了'
check '中文标点后多了空格'
check '行内粗体'
check '破折号'
check '图片不存在'
check '按键表'
check '中文成稿硬禁令'

echo "docaudit 自检通过：7 类缺陷都能报出来（含只由 check_prose 判定的中文硬禁令）"
