## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`packages/xml` 的 `PageVariable` 只有 `type` / `name` / `value` / 可选 `watch`。解析用属性 `n`，`bool` 另读 `watch`；序列化只在有 `watch` 时写属性。`PageDataPanel` 表格列为拖动手柄、变量名、类型、初始值、删除。新增默认 `{ type: 'num', name, value }`。改类型只重置 `value`。连续编辑用 `coalesceKey`（如 `data:${name}:value`）。运行时仍不消费 `data`。

## Goals / Non-Goals

**Goals:**

- 把描述做成 `PageVariable` 的可选字段，XML 用 `desc` 往返。
- 数据列表在类型和初始值之间插入描述列，编辑走现有 `onChange` / `commitDraft`。
- 空描述省略属性，与 `watch` 的缺省策略一致。

**Non-Goals:**

- 不把描述绑到运行时、预览或 `$data` 求值。
- 不改变量名/类型/初始值的校验规则，也不做描述的唯一性或长度硬限制。
- 不改事件 tab、`watch` 监听器，也不改页面/版本 API。

## Decisions

### 1. XML 用可选属性 `desc`，空则省略

扩展：

```ts
type PageVariable = {
  type: PageDataType;
  name: string;
  value: string;
  desc?: string;
  watch?: string;
};
```

解析：`attr(child, 'desc').trim()`；非空才写入对象。序列化：`desc` 有内容时写 `'@_desc'`，否则不写。属性转义沿用现有 `fast-xml-parser` 往返。

备选：把描述做成子元素 `<desc>`。否决原因：会打乱「类型标签 + 文本为初始值」的现有结构。

备选：属性名用 `d` 对齐 `n`。否决原因：`watch` 已是全词，`desc` 更可读，也避免以后和别的短属性冲突。

### 2. 描述列插在类型与初始值之间，行内 `Input`

`PageDataPanel` 增一列 `dataIndex: 'desc'`，标题走 i18n（zh「描述」/ en「Description」）。行内 `Input`，`disabled` 跟随只读态。失焦或回车提交；连续输入用 `coalesceKey`：`data:${name}:desc`。清空描述时从对象去掉 `desc`（或写成 `undefined`），让序列化省略属性。

新增变量不带 `desc`。`changeType` / `rename` 展开原对象，保留 `desc`。

备选：描述放到初始值旁的 tooltip。否决原因：用户要求的是列表列。

备选：多行 `TextArea`。否决原因：表格行高会被撑开；描述是短说明。

### 3. 运行时与求值忽略描述

`pageData.ts` 的 `$data` 作用域、依赖排序和字面量校验只读 `name` / `value` / `type`。不要把 `desc` 放进求值上下文。`packages/lowcode-runtime` 继续只读 `widgets` / `style`。

## Risks / Trade-offs

- [`desc` 含 `&` / `"` / `<` 会破坏 XML] → 走现有属性序列化转义；解析后再展示原文。
- [只 trim、不限制长度] → 超长描述可能把列挤窄；列设 ellipsis + `title`，不另加上限以免和规格冲突。
- [清空描述若仍写出 `desc=""`] → 序列化前把空字符串当成未设置，与「空则省略」对齐。

## Migration Plan

- 无 `desc` 的既有 `<data>` 原样解析，列表描述为空。
- 无需数据库或 API 迁移；保存草稿/版本时随 XML 写入。
- 回滚：去掉描述列与 `desc` 字段后，含 `desc` 的属性会被忽略，变量名和初始值仍可用。
