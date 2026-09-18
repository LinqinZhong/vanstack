## Why

工作台已能改宽高与内外边距，但控件仍只能走文档流，无法在画布上指定静态、相对、绝对、固定或吸附定位，也无法用与边距相同的手势微调 `top` / `left` / `right` / `bottom`。作者需要把定位方式与四边偏移写进页面 XML，并在编辑态立刻看到效果。

## What Changes

- 控件样式 MUST 增加定位方式：`static`（静态）、`relative`（相对）、`absolute`（绝对）、`fixed`（固定）、`sticky`（吸附）。缺省为静态，MUST 不写入 XML。
- 控件样式 MUST 支持独立设置 `top` / `right` / `bottom` / `left`（`px` / `%`，可缺省；像素可为负）。渲染 MUST 按 CSS `position` 与对应偏移生效。静态（含缺省）MUST NOT 设置、持久化或渲染这些偏移；检查器、气泡与画布 MUST NOT 提供四边入口。
- 定位非静态时 MUST 可设置 `z-index`（整数，可负，可缺省）；静态时 MUST NOT 持久化。工作台中文标签为「层级」。
- 气泡 MUST 增加定位分组；编辑草稿且已选中可定位控件时，`Ctrl+L` / `⌘+L` MUST 立刻打开该分组（已打开时 MUST NOT 关掉），并挡住浏览器把焦点送到地址栏。定位非静态时 MUST 像边距一样在四边显示控制条，可用拖动、`1`–`4` 选边、小键盘与方向键改偏移，并 MUST 画出定位对齐辅助线（相对按静态位置盒，绝对/固定/吸附按包含块；按生效边画，某一方向未设置则该方向两条都画）。
- `swiper-item` MUST 固定为静态：检查器与气泡 MUST NOT 展示定位入口，快捷键 MUST NOT 打开定位分组，XML 上的 `position` 与四边偏移 MUST 被忽略。
- 无 `position` / 偏移属性的既有页面 XML MUST 仍合法，视觉上保持静态文档流。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 控件可持久化并渲染定位方式与四边偏移；工作台用气泡、检查器与 `Ctrl+L` 画布手势编辑；滑动器页保持静态。

## Impact

- `@vanstack/xml`：`WidgetStyle` 增加 `position`、`zIndex` 与 `top` / `right` / `bottom` / `left`；解析、序列化、`compact` / `sanitize`（`swiper-item` 剥离这些字段）。
- `@vanstack/lowcode-runtime`：`widgetCss` 写出对应 CSS，管理后台 iframe 与 H5 共用。
- `frontend-admin`：检查器属性表、气泡分组、`widgetShortcuts` 的 `Mod+L`、`spacingDrag` 增加定位、画布控制条与 i18n。
- 非目标：百分比或逻辑属性偏移、页面根定位、把 `fixed` 改写成相对页面盒的 `absolute`、多选。
