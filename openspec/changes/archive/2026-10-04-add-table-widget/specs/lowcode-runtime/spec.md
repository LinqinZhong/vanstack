## ADDED Requirements

### Requirement: Table widget in page xml
页面 XML SHALL 识别 `table` 为可渲染表格容器。每个 `table` MUST 具有 `id`。其直接子元素 MUST 仅为表头单元格 `th` 与数据行 `tr`；`text`、`button`、`flex`、`swiper`、`td` 或其他控件作为 `table` 的直接子元素 MUST 被忽略，且 MUST NOT 阻止其余已识别控件渲染。`table` MUST 可出现在页面根、`flex` 或 `swiper-item` 内。作为 `swiper` 直接子元素的 `table` MUST 被忽略。未设置表格属性的 `table` MUST 仍合法。列顺序 MUST 为 `th` 在文档中的出现顺序，行顺序 MUST 为 `tr` 在文档中的出现顺序；序列化时 MUST 先写出全部 `th`，再写出全部 `tr`。

#### Scenario: Table xml is accepted
- **WHEN** 系统解析一份 `page` 根下包含 `table`，且该 `table` 内含两个 `th` 与一个带两个 `td` 的 `tr` 的合法 XML
- **THEN** 解析结果包含该表格、两个表头单元格与该行及其单元格，且各控件 `id` 与 XML 一致

#### Scenario: Empty table is accepted
- **WHEN** 系统解析包含一个没有子元素的 `table` 的合法页面 XML
- **THEN** 解析结果包含该表格，且其没有表头单元格与数据行

#### Scenario: Direct non-section children are ignored
- **WHEN** 页面 XML 中某个 `table` 的直接子元素除 `th` 与 `tr` 外还包含 `text` 或 `td`
- **THEN** 系统仍成功解析该表格与已识别的 `th`、`tr`，且不把该 `text` 或 `td` 当作该表格的直接子控件

#### Scenario: Table inside swiper is ignored
- **WHEN** 页面 XML 中某个 `swiper` 的直接子元素是 `table`
- **THEN** 系统不把该 `table` 当作该滑动器的子控件，且其余已识别控件仍成功解析

### Requirement: Table header cells in page xml
页面 XML SHALL 识别 `th` 为表格的表头单元格，一列对应一个 `th`。`th` MUST 仅作为 `table` 的直接子元素被识别；出现在页面根、`flex`、`swiper-item` 或 `tr` 下的 `th` MUST 被忽略。每个被识别的 `th` MUST 具有 `id` 与文案 `value`（可为空字符串），MUST NOT 接受子控件。`th` 上的列宽 MUST 使用 `width` 属性，单位为像素；缺省或无法识别时 MUST 不写入，渲染使用 `80`。小于 `24` 的列宽 MUST 视为未设置。`th` 的盒样式宽高、外边距、定位、溢出与旋转 MUST 被忽略且序列化 MUST NOT 写出。

#### Scenario: Header cell round-trips
- **WHEN** 页面 XML 中某个 `table` 的直接子元素 `th` 具有 `id`、`value` 为 `名称`、`width` 为 `120`
- **THEN** 再次解析该 XML 得到相同 `id`、文案与列宽

#### Scenario: Root header cell is ignored
- **WHEN** 页面 XML 在 `page` 根下直接包含一个 `th`
- **THEN** 系统不把该元素当作可渲染控件，且其余已识别控件仍成功解析

#### Scenario: Header cell children are ignored
- **WHEN** 页面 XML 中某个 `th` 内包含 `text`
- **THEN** 系统仍解析该 `th` 及其 `value`，且不把该 `text` 当作子控件

#### Scenario: Invalid column width is ignored
- **WHEN** 页面 XML 中某个 `th` 的 `width` 为 `10` 或非数字
- **THEN** 该列宽视为未设置，整页 XML 仍合法，渲染时该列宽为 `80`

### Requirement: Table rows and cells in page xml
页面 XML SHALL 识别 `tr` 为表格数据行、`td` 为数据单元格。`tr` MUST 仅作为 `table` 的直接子元素被识别；`td` MUST 仅作为 `tr` 的直接子元素被识别。出现在其他父级下的 `tr` 或 `td` MUST 被忽略。每个被识别的 `tr` 与 `td` MUST 具有 `id`。`td` MUST 具有文案 `value`（可为空字符串），MUST NOT 接受子控件。`tr` MUST NOT 接受 `td` 以外的子控件。数据行行高 MUST 使用 `tr` 的 `height` 属性，单位为像素；缺省或无法识别时 MUST 不写入，渲染使用 `36`。小于 `24` 的行高 MUST 视为未设置。列数 MUST 等于所属 `table` 的 `th` 数量。每个 `tr` 的 `td` MUST 按顺序对齐到这些列；超出列数的 `td` MUST 被忽略；少于列数时 MUST 保留已有 `td`，缺位在渲染中为空单元格，且解析 MUST NOT 凭空补出 `td`。`tr` 与 `td` 的盒样式宽高、外边距、定位、溢出与旋转 MUST 被忽略且序列化 MUST NOT 写出。

#### Scenario: Row with cells is accepted
- **WHEN** 系统解析一份含两个 `th` 的 `table`，且其中一个 `tr` 依次含有两个 `td`
- **THEN** 解析结果中该行的两个单元格按列顺序对应这两个 `th`，文案与 `id` 与 XML 一致

#### Scenario: Extra cell is ignored
- **WHEN** 某个只有一个 `th` 的 `table` 中，一个 `tr` 含有两个 `td`
- **THEN** 系统只保留第一个 `td`，第二个 `td` 不成为可渲染单元格

#### Scenario: Short row stays short
- **WHEN** 某个含两个 `th` 的 `table` 中，一个 `tr` 只有一个 `td`
- **THEN** 解析结果仍只有这一个 `td`，序列化不会自动补上第二个 `td`

