## 1. XML 与渲染

- [x] 1.1 在 `WidgetStyle` 增加 `position` 与 `top` / `right` / `bottom` / `left`，导出 `POSITION_MODES`（含 `static`）。`compactWidgetStyle` 丢掉静态、非法值，以及静态上的四边；`sanitizeWidgetStyle('swiper-item')` 剥离定位与四边。用带 `position`/`inset`/分边、非法 `position`、静态带 `top`、以及 `swiper-item` 带定位的示例 XML 跑通解析→序列化→再解析
- [x] 1.2 `parseStyle` / `styleAttrs` 读写 `position`、`inset` 缩写与 `top` / `right` / `bottom` / `left`；四边相等合并为 `inset`，缺省不落盘。确认无这些属性的旧 XML 仍只得到原有样式
- [x] 1.3 在 `@vanstack/lowcode-runtime` 的 `widgetCss` 写出非静态 `position` 与已设置边的 `px` 偏移；静态时不写偏移 CSS。用相对/绝对/固定/吸附与静态（含手写 `top`）的 XML 确认管理后台预览与 H5 表现符合 spec

## 2. 快捷键与增量

- [x] 2.1 `widgetShortcuts` 增加 `position`（`Mod+L`，无 Shift），纳入 `isBoxGroupShortcut`。确认 `Ctrl+L` 不聚焦地址栏；无选中、只读或 `swiper-item` 时不改分组
- [x] 2.2 `BoxDragKind` 增加 `position`，选边走边距的 `1`–`7`；拖动复用外边距公式（向外为正、可负、过 0 阻力、`Alt` 镜像、`Shift` 吸附）。未设置边从计算像素起步。用若干 dx/dy 组合确认结果符合 spec

## 3. 气泡、检查器与画布

- [x] 3.1 气泡增加定位分组：方式 `Select`；仅非静态时显示四边输入与层级（`z-index`）；`swiper-item` 不显示入口。tooltip 带 `Ctrl+L` / `⌘+L`。中英 i18n 补定位与层级标签
- [x] 3.2 检查器为非 `swiper-item` 增加 `position`；`inset` 与四边像素项仅非静态出现，与气泡写同一套字段。选中 `swiper-item` 时这些项不可见
- [x] 3.3 定位分组打开且定位非静态时在边框盒四边叠控制条、遮罩、取消/确定，并画出定位对齐辅助线（相对为静态位置盒四边；绝对/固定/吸附按生效边画包含块上/下/左/右，某一方向未设置则该方向两条都画）。静态时不叠控制条且不改偏移。打开时快照定位与四边，取消一并恢复。预览消息 `spacingDrag` 增加 `position`，`LIVE_STYLE_KEYS` 含定位相关 CSS。验证：`Ctrl+L` 打开、静态无控制条、切到相对后出现控制条与原点轴、`1`/`4` 选边、拖上边增大 `top`、`swiper-item` 无效、预览/只读无效、`Tab` 切可定位兄弟时保持分组
- [x] 3.4 编辑态 `fixed` 相对 375×667 屏幕（`.preview-mount`）而不是溢出画布或 iframe 视口；原点辅助线与未设置边测量同步用该屏幕盒。H5 仍相对浏览器视口，渲染器不把 `fixed` 改写成 `absolute`
