#!/bin/bash
# 把仓库里的钩子装到 .git/hooks/。用软链，改了仓库里的钩子立刻生效。
#
# 公开仓库里钩子在 tools/，本地安装版在 zh-patch/，脚本自己认。
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DIR=""
for d in tools zh-patch; do
  [ -f "$d/pre-commit" ] && DIR="$d" && break
done
[ -n "$DIR" ] || { echo "没找到钩子（tools/ 或 zh-patch/ 里都没有）"; exit 1; }

mkdir -p .git/hooks
for h in pre-commit commit-msg; do
  [ -f "$DIR/$h" ] || { echo "跳过 $h（$DIR/ 里没有）"; continue; }
  chmod +x "$DIR/$h"
  ln -sf "../../$DIR/$h" ".git/hooks/$h"
  echo "已装 .git/hooks/$h -> $DIR/$h"
done
echo "之后每次提交：改动里有 .md 就跑文档自检；提交信息本身也会被检查。"