#### Scenario: Root row is ignored
- **WHEN** 页面 XML 在 `page` 根下直接包含一个 `tr`
- **THEN** 系统不把该元素当作可渲染控件，且其余已识别控件仍成功解析

#### Scenario: Invalid row height is ignored
- **WHEN** 页面 XML 中某个 `tr` 的 `height` 为 `8` 或非数字
- **THEN** 该行高视为未设置，整页 XML 仍合法，渲染时该行高为 `36`

### Requirement: Table header freeze and overflow
每个 `table` SHALL 可配置表头冻结与溢出策略。表头冻结 MUST 使用 `freeze-header`；真值序列化为 `true`，缺省或假值 MUST 不写入，渲染默认不冻结。无法识别的值 MUST 视为未设置，MUST NOT 使整页 XML 非法。表头行高 MUST 使用 `header-height`，单位为像素，缺省为 `36`；小于 `24` 或无法识别时 MUST 视为未设置。溢出策略 MUST 使用表格样式上的 `overflow`，取值 MUST 为 `visible`、`hidden`、`scroll` 或 `auto`；缺省时预览与 H5 MUST 按 `auto` 处理，且缺省 MUST 不写入。表格视口宽高缺省时 MUST 分别为 `240px` 与 `120px`，新建表格 MUST 带上这两项。`overflow` 以外的表格盒子样式 MUST 仍可按其他控件的样式规则持久化。

#### Scenario: Freeze header round-trips
- **WHEN** 已登录管理员为某表格打开表头冻结，并把 `header-height` 设为 `44` 后应用到当前 XML
- **THEN** 再次解析该 XML 得到 `freeze-header` 为真且表头行高为 `44`

#### Scenario: Omitted table properties use defaults
- **WHEN** 页面 XML 中的 `table` 只有 `id`，没有冻结、表头行高或溢出属性
- **THEN** 系统不冻结表头，表头行高为 `36`，预览按 `auto` 处理溢出，视口宽高为 `240px` 与 `120px`

#### Scenario: Invalid freeze header is ignored
- **WHEN** 页面 XML 中某个 `table` 的 `freeze-header` 为无法识别的值，且 `header-height` 为 `4`
- **THEN** 这两项视为未设置，整页 XML 仍合法

### Requirement: Table cell presentation
`th` 与 `td` SHALL 可设置单元格样式：背景、边框、圆角、内边距、字体、字号、字重、斜体、下划线、删除线、字体颜色、文字阴影，以及水平对齐与垂直对齐。水平对齐 MUST 为 `start`、`center` 或 `end`，属性名为 `align`，默认 `start`。垂直对齐 MUST 为 `top`、`middle` 或 `bottom`，属性名为 `valign`，默认 `middle`。默认值与无法识别的对齐 MUST 不写入 XML。单元格文案 MUST 用 `value` 持久化。这些样式 MUST 只作用于该单元格，MUST NOT 改列宽、行高或表格视口尺寸。选中 `th`、`tr` 或 `td` 时，`Ctrl+M` / `⌘+M`、`Ctrl+L` / `⌘+L` 与 `Ctrl+Shift+R` / `⌘+Shift+R` MUST NOT 打开外边距、定位或旋转，也 MUST NOT 改这些字段。选中 `tr` 时 `Ctrl+P` / `⌘+P` MUST NOT 打开内边距。

#### Scenario: Cell style round-trips
- **WHEN** 已登录管理员把某个 `td` 的背景设为 `#fff7e6`、边框设为 `1px` 实线 `#d9d9d9`、水平对齐设为 `center`、垂直对齐设为 `top`、文案设为 `苹果` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到相同背景、边框、对齐与文案

#### Scenario: Default alignment is omitted
- **WHEN** 某个 `th` 未设置 `align` 与 `valign`
- **THEN** 序列化 XML 不写出这两项，渲染时文字靠起始侧、垂直居中

#### Scenario: Table parts reject box shortcuts
- **WHEN** 已登录管理员选中一个 `td` 并按下 `Ctrl+M` 或 `Ctrl+L`
- **THEN** 不展开外边距或定位分组，也不改该单元格的外边距或定位

### Requirement: Render table from xml
公共渲染能力 SHALL 把每个 `table` 渲染为表格。表头 MUST 为一行，从左到右排列全部 `th`。其下 MUST 按顺序排列每个 `tr`，行内 `td` MUST 对齐到对应列。空表、空单元格与缺位单元格 MUST 仍占据该列该行的格子。列宽 MUST 取对应 `th` 的 `width`，数据行高 MUST 取 `tr` 的 `height`，表头行高 MUST 取 `header-height`。管理后台预览模式与 H5 MUST 对同一份合法表格 XML 使用相同的行列结构、列宽、行高、单元格文案与样式，且都不展示编辑态网格线、行列手柄或结构/布局工具。

#### Scenario: Preview lays out columns and rows
- **WHEN** 当前 XML 含一个有两个 `th`（列宽 `80` 与 `120`）和两个 `tr`（行高 `36` 与 `48`）的表格，且工作台处于预览模式
- **THEN** 子窗口展示一行表头与两行数据，列宽与行高与 XML 一致

#### Scenario: Same table xml matches in admin preview and h5
- **WHEN** 同一份含表格、表头冻结与溢出策略的合法页面 XML 分别在管理后台预览模式与 H5 运行时中渲染
- **THEN** 两处的行列嵌套、单元格文案与溢出行为一致，且都不展示编辑态网格线或行列手柄

