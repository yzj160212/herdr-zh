// The frame's command palette: everything you can do, by name, with its key.
// Places (spaces, tabs) stay in the picker. Fuzzy: your letters in
// order, word starts and runs rank higher. Empty: recent first, then every
// group. Choices are entries of their own ("Layout: Zen"); commands that need
// a name ask for it. Enter runs, ↑/↓ move, Esc closes.
// The app's own mod: rewritten from the binary on every start.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { commands, layouts, keys, run, theme, props, closeOverlay, openOverlay, shared, window as win } from "herdr";

// The list keeps one height while you move: rows and group titles have fixed
// heights, and the window shows as many as fit in LIST_H.
// 10 rows: with the search line it fits the popup (at most 85% of the
// window) down to ~580 px windows at zoom 1.3.
const SHOWN = 10;
const ROW_H = 32;
const HEAD_H = 26;
const LIST_H = SHOWN * ROW_H;
const GROUPS = ["最近使用", "标签页", "窗格", "空间", "布局", "终端", "代理", "窗口", "应用"];

// The palette's names for commands: [command, args, group, title, keywords].
const DIR = { left: "左", right: "右", up: "上", down: "下" };
const NAMED = [
  ["tab.new", {}, "标签页", "新建标签页", "tab agent new task 代理 任务"],
  ["mod.open", { name: "picker-zh" }, "标签页", "跳转到空间或标签页…", "switch jump find 切换 跳转 查找"],
  ["tab.rename", {}, "标签页", "重命名标签页", "tab"],
  ["tab.close", {}, "标签页", "关闭标签页", "tab kill 关闭"],
  ["tab.next", {}, "标签页", "下一个标签页", "tab"],
  ["tab.prev", {}, "标签页", "上一个标签页", "tab"],
  ["pane.split", { direction: "right" }, "窗格", "向右分屏", "vertical 竖向"],
  ["pane.split", { direction: "down" }, "窗格", "向下分屏", "horizontal 横向"],
  ["pane.close", {}, "窗格", "关闭窗格", "kill 关闭"],
  ["pane.zoom", {}, "窗格", "放大窗格", "maximize fullscreen 最大化 全屏"],
  ...["left", "right", "up", "down"].map((d) => ["pane.go", { direction: d }, "窗格", `聚焦${DIR[d]}侧窗格`, "move go 移动"]),
  ...["left", "right", "up", "down"].map((d) => ["pane.swap", { direction: d }, "窗格", `与${DIR[d]}侧窗格交换`, "move 移动"]),
  ["space.new", {}, "空间", "新建空间", "workspace 工作区"],
  ["space.rename", {}, "空间", "重命名空间", "workspace 工作区"],
  ["space.close", {}, "空间", "关闭空间", "workspace kill 关闭"],
  ["space.next", {}, "空间", "下一个空间", "workspace 工作区"],
  ["space.prev", {}, "空间", "上一个空间", "workspace 工作区"],
  ["layout.switch", {}, "布局", "下一个布局", "look switch 外观 切换"],
  ["layout.reset", {}, "布局", "重置布局", "new version default restore herdr's 默认 恢复"],
  ["layout.clone", {}, "布局", "复制布局", "clone copy customize 克隆 定制"],
  ["mod.clone", {}, "布局", "复制模块", "clone copy customize 克隆 定制"],
  ["terminal.open", {}, "终端", "新建终端", "shell"],
  ["terminal.copy", {}, "终端", "复制", "clipboard 剪贴板"],
  ["terminal.paste", {}, "终端", "粘贴", "clipboard 剪贴板"],
  ["agent.next", {}, "代理", "下一个代理", ""],
  ["agent.prev", {}, "代理", "上一个代理", ""],
  ["window.minimize", {}, "窗口", "最小化窗口", ""],
  ["window.maximize", {}, "窗口", "最大化窗口", "restore 还原"],
  ["window.close", {}, "窗口", "关闭窗口", "quit 退出"],
  ["mod.open", { name: "settings-zh" }, "应用", "设置", "preferences options config look font theme sound 偏好 配置 外观 字体 主题 声音"],
  ["mod.open", { name: "help-zh" }, "应用", "快捷键", "keybindings shortcuts help 快捷键 键位 帮助"],
  ["mod.open", { name: "welcome-zh" }, "应用", "欢迎页", "intro start onboarding 入门"],
  ["mod.open", { name: "whatsnew-zh" }, "应用", "更新内容", "release changes news update 发布 变更"],
  ["app.reset", {}, "应用", "恢复到默认界面", "escape hatch broken restore 恢复 修复 重置"],
  ["app.zoom_in", {}, "应用", "放大界面", "bigger font size 字体"],
  ["app.zoom_out", {}, "应用", "缩小界面", "smaller font size 字体"],
  ["app.zoom_reset", {}, "应用", "还原缩放", "font size 字体"],
  ["app.quit", {}, "应用", "退出 Herdr", "exit"],
  ...["graphite", "ink", "moss", "atom-one-dark"].map((n) => ["app.theme", { name: n }, "应用", `主题：${n.replace(/-/g, " ")}`, "colors look 颜色 外观"]),
].filter(Boolean);

