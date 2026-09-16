## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`ProjectEditorPage` 用 `widgets` + `selectedWidgetId` 驱动控件树、检查器与 iframe 预览。`widgetTree.ts` 已有查找、按 id 不可变更新、选中弹性盒后追加子节点，但没有删除、按兄弟插入或克隆。`addWidget` 用 `n${Date.now()}` 生成 id，检查器每个 `onChange` 立刻 `setWidgets`。预览协议已转发滚轮与中键平移，不转发键盘。`readOnly = 预览模式 || 版本非草稿`。控件树规模很小，历史不必做命令对象。

## Goals / Non-Goals

**Goals:**

- 所有控件树变更走同一套提交入口，以便记录撤回/重做，并与现有 `xml → iframe` 管道兼容。
- 剪贴板与历史留在工作台会话内存，不进 XML schema、后端或公共渲染包。
- 主窗口与 iframe 共用同一套快捷键判定，避免点选画布后快捷键失效。

**Non-Goals:**

- 不引入撤销库、不写系统剪贴板、不把历史持久化到版本 XML。
- 不改 `@vanstack/xml` / `@vanstack/lowcode-runtime` 的解析与渲染。
- 不做剪切、多选、拖拽排序。

## Decisions

### 1. 树操作集中在 `widgetTree.ts`

新增纯函数，继续对 `PageWidget[]` 做不可变更新：

- `removeWidget(widgets, id)`：从所在兄弟数组去掉该节点（弹性盒带子树一起走）；返回下一选中：父级优先，否则前一兄弟，否则后一兄弟，否则 `null`。
- `insertWidget(widgets, selectedId, widget)`：选中 `flex` 则追加到其 `children`；选中非容器则插入为下一兄弟；无选中则追加到根。粘贴与现有添加的差异只在非容器分支：添加仍追加到根（保持现状），粘贴走下一兄弟。
- `cloneWidget(widget, nextId)`：深拷贝子树并为每个节点分配新 id。id 生成改为单调计数（例如 `n${base}-${seq}`），避免同一毫秒粘贴整棵子树撞 id。

页面组件只编排选中态与提交，不在 JSX 里手写递归。

备选：把删除/粘贴写进 `ProjectEditorPage`。否决原因：嵌套路径与 `addWidgetToTree` 同类，散落会重复出错。

备选：粘贴与添加共用同一插入点。否决原因：规格要求粘贴到非容器时成为下一兄弟；添加仍是「未选中弹性盒则进根」，两者不能混成一个函数语义。

### 2. 历史用控件树快照，属性编辑按字段合并

```ts
type HistoryEntry = { widgets: PageWidget[]; selectedWidgetId: string | null };
```

工作台持有 `past` / `future` 两个栈（上限约 100）。所有变更经 `commitWidgets(next, selectedId, coalesceKey?)`：

- 无 `coalesceKey`（添加/删除/粘贴）：把变更前快照压入 `past`，清空 `future`。
- 有 `coalesceKey`（检查器同一控件同一字段）：若与上一次提交的 key 相同，则不压新快照，只改当前树；key 变化、焦点离开该字段、或开始添加/删除/粘贴时结束合并。
- 撤回：当前快照入 `future`，弹出 `past` 恢复树与选中。重做相反。
- `applyXml`、切换页面、切换版本时清空两栈并结束合并。切换页面同时清空剪贴板；切换版本保留剪贴板。

检查器把现在的即时 `onChange` 改为带 `coalesceKey` 的提交（例如 `edit:${id}:value`），不必改成只有 blur 才写树，预览仍可逐字更新。

备选：命令模式（DeleteCommand 等）。否决原因：树很小，快照更短、撤回时选中态自然还原。

备选：每个按键一步历史。否决原因：规格要求连续改同一字段撤回为一步。

### 3. 会话内剪贴板，不走 `navigator.clipboard`

复制：把当前选中节点 `cloneWidget` 后放入 ref（结构化克隆一份，后续改原控件不影响剪贴板）。只读态允许复制。

粘贴：再克隆并换新 id，经 `insertWidget` 提交；提交后选中新根节点。无剪贴板或 `readOnly` 时 no-op。

备选：把 XML 片段写入系统剪贴板。否决原因：与检查器文本复制冲突，且跨页粘贴是非目标。

### 4. 快捷键：主窗口监听 + iframe 转发

在 `lowcode-protocol` 增加 `keydown` 消息：`key` / `code` / `ctrlKey` / `metaKey` / `shiftKey` / `altKey`。`PreviewPage` 在编辑态 `window` 监听 `keydown`，对已识别快捷键 `preventDefault` 后 postMessage；主窗口用同一套 `matchShortcut` 执行命令。

主窗口 `window` 监听：

- 事件目标是 `input` / `textarea` / `select` / `[contenteditable]` 时直接返回，不拦截。
- 否则：`Delete`/`Backspace` 删除；`Mod+C` 复制；`Mod+V` 粘贴；`Mod+Z` 撤回；`Mod+Shift+Z` 与 `Mod+Y` 重做。`Mod` 为 `ctrlKey || metaKey`。
- `readOnly` 时只允许复制。

控件树卡片 `extra` 增加删除/复制/粘贴/撤回/重做按钮（图标 + tooltip 标快捷键），禁用规则与规格一致。

备选：点选画布后强制 `iframe.blur()` 把焦点拉回主窗口。否决原因：滚轮/平移仍在 iframe 内，键盘会再次丢失；转发与现有 pointer 协议一致。

## Risks / Trade-offs

- [检查器输入时 `Backspace`/`Ctrl+C` 误删或误复制控件] → 以事件目标是否为可编辑元素为唯一开关；iframe 内无检查器输入，只转发已识别快捷键。
- [iframe 快捷键被浏览器当成返回上一页] → 子窗口对匹配到的键 `preventDefault` 再转发。
- [快速粘贴或克隆子树撞 id] → 克隆时用单调序号，不依赖单次 `Date.now()`。
- [快照栈占用内存] → 树很小，再加条目上限；切换页面/版本丢弃。
- [合并中途切换选中] → 选中变化结束当前 `coalesceKey`，避免把对不同控件的编辑合成一步。

## Migration Plan

1. 先落地 `widgetTree` 的删除/插入/克隆，再接到工作台按钮与 `commitWidgets`。
2. 接检查器合并提交、剪贴板、历史栈。
3. 扩展预览协议并转发键盘；补 zh/en 文案。
4. 验证：删除叶子与弹性盒子树、复制粘贴到弹性盒/兄弟/根、撤回/重做、合并文案编辑、输入框内快捷键不穿透、点选 iframe 后 `Delete` 仍删除、只读态与切版本行为符合规格。
5. 回滚：还原 `frontend-admin` 即可；已保存版本不受影响，未保存的会话编辑会丢失。

## Open Questions

无。快捷键文案里 Windows 显示 `Ctrl`、macOS 显示 `⌘` 可在实现时按 `navigator.platform` 选择，不影响规格。
