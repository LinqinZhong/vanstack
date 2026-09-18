## Why

工作台中间预览卡片的标题栏目前只提供可调屏幕宽度，无法管理页面级数据。编辑器需要把这块改成「布局 / 数据 / 事件」切换，并让页面变量进入 XML，作为后续绑定与事件的基础。

## What Changes

- 去掉预览卡片标题栏的屏幕宽度输入（「屏幕 375 px × 667px」）；画布固定为 375×667，不再提供工作台内改宽入口。
- 该位置改为三个 tab：布局、数据、事件。布局 tab 保留现有画布（缩放、还原、编辑/预览）；数据 tab 展示页面变量列表；事件 tab 本期只给空态，不实现事件编辑。
- 数据 tab 以列表展示变量，支持新增、删除、拖动排序；列包括变量名、类型（Number / String / Boolean / Array / Object）、初始值。
- Number / String / Boolean 在列表内直接编辑初始值；Array / Object 用代码编辑器编辑，外壳为 `function 变量名(){` 与 `}` 两行只读，中间 `return` 表达式可编辑。
- 变量写入页面 XML 的 `<page>` 子元素 `<data>`，按类型使用 `num` / `str` / `arr` / `obj` / `bool`；`bool` 可带 `watch` 属性但本期不实现监听器。无变量时不输出 `<data>`。无 `<data>` 的既有页面 XML 仍合法。
- 变量的增删改与排序走现有草稿 XML 与撤回/重做。预览模式或非草稿版本时数据列表只读。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 工作台中间区用布局/数据/事件 tab 替换屏幕宽度控件；页面 XML 识别并往返 `<data>` 变量；数据 tab 可编辑、排序变量；Array/Object 用带只读外壳的代码编辑器。

## Impact

- **共享包**：`packages/xml` 的 `PageXmlDocument` 增加页面变量；解析时把页面级 `<data>` 当作数据而不是控件；序列化把变量写回 `<data>`。`packages/lowcode-runtime` 渲染仍忽略变量，不在本期把数据绑到控件。
- **前端**：`apps/frontend-admin` 预览卡片标题栏改为 tab；布局 tab 固定 375×667；数据 tab 列表与代码编辑器；历史快照纳入页面变量；中英 i18n。`apps/frontend-app` 无新 UI。
- **后端 / API**：无。变量只存在版本 XML 中。
- **依赖**：admin 增加轻量 JS 代码编辑器，用于 Array/Object 初始值。
- **兼容**：无 `<data>` 的既有页面仍可解析；未知控件元素仍被忽略。