// Commands that act on something you point at (ids, terminals): not for a list.
const HIDDEN = new Set([
  "space.move", "tab.move", "space.select", "tab.select", "pane.focus", "terminal.keep",
  "terminal.park", "terminal.kill", "terminal.show", "agent.focus", "layout.set", "layout.toggle",
  "layout.show", "layout.hide", "layout.resize", "layout.select", "mod.open", "overlay.close",
  "tab.settle", "tab.unsettle",
  "app.palette", "app.hide", "app.hide_others", "app.show_all", "app.theme", "app.settings",
]);

const GROUPS_ZH = { tab: "标签页", pane: "窗格", space: "空间", layout: "布局", terminal: "终端", agent: "代理", window: "窗口", app: "应用", mod: "模块", overlay: "浮层" };
const VERBS = {
  new: "新建", close: "关闭", rename: "重命名", move: "移动", select: "切换", next: "下一个",
  prev: "上一个", settle: "收起", unsettle: "展开", split: "分屏", zoom: "放大", focus: "聚焦",
  go: "移到", swap: "交换", open: "打开", kill: "结束", keep: "固定", park: "收回", peek: "预览",
  show: "显示", hide: "隐藏", copy: "复制", paste: "粘贴", paste_image: "粘贴图片",
  right_click: "右键行为", switch: "切换", clone: "复制", set: "修改", toggle: "显示/隐藏",
  resize: "调整尺寸", reset: "重置", help: "快捷键", palette: "命令面板", settings: "设置",
  welcome: "欢迎页", whats_new: "更新内容", feedback: "发送反馈", check_updates: "检查更新",
  update_core: "更新 herdr-core", update: "应用更新", theme: "主题", zoom_in: "放大界面",
  zoom_out: "缩小界面", zoom_reset: "还原缩放", quit: "退出", minimize: "最小化", maximize: "最大化",
};
function titleOf(name) {
  const [noun, verb] = name.split(".");
  return { group: GROUPS_ZH[noun] ?? noun, title: `${VERBS[verb] ?? verb}${GROUPS_ZH[noun] ? "" : " " + noun}` };
}

// Every entry for the state we're in now.
function entries() {
  const known = new Set(commands().map((c) => c.name));
  const mac = win()?.platform === "macos";
  const list = NAMED.filter(([n]) => known.has(n))
    .filter(([n]) => !(mac && n.startsWith("window.")))
    .map(([name, args, group, title, words]) => ({ name, args, group, title, words }));
  for (const l of layouts()) {
    const t = { main: "Herdr", terminals: "终端版", win98: "Herdr 98", "main-zh": "Herdr 中文版" }[l] ?? l.charAt(0).toUpperCase() + l.slice(1);
    list.push({ name: "layout.switch", args: { name: l }, group: "布局", title: `布局：${t}`, words: `look ${l}` });
  }
  // Anything new in the app shows up too, until it gets a better name here.
  const named = new Set(NAMED.map(([n]) => n));
  for (const c of commands()) {
    if (named.has(c.name) || HIDDEN.has(c.name) || c.args.some((a) => a.required && a.name !== "name")) continue;
    list.push({ name: c.name, args: {}, ...titleOf(c.name), words: c.about });
  }
  return list.map((e) => ({ ...e, id: `${e.name}:${JSON.stringify(e.args)}` }));
}

// The key bound to an entry: `name` or `name:value` in keys.json.
function keyOf(e, bound) {
  const v = Object.values(e.args)[0];
  const want = v === undefined ? e.name : `${e.name}:${v}`;
  const k = bound.find((b) => b.section === "global" && b.action === want);
  return k ? k.keys : null;
}

// "ctrl-shift-p" -> ["ctrl", "shift", "p"]; "ctrl--" -> ["ctrl", "-"].
function keyParts(k) {
  return k.endsWith("--") ? [...k.slice(0, -2).split("-"), "-"] : k.split("-");
}

