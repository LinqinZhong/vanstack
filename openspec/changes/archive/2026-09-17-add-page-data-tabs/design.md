## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`ProjectEditorPage` 中间卡片标题为「预览」，`extra` 是 `screenWidth` 的 `InputNumber`（默认 375，高度常量 667）。草稿状态是 `widgets` + `pageStyle`，`serializePageXml` 只写控件与页面样式；`parseWidgets` 忽略未识别子元素，因此今天的 `<data>` 会被丢掉。历史快照 `HistoryEntry` 含 `widgets` / `pageStyle` / `selectedWidgetId`。仓库没有代码编辑器依赖。`@vanstack/lowcode-runtime` 只用 `page.widgets` 与 `page.style` 渲染。

## Goals / Non-Goals

**Goals:**

- 把页面变量做成 `PageXmlDocument` 的一等字段，解析/序列化往返，且不进入控件树。
- 中间卡片用 tab 切换布局/数据/事件，数据编辑复用现有 `commitDraft` 历史管道。
- Array/Object 用带只读函数外壳的代码编辑器，XML 里只存表达式文本，不把对象正规化成 JSON。

**Non-Goals:**

- 不把变量绑定到控件文案、样式或预览运行时。
- 不实现 `watch` 监听器、事件 tab 的编辑，也不改页面/版本 API。
- 不把变量暴露给 H5 应用的新 UI；运行时继续只渲染控件。

## Decisions

### 1. `PageXmlDocument.data` 存表达式文本，不求值

在 `packages/xml/src/page.ts` 增加：

```ts
type PageDataType = 'num' | 'str' | 'bool' | 'arr' | 'obj';
type PageVariable = {
  type: PageDataType;
  name: string;
  value: string;
  watch?: string;
};
type PageXmlDocument = {
  widgets: PageWidget[];
  style?: PageStyle;
  data?: PageVariable[];
};
```

`value` 始终是 XML 文本内容（`num` 为 `"1"`，`bool` 为 `"0"`/`"1"`，`arr`/`obj` 为用户输入的字面量）。`watch` 仅 `bool` 使用；缺省不写属性。无变量时 `data` 省略。

解析：在 `page` 子节点中取**第一个**页面级 `data`，按其子节点顺序收集 `num`/`str`/`bool`/`arr`/`obj`；其余页面子节点仍走 `parseWidgets`。后续多余的 `data`、嵌套在控件内的 `data`、以及 `data` 内未知标签一律忽略。缺 `n` 或 `n` 为空的条目忽略。

序列化：`page` 子节点为可选的 `<data>`（有变量时写在控件之前）再接下控件。空 `str` 必须写出 `<str n="name"></str>`，不能因 `suppressEmptyNode` 丢掉元素。

备选：把 `arr`/`obj` 解析成 JS 值再 `JSON.stringify`。否决原因：规格示例是 `{a:1,b:2}`，不是 JSON。

备选：把 `<data>` 当一种控件。否决原因：不能出现在预览里，也不能进控件树。

### 2. 中间卡片用 Tabs 换掉屏幕宽度，画布保持挂载

`editor-canvas-card` 的 `title` 改为 Ant Design `Tabs`（布局 / 数据 / 事件），去掉 `extra` 里的 `InputNumber`。`screenWidth` 状态删除，画布常量 `375 × 667`。

三个面板都留在同一张卡片里：布局显示现有 `canvas-wrap`；数据为变量表；事件为 `Empty`。切到数据/事件时**隐藏**画布而不是卸载 iframe，避免预览 `ready` 丢失、切回布局时整页重载。切换 tab 不写历史。

数据面板抽到独立组件（例如 `PageDataPanel`），`ProjectEditorPage` 只持有 `pageData` 状态并 `commitDraft`。

备选：把数据列表放到右侧页面属性。否决原因：用户要求替换预览标题栏这一块。

