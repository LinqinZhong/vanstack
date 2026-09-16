## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`@vanstack/xml` 的 `PageWidget` 只有扁平的 `text` / `button`，`parsePageXml` 只遍历 `page` 的直接子节点。`@vanstack/lowcode-runtime` 按数组映射为 `span` / `button`。工作台 `ProjectEditorPage` 用 `List` 展示控件，`addWidget` 总是追加到根数组；`WidgetStyleFields` 只覆盖字体与盒样式。预览点击用 `[data-widget-id]` 的 `closest` 选中，嵌套后仍可工作。`lowcode-page` 的 CSS 给文本/按钮加了横向 `margin`，会干扰弹性项目。

## Goals / Non-Goals

**Goals:**

- 把页面 AST 从扁平列表改成可递归的控件树，使 `flex` 能嵌套且 XML 往返不失子树。
- 用现有属性管道（kebab-case XML 属性、缺省不序列化）落地容器属性与项目属性，不引入新包。
- 工作台用「选中弹性盒再添加」完成嵌套，公共渲染器递归 `createElement`，两端 CSS 复位弹性项目上的旧间距。

**Non-Goals:**

- 不引入拖拽排序、绝对定位或 Grid。
- 不暴露 `flex-flow` / `flex` / `place-*` 缩写。
- 不改页面/版本 API、OSS 键或预览 postMessage 协议。
- 本期不为弹性盒增加宽高、padding、margin 等盒模型字段（沿用现有背景/边框/圆角/阴影即可）。

## Decisions

### 1. `PageWidget` 改为递归树，弹性属性与视觉样式分开

```ts
type FlexContainerStyle = {
  display?: 'flex' | 'inline-flex';
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline';
  alignContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch';
  rowGap?: number; // px
  columnGap?: number; // px
};

type FlexItemStyle = {
  order?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: 'auto' | number; // number = px
  alignSelf?: 'auto' | 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline';
};

type PageWidget =
  | { type: 'text'; id: string; value: string; style?: WidgetStyle; item?: FlexItemStyle }
  | { type: 'button'; id: string; text: string; style?: WidgetStyle; item?: FlexItemStyle }
  | { type: 'flex'; id: string; children: PageWidget[]; style?: WidgetStyle; flex?: FlexContainerStyle; item?: FlexItemStyle };
```

`parseWidgets(nodes)` 递归解析；`flex` 节点的子数组再调用自身。序列化时 `flex` 的 children 写入元素子节点，容器属性写在 `flex` 上，项目属性写在每个子控件上。

`gap` 不进入内部模型：编辑与 AST 只存 `rowGap` / `columnGap`。序列化时两者相等且均有值则写 `gap`，否则分别写 `row-gap` / `column-gap`。解析时先读 `gap` 填两侧，再让显式 `row-gap` / `column-gap` 覆盖。

长度与现有 `border-width` 一致：XML 中无单位数字表示 px；`flex-basis` 为 `auto` 时写字面量 `auto`。非法枚举或非数字 MUST 丢弃该字段，不抛整页错误。

备选：全部塞进 `WidgetStyle`。否决原因：容器字段只对 `flex` 有意义，项目字段只对子项有意义，混在视觉样式里会让 `compactWidgetStyle` 与检查器分支更糊。

备选：扁平列表 + `parentId`。否决原因：XML 已是树，扁平化再还原增加一致性成本。

### 2. 工作台树操作：选中容器即插入点

在 `ProjectEditorPage` 用树辅助函数（查找、不可变更新、按 id 判断父级是否为 `flex`）替换根数组 `map`。

- `addWidget(type)`：若 `selectedWidget.type === 'flex'`，追加到其 `children`；否则追加到页面根。
- 控件树改用 Ant Design `Tree`（项目已依赖 antd），按嵌套渲染；空弹性盒仍显示为可选节点。
- 属性面板：`flex` 展示容器字段 + 现有盒样式（隐藏字体类字段）；仅当父级为 `flex` 时展示项目字段。根级控件的 `item` 在保存路径上保持 `undefined`。

`updateWidget` 需能改 `value` / `text` / `style` / `flex` / `item` / `children`。`selectedWidget` 改为树查找，不再 `widgets.find`。

备选：始终加到根，靠拖拽进盒。否决原因：规格明确选中弹性盒后添加即成为其子控件，且本期不做拖拽。

### 3. 运行时递归渲染 + 宿主 CSS 复位

`widgetElement` 递归：

- `flex` → `div.lowcode-flex`，`display` 默认 `flex`，合并盒样式、容器 CSS、项目 CSS。
- 子控件同样带 `data-widget-id` / `data-widget-type`，预览 `closest` 仍选中最内层。
- 空 `flex` 仍 `render` 该 `div`。高度折叠时 DOM 仍在；编辑态由 admin CSS（如 `.is-editing .lowcode-flex`）给最小高度与虚线，H5 不加编辑铬。

`frontend-admin` 与 `frontend-app` 增加 `.lowcode-flex > .lowcode-text` / `.lowcode-flex > .lowcode-button`：去掉横向 margin，保留 `box-sizing`。不把工作台协议放进 runtime 包。

备选：把默认 `min-height` 写进 runtime 内联样式。否决原因：会改变 H5 空盒子尺寸，编辑铬应留在宿主。

## Risks / Trade-offs

- [弹性项目 CSS 被页面级 `margin` 干扰] → 仅在 `.lowcode-flex` 直接子级复位间距，根级文本/按钮外观不变。
- [点击子控件无法选中外层弹性盒] → 接受 `closest` 选最内层；要改外层请用控件树。不改预览协议。
- [既有穷尽匹配 `PageWidget['type']` 的代码漏掉 `flex`] → 编辑页添加入口、检查器、序列化、runtime 四处改为显式分支；未知类型保持忽略。
- [深层嵌套导致查找/更新写错不可变路径] → 集中一组递归 helper，避免在 JSX 里手写多层 map。
- [历史 XML 无 `flex`] → 解析路径保持对 `text`/`button` 兼容，不迁移存量对象。

## Migration Plan

1. 先改 `@vanstack/xml` 类型与递归解析/序列化，用含嵌套 `flex` 与 gap 往返的示例确认；再用旧的扁平 XML 确认行为不变。
2. 改 runtime 递归渲染，再改 admin 树/检查器/i18n 与两端 CSS。
3. 验证：工作台添加弹性盒 → 选中后加入文本/按钮/嵌套弹性盒 → 改容器与项目属性见 iframe 即时变化 → 存版本再读回属性一致；同一 XML 在 H5 布局一致；根级控件检查器无项目属性。
4. 回滚：还原 xml/runtime/admin/app 改动即可；已保存的含 `flex` 的版本在旧代码中会被当成未知元素忽略，文本/按钮仍在根级时仍能渲染。若根下只有 `flex`，旧运行时会显示空页。

## Open Questions

- 编辑态空弹性盒的虚线/最小高度具体像素可在实现时按画布观感调整，不影响规格与任务切分。
