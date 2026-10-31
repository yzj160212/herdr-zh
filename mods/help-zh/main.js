// The keybind list (Herdr's prefix+?), grouped, filterable by typing.
// Reads keys.json through keys(); edit keys.json to change any of them.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { keys, props, closeOverlay, theme } from "herdr";

const GROUPS = [
  ["空间", /^space\./],
  ["标签页", /^tab\./],
  ["窗格", /^pane\./],
  ["代理", /^agent\./],
  ["终端", /^terminal\.|^send:/],
  ["窗口与其它", /./],
];

// 命令名 -> 中文说明（与 herdr-app commands 一一对应）。
const NAMES = {
  "space.new": "新建空间", "space.close": "关闭空间", "space.rename": "重命名空间",
  "space.move": "移动空间位置", "space.select": "切换到空间", "space.next": "下一个空间",
  "space.prev": "上一个空间",
  "tab.new": "新建标签页", "tab.close": "关闭标签页", "tab.rename": "重命名标签页",
  "tab.move": "移动标签页位置", "tab.select": "切换到标签页", "tab.next": "下一个标签页",
  "tab.prev": "上一个标签页", "tab.settle": "收起标签页（仍在运行）", "tab.unsettle": "展开收起的标签页",
  "pane.split": "分屏", "pane.close": "关闭窗格", "pane.zoom": "放大/还原窗格",
  "pane.focus": "聚焦窗格", "pane.go": "移到窗格", "pane.swap": "交换窗格",
  "terminal.open": "新建终端", "terminal.kill": "结束终端", "terminal.keep": "把终端固定为窗格",
  "terminal.park": "收回终端窗格", "terminal.peek": "预览终端", "terminal.show": "在窗格中显示终端",
  "terminal.copy": "复制", "terminal.paste": "粘贴", "terminal.paste_image": "粘贴图片为文件",
  "terminal.right_click": "右键行为",
  "agent.next": "下一个代理", "agent.prev": "上一个代理", "agent.focus": "显示代理",
  "layout.switch": "切换布局", "layout.clone": "复制布局", "layout.set": "修改布局结构",
  "layout.toggle": "显示/隐藏布局节点", "layout.show": "显示布局节点", "layout.hide": "隐藏布局节点",
  "layout.resize": "调整布局尺寸", "layout.select": "切换堆叠子节点", "layout.reset": "重置布局",
  "mod.clone": "复制模块", "mod.open": "打开模块", "overlay.close": "关闭浮层",
  "app.help": "快捷键", "app.palette": "命令面板", "app.settings": "设置", "app.welcome": "欢迎页",
  "app.whats_new": "更新内容", "app.feedback": "发送反馈", "app.check_updates": "检查更新",
  "app.update_core": "更新 herdr-core", "app.update": "重启并应用更新", "app.reset": "恢复默认界面",
  "app.theme": "主题", "app.zoom_in": "放大界面", "app.zoom_out": "缩小界面",
  "app.zoom_reset": "还原缩放", "app.quit": "退出 Herdr", "app.hide": "隐藏 Herdr",
  "app.hide_others": "隐藏其它应用", "app.show_all": "显示全部应用",
  "window.close": "关闭窗口", "window.minimize": "最小化窗口", "window.maximize": "最大化窗口",
};
const ARGS = { left: "左", right: "右", up: "上", down: "下", program: "程序", menu: "菜单" };

function label(action) {
  if (action.startsWith("send:")) return "输入 " + JSON.stringify(action.slice(5));
  const [name, arg] = action.split(":");
  const words = NAMES[name] ?? name.replace(/[._]/g, " ");
  return arg ? `${words} · ${ARGS[arg] ?? arg}` : words;
}

export default class Help extends View {
  init(_props, cx) {
    this.filter = "";
    this.input = InputState.new({ placeholder: "输入以筛选…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); cx.notify(); });
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  render(cx) {
    const t = theme();
    const f = this.filter.toLowerCase();
    const all = keys().filter((k) => !f || k.keys.includes(f) || label(k.action).includes(f));
    const seen = new Set();
    const groups = GROUPS.map(([name, re]) => {
      const rows = all.filter((k) => !seen.has(k) && re.test(k.action) && (seen.add(k) || true));
      return [name, rows];
    }).filter(([, rows]) => rows.length > 0);
    return v_flex()
      .id("help")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape") return closeOverlay(props().overlay);
      })
      .size_full()
      .min_h(0)
      .p(18)
      .gap(14)
      .bg(t.popover)
      .text_size(12)
      .child(
        h_flex()
          .h(22)
          .items_center()
          .justify_between()
          .child(div().text_size(15).font_semibold().text_color(t.foreground).child("快捷键"))
          .child(div().text_size(11).text_color(t.dim).child("Esc")),
      )
      .child(Input.new(this.input).h(36).flex_none().px(10).rounded(9).border_1().border_color(t.accent).bg(t.background).text_size(12.8).text_color(t.foreground))
      .child(
        v_flex()
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .py(2)
          .gap(10)
          .children(
            groups.map(([name, rows]) =>
              v_flex()
                .gap(2)
                .child(div().text_size(11.5).font_medium().text_color(t.dim).child(name))
                .children(
                  rows.map((k) =>
                    h_flex()
                      .h(32)
                      .px(8)
                      .rounded(7)
                      .items_center()
                      .child(div().w(190).text_color(t.accent).child(k.keys + (k.section !== "global" ? `  (${k.section})` : "")))
                      .child(div().text_color(t.foreground).child(label(k.action))),
                  ),
                ),
            ),
          ),
      );
  }
}
