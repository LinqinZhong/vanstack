## Why

当前页面只识别扁平的 `text` / `button`，无法把多个控件按弹性布局排列。工作台需要一个可嵌套的弹性盒控件，并暴露 CSS Flexbox 的全部可独立配置属性，才能在预览与 H5 中得到与编辑器一致的布局。

## What Changes

- 页面 XML 新增容器控件 `flex`，可嵌套 `text`、`button` 以及嵌套的 `flex`；未知元素仍被忽略。
- 弹性盒容器可配置全部 Flexbox 容器属性：`display`（`flex` / `inline-flex`）、`flex-direction`、`flex-wrap`、`justify-content`、`align-items`、`align-content`、`gap` / `row-gap` / `column-gap`。
- 弹性盒内的子控件可配置全部 Flexbox 项目属性：`order`、`flex-grow`、`flex-shrink`、`flex-basis`、`align-self`。
- 不单独暴露与上述属性等价的缩写（`flex-flow`、`flex`、`place-content`、`place-items`），避免检查器出现互相覆盖的重复入口。
- 工作台可添加弹性盒、把新控件加入当前选中的弹性盒（或页面根），并以树形展示嵌套关系；属性面板按选中节点展示容器或项目字段。
- 公共渲染器把 `flex` 渲染为 CSS 弹性容器，子控件按 XML 声明顺序成为弹性项目；管理后台 iframe 预览与 H5 对同一份 XML 布局一致。
- 已有仅含 `text` / `button` 的页面 XML 仍合法。`PageWidget` 联合类型扩展后，穷尽匹配控件类型的调用方必须处理 `flex`。

## Capabilities

### New Capabilities

- 无。弹性盒是现有页面控件契约的扩展，不单独成能力。

### Modified Capabilities

- `lowcode-runtime`: 页面 XML 识别并渲染 `flex` 容器；工作台支持添加、嵌套与配置全部 Flexbox 容器/项目属性；预览与 H5 共用该渲染。

## Impact

- `@vanstack/xml`：`PageWidget` 增加 `flex` 及子树；解析/序列化容器与项目属性。
- `@vanstack/lowcode-runtime`：递归渲染弹性容器，并把 Flexbox 属性映射为 CSS。
- `frontend-admin`：控件树、添加入口、属性面板与预览选中；`WidgetStyleFields` 需区分容器字段与项目字段。
- `frontend-admin` / `frontend-app` 样式：弹性项目不再依赖页面根上的横向间距假设。
- 后端页面/版本 API 与 OSS 存储不变；`parsePageXml` 校验会接受含 `flex` 的合法 XML。
- 中英 i18n 文案需覆盖弹性盒类型、添加动作与全部 Flexbox 属性标签。