### Requirement: Edit mode shows the whole table
工作台处于编辑模式时，表格 SHALL 按列宽与行高把全部 `th` 与 `tr` 一次铺开。表格自身 MUST 使用可见溢出，MUST NOT 出现滚动条，MUST NOT 按 `overflow` 裁剪或滚动，也 MUST NOT 因表头冻结把表头吸在视口内。超出表格视口宽高的单元格 MUST 仍然可见。空单元格 MUST 仍占据格子，并带有仅编辑态存在的网格线；该网格线 MUST NOT 写入 XML，也 MUST NOT 出现在预览模式或 H5。页面画布原有的平移 MUST 不受影响。切换到预览模式后，同一表格 MUST 恢复为按视口与溢出策略显示。

#### Scenario: Edit mode shows every cell
- **WHEN** 已登录管理员处于编辑模式，当前 XML 含一个视口高度为 `120px`、表头行高 `36`、三行数据行高均为 `36` 的表格
- **THEN** 子窗口同时展示表头与三行数据，表格内部没有滚动条，超出 `120px` 的行仍然可见

#### Scenario: Edit mode ignores scroll overflow
- **WHEN** 已登录管理员处于编辑模式，且该表格的 `overflow` 为 `scroll`、`freeze-header` 为真
- **THEN** 子窗口仍铺开整张表，不出现表格内滚动，表头也不吸顶

#### Scenario: Preview restores overflow behavior
- **WHEN** 已登录管理员从编辑模式切换到预览模式，且该表格内容高于视口、`overflow` 为 `auto`
- **THEN** 子窗口不再把超出视口的行直接铺在视口外，编辑态网格线消失

### Requirement: Preview table overflow and frozen header
预览模式与 H5 SHALL 把表格限制在其视口宽高内，并按 `overflow` 决定溢出。`visible` MUST 不滚动，超出部分可见。`hidden` MUST 裁剪且不滚动。`scroll` MUST 提供滚动。`auto` MUST 仅在内容超出视口时滚动。`freeze-header` 为真且表格因 `scroll` 或 `auto` 出现纵向滚动时，表头行 MUST 吸在该表格滚动口顶部，表头单元格 MUST 随横向滚动与对应列一起移动。未发生纵向滚动，或溢出为 `visible` / `hidden` 时，表头冻结 MUST 不产生吸顶。本期 MUST NOT 冻结首列。

#### Scenario: Auto overflow scrolls when content is taller
- **WHEN** 工作台处于预览模式，表格视口高度小于表头加全部数据行的高度，且 `overflow` 为 `auto`
- **THEN** 表格滚动口可以纵向滚动，未超出时不强制显示滚动条

#### Scenario: Hidden overflow clips without scrolling
- **WHEN** 工作台处于预览模式，表格内容超出视口且 `overflow` 为 `hidden`
- **THEN** 超出部分被裁剪，表格内部不能滚动

#### Scenario: Frozen header sticks while scrolling
- **WHEN** 工作台处于预览模式，`freeze-header` 为真，`overflow` 为 `scroll`，且内容高于视口
- **THEN** 纵向滚动时表头行保持在表格滚动口顶部，横向滚动时表头单元格仍与各自的列对齐

#### Scenario: Frozen header does nothing when overflow is visible
- **WHEN** 工作台处于预览模式，`freeze-header` 为真且 `overflow` 为 `visible`
- **THEN** 表头不吸顶，超出视口的内容可见且表格内部不滚动

### Requirement: Table structure mode
工作台编辑草稿且当前选中落在某个表格内（`table`、`th`、`tr`、`td`，或该表的列选中、行选中、表头行选中）时，气泡工具栏 SHALL 提供「结构」与「布局」两种模式。模式 MUST 只作为编辑铬，MUST NOT 写入 XML，MUST NOT 出现在预览模式或 H5。初次进入该表格的选中时 MUST 为结构模式。结构模式 MUST 能添加列、删除列、左移列、右移列、添加数据行、删除数据行、上移数据行与下移数据行。添加列 MUST 插入一个 `th`，并在每一行的同一列序插入一个空 `td`。删除列 MUST 同时删除对应 `th` 与各行该列的 `td`。移动列 MUST 同时重排 `th` 与每一行中同一列序的 `td`。添加数据行 MUST 插入一个 `tr`，其 `td` 数量等于列数。只剩一列时 MUST NOT 删除列；只剩一行数据时 MUST NOT 删除该行。表头行 MUST NOT 被删除或与数据行交换顺序。未选中列时添加列 MUST 追加到末尾；选中列时 MUST 插在该列之后。未选中数据行时添加行 MUST 追加到末尾；选中数据行时 MUST 插在该行之后。每次添加、删除或移动 MUST 可一步撤回，撤回后行列恢复为操作前的结构。操作完成后每一数据行的 `td` 数量 MUST 等于 `th` 数量。

#### Scenario: Structure mode adds a column
- **WHEN** 已登录管理员选中一个有两列的表格，切到结构模式并添加列
- **THEN** 该表格变为三列，每个已有数据行都多出一个空单元格，子窗口立即展示新列

#### Scenario: Structure mode refuses to delete the last column
- **WHEN** 已登录管理员选中一个只剩一列的表格并执行删除列
- **THEN** 该列仍在，XML 结构不变

#### Scenario: Structure mode moves a column
- **WHEN** 已登录管理员选中表格的第一列并右移
- **THEN** 原第一列的 `th` 与各行对应 `td` 变成第二列，其他列顺序相应前移

#### Scenario: Header row cannot be deleted
- **WHEN** 已登录管理员选中表头行并执行删除行
- **THEN** 表头单元格仍在，数据行不变

