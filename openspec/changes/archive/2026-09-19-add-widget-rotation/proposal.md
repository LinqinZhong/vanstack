## Why

工作台已能改尺寸、边距、圆角与定位，但控件无法绕 X / Y / Z 旋转。作者需要在画布上用快捷键、拖动、方向键和角度输入直观地转控件，并把结果写进页面 XML，编辑态与 H5 立刻看到 3D 效果。

## What Changes

- 控件样式 MUST 支持独立的 `rotate-x` / `rotate-y` / `rotate-z` 角度。单位 MUST 为 CSS 角度：`deg`（默认）、`rad`、`grad`、`turn`。缺省或 `0` MUST 不写入 XML。
- 渲染 MUST 把这三轴写成 CSS `rotateX` / `rotateY` / `rotateZ`；页面预览宿主 MUST 提供透视，使绕水平/竖直轴的旋转可见。无这些属性的既有页面 MUST 仍合法，视觉上不旋转。
- 气泡 MUST 增加旋转分组；编辑草稿且已选中控件时，`Ctrl+Shift+R` / `⌘+Shift+R` MUST 立刻打开该分组（已打开时 MUST NOT 关掉），并挡住浏览器强制刷新。
- 旋转分组打开后 MUST 在选中控件上显示三轴操纵环，可用鼠标拖动改对应轴；按住 `1`（Z）、`2`（水平轴 X）、`3`（竖直轴 Y）时，方向键上下与拖动 MUST 只改该轴。也可在气泡、检查器或小键盘直接输入角度并切换单位。
- `swiper-item` MUST 仍可旋转（变换不影响铺满滑动槽）。取消/确定、遮罩、撤回合并与其它盒分组相同。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 控件可持久化并渲染三轴旋转；工作台用气泡、检查器与 `Ctrl+Shift+R` 画布手势编辑角度与单位。

## Impact

- `@vanstack/xml`：`WidgetStyle` 增加 `rotateX` / `rotateY` / `rotateZ`（带单位）；解析、序列化、`compact`。
- `@vanstack/lowcode-runtime`：`widgetCss` 写出 `transform`；预览宿主加透视。管理后台 iframe 与 H5 共用。
- `frontend-admin`：气泡分组、检查器、`widgetShortcuts` 的 `Mod+Shift+R`、画布三轴拖动与键盘、帮助与 i18n。
- 非目标：变换原点、自定义透视距离、缩放/倾斜、多选、把旋转做成动画时间轴。