// Fuzzy score of `q` in `text`, with the matched positions; null: no match.
function fuzzy(q, text) {
  const t = text.toLowerCase();
  let score = 0;
  let at = 0;
  let run = 0;
  const hits = [];
  for (const ch of q) {
    const i = t.indexOf(ch, at);
    if (i < 0) return null;
    const start = i === 0 || /[\s:.\-_/]/.test(t[i - 1]);
    run = i === at && hits.length ? run + 1 : 0;
    score += 1 + (start ? 6 : 0) + run * 3 - Math.min(i - at, 6) * 0.3;
    hits.push(i);
    at = i + 1;
  }
  return { score: score - text.length * 0.02, hits };
}

export default class Palette extends View {
  init(_props, cx) {
    this.query = "";
    this.input = InputState.new({ placeholder: "输入命令…" });
    this.input.on("change", (_e, cx) => { this.query = this.input.value(); this.at = 0; cx.notify(); });
    this.input.on("submit", () => this.go(this.rows()[this.at]?.e));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.at = 0;
    // How far the list is scrolled, px.
    this.scroll = 0;
    this.recent = JSON.parse(localStorage.getItem("recent") ?? "[]");
    this.handle = cx.focus_handle();
  }

  close() {
    closeOverlay(props().overlay);
  }

  go(e) {
    if (!e) return;
    // 中文版接管这些入口：命令面板里的设置/反馈/快捷键打开汉化模块。
    const ZH = { "app.settings": "settings-zh", "app.feedback": "feedback-zh", "app.help": "help-zh", "app.palette": "palette-zh", "app.welcome": "welcome-zh", "app.whats_new": "whatsnew-zh" };
    if (ZH[e.name]) {
      this.recent = [e.id, ...this.recent.filter((r) => r !== e.id)].slice(0, 20);
      localStorage.setItem("recent", JSON.stringify(this.recent));
      this.close();
      return run("mod.open", { name: ZH[e.name] });
    }
    this.recent = [e.id, ...this.recent.filter((r) => r !== e.id)].slice(0, 20);
    localStorage.setItem("recent", JSON.stringify(this.recent));
    this.close();
    if (e.name === "mod.clone") {
      openOverlay({ mod: "prompt-zh", kind: "dialog", width: 380, props: {
        title: "复制模块", hint: "要复制的模块；会创建 <name>-copy",
        command: { name: "mod.clone", args: {} },
      } });
    } else {
      run(e.name, e.name === "layout.clone" ? { name: shared("layout") ?? "main" } : e.args);
    }
  }

  // The rows to show: grouped when empty, ranked while typing.
  rows() {
    const all = entries();
    const q = this.query.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) {
      const recent = this.recent.map((id) => all.find((e) => e.id === id)).filter(Boolean).slice(0, 5);
      const rest = GROUPS.slice(1).flatMap((g) => all.filter((e) => e.group === g && !recent.includes(e)));
      const others = all.filter((e) => !GROUPS.includes(e.group) && !recent.includes(e));
      return [...recent.map((e) => ({ e, head: "Recent" })), ...[...rest, ...others].map((e) => ({ e, head: e.group }))];
    }
    const rank = (e) => this.recent.indexOf(e.id);
    return all
      .map((e) => {
        const title = fuzzy(q, e.title);
        const more = fuzzy(q, `${e.group} ${e.title} ${e.name} ${e.words}`);
        const best = title ?? (more && { score: more.score - 4, hits: [] });
        return best && { e, score: best.score, hits: best.hits };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || (rank(a.e) < 0 ? 99 : rank(a.e)) - (rank(b.e) < 0 ? 99 : rank(b.e)));
  }

