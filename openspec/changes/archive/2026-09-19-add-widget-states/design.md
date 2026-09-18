## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`PageWidget` 只有一套 `style` / `flex` / `item` / `swiper`。`parseWidgets` 只认 `text` / `button` / `flex` / `swiper` / `swiper-item`，其余子节点丢弃；`text` / `button` 序列化为空子节点。工作台 `updateWidget` → `patchWidget` 直接改这套字段，`sendPreview` 把整份 XML 交给 iframe，`renderPageXml` 按控件当前字段渲染。画布已有不随镜头移动的叠加层（`canvas-toolbar`、气泡）。属性名沿用现有 XML 词表（`background`、`font-size` 数字、`underline="true"` 等），不采用需求示例里的 `backgroundColor` / `fontSize="12px"` 写法。

## Goals / Non-Goals

**Goals:**

- 在 `@vanstack/xml` 把 `<_>` / `<__>` / `state` 做成与控件树同构的数据，解析、差异压缩、合并共用一套函数。
- 渲染只吃合并后的控件字段，编辑态与运行态走同一 merge，差别只在「用哪个状态名」。
- 工作台用作用域根 + 查看状态驱动列表、检查器、气泡和画布手势，避免每条属性通道自己判断 XML 标签。

**Non-Goals:**

- 不改页面根、`<data>`、i18n 的 XML 形状。
- 不为 `_` 另发明一套属性名；不把文案/子树按状态分叉。
- 不在 v1 做通用事件驱动切状态；仅保留约定：名为 `hover` 的状态在预览与 H5 悬停时自动命中。

## Decisions

### 1. 控件上拆三块：拥有的状态、后代覆盖、选用名

```ts
type WidgetStateDelta = {
  name: string;
  style?: WidgetStyle;
  flex?: FlexContainerStyle;
  item?: FlexItemStyle;
  swiper?: SwiperStyle;
  states?: WidgetStateDelta[]; // `<__>` 内的子 `<_>`
};

// 附加在每个 PageWidget 上
states?: WidgetStateDelta[];       // 本控件的 <_>
stateOverrides?: WidgetStateDelta[]; // 本控件的 <__>
appliedState?: string;             // 元素属性 state
```

默认状态仍是控件自身的 `style` / `flex` / `item` / `swiper`。`id`、`type`、`children`、`value` / `text` 不进 delta。

备选：把默认也做成名为 `default` 的 `<_>`。否决原因：与既有 XML 不兼容，且默认本就是元素属性。

备选：后代覆盖挂在祖先的 `states[].children` 上。否决原因：序列化必须写在后代元素里，按控件拆 delta 才能往返。

### 2. 解析时先剥状态节点，再走原控件列表

`parseWidgets` 对每个宿主的子 `OrderedNode`：名为 `_` 的进 `states`（无 `name` 或重名丢弃，保留第一份），名为 `__` 的进 `stateOverrides`。二者都先走现有 `parseStyle` / `parseFlex` / `parseItem` / `parseSwiper`，再丢掉 `id` / `value` / `text`。其余节点仍按控件解析。`text` / `button` 也要读子节点列表，不能再假设永远为空。

序列化：先写 `<_>`，再写 `<__>`，再写可渲染子控件。空 delta 仍写出 `<_ name="..." />`（声明状态存在）；空的 `<__>` MUST NOT 写出，除非其中含有子 `<_>`。`appliedState` 仅当该控件拥有该名（顶层 `_` 或某 `<__>` 内的 `_`）时写出。

`name` 规则：非空、去空白；不做 CSS 标识符强制，非法字符原样保留，空串丢弃。

### 3. 合并与差异是纯函数，渲染与编辑共用

```
resolve(widget, stateName, role):
  default = widget 的 style/flex/item/swiper
  delta = role === 'owner' ? states[name] : stateOverrides[name]
  return shallowMerge(default, delta)  // delta 缺字段则用 default
```

`diff(default, next)`：逐字段比较（沿用 `compact*` 与现有相等判断，如 `boxLengthsEqual`），只留下不同项；结果为空则 `undefined`。

渲染：自顶向下带 `activeName`。控件若有 `states`，则它是新的作用域根，`activeName` 改为 `appliedState`。子节点用该 `activeName` 做 `resolve`；有 `states` 的子节点用自己的选用，不再吃祖先的 `__` 逻辑——它的 `_` 是自己的状态机，它的 `__` 仍按最近祖先名匹配。

H5 与预览模式：无覆盖，只用 `appliedState`；若控件拥有名为 `hover` 的 `<_>`（顶层或当前继承上下文内的子状态），鼠标进入该控件时临时把该拥有者的当前状态切到 `hover`，离开后回落。编辑模式：`renderPageXml` 增加 `viewingOwnerId` + `viewingState`（`null` 表示默认），且 MUST NOT 自动命中 `hover`。从该 owner 往下的子树用查看名替换选用名，嵌套拥有者在此覆盖期间不再重置为自身 `appliedState`，以便选中子控件时仍能查看祖先继承态。