### Requirement: Table layout mode
同一气泡工具栏的布局模式 SHALL 用于设置列宽与行高，设置结果 MUST 写入 `th` 的 `width`、`tr` 的 `height` 或 `table` 的 `header-height`，单位 MUST 为像素整数，且 MUST NOT 改表格视口的宽高。选中列、或选中该列中的单元格时，MUST 能输入该列列宽，并 MUST 能拖拽该列右边界改列宽。选中数据行、或选中该行中的单元格时，MUST 能输入该行行高，并 MUST 能拖拽该行下边界改行高。选中表头行或表头单元格时，MUST 能输入并拖拽表头行高。拖拽 MUST 只在布局模式且编辑草稿时可用。拖拽位移 MUST 按画布缩放折算为 CSS 像素后按 `1` 步进写入，结果 MUST 钳在大于等于 `24`。一次拖拽 MUST 合并为一步撤回。结构模式 MUST NOT 出现这些拖拽手柄。这些手柄 MUST NOT 写入 XML，MUST NOT 出现在预览模式或 H5。

#### Scenario: Layout mode sets column width
- **WHEN** 已登录管理员选中某列，切到布局模式，并把列宽改为 `96`
- **THEN** 对应 `th` 的 `width` 为 `96`，该列单元格变宽，表格视口宽高不变

#### Scenario: Layout mode drag changes row height
- **WHEN** 已登录管理员处于布局模式，某数据行行高为 `36`，并按住该行下边界向下拖 `10` CSS 像素
- **THEN** 该行 `height` 变成 `46`，其他行行高不变

#### Scenario: Drag stops at minimum
- **WHEN** 已登录管理员把列宽为 `30` 的列向左拖过 `24`
- **THEN** 列宽停在 `24`，不写成更小的值

#### Scenario: Structure mode has no resize handles
- **WHEN** 已登录管理员处于结构模式并查看该表格
- **THEN** 画布上不出现列宽或行高拖拽手柄

### Requirement: Table column and row selection
工作台编辑草稿时 SHALL 能选中表格的整列、整行数据、表头行或单个单元格。列选中、行选中与表头行选中 MUST 通过仅编辑态存在的行列表选择手柄完成，MUST NOT 写入 XML，MUST NOT 出现在预览模式或 H5。点击单元格内容 MUST 选中该 `th` 或 `td`。选中整列时，随后的单元格样式修改 MUST 写入该列的 `th` 与每一行对应的 `td`。选中数据行时，样式修改 MUST 写入该行全部 `td`。选中表头行时，样式修改 MUST 写入全部 `th`。选中单个单元格时，样式修改 MUST 只写入该单元格。整列、整行或表头行选中时 MUST NOT 提供文案编辑；只有选中单个 `th` 或 `td` 时 MUST 能编辑该格 `value`。控件树中点选 `th`、`tr` 或 `td` MUST 选中该节点本身。

#### Scenario: Column selection styles every cell in the column
- **WHEN** 已登录管理员用列手柄选中第二列，并把背景设为 `#e6f4ff`
- **THEN** 该列的 `th` 与每个对应 `td` 背景都为 `#e6f4ff`，其他列不变

#### Scenario: Cell selection styles one cell
- **WHEN** 已登录管理员点击某个 `td` 并把水平对齐设为 `end`
- **THEN** 只有该 `td` 的 `align` 为 `end`

#### Scenario: Row selection does not edit copy
- **WHEN** 已登录管理员用行手柄选中一个数据行
- **THEN** 气泡不提供该行文案编辑入口

#### Scenario: Preview hides selection handles
- **WHEN** 已登录管理员切换到预览模式
- **THEN** 不显示列手柄、行手柄或结构/布局模式开关

### Requirement: Add table from workbench
工作台 SHALL 允许为当前页面添加 `table`，且添加弹窗 MUST NOT 列出 `th`、`tr` 或 `td`。新添加的 `table` MUST 带有 3 个 `th` 与 3 个 `tr`，每个 `tr` MUST 含 3 个空 `td`，视口宽高 MUST 为 `240px` 与 `120px`。若当前选中控件是 `flex`，新表格 MUST 成为该弹性盒的最后一个子控件。若当前选中控件是 `swiper-item`，新表格 MUST 成为该页的最后一个子控件。若当前选中控件是 `swiper`，新表格 MUST 成为其最后一个 item 的子控件（若尚无 item 则先创建一个空 item 再放入）。其他情况下新表格 MUST 成为页面根的最后一个子控件。`th`、`tr` 与 `td` MUST NOT 被添加到页面根、`flex` 或 `swiper-item`。控件树 MUST 按 `table`、其下的 `th` 与 `tr`、以及 `tr` 下的 `td` 展示。选中表格内部时，从添加弹窗加入的文本、按钮、弹性盒、滑动器或另一个表格 MUST NOT 进入单元格。

#### Scenario: Adding a table creates a three by three grid
- **WHEN** 已登录管理员在工作台为当前页面添加一个表格
- **THEN** 控件树出现该表格、3 个表头单元格与 3 个各含 3 个单元格的数据行，编辑态子窗口铺开这张表且表内没有滚动条

#### Scenario: Adding a table into selected flex
- **WHEN** 已登录管理员选中一个已有弹性盒后添加一个表格
- **THEN** 该表格成为该弹性盒的子控件，出现在控件树对应层级下

#### Scenario: Table parts are not addable at the root
- **WHEN** 已登录管理员打开添加弹窗
- **THEN** 弹窗不提供单独添加 `th`、`tr` 或 `td` 的入口

#### Scenario: Adding text while a cell is selected
- **WHEN** 已登录管理员选中某个 `td` 后从添加弹窗添加一个文本控件
- **THEN** 该文本不成为该单元格的子控件

## MODIFIED Requirements

