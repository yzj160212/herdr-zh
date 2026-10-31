#!/bin/bash
# Herdr 中文化体检：升级后先跑这个，一眼看出哪块需要修。
# 检查：锁定状态 / 当前布局 / 按键路由 / 译文漂移 / 模块可用性 / 报错 / 残留英文 / git 状态
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$(cd "$HERE/.." && pwd)"
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

echo "== 1. 锁定替换的三个应用自带文件 =="
for item in "frame/settings/main.js" "mods/confirm/main.js" "mods/prompt/main.js"; do
  f="$HOME_DIR/$item"
  if [ ! -e "$f" ]; then bad "$item 不存在"; continue; fi
  if ls -lO "$f" 2>/dev/null | grep -q uchg; then ok "$item 已锁定"; else bad "$item 未锁定 -> 跑 ./apply.sh"; fi
done

echo "== 2. 中文布局 =="
LAYOUT=$(herdr-app status 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin).get("layout",""))' 2>/dev/null)
if [ "$LAYOUT" = "main-zh" ]; then ok "当前布局 main-zh"; else warn "当前布局是 ${LAYOUT:-未知} -> herdr-app do layout.switch '{\"name\":\"main-zh\"}'"; fi
[ -f "$HOME_DIR/layouts/main-zh.json" ] && ok "layouts/main-zh.json 在" || bad "layouts/main-zh.json 丢了"

echo "== 3. keys.json 中文入口 =="
python3 - "$HOME_DIR/keys.json" <<'PY'
import json,sys
want = {"cmd-,":"mod.open:settings-zh","cmd-shift-p":"mod.open:palette-zh","cmd-/":"mod.open:help-zh",
        "cmd-p":"mod.open:picker-zh","f2":"mod.open:rename-tab-zh","shift-f2":"mod.open:rename-space-zh"}
try: g = json.load(open(sys.argv[1]))["global"]
except Exception as e: print("  \033[31m✗\033[0m keys.json 读取失败: %s" % e); sys.exit(0)
for k,v in want.items():
    got = g.get(k)
    print("  %s %-14s = %s" % ("\033[32m✓\033[0m" if got==v else "\033[31m✗\033[0m", k, got))
PY

echo "== 4. 译文漂移（中文副本 vs 当前上游）=="
python3 - "$HOME_DIR" <<'PY'
import glob,json,os,sys
root=sys.argv[1]
ignore=set()
ip=os.path.join(root,'zh-patch','drift-ignore.txt')
if os.path.exists(ip):
    for l in open(ip,encoding='utf-8'):
        l=l.split('#')[0].strip()
        if l: ignore.add(l if l.endswith('-zh') else l+'-zh')
stale=manual=skipped=0
for d in sorted(glob.glob(os.path.join(root,'mods','*-zh'))):
    n=os.path.basename(d); u=os.path.join(root,'mods',n[:-3])
    if not os.path.isfile(os.path.join(u,'main.js')): continue
    try:
        import importlib.util
        spec=importlib.util.spec_from_file_location('zs',os.path.join(root,'zh-patch','zhstrings.py'))
        zs=importlib.util.module_from_spec(spec); spec.loader.exec_module(zs)
        r=zs.check(os.path.join(u,'main.js'), os.path.join(d,'main.js'))
    except Exception as e:
        print("  \033[33m!\033[0m %-22s 无法比对: %s" % (n,e)); continue
    if r['code_equal']: continue
    if n in ignore:
        skipped+=1; print("  \033[32m✓\033[0m %-22s 已确认与上游一致（嵌套模板串误报，见 drift-ignore.txt）" % n); continue
    if r['translatable']:
        stale+=1; print("  \033[33m!\033[0m %-22s 上游逻辑变了 -> ./refresh.sh %s" % (n, n[:-3]))
    else:
        manual+=1; print("  \033[33m!\033[0m %-22s 需人工确认（含代码改动/上游新文案，或嵌套模板串误报）" % n)
if not stale and not manual and not skipped:
    print("  \033[32m✓\033[0m 所有副本都与上游一致")
else:
    print("      可自动刷新 %d 个；需人工 %d 个：先 git diff 确认是否只是嵌套模板串误报，真差异见 UPGRADE.md 第五节" % (stale, manual))
PY

echo "== 5. 每个中文模块能否加载 =="
fail=0
for d in "$HOME_DIR"/mods/*-zh "$HOME_DIR"/mods/empty-zh "$HOME_DIR"/mods/rename-tab-zh "$HOME_DIR"/mods/rename-space-zh; do
  [ -d "$d" ] || continue
  out=$(herdr-app check "$d" 2>&1 | tail -1)
  case "$out" in *"check passed"*) ;; *) bad "$(basename "$d"): $out"; fail=1;; esac
done
[ $fail -eq 0 ] && ok "全部通过"

echo "== 6. 残留英文文案 =="
python3 "$HERE/leftover-report.py" "$HOME_DIR"/mods/*-zh/main.js "$HOME_DIR"/mods/empty-zh/main.js || true
echo "      （只列双引号包裹的纯文本；模板串/代码/路径/注释已过滤。真需要修的按 UPGRADE.md 第二节第 4 步补译）"

echo "== 7. 文件/mod 报错 =="
herdr-app status 2>/dev/null | python3 -c '
import json,sys
d=json.load(sys.stdin); e=d.get("errors") or []
print("  \033[32m✓\033[0m 无报错" if not e else "  \033[31m✗\033[0m " + "; ".join(map(str,e)))' 2>/dev/null || warn "Herdr 没在运行，跳过"

echo "== 8. 版本库状态 =="
if git -C "$HOME_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  dirty=$(git -C "$HOME_DIR" status --short | wc -l | tr -d ' ')
  if [ "$dirty" = "0" ]; then ok "工作区干净"; else warn "$dirty 个改动未提交"; git -C "$HOME_DIR" status --short | head -8 | sed 's/^/      /'; fi
  echo "  当前版本: $(herdr-app --version 2>/dev/null | awk '{print $NF}')  最近提交: $(git -C "$HOME_DIR" log -1 --pretty='%h %s' 2>/dev/null)"
else
  warn "还不是 git 仓库"
fi
