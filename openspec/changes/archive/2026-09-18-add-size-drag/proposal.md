## Why

工作台已能在气泡里用数字改宽高，内外边距与圆角也能在画布上拖控制条。宽高仍只能靠检查器输入，选中控件后看不到尺寸操纵条，微调不直观。

## What Changes

- 气泡操纵栏 MUST 增加尺寸分组入口。编辑草稿且已选中可设宽高的控件时，`Ctrl+T` / `⌘+T` MUST 立刻打开该分组（并挡住浏览器新标签页），已打开时 MUST NOT 关掉。
- 尺寸分组打开后，MUST 在选中控件边框盒四边各放一条控制条：左右改宽度，上下改高度。按住某条向外拖 MUST 增大对应尺寸，向内拖 MUST 减小。宽高 MUST 钳在 `≥0`，MUST 写成像素。
- 默认一次只改按住边对应的那一维。按住 `Alt` 时 MUST 把宽和高写成相同值。按住 `Shift` 时 MUST 吸附（先另一维当前值、否则 5 的倍数）并显示磁铁图标。
- 打开尺寸时 MUST 沿用内外边距的遮罩、取消/确定（`Esc`/`Enter`）、小键盘输入与方向键微调；选维键 MUST 为 `1` 宽 / `2` 高 / `3` 宽高。关闭分组或取消选中后 MUST 隐藏。
- `swiper-item` MUST NOT 出现尺寸入口，快捷键 MUST NOT 打开尺寸分组。
- 不新增 XML 样式字段；继续写现有 `WidgetStyle.width` / `height`。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 工作台编辑态可从气泡操纵栏或 `Ctrl+T` 打开尺寸分组，并在画布上像边距一样拖动、点按数字与方向键改宽高。

## Impact

- `frontend-admin`：快捷键表、气泡分组、预览协议的 `spacingDrag` 增加 `size`，画布拖动写 `width`/`height` 像素值。
- 气泡与检查器仍写同一套 `WidgetStyle`；连续拖动合并为一步撤回。
- 中英 i18n 为尺寸入口补快捷键提示。
- 非目标：百分比拖动、`fit-content` 画布手势、页面级宽高、多选。