备选：工作台先 flatten 再发给 iframe。否决原因：两套 XML 形状，拖动手势与运行时容易不一致。

### 4. 工作台列表：继承可见、创建落在选中控件

列表项 = 选中控件的默认（拥有） + 祖先 `<_>`（继承） + 自身 `<_>`（拥有）。查看状态是工作台内存（`viewingOwnerId` + `viewingState`），其 owner 是该行对应的声明者：点继承态时 owner 是祖先，点拥有态时 owner 是选中控件。切选中时：若新列表仍含同一 owner+name 则保留查看；否则回到该控件自己的选用（没有则默认）。

所有属性写入（检查器、气泡、盒模型拖动、快捷键）仍走 `updateWidget`，但按查看状态：

- 查看默认，或补丁含 `value` / `text`：写控件自身（文案永远共享）。
- 查看选中控件自己的命名状态：把解析后的新属性 `diff` 回 `states[name]`。
- 查看祖先命名状态：`diff` 回 `stateOverrides[name]`；delta 空则删掉该项。

创建经弹窗确认：名称必填且在选中控件全部 `<_>`（顶层与所有 `__` 内子状态）中唯一，各组 `initial` 可重复；「创建于」默认当前查看项。新 `<_>` 写在选中控件上。从默认复制 → 空 `<_ name>`，不复制后代 `__`。从自身命名状态复制 → 深拷贝对应 `_` 与子孙同名 `__`。从继承态复制 → 把选中控件对源名的 `__`（若有）写成新 `_`，并拷贝子孙同名 `__`。创建后查看并选用新名。重名的嵌套 `<_>` 解析与序列化时丢弃，状态树不展示。

重命名/删除只作用于选中控件拥有的自定义状态：同步 `appliedState` 与子孙 `__`。默认与继承行没有这些入口。

选用：右键「设为默认」写选中控件的 `appliedState`；对默认项则删除该字段。左键只改查看。点击继承态不写 `state`。使用中的项在名称后打绿色勾。

### 5. 画布列表是屏幕空间叠加层

在 `.canvas-stage` 内、与 `canvas-toolbar` 同级的绝对定位面板：`left: 12px; bottom: 56px`（避开底部工具条），不随平移/缩放。只在编辑模式、布局页签、且有选中控件时显示。状态树：同级 `initial` 在前，自身顶层 `<_>` 为叶子，继承态为可折叠非叶子（其下再是该上下文的 `initial` 与 `<__>` 内子状态）。覆盖滚动条，悬停显示。拥有态白色、继承态灰白色。当前查看行高亮。使用中的叶子带绿色对勾，非叶子不打勾。左键改查看。右键：叶子可设为默认/编辑/删除；继承态可添加状态。底部「添加状态」加顶层状态。预览模式隐藏列表，渲染改回选用状态。

样式靠近 `canvas-toolbar`（半透明深底、细边框）。中英 i18n。指针事件 `stopPropagation`，避免拖动画布。

备选：放进右侧检查器。否决原因：需求指定画布红框区域，且切状态应不依赖检查器是否打开。

### 6. 预览协议只加两个可选字段

`LowcodePreviewMessage` 增加 `viewingOwnerId: string | null`、`viewingState: string | null`。`mode === 'edit'` 时带上；预览模式恒为 `null`。`PreviewPage` 传给 `renderPageXml`。H5 不传。既有消息仍合法。

## Risks / Trade-offs

- [fast-xml-parser 对标签名 `_` / `__` 的 preserveOrder 键异常] → 实现时用最小 XML 往返验证；若构建器转义失败，显式按 `OrderedNode` 拼 `_` / `__` 键，不改标签名。
- [编辑态覆盖与 XML `state` 不一致，作者以为切查看即改运行态] → 左键只查看；右键「设为默认」才写 `state`。使用中项打绿色勾。预览模式强制按选用渲染。
- [在命名状态下改尺寸/边距，diff 把整份 style 写进 `__`，XML 变胖] → `diff` 必须按字段、不能整对象替换；与默认相等的键丢掉。
- [嵌套拥有者让外层状态在内层选中时消失] → 列表同时展示继承态与拥有态；查看继承态时覆盖从祖先向下锁定，不让内层 `appliedState` 抢走画布。
- [复制状态遍历整棵子树] → 页面控件量小，跟现有 `updateWidgetById` 同级，不另做索引。

## Migration Plan

无数据库或 API 迁移。无 `<_>` / `<__>` / `state` 的旧 XML 继续可解析，行为与现在相同。非法 `name` 或未知 `state` 值丢弃该节点或回落默认，不使整页失败。

## Open Questions

- （无；拥有态支持重命名与删除，创建经弹窗确认并落在选中控件。）
