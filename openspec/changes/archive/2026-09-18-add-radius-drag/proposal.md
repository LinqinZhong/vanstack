## Why

工作台已能在气泡里用数字改圆角，内外边距打开后也能在画布上拖控制条。圆角仍只能靠输入，选中控件后看不到角上的操纵条，微调四个角不直观。

## What Changes

- 圆角分组打开后，MUST 在选中控件四角各放一条切线控制条（相对角平分线旋转 90°）。按住某角向控件内拖 MUST 增大该角；向外拖 MUST 减小。圆角 MUST 钳在 `≥0`。
- 默认一次只改按住的那一角。按住 `Alt` 时 MUST 同时改全部四个角，写成与当前角相同的值（按下 `Alt` 或按住 `Alt` 抓住控制条时立刻对齐）；松开后保持该值。按住 `Shift` 时 MUST 吸附（先其它角、否则 5 的倍数）并显示磁铁图标。
- 打开圆角时 MUST 沿用内外边距的遮罩、取消/确定（`Esc`/`Enter`）与指针跟手；关闭分组或取消选中后 MUST 隐藏。
- 编辑草稿且已选中控件时，`Ctrl+R` / `⌘+R` MUST 立刻打开圆角分组（并挡住浏览器刷新）；`Ctrl+Shift+B` / `⌘+Shift+B` MUST 立刻打开边框分组。已打开时 MUST NOT 关掉。
- 不新增 XML 样式字段。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 工作台编辑态打开圆角分组后，可在选中控件四角拖动改 `WidgetStyle` 圆角。

## Impact

- `frontend-admin`：预览协议的 `spacingDrag` 增加 `radius`；画布拖动写 `radiusTopLeft` 等四角。
- 气泡与检查器仍写同一套 `WidgetStyle`；连续拖动合并为一步撤回。
- 非目标：边框宽度拖动、页面级圆角、多选。