### Requirement: Page xml widget contract
页面 XML SHALL 以 `page` 为根。本期系统 MUST 识别子元素 `text`、`button`、`flex`、`swiper` 与 `table`。`text` MUST 使用 `id` 与 `value` 描述一段展示文本；`button` MUST 使用 `id` 与 `text` 描述一个按钮标签；`flex` MUST 使用 `id` 描述一个可嵌套的弹性容器；`swiper` MUST 使用 `id` 描述一个可嵌套的滑动器，其直接子元素为 `swiper-item`；`table` MUST 使用 `id` 描述一个表格，其直接子元素为 `th` 与 `tr`。未识别的元素 MUST 被忽略且 MUST NOT 阻止其余控件渲染。仅含 `text`、`button` 与 `flex` 的既有页面 XML MUST 仍合法。

#### Scenario: Text and button xml is accepted
- **WHEN** 系统解析包含一个 `text` 与一个 `button` 的合法页面 XML
- **THEN** 解析结果包含这两个控件及其 `id` 与对应文案

#### Scenario: Flex xml is accepted
- **WHEN** 系统解析包含一个 `flex` 的合法页面 XML
- **THEN** 解析结果包含该弹性盒及其 `id`

#### Scenario: Swiper xml is accepted
- **WHEN** 系统解析包含一个 `swiper` 的合法页面 XML
- **THEN** 解析结果包含该滑动器及其 `id`

#### Scenario: Table xml is accepted
- **WHEN** 系统解析包含一个 `table` 的合法页面 XML
- **THEN** 解析结果包含该表格及其 `id`

#### Scenario: Unknown widget is ignored
- **WHEN** 页面 XML 在 `text`、`button`、`flex`、`swiper` 与 `table` 之外还包含未识别的子元素
- **THEN** 系统仍成功解析已识别控件，且不把未识别元素当作可渲染控件

#### Scenario: Invalid page xml is rejected
- **WHEN** 系统解析缺少 `page` 根或格式非法的 XML
- **THEN** 系统判定该 XML 无效并给出失败反馈，MUST NOT 当作空页面静默成功

### Requirement: Flex widget in page xml
页面 XML SHALL 识别 `flex` 为可渲染容器控件。每个 `flex` MUST 具有 `id`，MUST 允许子元素为 `text`、`button`、嵌套 `flex`、`swiper` 或 `table`。未设置弹性属性的 `flex` MUST 仍合法，渲染时按 CSS Flexbox 默认值布局。`flex` 内外未识别的元素 MUST 被忽略且 MUST NOT 阻止其余已识别控件渲染。

#### Scenario: Nested flex xml is accepted
- **WHEN** 系统解析一份 `page` 根下包含 `flex`，且该 `flex` 内依次含有 `text`、`button` 与嵌套 `flex` 的合法 XML
- **THEN** 解析结果包含该弹性盒及其子控件树，且各控件 `id` 与文案与 XML 一致

#### Scenario: Flex can contain swiper
- **WHEN** 系统解析一份 `flex` 内包含 `swiper` 的合法 XML
- **THEN** 解析结果将该滑动器作为该弹性盒的子控件

#### Scenario: Flex can contain table
- **WHEN** 系统解析一份 `flex` 内包含 `table` 的合法 XML
- **THEN** 解析结果将该表格作为该弹性盒的子控件

#### Scenario: Empty flex is accepted
- **WHEN** 系统解析包含一个没有子元素的 `flex` 的合法页面 XML
- **THEN** 解析结果包含该弹性盒，且其没有可渲染子控件

#### Scenario: Unknown nested element is ignored
- **WHEN** 页面 XML 中某个 `flex` 内除已识别控件外还包含未识别子元素
- **THEN** 系统仍成功解析该弹性盒与已识别子控件，且不把未识别元素当作可渲染控件

### Requirement: Swiper item widget in page xml
页面 XML SHALL 识别 `swiper-item` 为滑动器页。`swiper-item` MUST 仅作为 `swiper` 的直接子元素被识别；出现在页面根或 `flex` 下的 `swiper-item` MUST 被忽略。每个被识别的 `swiper-item` MUST 具有 `id`，MUST 允许子元素为 `text`、`button`、`flex`、`swiper` 或 `table`。空 `swiper-item` MUST 仍合法。item 内未识别的元素 MUST 被忽略且 MUST NOT 阻止其余已识别控件渲染。

#### Scenario: Item with nested widgets is accepted
- **WHEN** 系统解析一份 `swiper` 内含一个 `swiper-item`，且该 item 内依次含有 `text`、`button` 与 `flex` 的合法 XML
- **THEN** 解析结果包含该 item 及其子控件树，且各控件 `id` 与文案与 XML 一致

#### Scenario: Item can contain table
- **WHEN** 系统解析一份 `swiper-item` 内包含 `table` 的合法 XML
- **THEN** 解析结果将该表格作为该 item 的子控件

#### Scenario: Empty item is accepted
- **WHEN** 系统解析包含一个没有子元素的 `swiper-item` 的合法 `swiper`
- **THEN** 解析结果包含该 item，且其没有可渲染子控件

#### Scenario: Root swiper-item is ignored
- **WHEN** 页面 XML 在 `page` 根下直接包含一个 `swiper-item`
- **THEN** 系统不把该元素当作可渲染控件，且其余已识别控件仍成功解析

#### Scenario: Item width and height are ignored
- **WHEN** 页面 XML 中某个 `swiper-item` 带有 `width` 或 `height`
- **THEN** 解析结果不包含该 item 的宽高，序列化后的 XML 也不再写出这两项属性

#### Scenario: Item margin is ignored
- **WHEN** 页面 XML 中某个 `swiper-item` 带有 `margin` 或四边 `margin-*`
- **THEN** 解析结果不包含该 item 的外边距，序列化后的 XML 也不再写出这些属性

#### Scenario: Item border and radius are ignored
- **WHEN** 页面 XML 中某个 `swiper-item` 带有边框宽度、线型、颜色或圆角
- **THEN** 解析结果不包含该 item 的边框与圆角，序列化后的 XML 也不再写出这些属性

