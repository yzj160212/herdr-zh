# Herdr 中文界面

把 [Herdr](https://herdr.dev) 的界面换成**简体中文**的一套布局与模块。

Herdr 本身没有语言/区域设置，界面文案写死在程序里和它自带的界面模块里。
这套东西不改 `Herdr.app` 本体（不改二进制、不重签名），而是提供：

- 两个中文布局：**Herdr 中文版**（`main-zh`）与 **终端版 中文**（`terminals-zh`）
- 25 个中文界面模块
- 一套 `keys.json` 中文入口
- 可选：把 Herdr **自带的设置窗口**也换成中文（`tools/`）
- 可选：跟着 Herdr 升级维护译文的一整套工具（`tools/`）

![Herdr 中文版](preview.png)

---

## 装（3 步）

```sh
H=~/.config/herdr-app

# 1. 布局与模块
cp -R layouts/* "$H/layouts/"
cp -R mods/*    "$H/mods/"

# 2. 按键入口（先看后合并，别整份覆盖）
#    需要合并这几项：⌘, → 中文设置；⌘⇧P → 中文命令面板；⌘/ → 中文快捷键；
#    ⌘P → 中文跳转；F2 → 中文重命名标签页；⇧F2 → 中文重命名空间
$EDITOR "$H/keys.json"       # 对照本仓库 keys.json 的 global 段

# 3. 切到中文布局
herdr-app do layout.switch '{"name":"main-zh"}'
```

想恢复：`herdr-app do layout.switch '{"name":"main"}'`。

### 可选：让「设置」窗口也变中文

Herdr 的设置窗口是**应用内建的独立窗口**，源码在 `frame/settings/`，而且**每次启动
都会被重写**，所以只能"锁定替换"。工具已备好：

```sh
cp -R tools ~/.config/herdr-app/zh-patch
cd ~/.config/herdr-app && ./zh-patch/apply.sh      # 应用/--restore 还原
# 同时会替换 mods/confirm（关闭确认框）与 mods/prompt（重命名输入框）
```

原理：写入中文版后 `chmod 444` + `chflags uchg` 锁住，Herdr 写不进去就跳过。
代价是这三个文件不跟随应用更新；升级后重跑 `apply.sh` 即可。

---

## 目录

```
herdr-zh/
├── layouts/
│   ├── main-zh.json          主布局（侧边栏 + 标签栏 + 窗格 + 文件/改动面板 + 状态栏）
│   ├── main-zh.svg           它在「设置 › 外观」里的预览图（纯图形，同 Herdr 自带惯例）
│   ├── terminals-zh.json     终端版布局（标签在标题栏、窗格成卡片）
│   └── terminals-zh.svg
├── mods/                     25 个中文模块，见下表
├── keys.json                 要合并的中文按键入口
├── RECIPE.md                 从零重建这套东西的完整说明（给 agent 看）
├── UPGRADE.md                跟着 Herdr 升级维护译文的流程
├── tools/                    可选工具：设置窗口汉化 + 体检 + 跟版合并
├── preview.png / preview-terminals-zh.png
├── assets/                   上面两张预览图的 SVG 源（Chrome 无头渲染成 PNG）
└── LICENSE  NOTICE           Apache-2.0；Herdr 与 Lucide 的署名
```

### 25 个模块

| 位置 | 模块 | 中文内容 |
|---|---|---|
| 布局 | `workspace-chrome-zh` | 品牌行、侧边栏底部「设置」「添加机器」 |
| 布局 | `spaces-zh` | 「空间」、空间行、按机器分组、右侧菜单 |
| 布局 | `agents-zh` | 「代理」、按优先级/空间分组、置顶、子代理树 |
| 布局 | `tabs-zh` | 标签栏、「文件」「改动」按钮、+ 菜单 |
| 布局 | `pane-zh` | 窗格表头（名称、目录、状态、分屏/放大/关闭） |
| 布局 | `workspace-status-zh` | 状态栏「本机 · N 个代理 · ⌘ Shift P 命令」 |
| 布局 | `files-zh` | 「文件」面板、目录树、只读预览、错误提示 |
| 布局 | `changes-zh` | 「改动」面板、diff、提交框 |
| 空状态 | `empty-zh` | 「还没有打开空间。新建一个（⌘+N）。」+ 新建按钮 |
| 浮层 | `menu-zh` | 右键菜单（窗格/标签/空间/终端） |
| 浮层 | `new-menu-zh` | ＋菜单：终端、启动一个代理、新建空间、worktree |
| 浮层 | `picker-zh` | 跳转面板（空间/标签/代理/新建） |
| 浮层 | `peek-zh`* | 终端预览条 |
| 浮层 | `machine-add-zh` | 「添加机器」对话框、ssh 主机列表、macOS 授权说明 |
| 浮层 | `worktree-zh` | 新建/打开/移除 worktree 对话框 |
| 浮层 | `help-zh` | 快捷键一览（命令名译成中文） |
| 浮层 | `prompt-zh` | 中文输入框（名称/取消/保存） |
| 浮层 | `rename-tab-zh` `rename-space-zh` | 双击标签/右键空间直接弹中文重命名 |
| 窗口 | `settings-zh` | 中文设置页（外观/机器/提醒/更新/隐私） |
| 窗口 | `palette-zh` | 中文命令面板 |
| 窗口 | `feedback-zh` | 「发送反馈」 |
| 窗口 | `welcome-zh` | 欢迎页 |
| 窗口 | `whatsnew-zh` | 更新内容 |
| 终端版 | `terminals-bar-zh` `terminals-pane-zh` | 终端版布局的标题栏与窗格表头 |

\* `peek-zh` 与 `toast-zh` 已做但没有装进分享包：Herdr 是按固定名字打开 `peek` / `toast`
的，用户侧替换不了（见 `RECIPE.md` 的「当心」）。

---

## 已验证

- 25 个模块全部通过 `herdr-app check`（在临时 `HERDR_APP_HOME` 里全新安装后逐个跑）。
- 两个布局都能切换、`herdr-app status` 的 `errors` 为 `[]`。
- 设置窗口、确认框、重命名框在锁定替换后重启仍为中文（Herdr 0.1.10 实测）。

## 边界（改不了的）

- **macOS 菜单栏**里 Herdr 菜单的 `Settings…` / `Hide Herdr` / `Quit Herdr` /
  `Services` / `Show All`：系统菜单，文案在二进制里（其中 `Settings…` 打开的
  **是中文设置窗口**）。
- **Herdr 自己弹的提示条（toast）正文**：在二进制里。
- **终端里你自己程序输出的内容**：不属于 Herdr 界面。
- 有意保留英文的专有名词：`Herdr`、`Herdr 98`、`herdr-core`、`hc`、字体名、主题名、`Esc`。

## 许可

Apache-2.0（见 `LICENSE`）。这套模块是 Herdr 自带模块的衍生作品，署名与第三方图标
（Lucide，ISC）声明见 `NOTICE`。
