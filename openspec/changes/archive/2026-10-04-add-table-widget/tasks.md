## 1. XML 控件树

- [x] 1.1 在 `packages/xml/src/page.ts` 按 `design.md` 增加 `table` / `th` / `tr` / `td`、`freezeHeader`、`headerHeight`、列宽、行高、`align` / `valign`，并让 `sanitizeWidgetStyle` 丢掉 `th` / `tr` / `td` 的样式宽高、外边距、定位、溢出与旋转。用一份含两列、一行、单元格文案与对齐的 XML 解析再序列化再解析，确认标签顺序是先 `th` 后 `tr`，默认列宽/行高/冻结不落盘，`width="10"` 的列宽被忽略
- [x] 1.2 扩展 `parseWidgets` / `serializeWidgets` 的父级过滤：`table` 只收 `th` 与 `tr`，`tr` 只收 `td`，页面根 / `flex` / `swiper-item` 可收 `table`，`swiper` 直接子级的 `table` 以及根上的 `th` / `tr` / `td` 被忽略，短行不补 `td`，多余 `td` 被忽略。用错位子节点的 XML 和一份旧的 `text` / `button` / `flex` XML 各跑通解析，确认旧页面仍合法且错位节点不进树

## 2. 公共渲染

- [x] 2.1 在 `@vanstack/lowcode-runtime` 用 CSS grid 渲染表格（表头行加数据行，列宽取 `th.width`，行高取 `headerHeight` / `tr.height`），空表和缺位格子仍占位，节点带 `data-widget-id` 与 `data-widget-type`。用两列两行的 XML 在 `editing: false` 下渲染，确认行列顺序、列宽和单元格文案与 XML 一致
- [x] 2.2 实现预览/H5 滚动口：视口默认 `240×120`，`overflow` 缺省按 `auto`；`visible` 不滚动，`hidden` 裁剪，`scroll` 可滚动，`auto` 仅在内容超出时滚动。`freezeHeader` 为真且出现纵向滚动时表头行吸顶，横向滚动时表头格子仍跟列。用高于视口、`overflow="scroll"`、`freeze-header="true"` 的 XML 在 `editing: false` 下确认滚动口存在且表头吸顶；再把 `overflow` 改为 `visible`，确认不再吸顶也不出现表格内滚动条
- [x] 2.3 实现编辑态：`editing: true` 时外壳等于内容尺寸，`overflow: visible`，无滚动口、无吸顶，空格子有网格线。用视口高度 `120`、表头加三行各 `36` 的表在 `editing: true` 下确认四行同时可见且表格节点没有滚动条；同一 XML 在 `editing: false` 下不再把超出视口的行铺在盒子外

## 3. 工作台数据与插入

- [x] 3.1 为 `table` / `th` / `tr` / `td` 增加 helper 并登记到 `widgetHelpers`。`table` 可出现在添加列表，另外三个不行；`create` 生成 3 列 × 3 行且视口为 `240×120`；`clone` 复制几何、文案、对齐和子树。在 `apps/frontend-admin` 跑类型检查，确认 `satisfies` 通过；用内存树调用 `create`，确认 3 个 `th` 与 3 个各含 3 个 `td` 的 `tr`
- [x] 3.2 扩展控件树插入：`table` 可进入页面根、`flex` 和 `swiper-item`（选中 `swiper` 时进入最后一个 item）；`th` / `tr` / `td` 不能插到这些位置；选中单元格后再添加文本不会进入该格。用内存树断言这四条插入结果，并在控件树中能按 `table` → `th`/`tr` → `td` 展开

## 4. 结构、布局与样式

- [x] 4.1 在气泡工具栏为表格选中增加结构/布局开关，默认结构模式，且不写入 XML。结构模式实现添加/删除/左右移动列、添加/删除/上下移动数据行：列操作同步各行 `td`，禁止删到 0 列或 0 行，表头行不能删除或挪走，每次操作可一步撤回。在编辑页添加表格后加一列，确认变成 4 列且每行 4 个 `td`；对只剩一列的表执行删除，确认列还在
- [x] 4.2 编辑态绘制列手柄、行手柄和表头行手柄。点手柄选中整列、整行或表头行，点格子只选中该格，点控件树只选中该节点。整列改背景时该列 `th` 与全部对应 `td` 一起变，且一次撤回全部恢复；整行选中时气泡没有文案框；单格可以改 `value`、`align` 与 `valign`
- [x] 4.3 布局模式提供列宽、行高和表头行高的数字输入，并在列右边界、行下边界、表头下边界拖拽。拖拽按画布缩放取整、最小 `24`、一次拖拽一步撤回，且不改表格视口宽高。把列宽从 `80` 拖过最小后确认为 `24`；切回结构模式后手柄消失
- [x] 4.4 调整 `isBoxGroupAllowed` 与气泡：`th` / `td` 有文字、对齐、背景、边框、圆角、内边距，没有通用尺寸、外边距、定位、旋转；`tr` 没有这些盒样式和文字样式；`table` 有溢出、表头冻结和表头行高。选中 `td` 按 `Ctrl+T` 与 `Ctrl+M` 不打开尺寸或外边距。中英文案覆盖表格、表头、行、单元格、结构、布局、表头冻结与对齐，切换语言后标签正确

## 5. 编辑态与预览验收

- [x] 5.1 确认编辑模式铺开整张表且表内无滚动条，即使 `overflow` 为 `scroll` 且表头冻结打开也一样；切到预览后网格线、行列手柄和结构/布局开关消失，内容高出 `120px` 时可以滚动，表头冻结打开时表头吸顶。同一份 XML 在 H5 的行列、文案和滚动行为与预览一致，且没有编辑网格线