#### Scenario: Item position is ignored
- **WHEN** 页面 XML 中某个 `swiper-item` 带有 `position` 或 `top` / `right` / `bottom` / `left` / `inset`
- **THEN** 解析结果不包含该 item 的定位与偏移，序列化后的 XML 也不再写出这些属性

### Requirement: Bubble text and box style controls
气泡样式编辑器 SHALL 按控件类型提供文字与盒样式入口。盒模型与文字样式 MUST 编辑现有控件样式字段；`th` 与 `td` 的水平对齐和垂直对齐 MUST 编辑单元格自己的 `align` 与 `valign`。当选中控件为 `text`、`button`、`th` 或 `td` 时，气泡 MUST 提供文本内容编辑入口（多行文本框），以及字体颜色、文字阴影、加粗、斜体、下划线与删除线。除 `tr` 外，全部可选中控件的气泡 MUST 提供背景颜色。除 `tr`、`th` 与 `td` 外，全部可选中控件的气泡 MUST 提供旋转。全部可选中控件（含 `tr`）MUST 提供状态控制与循环入口。`tr` 的气泡 MUST NOT 提供背景、边框、文字、旋转、外边距、内边距、圆角、定位或通用尺寸。圆角与边框宽度 MUST 出现在 `swiper-item` 与 `tr` 以外的控件。外边距与定位入口 MUST 出现在 `swiper-item`、`th`、`tr` 与 `td` 以外的控件；内边距入口 MUST 出现在 `swiper` 与 `tr` 以外的控件。外边距、内边距、圆角、边框宽度与定位偏移 MUST 逐行展示：总、上下、左右、上、左、下、右（圆角对应四角标签）。旋转 MUST 按 X、Y、Z 三轴逐行展示，单位 MUST 为 `deg` / `rad` / `grad` / `turn`，默认 `deg`。外边距 MUST 提供单位 `px` / `%` / `auto`；定位偏移 MUST 提供 `px` / `%`；内边距 MUST 提供 `px` / `%`。边框的线型与颜色 MUST 仍为控件级统一值。非 `text`、`button`、`th` 与 `td` 的气泡 MUST NOT 展示上述文字样式入口。选中 `th` 或 `td` 时，气泡 MUST 额外提供水平对齐（`start` / `center` / `end`）与垂直对齐（`top` / `middle` / `bottom`）。本期气泡 MUST NOT 提供字号增减。

#### Scenario: Text widget shows type-specific controls
- **WHEN** 已登录管理员选中一个文本控件
- **THEN** 气泡包含文本内容编辑、字体颜色、文字阴影、加粗、斜体、下划线、删除线，以及背景、外边距、内边距、圆角、边框、定位、旋转、状态控制、循环与设置入口

#### Scenario: Flex widget omits text style controls
- **WHEN** 已登录管理员选中一个弹性盒
- **THEN** 气泡包含背景、外边距、内边距、圆角、边框、定位、旋转、状态控制、循环与设置入口，不包含字体颜色或加粗等文字样式入口

#### Scenario: Margin and padding use per-edge rows
- **WHEN** 已登录管理员在弹性盒气泡中打开外边距或内边距
- **THEN** 气泡按总、上下、左右、上、左、下、右逐行编辑对应边距，并可选择 `px` / `%` / `auto`（内边距无 `auto`），预览立即更新

#### Scenario: Swiper omits padding
- **WHEN** 已登录管理员选中一个滑动器
- **THEN** 气泡包含背景、尺寸、外边距、圆角、边框、定位、旋转、状态控制、循环与设置入口，不包含内边距入口

#### Scenario: Swiper item omits size margin border radius and position
- **WHEN** 已登录管理员选中一个滑动器页
- **THEN** 气泡包含背景、内边距、旋转、状态控制、循环与设置入口，不包含尺寸、外边距、圆角、边框与定位入口

#### Scenario: Table cell shows text and alignment
- **WHEN** 已登录管理员选中一个 `td`
- **THEN** 气泡包含文本内容编辑、字体颜色、加粗等文字样式、水平对齐、垂直对齐、背景、内边距、圆角与边框，不包含通用尺寸、外边距、定位或旋转

#### Scenario: Table row omits cell style controls
- **WHEN** 已登录管理员在控件树中选中一个 `tr`
- **THEN** 气泡不包含文字样式、背景、边框、旋转、外边距或通用尺寸入口

#### Scenario: Four-side radius mode
- **WHEN** 已登录管理员将某控件圆角设为上下左右模式，并把四角设为不同数值
- **THEN** 预览中四个圆角分别使用这些值，且不把它们合并为单一相等圆角

#### Scenario: Bold toggle on button
- **WHEN** 已登录管理员在按钮的气泡中打开加粗
- **THEN** 该按钮以粗体渲染，关闭加粗后恢复为未设置粗细

### Requirement: Live preview after widget edits
工作台 SHALL 允许为当前页面添加 `text`、`button`、`flex`、`swiper` 或 `table`，并编辑已有文本/按钮的文案、弹性盒的容器与项目属性、滑动器属性以及表格的行列、列宽、行高、溢出、表头冻结与单元格样式。每次有效编辑后，子窗口 MUST 用更新后的 XML 重新渲染，且不必要求先保存为新版本。

#### Scenario: Adding a text widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个文本控件并给出文案
- **THEN** 子窗口展示该文案

#### Scenario: Adding a button widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个按钮控件并给出标签
- **THEN** 子窗口展示该标签的按钮

#### Scenario: Adding a flex widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个弹性盒
- **THEN** 子窗口展示该弹性容器

#### Scenario: Adding a swiper widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个滑动器
- **THEN** 子窗口展示该滑动器及其默认 item

