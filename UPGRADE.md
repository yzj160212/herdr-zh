# Herdr 中文化：升级流程说明

Herdr 升级后中文可能局部回退。这份文档说明**为什么会回退**、**按什么顺序修**，
以及每一步用什么工具、怎么验证。

---

> **本仓库里的位置**：这份文档提到的 `./zh-patch/` 就是本仓库的 `tools/`。
> 用之前先装过去，路径就对上了：
>
> ```sh
> cp -R tools ~/.config/herdr-app/zh-patch
> cd ~/.config/herdr-app && ./zh-patch/verify.sh
> ```
>
> 仓库里的 `layouts/`、`mods/` 与安装后的 `~/.config/herdr-app/layouts`、`mods`
> 是同一份内容；改了仓库再 `cp -R` 过去即可。

## 一、原理：升级到底会动到什么

Herdr 没有语言设置，中文是三层东西拼出来的：

| 层 | 内容 | 升级会怎样 |
|---|---|---|
| ① 自建副本 | `mods/*-zh/`、`layouts/main-zh.json`、`keys.json` 里的中文入口 | **不动**。副本属于用户，Herdr 不碰。但它停留在「克隆那天」的版本逻辑，会缺新版功能 |
| ② 锁定替换 | `frame/settings/main.js`、`mods/confirm/main.js`、`mods/prompt/main.js` | 被 `chmod 444 + chflags uchg` 锁住，Herdr **写不进去**，所以不会自动升级，也**不会自动跟进新版逻辑** |
| ③ 二进制内置文案 | macOS 菜单栏菜单项、应用自己 toast 的正文 | 改不了（要改二进制）。这一层忽略 |

所以升级后只有两类问题：

- **A 类：锁定文件停留在旧版** —— 设置窗口少了新版新增的选项。
- **B 类：中文副本停留在旧版** —— 侧边栏/标签栏/面板少了新版功能，或上游改了文案而副本还是旧的。

判断方法：副本的 `mod.json` 里记着克隆时的版本（`cloned_from.version`），
和 `herdr-app --version` 一比就知道落了多少。

---

## 二、升级后按这个顺序做

```sh
cd ~/.config/herdr-app

# 0. 记下新版本
herdr-app --version

# 1. 体检：锁、布局、按键路由、译文漂移、模块可用性
./zh-patch/verify.sh

# 2. 修锁定替换的三个文件（A 类）
./zh-patch/apply.sh
./zh-patch/apply.sh --status      # 确认三个文件都「已锁定（中文）」

# 3. 看中文副本哪些落后了（B 类）
./zh-patch/refresh.sh --check
./zh-patch/refresh.sh --all       # 能自动处理的直接刷新
./zh-patch/refresh.sh spaces      # 单个刷新：模块名不带 -zh

# 4. 找合并后残留的英文，逐条补译
python3 zh-patch/leftover.py mods/*-zh/main.js

# 5. 目视确认（必须做，check 通过 != 界面正确）
osascript -e 'quit app "Herdr"'; sleep 3; open -a Herdr; sleep 10
herdr-app status                  # errors 应为 []

# 6. 记录这次升级
git add -A && git commit -m "跟到 Herdr <版本>"
```

每一步在做什么：

- **`verify.sh`** 体检七项：锁定状态、当前布局、`keys.json` 六个中文入口、译文漂移、
  每个 `*-zh` 能否加载、`herdr-app status` 报错、git 工作区状态。
- **`refresh.sh`** 只处理「能安全自动处理」的副本：它用 **`zhmerge.py`** 把上游新版当骨架，
  按代码行对齐搬中文文案。**对不齐就拒绝**，绝不瞎猜。
- **`leftover.py`** 是收尾扫描：找出仍像英文文案的字面量（含空格的多词串、首字母大写的单词），
  排除路径/命令/状态键/平台名等。

---

## 三、工具一览（都在 `zh-patch/`）

| 工具 | 用途 |
|---|---|
| `apply.sh` | 应用/还原/查看三个锁定文件，并顺手切中文布局 |
| `verify.sh` | 一键体检（升级后先跑它） |
| `refresh.sh` | 让中文副本跟上新版上游（`--check` 只体检） |
| `zhstrings.py` | 字面量级转写，要求两边数量与类型完全一致（严格） |
| `zhmerge.py` | 行级对齐合并，上游可增删代码；非对齐块保留英文并报告 |
| `leftover.py` | 扫出疑似未翻译的英文文案 |
| `backup/` | 每次刷新前的副本自动备份 |
| `frame-settings-*.js` `mods-confirm-*.js` `mods-prompt-*.js` | 三个锁定文件的中英文源码对 |

`zhmerge.py` 的设计原则，值得记住：

**已知局限**：`zhstrings.py` / `zhmerge.py` 用正则找字符串字面量，**嵌套模板串**
（例如 `` `打开 worktree${r ? ` · ${r.name}` : ""}` ``）会被切断，于是这类文件
可能被报成「需人工」。判断法：直接 `git diff` 看差异，若只差文案就是误报。

