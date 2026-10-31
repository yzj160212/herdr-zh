// 空状态：没有打开空间时显示中文提示，并自动在终端与提示之间切换。
// 应用内建的那句「No space open. Make one (cmd-n).」是硬编码英文，
// 所以用一个整块的 stack 子节点盖住它，而不是浮层。

import { View, div } from 'gpui-kit';
import { v_flex } from 'gpui-base';
import { spaces, theme, window, run, layout } from 'herdr';

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class EmptyZh extends View {
  init(_props, cx) {
    cx.timer.every(700, () => this.sync());
  }

  // 有空间显示终端，没有就显示这句提示。
  sync() {
    const stack = find(layout(), 'main-stack');
    if (!stack) return;
    const want = spaces().length > 0 ? 'terminals' : 'empty';
    if (stack.active !== want) run('layout.select', { stack: 'main-stack', child: want });
  }

  render() {
    const t = theme();
    const mod = window()?.platform === 'macos' ? '⌘' : 'Ctrl';
    return v_flex()
      .id('empty-zh')
      .size_full()
      .bg(t.background)
      .items_center()
      .justify_center()
      .child(
        v_flex()
          .p(22)
          .gap(14)
          .rounded(12)
          .border_1()
          .border_color(t.border)
          .bg(t.chrome)
          .items_center()
          .child(div().text_size(13.5).text_color(t.muted).child(`还没有打开空间。新建一个（${mod}+N）。`))
          .child(div().id('empty-new').px(14).py(7).rounded(8).bg(t.solid).text_color(t.solid_foreground)
            .text_size(12.5).font_medium().cursor_pointer().hover((s) => s.opacity(0.9))
            .on_click(() => run('space.new')).child('新建空间')),
      );
  }
}
