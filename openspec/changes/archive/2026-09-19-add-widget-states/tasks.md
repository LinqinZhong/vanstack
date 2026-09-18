## 1. XML 模型与往返

- [x] 1.1 在 `PageWidget` 增加 `states` / `stateOverrides` / `appliedState`，导出 `WidgetStateDelta`。`parseWidgets` 从每个宿主子节点剥 `_` / `__`（无 `name` 或重名丢弃、保留第一份），`text` / `button` 也读子节点。用 spec 中的文本 `active` 示例、空 `<_ name="active" />` 的 flex、无 name、重名、页面根 `_`、无状态旧 XML 跑通解析→序列化→再解析，确认 `_` / `__` 不是控件
- [x] 1.2 序列化先写 `<_>` 再写 `<__>` 再写子控件；空 `_` 仍写出声明；空 `__` 不写；`appliedState` 仅在 `states` 含该名时写出，非法 `state` 不落盘。用 flex+子文本 `__`、孙节点仍为 `__`、未知 `__ name`、`state="missing"` 的示例确认往返符合 spec
- [x] 1.3 实现 `resolveWidgetState` 与按字段 `diffWidgetState`（沿用 `compact*` / `boxLengthsEqual`），缺字段继承默认，与默认相同的键不进 delta。`id` / `value` / `text` 不进 delta。用「只改 color 时 font-size 仍继承」和「改回默认则省略 color」两组数据确认

## 2. 运行时渲染

- [x] 2.1 `renderPageXml` 自顶向下按作用域根合并后再交给现有 `widgetElement`。无覆盖时用 `appliedState`，未设置或未知名回落默认。用「无 `state` 用默认色」「`state="active"` 用蓝底红」「祖先 `state` + 子 `__` 下划线、另一子无 `__`」三份 XML 确认管理后台预览与 H5 一致
- [x] 2.2 `RenderPageXmlOptions` 增加 `viewingOwnerId` / `viewingState`。仅从该 owner 子树用查看名替换选用名；未传则行为与现在的运行态相同。用同一份 XML 分别不传覆盖、传入查看 `active` 确认渲染差异

## 3. 工作台写入

- [x] 3.1 在 `widgetTree`（或并列模块）实现 `findStateOwner`、复制状态（默认→空 `<_>` 名 `state`/`state2`…；命名→拷贝根 delta 与子树同名 `__`，名 `active2`…）和按查看状态写入的 `patchWidget`。文案补丁始终写控件自身。用「从 active 复制后根与子差异改名保留」「在后代改色写出 `__`、改回默认删除 `__`」确认
- [x] 3.2 `ProjectEditorPage` 的 `updateWidget`、气泡、检查器、盒模型拖动都改当前查看状态下的解析属性。切查看状态不改 XML `state`。确认编辑 `active` 时默认色不变，改文案各状态共用

## 4. 画布列表与预览协议

- [x] 4.1 画布 stage 左下叠加状态树（不随镜头移动）：`initial` 同级最前；继承态为可折叠非叶子；底部「添加状态」加顶层状态，继承态右键也可添加子状态；覆盖滚动条悬停显示
- [x] 5.6 子状态写在 `<__>` 内的 `<_>`；只有叶子可编辑删除；默认显示名为 `initial`
- [x] 4.2 `LowcodePreviewMessage` 增加 `viewingOwnerId` / `viewingState`；编辑模式带上，预览模式为 `null`。`PreviewPage` 传给 `renderPageXml`。确认：切到 `active` 画布变蓝且 XML 无 `state`；标选用后出现 `state="active"`；再切预览且选用为默认时画布回默认色。选中子控件仍列出祖先状态

## 5. 列表交互跟进

- [x] 5.1 拥有态白色、继承态灰白色；使用中绿色对勾；左键只查看；右键「设为默认 / 编辑 / 删除」
- [x] 5.2 添加改为弹窗（名称、「创建于」默认当前查看项），确认后把新状态建在当前选中控件上
- [x] 5.3 拥有的自定义状态可重命名、删除，并同步子孙 `<__>` 与 `state`
- [x] 5.4 创建/编辑弹窗增加过渡时长（毫秒），写入 `<_ transition>`；进入该状态时作用域内控件使用该 CSS 过渡
- [x] 5.5 选中切换保持同名状态；嵌套拥有者可同时叠加祖先状态与自身选用，自身属性优先
- [x] 5.6 名为 `hover` 的状态在预览与 H5 悬停时自动命中，编辑模式不自动命中