> **宁可留英文，也不把代码配错。**
> 只在「对齐的代码块」里搬文案；非对齐块原样用上游，其中的英文文案列成「待翻译」交人补。
> 曾经因为把 `difflib` 的 `insert`/`delete` 方向搞反（丢掉了上游新增行、保留了旧行），
> 产出了语法能过但运行报错的模块 —— 所以合并后**必须** `herdr-app check` 每个模块。

---

## 四、A 类：锁定文件遇到上游改了源码

`apply.sh` 只是把仓库里的中文版写回去。如果上游**改了 `frame/settings` 的源码结构**，
中文版就是旧逻辑，新选项不会出现。这时：

```sh
cd ~/.config/herdr-app

# 1. 先备份当前中文版（万一要回滚）
cp frame/settings/main.js /tmp/settings-zh-old.js

# 2. 让 Herdr 生成新版英文原始文件
chflags nouchg frame/settings/main.js && chmod 644 frame/settings/main.js
rm frame/settings/main.js
osascript -e 'quit app "Herdr"'; sleep 3; open -a Herdr; sleep 10
cp frame/settings/main.js /tmp/settings-en-new.js     # 这就是新版上游

# 3. 用 zhmerge 把中文搬到新版上（有新增文案会列出来）
python3 zh-patch/zhmerge.py /tmp/settings-en-new.js /tmp/settings-zh-old.js /tmp/settings-zh-new.js
python3 zh-patch/leftover.py /tmp/settings-zh-new.js   # 看还剩哪些要译

# 4. 人工补译列出来的条目后，替换仓库里的中文版并重新应用
cp /tmp/settings-zh-new.js zh-patch/frame-settings-zh.js
./zh-patch/apply.sh
herdr-app check frame/settings
```

`mods/confirm` / `mods/prompt` 同理，对应 `mods-confirm-*.js`、`mods-prompt-*.js`。

---

## 五、B 类：中文副本里「我自己的代码改动」

有些副本不只是换文案，还改了代码（例如把 `run("app.settings")` 换成打开中文设置页）。
`refresh.sh` 用的是**上游代码 + 中文文案**，所以会**丢掉这些代码改动**。刷新后要手工补回：

| 副本 | 代码级改动（刷新后要补回） |
|---|---|
| `tabs-zh` | 双击重命名 → `mod.open rename-tab-zh`；`menu-zh` / `new-menu-zh` 路由；`files-zh` / `changes-zh` / `pane-zh` 的图标路径；Windows 窗口按钮指向 `mods/tabs-zh/` |
| `menu-zh` | 「重命名」两项 → `mod.open rename-tab-zh` / `rename-space-zh` |
| `workspace-chrome-zh` | 「设置」按钮 → 打开 `settings-zh`（而不是 `app.settings`） |
| `workspace-status-zh` | 右下角「命令」→ 打开 `palette-zh` |
| `terminals-bar-zh` | 命令按钮 → 打开 `palette-zh` |
| `palette-zh` | 自建（不是克隆）：中文命令表 + 中文分组 + 设置/反馈/快捷键/欢迎的中文路由 |
| `help-zh` | 自建命令名→中文说明表 `NAMES`、分组中文名 |
| `rename-tab-zh` `rename-space-zh` `empty-zh` `settings-zh` `feedback-zh` `welcome-zh` `whatsnew-zh` | 自建模块，不是克隆，不受上游影响 |

这些改动都在 `git log` 里；刷新后 `git diff mods/<name>-zh/main.js` 会立刻显示丢了什么。

---

## 六、回滚

```sh
# 只回退锁定文件
./zh-patch/apply.sh --restore
herdr-app do layout.switch '{"name":"main"}'      # 切回英文布局

# 回退某个提交
git log --oneline
git revert <commit>            # 或 git checkout <commit> -- mods/spaces-zh

# 回退到「刷新之前」的副本（refresh.sh 自动备份）
ls zh-patch/backup/
cp zh-patch/backup/spaces-zh-0.1.10-before.js mods/spaces-zh/main.js
```

---

## 七、已知边界（无法汉化）

- **macOS 菜单栏** Herdr 菜单里的 `Settings…` / `Hide Herdr` / `Quit Herdr` /
  `Services` / `Show All`：系统菜单，文案在二进制里。其中 `Settings…` 打开的
  **已经是中文设置窗口**。
- **应用自己弹的 toast 正文**（如 `herdr-core is up to date`）：在二进制里。
- **终端里你自己程序输出的内容**：不属于 Herdr 界面。
- 有意保留英文的专有名词：`Herdr`、`Herdr 98`、`herdr-core`、`hc`、字体名
  （`JetBrains Mono`、`Geist`）、主题名（`graphite` `ink` `moss` `atom one dark` `paper`）、
  快捷键名（`Esc`、`⌘`）。
