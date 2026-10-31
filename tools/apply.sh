#!/bin/bash
# Herdr 中文化补丁：替换三个「应用自带、每次启动会被重写」的界面文件，
# 并把窗口切到中文布局。
#
# 背景：Herdr 每次启动会用二进制内嵌的源码重写 frame/ 和它自己的 mods/，
# 直接编辑会被冲掉（并留下 *-edited 副本）。做法是把中文版写进去后
# chmod 444 + chflags uchg 锁住（macOS 不可变标志），Herdr 写不进去就跳过。
#
# 用法:
#   ./apply.sh            应用中文（默认）
#   ./apply.sh --restore  还原英文
#   ./apply.sh --status   查看当前状态
#   ./verify.sh           完整体检（含译文漂移检测）
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$(cd "$HERE/.." && pwd)"

# 目标文件|源码前缀
TARGETS=(
  "$HOME_DIR/frame/settings/main.js|frame-settings"
  "$HOME_DIR/mods/confirm/main.js|mods-confirm"
  "$HOME_DIR/mods/prompt/main.js|mods-prompt"
)

unlock() { [ -e "$1" ] && { chflags nouchg "$1" 2>/dev/null || true; chmod 644 "$1" 2>/dev/null || true; }; }
is_locked() { ls -lO "$1" 2>/dev/null | grep -q uchg; }

# 应用在跑就顺手切一下布局；没跑就跳过（下次启动会用上次记住的布局）。
switch_layout() {
  local name="$1"
  if herdr-app status >/dev/null 2>&1; then
    herdr-app do layout.switch "{\"name\":\"$name\"}" >/dev/null 2>&1 \
      && echo "布局已切到 $name。" || echo "布局切换失败（可手动：herdr-app do layout.switch '{\"name\":\"$name\"}'）"
  else
    echo "Herdr 没在运行，跳过布局切换。"
  fi
}

case "${1:-apply}" in
  --status|status)
    for t in "${TARGETS[@]}"; do
      f="${t%%|*}"
      if [ ! -e "$f" ]; then state="不存在（这台机器还没装，或 Herdr 版本不同）"
      elif is_locked "$f"; then state="已锁定（中文）"
      else state="未锁定（可能已被升级覆盖，跑 ./apply.sh）"; fi
      printf "%-52s %s\n" "${f/#$HOME/~}" "$state"
    done
    ;;
  --restore|restore)
    for t in "${TARGETS[@]}"; do
      f="${t%%|*}"; n="${t##*|}"
      unlock "$f"
      cp "$HERE/$n-en.js" "$f"
      echo "还原: ${f/#$HOME/~}"
    done
    switch_layout main
    echo "已还原英文。"
    ;;
  *)
    for t in "${TARGETS[@]}"; do
      f="${t%%|*}"; n="${t##*|}"
      mkdir -p "$(dirname "$f")"
      unlock "$f"
      cp "$HERE/$n-zh.js" "$f"
      chmod 444 "$f"
      chflags uchg "$f" 2>/dev/null || echo "警告: ${f/#$HOME/~} 锁定失败，重启后可能被覆盖。"
      echo "应用: ${f/#$HOME/~}"
    done
    switch_layout main-zh
    echo "已应用中文。若设置页仍显示英文，重启 Herdr 即可："
    echo "  osascript -e 'quit app \"Herdr\"'; open -a Herdr"
    ;;
esac
