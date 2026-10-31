// 重命名空间：同上，中文输入框。
import { View, div } from "gpui-kit";
import { spaces, openOverlay, props, closeOverlay } from "herdr";

export default class RenameSpaceZh extends View {
  init(_props, cx) {
    const space = spaces().find((s) => s.active);
    if (space) {
      openOverlay({
        mod: "prompt-zh",
        kind: "dialog",
        width: 380,
        props: {
          title: "重命名空间",
          hint: "留空则恢复按所在目录自动命名",
          value: space.named ? space.name : "",
          command: { name: "space.rename", args: { id: space.id } },
        },
      });
    }
    const own = props()?.overlay;
    if (own) closeOverlay(own);
  }

  render() {
    return div().id("rename-space-zh");
  }
}
