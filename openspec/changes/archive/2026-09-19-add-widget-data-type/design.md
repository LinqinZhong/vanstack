## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`packages/xml` 的 `PAGE_DATA_TYPES` 为 `num` / `str` / `bool` / `arr` / `obj`。`PageDataPanel` 按类型渲染行内 Number/String/Boolean 或 Array/Object 代码弹窗；它目前只接收 `variables`，不知道当前页面控件树。左侧 `Tree` 不可拖。变量行拖动排序用 HTML5 DnD，把行下标写进 `text/plain`。运行时仍不消费 `data`。

## Goals / Non-Goals

**Goals:**

- 把 `widget` 做成与现有类型对等的 `PageDataType`，XML 往返存控件 `id`。
- 控件类型的值只通过选择弹窗或从控件树拖入写入；列表只展示摘要。
- 拖入与现有变量行排序共用 HTML5 DnD，但用不同载荷，互不误伤。

**Non-Goals:**

- 不在本期把控件变量绑到事件、文案、样式或预览运行时。
- 不支持多选控件，也不把控件类型做成数组。
- 不因删除控件而自动改写指向它的变量。
- 不把控件树拖动做成控件重排。

## Decisions

### 1. XML 用 `widget`，值只存控件 `id`

`PAGE_DATA_TYPES` 增加 `'widget'`。`<widget n="target">n1</widget>` 的文本就是控件 `id`；空元素表示未选。解析/序列化沿用现有 `parsePageData` / `serializePageData` 按类型名取子元素的循环，不必为控件类型单开字段。

`readVariableValue` 把 `widget` 当成字符串返回 `id`（空则 `''`），以便 Array/Object 字面量里的 `$data.xxx` 仍能引用；本期运行时渲染不读这个值。

备选：存 `{ id, type }` JSON。否决原因：类型可从控件树查出，XML 会变复杂，也和现有「值是文本」不一致。

备选：XML 标签用 `el` / `ctl`。否决原因：`widget` 和控件树用语一致，且出现在 `<data>` 内，不会和页面级 `text` / `button` 等控件标签冲突。

### 2. `PageDataPanel` 接收当前控件树，弹窗复用树标签

`ProjectEditorPage` 把 `widgets` 传给 `PageDataPanel`。值列：已选且仍存在时用与左侧控件树相同的标签（如 `文本 · hello`）；未选显示空占位；id 找不到时显示缺失文案，仍保留原值。点「选择」打开 Modal，里面是当前页面控件树，单选后确认写入 `id`；提供清空。只读时按钮禁用。

控件类型不走 Array/Object 的 CodeMirror 弹窗。改类型为 `widget` 时 `defaultPageDataValue` 返回 `''`。

备选：用 Ant Design `Select` 扁列所有控件。否决原因：用户明确要弹窗，且嵌套控件树需要层级。

### 3. 控件树只在数据 tab 可拖出；用自定义 MIME，避免和行排序打架

仅当 `centerTab === 'data'` 且可编辑时，左侧 `Tree` 设 `draggable`，`allowDrop` 恒为 false，避免拖动改控件树。`dragStart` 写入自定义类型（例如 `application/x-vanstack-widget-id`）为控件 `id`，不要只写 `text/plain`。

`PageDataPanel` 在行的 `dragOver` / `drop` 上：
- 若载荷是控件 id：仅当该行 `type === 'widget'` 时写入，否则忽略；不要把它当成行下标去 `moveVariable`。
- 若载荷是行下标：保持现有排序逻辑。

只读或非数据 tab 不启用树拖出。拖入改值走现有 `onChange` / `commitDraft`，不 coalesce 成连续输入。

备选：拖到面板空白处自动新建一条控件变量。否决原因：用户说的是拖到已有数据上，自动新建会打乱默认 Number 新增习惯。

## Risks / Trade-offs

- [Ant Design Tree 开启 `draggable` 可能让人以为能重排控件] → `allowDrop={() => false}`，且仅数据 tab 开启。
- [变量行排序读 `text/plain` 下标，控件 id 被 `Number(...)` 会变成 `NaN`] → 自定义 MIME 优先判断；没有控件载荷才走排序。
- [删除控件后变量变缺失] → 不自动清空，避免隐式改 XML / 撤回历史；列表给缺失态，用户可重选或清空。
- [隐藏画布时仍可从左侧树拖] → 这是预期；拖的是控件 id，不依赖画布命中。

## Migration Plan

- 既有无 `widget` 的 `<data>` 原样解析。
- 无需数据库或 API 迁移；保存草稿/版本时随 XML 写入。
- 回滚：去掉 `widget` 类型后，含 `<widget>` 的条目会被当成未识别子元素忽略，其余变量与控件仍可解析。
