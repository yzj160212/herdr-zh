#!/bin/bash
# 把仓库里的钩子装到 .git/hooks/。用软链，改了仓库里的钩子立刻生效。
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
mkdir -p .git/hooks
for h in pre-commit; do
  [ -f "tools/$h" ] || { echo "没找到 tools/$h"; exit 1; }
  chmod +x "tools/$h"
  ln -sf "../../tools/$h" ".git/hooks/$h"
  echo "已装 .git/hooks/$h -> tools/$h"
done
