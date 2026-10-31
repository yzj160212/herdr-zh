#!/bin/bash
# 把中文副本「跟上」当前版本的 Herdr 上游模块：
# 保留新版逻辑，只把文案按位置搬回中文。
#
# 原理：中文副本 = 上游模块 + 逐条替换文案。上游升级后逻辑会变、文案位置基本不变，
# 于是参考 zh-patch/zhstrings.py 按字面量位置转写（保留新版逻辑 + 搬回中文）。
# 若两边字面量数量/类型对不上（说明该模块有代码级改动，或上游加了新文案），
# 脚本会拒绝并列出差异，交人工处理，绝不瞎猜。
#
# 用法：
#   ./refresh.sh space          # 刷新单个模块（mods/spaces-zh）
#   ./refresh.sh --all          # 刷新所有能自动处理的
#   ./refresh.sh --check        # 只体检、不改动
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$(cd "$HERE/.." && pwd)"
APPVER=$(herdr-app --version 2>/dev/null | awk '{print $NF}')

refresh_one() {
  local clone="$1"                         # mods/spaces-zh
  local name; name=$(basename "$clone")
  local base="${name%-zh}"
  local upstream="$HOME_DIR/mods/$base"
  if [ ! -f "$upstream/main.js" ]; then echo "跳过 $name：没有同名上游模块（这是自建模块）"; return 0; fi

  local json
  json=$(python3 "$HERE/zhstrings.py" check "$upstream/main.js" "$clone/main.js" 2>/dev/null)
  local trans; trans=$(echo "$json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["translatable"])')
  local codeq; codeq=$(echo "$json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["code_equal"])')

  if [ "$codeq" = "True" ]; then echo "无需刷新 $name：上游逻辑没变"; return 0; fi
  if [ "$trans" != "True" ]; then
    echo "需人工处理 $name：字面量对不上（上游可能有新文案，或本副本含代码级改动）"
    echo "$json" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("      上游 %d 条 / 副本 %d 条" % (d["upstream_literals"], d["clone_literals"]))
for s in d.get("upstream_tail") or []: print("      上游多出: " + s[:100])
for s in d.get("clone_tail") or []: print("      副本多出: " + s[:100])'
    return 1
  fi

  mkdir -p "$HERE/backup"
  cp "$clone/main.js" "$HERE/backup/$name-$APPVER-before.js"
  python3 "$HERE/zhstrings.py" transfer "$upstream/main.js" "$clone/main.js" "$clone/main.js.new" || return 1
  mv "$clone/main.js.new" "$clone/main.js"
  # 上游新增的资源文件也补上（不覆盖已有）
  for f in "$upstream"/*; do
    b=$(basename "$f")
    case "$b" in jsconfig.json|*.d.ts) continue;; esac
    [ -e "$clone/$b" ] || cp -R "$f" "$clone/$b"
  done
  # 记下现在基于哪个版本
  python3 - "$clone/mod.json" "$APPVER" <<'PY'
import json,sys
p,ver=sys.argv[1],sys.argv[2]
try: d=json.load(open(p))
except Exception: d={}
if d.get("cloned_from"): d["cloned_from"]["version"]=ver
json.dump(d,open(p,"w"),ensure_ascii=False,indent=2)
PY
  out=$(herdr-app check "$clone" 2>&1 | tail -1)
  case "$out" in *"check passed"*) echo "已刷新 $name → 基于 $APPVER（原文件备份在 zh-patch/backup/）";; *) echo "刷新后 $name 校验失败：$out"; return 1;; esac
}

rc=0
if [ "${1:-}" = "--check" ]; then
  for d in "$HOME_DIR"/mods/*-zh; do
    [ -d "$d" ] || continue
    n=$(basename "$d"); u="$HOME_DIR/mods/${n%-zh}"
    [ -f "$u/main.js" ] || continue
    j=$(python3 "$HERE/zhstrings.py" check "$u/main.js" "$d/main.js" 2>/dev/null)
    echo "$j" | python3 -c "
import json,sys
d=json.load(sys.stdin)
state = '无需刷新（逻辑一致）' if d['code_equal'] else ('可自动刷新' if d['translatable'] else '需人工处理')
print('  %-22s %s' % ('$n', state))"
  done
elif [ "${1:-}" = "--all" ]; then
  for d in "$HOME_DIR"/mods/*-zh; do [ -d "$d" ] || continue; refresh_one "$d" || rc=1; done
elif [ -n "${1:-}" ]; then
  refresh_one "$HOME_DIR/mods/${1%-zh}-zh" || rc=1
else
  sed -n '2,14p' "$0"; exit 2
fi
exit $rc
