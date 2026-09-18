## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：控件样式已经在 `@vanstack/xml` 的 `WidgetStyle` 与检查器 `WidgetStyleFields` 中完整存在（文字色/阴影/斜体/字重/下划线/删除线，背景，四边 margin/padding/border-width，四角 radius，box-shadow）。检查器对边距同时展示「统一值 + 四边」，没有水平/竖直模式。画布预览在同源 iframe 里，用 CSS `zoom` 缩放，选中描边在 iframe 内；主窗口已能把 iframe 坐标映射到画布（`focus-widget`、滚轮）。iframe 目前只上报 click / dblclick / wheel / pointer / keydown，没有 hover。气泡必须叠在画布上且不被 `zoom` 缩小。

## Goals / Non-Goals

**Goals:**

- 气泡与检查器共用同一套样式 patch（`compactWidgetStyle` + 现有 `updateWidget(..., coalesceKey)`），不复制第二份样式模型。
- 边距/圆角/边框的四种编辑模式抽成可复用控件，气泡和检查器共用，避免两套交互。
- 气泡渲染在主窗口画布 overlay，不进公共渲染器、不进 H5。

**Non-Goals:**

- 不新增 `font-size` 或其它 XML 样式字段。
- 不把气泡放进 iframe DOM，不改 `@vanstack/lowcode-runtime` 的 CSS 映射。
- 不做拖拽改边距、不做页面级气泡、不做多选。

## Decisions

### 1. 气泡在主窗口 overlay，钉在画布右上角

`ProjectEditorPage` 在 `.canvas-stage` 上叠 `WidgetStyleBubble`，用 CSS `top/right` 固定在画布右上角。不随 `view` 平移缩放，不跟随控件矩形。`z-index` 高于 `canvas-toolbar`。

备选：气泡画在 iframe 内选中节点旁边。否决原因：会随 `zoom` 缩放，ColorPicker 弹出层会被裁切，且 H5/预览页不该承载工作台铬。

### 2. 点击选中后固定显示

编辑草稿且当前在布局 tab 时，选中任一控件即显示完整气泡（含设置图标）；未选中时右上角只留设置图标以打开页面属性。切预览或切走布局 tab 时隐藏。平移缩放时气泡仍留在画布右上角。

备选：仅悬浮选中控件时出现。否决原因：操作气泡时会挡住控件并随矩形抖动。

### 3. 气泡写同一 `WidgetStyle`，文字工具做成开关

`WidgetStyleBubble` 接收当前 `PageWidget` 与 `onChange(style)`，内部调用与检查器相同的 `patch` → `updateWidget(id, { style }, \`edit:${id}:style\`)`。连续改同一控件样式仍合并为一步撤回。

文字入口仅 `text` / `button`：

- 加粗：`fontWeight === '700'` 为开；打开写入 `'700'`，关闭写入 `undefined`（不保留 500/600，气泡是开关不是字重选择器；完整字重仍在检查器）。
- 斜体 / 下划线 / 删除线：布尔开关，与检查器同一字段。
- 颜色：`ColorPicker`。文字阴影：颜色清空即删阴影；有颜色时用现有 `x/y/blur/color` 序列化，默认 `0 0 4px`。

盒样式对全部类型：背景色；外边距、内边距、圆角与边框在气泡中用决策 4 的模式控件。边框线型与颜色仍是控件级各一个值，放在边框组里。

检查器弹窗 MUST 以「控件属性【类型-ID】」为标题，并以四列字符串属性表展示该控件的样式与类型字段。每项 MUST 为一个中文标签加一个字符串值，标签对应 CSS 属性名（如背景颜色/`backgroundColor`、边距/`margin`、上边距/`marginTop`、边框颜色/`borderColor`）。弹窗顶部 MUST 提供筛选输入，按标签或属性名过滤可见项。完整可视化边距/圆角/边框编辑仍在气泡中。

### 4. 边模式是视图开关，写入规则按模式切

抽出 `StyleBoxEdges`（或同等纯展示组件），`mode: 'unified' | 'sides' | 'horizontal' | 'vertical'` 为组件内 UI 状态，**不写入 XML**。切换模式不改当前四值，只改可见输入；用户改输入后才 patch。

| 模式 | 边（margin/padding/border-width） | 角（radius） |
| --- | --- | --- |
| 统一 | 一个值 → 四边 | 一个值 → 四角 |
| 上下左右 | 上/右/下/左 | 左上/右上/右下/左下 |
| 水平 | 左、右 | 左上+左下、右上+右下 |
| 竖直 | 上、下 | 左上+右上、左下+右下 |

统一模式下若四值不全相等，输入显示空（与现检查器 `unifiedEdges` 一致），填入后写四边。水平模式改左不自动改右。切控件时按值推断默认模式：四值相等（含全空）→ 统一；否则上下左右。

`WidgetStyleFields` 的 margin/padding/border/radius 换成该组件，去掉「统一输入 + 四边网格」并存的旧布局。

备选：水平模式一个值同时写左右。否决原因：规格写的是左右两边/两角，需要对边分开调。

### 5. 气泡结构：工具条 + 分组展开

第一行（紧凑图标条）：文字开关与色板（若有）、背景色、外边距、内边距、圆角、边框。第二区：外边距 / 内边距 / 圆角 / 边框分组，默认收起，点开后出现模式网格与对应输入。弹出层挂在气泡根节点。

不引入新依赖，继续用 antd `ColorPicker` / `InputNumber`。

## Risks / Trade-offs

- [从控件移到气泡时 iframe 先报 leave，气泡闪关] → 改为选中后固定显示，不再依赖悬停离开。
- [改样式导致 DOM 重绘，矩形过期] → 气泡钉在画布右上角，不跟控件矩形，也不跟画布平移缩放。
- [气泡挡住小控件，无法点选邻居] → 固定在画布右上角，不覆盖控件。
- [iframe `zoom` 与 stage `transform` 叠加算错位置] → 复用 `mapIframePoint` 映射矩形两角，不用假设 1:1 CSS 像素。
- [加粗开关丢掉检查器里的 500/600] → 规格允许关闭后回到未设置；字重选择仍在检查器。

## Migration Plan

无需数据迁移。既有四边/四角 XML 原样显示；新模式只影响编辑 UI。回滚即去掉 overlay 与 hover 协议，检查器可同时回退到旧边距布局。

## Open Questions

无。字号、页面气泡、多选已排除。