#### Scenario: Adding a table widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个表格
- **THEN** 子窗口展示该表格及其默认表头与数据行

#### Scenario: Editing widget copy updates preview
- **WHEN** 已登录管理员修改已有文本的 `value` 或已有按钮的 `text` 并应用到当前 XML
- **THEN** 子窗口展示修改后的文案

#### Scenario: Editing flex properties updates preview
- **WHEN** 已登录管理员修改已有弹性盒的容器属性或其中子控件的项目属性并应用到当前 XML
- **THEN** 子窗口按更新后的弹性布局重新渲染

#### Scenario: Editing swiper properties updates preview
- **WHEN** 已登录管理员修改已有滑动器的 `autoplay`、`circular` 或 `vertical` 并应用到当前 XML
- **THEN** 子窗口按更新后的滑动器属性重新渲染

#### Scenario: Editing table structure updates preview
- **WHEN** 已登录管理员为已有表格添加一列或修改某个单元格文案并应用到当前 XML
- **THEN** 子窗口展示更新后的列或文案

### Requirement: Add nested widgets from workbench
工作台 SHALL 允许为当前页面添加 `flex`、`swiper` 与 `table`。若当前选中控件是 `flex`，新添加的 `text`、`button`、`flex`、`swiper` 或 `table` MUST 成为该弹性盒的最后一个子控件。若当前选中控件是 `swiper` 或 `swiper-item`，新控件 MUST 按「Add swiper from workbench」的插入规则进入对应滑动器树；其中 `table` MUST 与 `text` 一样进入 item，而不是成为 `swiper` 的直接子元素。否则新控件 MUST 成为页面根的最后一个子控件（`swiper-item`、`th`、`tr` 与 `td` 除外）。控件树 MUST 按嵌套层级展示容器及其子控件，而不是把所有控件列成一层。

#### Scenario: Adding a flex widget updates tree and preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个弹性盒
- **THEN** 控件树出现该弹性盒，子窗口渲染出对应的弹性容器

#### Scenario: Adding a child into selected flex
- **WHEN** 已登录管理员选中一个已有弹性盒后添加一个文本控件
- **THEN** 该文本成为该弹性盒的子控件，出现在控件树的对应层级下，且子窗口在该弹性盒内展示该文案

#### Scenario: Adding a swiper into selected flex
- **WHEN** 已登录管理员选中一个已有弹性盒后添加一个滑动器
- **THEN** 该滑动器成为该弹性盒的子控件，出现在控件树的对应层级下

#### Scenario: Adding a table into selected flex
- **WHEN** 已登录管理员选中一个已有弹性盒后添加一个表格
- **THEN** 该表格成为该弹性盒的子控件，出现在控件树的对应层级下

#### Scenario: Adding a widget without a flex selected
- **WHEN** 已登录管理员未选中弹性盒（或选中的是非容器控件）后添加一个按钮
- **THEN** 该按钮成为页面根的最后一个控件，而不是某个弹性盒的子控件

### Requirement: Canvas size drag
工作台编辑草稿且点击选中某一可设宽高的控件后，系统 SHALL 在气泡操纵栏提供尺寸分组入口，并接受修饰键加 `T` 立刻打开该分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开尺寸面板，MUST NOT 在该分组已打开时把它关掉，MUST `preventDefault` 以免浏览器打开新标签页。主窗口与 iframe 画布 MUST 都能识别。焦点在可编辑输入内时 MUST NOT 拦截。预览模式、非草稿版本、当前没有选中控件、或选中的是 `swiper-item`、`th`、`tr` 或 `td` 时 MUST NOT 打开尺寸分组或改宽高。`swiper-item`、`th`、`tr` 与 `td` 的气泡 MUST NOT 展示尺寸入口。

尺寸分组打开后，系统 MUST 在选中控件边框盒四边各叠加一条控制条：左、右 MUST 改宽度，上、下 MUST 改高度。控制条热区 MUST 明显大于可见细条。左右非零宽度 MUST 显示在对应边上，上下非零高度 MUST 显示在对应边上；边长放不下时 MUST 隐藏该数字。画布其余内容 MUST 被半透明遮罩盖住，选中控件本身 MUST 保持完全可见。选中控件右下角 MUST 有取消与确定；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件宽高恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。辅助线、控制条、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉辅助线与遮罩。

按住某条控制条拖动 SHALL 按指针位移改写对应维度，并 MUST 写入与气泡、检查器相同的 `width` / `height` 字段，模式 MUST 为像素。位移 MUST 按画布视觉缩放折算为 CSS 像素后按 `1` 步进写入整数（向 0 截断）。向外拖 MUST 增大，向内拖 MUST 减小。宽高 MUST 钳在大于等于 `0`。若拖动开始时该维未设置或不是像素（例如百分比），MUST 先按当前计算像素作为起点再写成像素。按下控制条后，指针移出热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写。未按住控制条时 MUST NOT 把控件上的左键拖动当成改尺寸。默认一次只改按住边对应的那一维。按住 `Alt` 时 MUST 把宽和高写成相同值（按下 `Alt` 或按住 `Alt` 抓住控制条时立刻对齐）；松开后保持该值。按住 `Shift` 时 MUST 吸附：先另一维的当前像素值（距目标 10px 内；按住 `Alt` 时 MUST 跳过这一步），否则落到最近的 5 的倍数，并显示磁铁图标；未按 `Shift` 时 MUST NOT 吸附。一次拖动 MUST 合并为一步撤回。中键平移 MUST 不受影响。