  title(t, text, hits, on) {
    if (!hits?.length) return div().text_color(on ? t.foreground : t.muted).child(text);
    const parts = [];
    let cur = "";
    let lit = false;
    [...text].forEach((ch, i) => {
      const h = hits.includes(i);
      if (h !== lit && cur) {
        parts.push([cur, lit]);
        cur = "";
      }
      lit = h;
      cur += ch;
    });
    if (cur) parts.push([cur, lit]);
    return h_flex().children(parts.map(([s, h]) => div().text_color(h ? t.accent : on ? t.foreground : t.muted).when(h, (d) => d.font_semibold()).child(s.replace(/ /g, "\u00a0"))));
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const bound = keys();
    this.at = Math.min(this.at, Math.max(0, rows.length - 1));
    // One continuous strip: each row (and the group title before it) at a
    // fixed y. Scrolling moves the strip in pixels, only as far as it takes to
    // keep the selected row (and its group's title, if it opens one) in view.
    const tops = [];
    let y = 0;
    rows.forEach((r, i) => {
      const head = !this.query && (i === 0 || r.head !== rows[i - 1].head);
      tops.push({ head, title: y, row: y + (head ? HEAD_H : 0) });
      y += (head ? HEAD_H : 0) + ROW_H;
    });
    const total = y;
    const fixed = total > LIST_H;
    this.maxScroll = Math.max(0, total - LIST_H);
    const sel = tops[this.at];
    if (sel) {
      const from = sel.head ? sel.title : sel.row;
      if (from < this.scroll) this.scroll = from;
      if (sel.row + ROW_H > this.scroll + LIST_H) this.scroll = sel.row + ROW_H - LIST_H;
    }
    this.scroll = Math.max(0, Math.min(this.scroll, this.maxScroll));
    const key = (k) =>
      h_flex().gap(3).children(keyParts(k).map((p) => div().px(5).rounded(4).border_1().border_color(t.border).bg(t.raised).text_size(11).text_color(t.dim).child(p)));
    // In a scrolling list each item is placed at its edges from the model
    // above, not stacked: GPUI rounds every height to whole pixels, and a
    // stack of rounded heights drifts away from the model (19 px at zoom 1.3
    // by row 40, cutting the selection off). Edges from the model can't add up.
    const place = (el, start, end) =>
      fixed
        ? el.absolute().left(0).right(0).top(start - this.scroll).bottom(LIST_H - (end - this.scroll))
        : el.flex_none().h(end - start);
    const visible = (start, end) => !fixed || (end > this.scroll && start < this.scroll + LIST_H);
    const list = [];
    rows.forEach((r, i) => {
      const { head, title, row } = tops[i];
      if (head && visible(title, row)) list.push(place(h_flex(), title, row).px(14).pb(4).items_end().text_size(11).font_semibold().text_color(t.dim).child(r.head));
      if (!visible(row, row + ROW_H)) return;
      const on = i === this.at;
      const k = keyOf(r.e, bound);
      list.push(
        place(h_flex(), row, row + ROW_H)
          .id(`pl-${i}`)
          .mx(6)
          .px(10)
          .gap(10)
          .items_center()
          .rounded(7)
          .cursor_pointer()
          .text_size(12.8)
          .when(on, (el) => el.bg(t.selected))
          .hover((s) => s.bg(t.hover))
          .on_click(() => this.go(r.e))
          .child(div().flex_1().min_w(0).child(this.title(t, r.e.title, r.hits, on)))
          .when(Boolean(this.query), (el) => el.child(div().text_size(11.5).text_color(t.dim).child(r.e.group)))
          .when(Boolean(k), (el) => el.child(key(k))),
      );
    });
    return v_flex()
      .id("palette")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(18)
      .gap(10)
      .bg(t.popover)
      .on_key_down((e, cx) => {
        const k = e.key;
        if (k === "escape") return this.close();
        // Stops at the ends: wrapping jumps out of sight.
        if (k === "down") this.at = Math.min(this.at + 1, rows.length - 1);
        else if (k === "up") this.at = Math.max(this.at - 1, 0);
        else if (k === "pagedown") this.at = Math.min(this.at + SHOWN, rows.length - 1);
        else if (k === "pageup") this.at = Math.max(this.at - SHOWN, 0);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        h_flex()
          .h(36)
          .flex_none()
          .px(10)
          .gap(10)
          .items_center()
          .rounded(9)
          .border_1()
          .border_color(t.accent)
          .bg(t.background)
          .child(svg("mods/palette-zh/command.svg").size(16).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .child(
        rows.length
          ? div()
              .id("palette-rows")
              .relative()
              .mb(6)
              .when(fixed, (el) => el.h(LIST_H).overflow_hidden())
              .on_scroll_wheel((e, cx) => {
                // Wheels report lines, touchpads pixels.
                const d = Math.abs(e.delta.y) < 4 ? e.delta.y * ROW_H : e.delta.y;
                this.scroll = Math.max(0, Math.min(this.scroll - d, this.maxScroll));
                // The selection stays on screen, so the next frame doesn't scroll back to it.
                while (this.at < rows.length - 1 && tops[this.at].row < this.scroll) this.at++;
                while (this.at > 0 && tops[this.at].row + ROW_H > this.scroll + LIST_H) this.at--;
                cx.notify();
              })
              .children(fixed ? list : [v_flex().children(list)])
          : div().px(16).py(14).text_size(13).text_color(t.dim).child(`没有匹配 “${this.query}” 的命令。跳转到某个位置请用跳转面板。`),
      );
  }
}
