// 重命名标签页：用中文版输入框（应用自带的 prompt 只有英文）。
// mod.open 不能带 props，所以把它做成一个只有 init 的模块：打开即弹出中文输入框。
import { View, div } from "gpui-kit";
import { spaces, openOverlay, props, closeOverlay } from "herdr";

export default class RenameTabZh extends View {
  init(_props, cx) {
    const space = spaces().find((s) => s.active);
    const tab = space?.tabs?.find((c) => c.active);
    if (tab) {
      openOverlay({
        mod: "prompt-zh",
        kind: "dialog",
        width: 380,
        props: {
          title: "重命名标签页",
          hint: "留空则恢复按序号命名",
          value: /^\d+$/.test(tab.name) ? "" : tab.name,
          command: { name: "tab.rename", args: { id: tab.id } },
        },
      });
    }
    const own = props()?.overlay;
    if (own) closeOverlay(own);
  }

  render() {
    return div().id("rename-tab-zh");
  }
}