尺寸分组打开后，系统 SHALL 接受按住数字键 `1`–`3` 选择维度：`1` MUST 改宽度（左右控制条），`2` MUST 改高度（上下控制条），`3` MUST 同时改宽与高（四条控制条）。这些选维键 MUST 为主键盘数字行，MUST NOT 把小键盘当成选维，MUST NOT 把 `4`–`7` 当成尺寸选维。同一维度被多条边同时选中时，方向键与小键盘 MUST 对该维只施加一次增量，MUST NOT 把高度或宽度加两遍。按住数字的同时 `ArrowUp` MUST 立刻增加 `1` 像素，`ArrowDown` MUST 立刻减小 `1` 像素；未选中宽与高时 `ArrowLeft` / `ArrowRight` MUST NOT 改样式。按住 `3` 时 `ArrowUp` / `ArrowRight` MUST 同时增加宽和高，`ArrowDown` / `ArrowLeft` MUST 同时减小。长按方向键 MUST 每 `100ms` 步进 `2` 像素。按住选维键时，小键盘数字 MUST 把当前选中维度写成该次按住期间输入的整数值；`Backspace` MUST 删末位；`-` MUST NOT 把宽高写成负数。未选维时这些键 MUST NOT 改样式。按住数字时对应控制条 MUST 显示为黄色。`Tab` 切到兄弟后若上一控件已打开尺寸分组，新选中控件 MUST 仍打开尺寸分组（该兄弟为 `swiper-item`、`th`、`tr` 或 `td` 时 MUST 关闭）。

#### Scenario: Shortcut opens size
- **WHEN** 已登录管理员在编辑草稿时选中一个文本控件并按下 `Ctrl+T` 或 `⌘+T`
- **THEN** 气泡立刻展开尺寸面板，选中控件上出现尺寸控制条，浏览器不打开新标签页

#### Scenario: Shortcut does not toggle closed
- **WHEN** 气泡尺寸面板已打开，管理员再次按下 `Ctrl+T`
- **THEN** 尺寸面板保持打开

#### Scenario: Swiper item has no size group
- **WHEN** 已登录管理员选中一个 `swiper-item` 并按下 `Ctrl+T`
- **THEN** 不展开尺寸分组，也不改该 item 的宽高

#### Scenario: Table parts have no size group
- **WHEN** 已登录管理员选中一个 `th`、`tr` 或 `td` 并按下 `Ctrl+T`
- **THEN** 不展开尺寸分组，也不改该节点的通用宽高

#### Scenario: Drag right grows width
- **WHEN** 已选中控件且尺寸面板已打开，宽度为 `100px`，管理员按住右边控制条向右拖 `8` CSS 像素
- **THEN** 宽度变成 `108` 像素，高度不变

#### Scenario: Drag top grows height
- **WHEN** 已选中控件且尺寸面板已打开，高度为 `40px`，管理员按住上边控制条向上拖 `6` CSS 像素
- **THEN** 高度变成 `46` 像素，宽度不变

#### Scenario: Drag does not go negative
- **WHEN** 已选中控件且宽度为 `10px`，管理员按住左边控制条向内拖过零点
- **THEN** 宽度停在 `0`，不写成负数

#### Scenario: Unset size starts from computed pixels
- **WHEN** 已选中控件且未设置宽度，计算宽度为 `120px`，管理员打开尺寸面板并按住右边控制条向右拖 `4` CSS 像素
- **THEN** 宽度写成 `124` 像素

#### Scenario: Alt makes a square
- **WHEN** 已选中控件且宽度为 `80px`、高度为 `40px`，管理员按住 `Alt` 并按住右边控制条拖到宽度 `50`
- **THEN** 宽度与高度都写成 `50`

#### Scenario: Shift snaps to the other dimension
- **WHEN** 已选中控件且宽度为 `32px`、高度为 `40px`，管理员按住 `Shift` 并按住右边控制条拖到约 `39`
- **THEN** 宽度吸附为 `40`，高度仍为 `40`，并出现磁铁图标

#### Scenario: Digit 1 nudges width
- **WHEN** 已选中控件且尺寸面板已打开，宽度为 `100px`，管理员按住 `1` 并按 `ArrowUp`
- **THEN** 宽度变成 `101` 像素，高度不变，左右控制条呈黄色

#### Scenario: Digit 2 nudges height once
- **WHEN** 已选中控件且尺寸面板已打开，高度为 `40px`，管理员按住 `2` 并按 `ArrowUp`
- **THEN** 高度变成 `41` 像素，MUST NOT 变成 `42`，上下控制条呈黄色

#### Scenario: Digit 3 nudges both
- **WHEN** 已选中控件且尺寸面板已打开，宽高均为 `40px`，管理员按住 `3` 并按 `ArrowUp`
- **THEN** 宽度与高度都变成 `41` 像素，四条控制条均呈黄色

#### Scenario: Numpad types width
- **WHEN** 已选中控件且尺寸面板已打开，管理员按住主键盘 `1`，再依次按小键盘 `8`、`0`
- **THEN** 宽度先变成 `8`，再变成 `80` 像素，高度不变

#### Scenario: Confirm keeps size edits
- **WHEN** 尺寸已打开且管理员已拖动改过宽度，管理员点勾或按 `Enter`
- **THEN** 宽度保持拖动后的值，辅助线、遮罩与按钮消失

#### Scenario: Cancel restores size
- **WHEN** 尺寸已打开且管理员已拖动改过宽度，管理员点叉或按 `Esc`
- **THEN** 该控件宽高恢复为打开分组前的值，辅助线、遮罩与按钮消失

#### Scenario: Tab keeps the size group
- **WHEN** 已登录管理员在编辑草稿时已打开尺寸分组并改了当前控件宽度，再按 `Tab` 切到可设宽高的兄弟
- **THEN** 上一控件的宽度保持改后的值，新选中控件上尺寸分组仍打开

#### Scenario: Preview ignores size drag
- **WHEN** 管理员处于预览模式或当前版本不是草稿
- **THEN** `Ctrl+T` 与左键拖动都不改变宽高
