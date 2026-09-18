## Why

数据 tab 的变量类型目前只有 Number / String / Boolean / Array / Object，管理员无法把页面上的某个控件记成变量，后续事件与绑定也就没有稳定的控件引用入口。现在就要补上「控件」类型，让人能在数据列表里点选或从左侧控件树拖入。

## What Changes

- 页面变量增加「控件」类型（XML 子元素 `widget`），初始值保存当前页面某个控件的 `id`；未选择时为空。
- 数据 tab 中控件类型的初始值不再用行内输入或 Array/Object 代码编辑器，改为摘要展示 + 弹窗从当前页面控件树中单选。
- 编辑草稿且停留在数据 tab 时，管理员可把左侧控件树节点拖到某条控件类型变量上，直接写入该控件 `id`。
- 改类型为控件时，初始值重置为空；预览模式或非草稿版本时不可改选、不可拖入。
- 运行时仍不消费页面变量；本期不把控件变量绑到文案、样式或事件。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 页面变量类型增加 `widget`；数据列表用弹窗选择控件；数据 tab 接受从控件树拖入控件 id；解析/序列化往返该类型。

## Impact

- **共享包**：`packages/xml` 的 `PAGE_DATA_TYPES` 增加 `widget`；解析/序列化把 `<widget n="...">控件id</widget>` 当变量而不是控件。`packages/lowcode-runtime` 渲染仍忽略变量。
- **前端**：`apps/frontend-admin` 的 `PageDataPanel` 增加控件类型编辑与选择弹窗；`ProjectEditorPage` 在数据 tab 让控件树可拖出。中英 i18n。`apps/frontend-app` 无新 UI。
- **后端 / API**：无。变量仍只存在版本 XML 中。
- **依赖**：无新依赖。
- **兼容**：无 `widget` 的既有 `<data>` 仍可解析；未知 `<data>` 子元素仍被忽略。
