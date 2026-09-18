## 1. XML 控件类型

- [x] 1.1 在 `packages/xml` 的 `PAGE_DATA_TYPES` 增加 `'widget'`。用含 `<widget n="target">n1</widget>` 与空 `<widget n="empty"></widget>` 的页面 XML 做解析→序列化→再解析，确认类型、名称与 `id`/空值仍在；无 `widget` 的既有 `<data>` 仍能解析
- [x] 1.2 在 `pageData.ts` 为 `widget` 增加类型选项与缺省值 `''`；`readVariableValue` 把控件类型当字符串返回 `id`。把 Number 改成控件后值为空；`buildPageDataScope` 能读到该 `id`

## 2. 选择弹窗

- [x] 2.1 `PageDataPanel` 接收当前 `widgets`。控件类型值列展示树标签（空态/存在/缺失），点按钮打开单选控件树 Modal，确认写入 `id`、可清空；不打开 Array/Object 代码编辑器。选中按钮控件后 XML 为 `<widget n="...">该id</widget>`；清空后文本为空；删除该控件后列表缺失但 id 仍在
- [x] 2.2 在 admin 的 zh/en 增加控件类型名（「控件」/「Widget」）、选择/清空/空态/缺失文案。预览或非草稿时选择与清空不可用。切换语言后文案正确；只读态无法改选

## 3. 从控件树拖入

- [x] 3.1 仅数据 tab 且可编辑时左侧控件树可拖出，`allowDrop` 禁止重排；用自定义 MIME 传控件 `id`。`PageDataPanel` 只在控件类型行接受该载荷并写入，Number 等行与变量行排序互不影响。把文本控件拖到控件变量后值为该 id、控件树不变；拖到 Number 行值不变；预览模式下拖入不改值

## 4. 验收

- [x] 4.1 走通：登录 → 打开工程数据 tab → 类型可选控件 → 弹窗选控件写入 XML → 从控件树拖到该行更新 id → 改类型为控件清空值 → 撤回可还原 → 预览/非草稿只读且不能拖入；H5/预览仍不把变量画成控件