备选：卸载 iframe。否决原因：`sendPreview` / `readyRef` 会抖动，也更容易丢画布缩放。

### 3. 历史快照纳入 `pageData`

扩展 `HistoryEntry` 与 `commitDraft`：每次提交带上 `pageData`。`applyXml` / `resetWidgetSession` / 撤回 / 重做同步恢复变量列表。`xml` 的 `useMemo` 改为 `serializePageXml({ widgets, style: pageStyle, data: pageData })`。

连续改同一变量的同一字段（名、类型、值）用已有 `coalesceKey`（如 `data:${name}:value`）；新增、删除、改类型、拖动排序不合并。数据 tab 的输入与代码编辑器视为可编辑区域，沿用现有快捷键忽略规则，避免 `Backspace` 误删控件。

### 4. 列表用表格 + HTML5 拖动；代码编辑器用 CodeMirror 6

数据 tab：Ant Design `Table`，列 = 拖动手柄、变量名、类型、初始值、删除。行内：`Input` 改名（失焦校验 IdentifierName + 唯一）、`Select` 改类型（Number/String/Boolean/Array/Object，改类型立刻换成该类型缺省值）、Number 用 `InputNumber`，String 用 `Input`，Boolean 用只写 `0`/`1` 的开关。Array/Object 的值列是只读摘要 + 按钮，点开 Modal。

拖动：原生 HTML5 DnD 调换数组顺序后 `commitDraft`，不新增 dnd 库。新增默认名按 `var1`、`var2`… 找第一个未占用的 IdentifierName，默认类型 Number、值 `"0"`。

Array/Object Modal：三行结构，避免 Monaco 体积与 Vite worker 配置。

- 只读行：`function ${name}(){`
- CodeMirror 6（`@codemirror/lang-javascript`）编辑 `return ${value}`
- 只读行：`}`

确认时从可编辑文本取出 `return` 后的表达式：用 `new Function('"use strict"; return (' + expr + ');')` 求值校验——Array 必须是数组，Object 必须是非 null 普通对象且不是数组。失败则 `message.error` 且不改 XML。成功则把**用户输入的表达式文本**（不是 `JSON.stringify`）写回 `value`。外壳两行不是 CodeMirror 文档的一部分，因此不可编辑。

备选：Monaco + `IModelDecoration` 只读范围。否决原因：依赖重，只为两行外壳。

备选：整份函数放进同一个编辑器再锁首尾行。否决原因：实现更脆，三行拼接已满足规格外观。

### 5. 运行时不消费 `data`

`packages/lowcode-runtime` 继续只读 `widgets`/`style`。只要 `parsePageXml` 不再把 `<data>` 当未知控件丢掉，预览与 H5 行为保持「变量不可见」。不要在渲染包里引入数据上下文。

## Risks / Trade-offs

- [`{a:1}` 不是合法 XML 属性，但是合法文本；`&` / `<` 会破坏 XML] → 序列化时转义文本节点，解析时还原；表达式校验在写入前做。
- [空 `<str>` 被 builder 省略] → 数据节点单独序列化，保证空字符串仍有元素。
- [CodeMirror 内 `Mod+Z` 与页面撤回抢快捷键] → 焦点在编辑器时不拦截，沿用现有「可编辑区域忽略」；Modal 打开时也按此处理。
- [`new Function` 求值用户输入] → 仅管理后台草稿编辑，不在 H5 运行；校验失败即丢弃，不把函数本身写入 XML。
- [隐藏画布仍会吃 resize] → 切回布局时若 stage 尺寸变了，再 `fitCanvas(false)` 一次，且仅当用户没手动缩放过。

## Migration Plan

- 既有无 `<data>` 的版本 XML 原样解析，变量列表为空。
- 无需数据库或 API 迁移；保存草稿/版本时随 XML 写入 OSS。
- 回滚：去掉工作台 tab 与 `data` 字段后，含 `<data>` 的 XML 会再次被忽略，控件仍可渲染。
