## Why

数据 tab 的变量列表目前只有变量名、类型和初始值，管理员无法给变量写说明。列表里的对象/数组初始值又常被截断，缺少描述列时很难辨认每个变量的用途。

## What Changes

- 数据 tab 变量列表在「类型」和「初始值」之间增加「描述」列，编辑草稿时可直接改文字。
- 描述为可选纯文本，缺省为空；新增变量、改类型、改名都不清空已有描述。
- 描述随页面 XML 往返：变量元素增加可选属性 `desc`；空描述不写该属性。无 `desc` 的既有变量仍合法，打开后描述为空。
- 预览模式或非草稿版本时描述只读。描述变更走现有草稿 XML 与撤回/重做。
- 描述不参与运行时求值或控件绑定。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 页面变量增加可选描述；数据列表展示并编辑该列；解析/序列化 `desc`；撤回/重做覆盖描述编辑。

## Impact

- **共享包**：`packages/xml` 的 `PageVariable` 增加可选 `desc`；解析读取、序列化在非空时写出，空则省略。
- **前端**：`apps/frontend-admin` 的 `PageDataPanel` 增加描述列与中英 i18n；`commitDraft` 把描述当作变量字段纳入 coalesce。`apps/frontend-app` 无新 UI。
- **后端 / API**：无。描述只存在版本 XML 中。
- **依赖**：无新依赖。
- **兼容**：无 `desc` 的既有 `<data>` 仍可解析；运行时继续忽略变量。
