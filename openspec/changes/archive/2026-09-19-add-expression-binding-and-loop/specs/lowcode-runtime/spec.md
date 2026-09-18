## ADDED Requirements

### Requirement: Copy field data binding
文本控件的 `value` 与按钮控件的 `text` SHALL 允许填写整段绑定表达式，以在预览模式与 H5 中传入值。去掉首尾空白后，整段匹配优先级 MUST 为：`$t("分组键.文案键")`（仍按语言库解析）→ `$(表达式)` → `$data` 路径 → 当前循环作用域中的项目或索引路径 → 普通字面量。`$(表达式)` MUST 支持数字、字符串、布尔字面量、三元运算、四则与字符串拼接，并在表达式内用 `data.变量名` 读取变量池。`$data.变量名` 与 `$data.变量名.成员` MUST 读取变量池中对应值。配置了循环的节点及其子孙 MUST 还能使用 `$项目变量名`、`$项目变量名.成员` 与 `$索引变量名`（缺省为 `$item` 与 `$index`），并在 `$(表达式)` 内用对应标识符混写（例如 `$(data.var1 + data.var2)`、`$(item.name + '(' + item.id + ')')`）。混合在普通字面量中间的片段（例如 `前缀$(1)`）MUST 当作普通字面量，MUST NOT 部分求值。样式、尺寸与其它非文案字段 MUST NOT 按本语法求值。编辑模式下，除 `$t(...)` 外 MUST 在画布上展示绑定原文，MUST NOT 把 `$()` / `$data` / 循环路径替换成求值结果。预览模式与 H5 MUST 求值：成功时把结果转成展示字符串（`null` / `undefined` 为空串，对象与数组用 JSON 文本，其余按对应原始值的文本形式）；失败、未知变量或路径不存在时 MUST 显示空字符串，MUST NOT 把表达式原文画到页面上，MUST NOT 使整页渲染失败。

#### Scenario: Number expression renders in preview
- **WHEN** 某文本 `value` 为 `$(1)`，工作台处于预览模式或 H5 渲染该页
- **THEN** 该文本展示 `1`，而不是 `$(1)`

#### Scenario: String and boolean expressions render
- **WHEN** 某按钮 `text` 为 `$("1")`，另一文本 `value` 为 `$(false)`，处于预览模式
- **THEN** 按钮标签为 `1`，文本展示 `false`

#### Scenario: Ternary expression renders
- **WHEN** 某文本 `value` 为 `$(true ? '1' : '2')`，处于预览模式
- **THEN** 该文本展示 `1`

#### Scenario: Data path reads page variable
- **WHEN** 页面变量 `var4` 的值为字符串 `张三`，某文本 `value` 为 `$data.var4`，处于预览模式
- **THEN** 该文本展示 `张三`

#### Scenario: Expression mixes data variables
- **WHEN** 页面变量 `var1` 为数字 `1`、`var2` 为数字 `2`，某文本 `value` 为 `$(data.var1 + data.var2)`，处于预览模式
- **THEN** 该文本展示 `3`

#### Scenario: Data ternary mixes with literals
- **WHEN** 页面变量 `var3` 为布尔真，某文本 `value` 为 `$(data.var3 ? '1' : '2')`，处于预览模式
- **THEN** 该文本展示 `1`

#### Scenario: Edit mode keeps binding source
- **WHEN** 已登录管理员处于编辑模式，某文本 `value` 为 `$data.var4`
- **THEN** 画布上该文本仍展示 `$data.var4`，不替换成变量值

#### Scenario: I18n still wins over data binding
- **WHEN** 某文本 `value` 为 `$t("common.ok")`，当前语言有对应译文
- **THEN** 编辑模式与预览都展示该译文，不把整段当作 `$data` 或 `$()` 解析

#### Scenario: Mixed literal is not evaluated
- **WHEN** 某文本 `value` 为 `前缀$(1)`，处于预览模式
- **THEN** 该文本展示 `前缀$(1)`，不把其中的 `$(1)` 单独求值

#### Scenario: Unknown binding renders empty
- **WHEN** 某文本 `value` 为 `$data.missing` 或 `$(data.missing)`，变量池没有该名，处于预览模式
- **THEN** 该文本展示空字符串，页面其余控件仍渲染

### Requirement: Widget loop in page xml
可选中控件 SHALL 可声明循环，用于预览模式与 H5 按数组重复渲染该节点及其子树。循环 MUST 写在该控件元素自身上，MUST 使用属性：`loop-from`（`data` 表示数据池，`literal` 表示定义值）、`loop-src`（`data` 时为变量名，`literal` 时为数组表达式）、`loop-key`（唯一键，必填，相对每项的成员路径）、可选 `loop-item`（项目变量名，缺省 `item`）、可选 `loop-index`（索引变量名，缺省 `index`）。缺省项目/索引名 MUST 不写出对应属性。循环是控件身份与结构的一部分：MUST 在各视觉状态间共享，MUST NOT 写入 `<_>` 或 `<__>`。`loop-from`、`loop-src` 与 `loop-key` 均非空时循环 MUST 视为已配置；任一缺失、空白或 `loop-from` 无法识别时 MUST 视为未配置，MUST NOT 写出循环属性，MUST NOT 使整页 XML 非法。无循环属性的既有页面 XML MUST 仍合法。项目变量名与索引变量名 MUST 是合法的 JavaScript `IdentifierName`，MUST 互不相同，MUST NOT 为 `data` 或 `t`；非法名称 MUST 回落到缺省名。复制控件时 MUST 复制循环配置（新 `id` 除外）。

#### Scenario: Data-pool loop round-trips
- **WHEN** 系统解析 `<text id="row" value="$item.name" loop-from="data" loop-src="list" loop-key="id" />` 并再序列化
- **THEN** 再次解析得到相同的循环来源、源名、唯一键，且不写出 `loop-item` 与 `loop-index`

#### Scenario: Literal loop and custom aliases round-trip
- **WHEN** 系统解析 `<flex id="row" loop-from="literal" loop-src="[{id:1},{id:2}]" loop-key="id" loop-item="row" loop-index="i"></flex>` 并再序列化
- **THEN** 再次解析得到定义值来源、同一数组表达式、唯一键 `id`、项目变量名 `row`、索引变量名 `i`

#### Scenario: Incomplete loop is not configured
- **WHEN** 某控件只有 `loop-from="data"` 与 `loop-src="list"`，没有 `loop-key`
- **THEN** 解析结果视为未配置循环，序列化不写出循环属性，整页仍合法

#### Scenario: Existing pages without loop remain valid
- **WHEN** 系统解析一份不含任何 `loop-*` 属性的既有页面 XML
- **THEN** 解析成功，所有控件都未配置循环

#### Scenario: Copy preserves loop
- **WHEN** 已登录管理员复制一个已配置循环的弹性盒并粘贴
- **THEN** 副本带有相同的循环来源、源、唯一键与变量名，且各控件 `id` 与原树不同

### Requirement: Workbench loop configuration
工作台编辑草稿且选中某一控件后，气泡工具栏 SHALL 为全部可选中控件提供循环入口。点击后 MUST 在气泡下方打开循环配置面板，字段 MUST 为：源数组（下拉框在「定义值」与「数据池」之间切换，其后为编辑定义值或选择变量池变量）、唯一键（必填）、索引变量名（默认 `index`）、项目变量名（默认 `item`）。循环已配置时，工具栏循环图标 MUST 呈激活态（与字体加粗相同的主色按钮）；未配置时 MUST 为普通未激活态。再次点击该图标 MUST 关闭面板（与其它分组切换方式一致）。`Tab` 切到兄弟后若上一控件已打开循环分组，新选中控件 MUST 仍打开循环分组。预览模式 MUST NOT 显示可编辑气泡，因此 MUST NOT 从气泡改循环。非草稿版本打开循环面板时 MUST 只读。修改循环后 MUST 写入当前草稿 XML，子窗口 MUST 立即重新渲染，且不必先保存版本。清空源或唯一键 MUST 使循环变为未配置并去掉激活态。

#### Scenario: All widgets show loop control
- **WHEN** 已登录管理员依次选中文本、按钮、弹性盒、滑动器与 `swiper-item`
- **THEN** 各气泡工具栏都有循环图标

#### Scenario: Opening loop shows binding fields
- **WHEN** 已登录管理员在编辑草稿时点击选中控件的循环图标
- **THEN** 气泡下方出现源数组（定义值/数据池）、唯一键、索引变量名与项目变量名

#### Scenario: Configured loop activates the icon
- **WHEN** 已登录管理员为某控件填好数据池源数组 `list`、唯一键 `id`，索引与项目使用缺省名
- **THEN** 工具栏循环图标处于激活态，XML 写出 `loop-from="data"`、`loop-src="list"`、`loop-key="id"`

#### Scenario: Clearing key deactivates loop
- **WHEN** 已登录管理员把已配置循环的唯一键清空
- **THEN** 循环图标回到未激活态，序列化结果不再写出循环属性

#### Scenario: Loop edits are undoable
- **WHEN** 已登录管理员在编辑草稿时给某控件配置循环，再执行撤回
- **THEN** 该控件回到配置前的未循环状态，工具栏图标未激活

### Requirement: Widget tree loop marker
左侧控件树 SHALL 在已配置循环的节点行右侧显示循环图标。未配置循环的节点 MUST NOT 显示该图标。点击该图标 MUST 选中该控件、把它放到画布视野中，并打开该控件气泡的循环配置面板。该图标 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5。

#### Scenario: Looped widget shows tree icon
- **WHEN** 当前页面有一个已配置循环的弹性盒，以及一个未配置循环的文本
- **THEN** 控件树只在该弹性盒行右侧显示循环图标

#### Scenario: Tree icon focuses loop config
- **WHEN** 已登录管理员点击控件树某节点右侧的循环图标
- **THEN** 该控件被选中并放到视野中，气泡循环配置面板打开

### Requirement: Render looped widgets from xml
预览模式与 H5 SHALL 对已配置循环的节点按源数组展开：源为数据池时 MUST 读取该变量求值结果，源为定义值时 MUST 求值 `loop-src` 数组表达式。结果不是数组或长度为 0 时，该节点及其子树 MUST 不出现在渲染结果中。每一项 MUST 克隆该节点及其子树并按数组顺序插入原位置；该项及其子孙的文案绑定 MUST 能读取该次循环的项目与索引（按所配变量名）。唯一键 MUST 用于区分各次展开实例；某项缺少该键时 MUST 仍渲染，并用该项下标区分实例。嵌套循环 MUST 各自使用自己的项目/索引名；内层 MUST 仍能读取外层尚未被同名覆盖的变量以及 `data`。编辑模式 MUST NOT 展开循环，MUST 只渲染一份模板节点。管理后台预览与 H5 对同一份含循环的 XML MUST 展开出相同份数、相同顺序与相同求值文案。

#### Scenario: Preview repeats node by data array
- **WHEN** 页面变量 `list` 为 `[{id:1,name:'A'},{id:2,name:'B'}]`，某文本配置了数据池循环 `list`、唯一键 `id`、`value` 为 `$item.name`，工作台处于预览模式
- **THEN** 子窗口依次展示 `A` 与 `B` 两份该文本

#### Scenario: Nested item path and mixed expression
- **WHEN** 循环项为 `{id:3,name:'李四'}`，某文本 `value` 为 `$(item.name + '(' + item.id + ')')`，处于预览模式
- **THEN** 该次实例展示 `李四(3)`

#### Scenario: Custom item alias is used
- **WHEN** 某循环的项目变量名为 `row`，其文本 `value` 为 `$row.id`
- **THEN** 预览中各实例展示对应项的 `id`

#### Scenario: Empty source hides the node
- **WHEN** 某弹性盒已配置循环，源数组为空数组，处于预览模式
- **THEN** 子窗口不展示该弹性盒及其子控件

#### Scenario: Edit mode shows a single template
- **WHEN** 同一已配置循环的弹性盒，工作台处于编辑模式
- **THEN** 画布只展示一份该弹性盒模板，不按数组复制

#### Scenario: Nested loops compose scopes
- **WHEN** 外层循环项目名为 `group`，内层为缺省 `item`，内层文本 `value` 为 `$(group.title + item.name)`，处于预览模式
- **THEN** 每个内层实例展示对应外层标题与内层名称的拼接

#### Scenario: H5 matches admin preview loops
- **WHEN** 同一份含循环文本的合法页面 XML 分别在管理后台预览与 H5 中渲染
- **THEN** 两处展开的份数、顺序与文案相同

## MODIFIED Requirements

### Requirement: Widget named states in page xml
可选中控件 SHALL 具有隐式默认状态，其属性即该控件元素自身的已识别属性（`id`、文案、循环与现有样式 / 弹性 / 滑动器属性）。默认状态 MUST NOT 写成子元素。控件 MAY 声明一个或多个命名自定义状态：每个自定义状态 MUST 是该控件的直接子元素 `<_>`，MUST 带非空属性 `name`，MUST NOT 被当作可渲染控件。`<_>` 上 MAY 携带与宿主控件相同的外观与布局属性（样式、弹性容器、弹性项目、滑动器属性），MAY 携带非负整数属性 `transition`（毫秒，进入该状态时的 CSS 过渡时长）；MUST NOT 携带 `id`、`value`、`text`、循环属性或子控件。默认状态的过渡时长 MUST 写在宿主元素自身的 `transition` 属性上（例如 `<flex transition="1000">`），MUST NOT 写成 `<_>`。`transition` 为 0 或省略时 MUST NOT 写出，且 MUST NOT 产生过渡。`name` MUST 在同一宿主控件的全部 `<_>` 中唯一（含顶层与所有 `<__>` 内的子状态）；无法识别或重名的 `<_>` MUST 被忽略且 MUST NOT 使整页 XML 非法。无 `<_>` 的既有页面 XML MUST 仍合法。页面根下的 `<_>` MUST 被忽略。

#### Scenario: Named state round-trips on text
- **WHEN** 页面 XML 含 `<text id="t1" value="内容" color="red" background="white" font-size="12"><_ name="active" color="blue" background="red" /></text>`
- **THEN** 解析结果中该文本的默认状态颜色为红、背景为白、字号为 12，并含名为 `active` 的自定义状态，其差异为颜色蓝、背景红；再次序列化仍含该 `<_ name="active">` 且不把默认状态写成 `<_>`

#### Scenario: Default state transition duration round-trips on the host
- **WHEN** 页面 XML 含 `<flex id="box" transition="1000"><_ name="active" transition="300" /></flex>`
- **THEN** 解析结果中该弹性盒默认状态过渡时长为 1000 毫秒、`active` 为 300 毫秒；再次序列化宿主元素仍写出 `transition="1000"`，`<_>` 仍写出 `transition="300"`

#### Scenario: Empty named state is kept
- **WHEN** 页面 XML 含一个 `flex`，其直接子元素为 `<_ name="active" />` 与若干控件
- **THEN** 解析结果声明该弹性盒拥有名为 `active` 的自定义状态，且该状态相对默认没有属性差异；该 `<_>` 不是可渲染子控件

#### Scenario: Nameless state node is ignored
- **WHEN** 页面 XML 中某个按钮内含 `<_ color="blue" />`（无 `name`）
- **THEN** 解析结果不包含该自定义状态，按钮仍成功解析，整页 XML 仍合法

#### Scenario: Duplicate state names keep the first
- **WHEN** 同一控件内连续两个 `<_ name="active">`，后者带不同颜色
- **THEN** 解析只保留第一份 `active`，不使整页非法

#### Scenario: Duplicate nested name is ignored
- **WHEN** 同一文本既有 `<_ name="a">` 又有 `<__ name="active"><_ name="a"/></__>`
- **THEN** 解析只保留顶层 `a`，忽略继承覆盖内重名的 `<_>`，状态树只出现一个 `a`，整页仍合法

#### Scenario: Existing pages without states remain valid
- **WHEN** 系统解析一份不含 `<_>`、`<__>` 与 `state` 属性的既有页面 XML
- **THEN** 解析成功，每个控件只有默认状态

#### Scenario: Loop is not stored on named states
- **WHEN** 某弹性盒已配置循环，管理员在 `active` 状态下改背景色
- **THEN** `<_ name="active">` 只写出背景差异，不写出任何 `loop-*` 属性

### Requirement: Custom state properties inherit default
命名自定义状态的属性 SHALL 叠加在默认状态之上。自定义状态未设置的属性 MUST 使用默认状态的对应值；已设置的属性 MUST 覆盖默认值。序列化自定义状态时，与默认状态相同的属性 MUST NOT 写入 `<_>`。控件身份与结构（`id`、类型、子控件树、循环、文本 `value` / 按钮 `text`）MUST 在各状态间共享，MUST NOT 按状态分叉。

#### Scenario: Unset custom property uses default
- **WHEN** 某文本默认 `color` 为红、`font-size` 为 12，其 `active` 状态只设置 `color` 为蓝
- **THEN** 解析后的 `active` 状态颜色为蓝、字号仍为 12

#### Scenario: Matching custom property is omitted
- **WHEN** 已登录管理员在某控件的 `active` 状态下把 `color` 改回与默认状态相同的值并应用到当前 XML
- **THEN** 该控件的 `<_ name="active">` 不再写出 `color`

#### Scenario: Content is not per-state
- **WHEN** 已登录管理员在 `active` 状态下修改某文本的展示文案
- **THEN** 默认状态与所有自定义状态都使用这份文案，XML 不把文案写进 `<_>`

#### Scenario: Loop is not per-state
- **WHEN** 已登录管理员在 `active` 状态下为某文本配置循环
- **THEN** 默认状态与所有自定义状态共用这份循环，XML 把循环属性写在宿主元素上而不是 `<_>`

### Requirement: Bubble text and box style controls
气泡样式编辑器 SHALL 按控件类型提供文字与盒样式入口，且 MUST 只编辑现有控件样式字段。当选中控件为 `text` 或 `button` 时，气泡 MUST 提供文本内容编辑入口（多行文本框），以及字体颜色、文字阴影、加粗、斜体、下划线与删除线。全部可选中控件的气泡 MUST 提供背景颜色、旋转与循环入口。圆角与边框宽度 MUST 出现在 `swiper-item` 以外的控件。外边距与定位入口 MUST 出现在 `swiper-item` 以外的控件；内边距入口 MUST 出现在 `swiper` 以外的控件。外边距、内边距、圆角、边框宽度与定位偏移 MUST 逐行展示：总、上下、左右、上、左、下、右（圆角对应四角标签）。旋转 MUST 按 X、Y、Z 三轴逐行展示，单位 MUST 为 `deg` / `rad` / `grad` / `turn`，默认 `deg`。外边距 MUST 提供单位 `px` / `%` / `auto`；定位偏移 MUST 提供 `px` / `%`；内边距 MUST 提供 `px` / `%`。边框的线型与颜色 MUST 仍为控件级统一值。非 `text`/`button` 的气泡 MUST NOT 展示上述文字样式入口。本期气泡 MUST NOT 提供字号增减。

#### Scenario: Text widget bubble shows text styles
- **WHEN** 已登录管理员选中一个文本控件
- **THEN** 气泡包含文本内容编辑、字体颜色、文字阴影、加粗、斜体、下划线、删除线，以及背景、外边距、内边距、圆角、边框、定位、旋转、循环与设置入口

#### Scenario: Flex widget bubble hides text styles
- **WHEN** 已登录管理员选中一个弹性盒
- **THEN** 气泡包含背景、外边距、内边距、圆角、边框、定位、旋转、循环与设置入口，不包含字体颜色或加粗等文字样式入口

#### Scenario: Bubble can edit margin and padding
- **WHEN** 已登录管理员选中一个允许该边距的控件并打开外边距或内边距面板
- **THEN** 气泡按总、上下、左右、上、左、下、右逐行编辑对应边距，并可选择 `px` / `%` / `auto`（内边距无 `auto`），预览立即更新

#### Scenario: Swiper bubble hides padding
- **WHEN** 已登录管理员选中一个滑动器
- **THEN** 气泡包含背景、尺寸、外边距、圆角、边框、定位、旋转、循环与设置入口，不包含内边距入口

#### Scenario: Swiper item bubble hides size, margin, border and radius
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 气泡包含背景、内边距、旋转、循环与设置入口，不包含尺寸、外边距、圆角、边框与定位入口

#### Scenario: Four-side radius mode
- **WHEN** 已登录管理员将某控件圆角设为上下左右模式，并把四角设为不同数值
- **THEN** 预览中四个圆角分别使用这些值，且不把它们合并为单一相等圆角

#### Scenario: Bold toggle on button
- **WHEN** 已登录管理员在按钮的气泡中打开加粗
- **THEN** 该按钮以粗体渲染，关闭加粗后恢复为未设置粗细

### Requirement: Render text and button from xml
子窗口 SHALL 按当前 XML 渲染 `text` 与 `button`。每个 `text` MUST 显示其解析后的文案：若 `value` 去掉首尾空白后整段为 `$t("分组键.文案键")`，MUST 显示当前语言下该键的译文；否则在预览模式与 H5 中 MUST 按「Copy field data binding」求值，在编辑模式中除 `$t(...)` 外 MUST 显示 `value` 原文。每个 `button` MUST 按同样规则解析其 `text` 标签。找不到对应分组、文案键或当前语言译文时，MUST 显示空字符串，MUST NOT 把 `$t(...)` 原文画到页面上。绑定求值失败时 MUST 显示空字符串。控件顺序 MUST 与 XML 中的声明顺序一致；已展开的循环实例 MUST 按源数组顺序占据该节点的位置。

#### Scenario: Preview shows text and button
- **WHEN** 当前 XML 依次包含 `value` 为「你好」的 `text` 与 `text` 为「确定」的 `button`
- **THEN** 子窗口先展示文本「你好」，再展示标签为「确定」的按钮

#### Scenario: Empty page renders no widgets
- **WHEN** 当前 XML 是合法的空 `page`（没有任何控件子元素）
- **THEN** 子窗口不展示文本或按钮控件

#### Scenario: Preview resolves t expression
- **WHEN** 当前预览语言为 `zh`，某文本 `value` 为 `$t("common.ok")`，语言库中该键的 `zh` 译文为「确定」
- **THEN** 子窗口展示「确定」，而不是 `$t("common.ok")`

#### Scenario: Missing translation renders empty
- **WHEN** 某按钮 `text` 为 `$t("missing.key")`，语言库中没有该键
- **THEN** 子窗口该按钮标签为空

#### Scenario: Preview resolves data binding
- **WHEN** 当前 XML 某文本 `value` 为 `$data.var4`，变量池 `var4` 为「你好」，工作台处于预览模式
- **THEN** 子窗口展示「你好」，而不是 `$data.var4`

#### Scenario: Edit mode shows data binding source
- **WHEN** 当前 XML 某文本 `value` 为 `$(1)`，工作台处于编辑模式
- **THEN** 子窗口展示 `$(1)`

### Requirement: Shared renderer across hosts
`text` 与 `button` 的页面渲染 SHALL 由公共渲染能力提供。管理后台预览页与 H5 独立运行时 MUST 对同一份合法页面 XML 在相同当前语言、相同语言目录与相同页面变量下渲染出相同的控件文案、循环展开、顺序与页面排列方向。工作台编辑、版本管理与预览协议 MUST NOT 放入该公共渲染能力；当前语言与语言目录可作为渲染输入交给该公共能力；页面变量 MUST 从同一份页面 XML 的 `<data>` 读取。

#### Scenario: Same xml matches in admin preview and h5
- **WHEN** 同一份依次包含文本「你好」与按钮「确定」的合法页面 XML 分别在管理后台预览页与 H5 运行时中渲染
- **THEN** 两处都先展示「你好」，再展示标签为「确定」的按钮

#### Scenario: Same locale resolves the same copy
- **WHEN** 同一份含 `$t("common.ok")` 的页面 XML，工作台预览语言为 `ar` 且工程库中有对应译文，H5 加载同一版本发布的 `ar` JSON
- **THEN** 两处都展示相同的 `ar` 译文，且页面都为从右到左

#### Scenario: Same data binding resolves in both hosts
- **WHEN** 同一份含 `$data.var4` 文本与对应 `<data>` 的页面 XML 分别在管理后台预览与 H5 中渲染
- **THEN** 两处都展示该变量的求值文案

### Requirement: Keyboard shortcuts for widget commands
工作台 SHALL 为删除、复制、粘贴、撤回、重做提供与按钮入口等效的快捷键。在编辑草稿且焦点不在文本输入、多行输入或可编辑区域内时：`Delete` MUST 删除当前选中控件；`Backspace` MUST NOT 删除控件。已选中控件时，`Tab` MUST 把选中切到当前控件的下一个兄弟节点；若当前已是最后一个兄弟，MUST 回到第一个兄弟。无选中或只有自身这一项时，`Tab` MUST NOT 改选中（仅一项时仍停留在该控件）。画布缩放不是 `500%` 时，`Tab` 切兄弟 MUST NOT 改变画布缩放或把该控件放大到视野中；当前缩放已是 `500%` 时，`Tab` 切到该兄弟后 MUST 把它放到视野中。若切兄弟前已打开内容、内边距、外边距、尺寸、圆角、边框、定位、旋转或循环编辑分组，`Tab` 之后 MUST 在新选中控件上保持同一分组打开，MUST NOT 关掉该编辑模式；上一控件已改的值 MUST 保留。`Ctrl+Enter` 或 `⌘+Enter` MUST 选中当前控件的第一个子控件；没有子控件时 MUST NOT 改选中。`Ctrl+Shift+Enter` 或 `⌘+Shift+Enter` MUST 选中当前控件的父控件；已在页面根级时 MUST NOT 改选中。连按两次 `Enter`（间隔不超过 `300ms`）MUST 等同于对该节点 `Ctrl` 双击：把当前选中控件放大到视野中；若当前画布缩放已是 `500%`，第二次 `Enter` MUST 还原为放大前的视图（没有放大前记录则回到适配画布）。焦点在可编辑输入内时 MUST NOT 拦截这些键。平台修饰键加 `C` MUST 复制；平台修饰键加 `V` MUST 粘贴；平台修饰键加 `Z` MUST 撤回；平台修饰键加 `Shift+Z` 或平台修饰键加 `Y` MUST 重做。焦点在文本输入、多行输入或可编辑区域内时，系统 MUST NOT 用这些快捷键操作控件树，以便保留输入框自身的编辑行为。编辑态下，管理员在预览 iframe 内按下上述快捷键时，工作台 MUST 与主窗口快捷键产生相同效果。预览模式或非草稿版本下，除复制外的变更类快捷键 MUST NOT 改变控件树。

#### Scenario: Delete key removes the selected widget
- **WHEN** 已登录管理员在编辑草稿时选中一个控件，且焦点不在输入框内，按下 `Delete`
- **THEN** 该控件按删除要求从控件树与子窗口中移除

#### Scenario: Backspace does not remove the selected widget
- **WHEN** 已登录管理员在编辑草稿时选中一个控件，且焦点不在输入框内，按下 `Backspace`
- **THEN** 该控件仍留在控件树与子窗口中

#### Scenario: Tab selects the next sibling widget
- **WHEN** 已登录管理员在编辑草稿时选中某容器下的第二个子控件，且焦点不在输入框内，按下 `Tab`
- **THEN** 选中变为该容器的第三个子控件

#### Scenario: Tab wraps from last sibling to first
- **WHEN** 已登录管理员在编辑草稿时选中某容器下的最后一个子控件，且焦点不在输入框内，按下 `Tab`
- **THEN** 选中变为该容器的第一个子控件

#### Scenario: Tab at 500% focuses the sibling in view
- **WHEN** 已登录管理员在编辑草稿且画布缩放为 `500%` 时选中一个控件，按下 `Tab` 切到兄弟
- **THEN** 选中变为该兄弟，且该兄弟被放到视野中

#### Scenario: Tab below 500% does not zoom
- **WHEN** 已登录管理员在编辑草稿且画布缩放不是 `500%` 时选中一个控件，按下 `Tab` 切到兄弟
- **THEN** 选中变为该兄弟，画布缩放与平移保持不变

#### Scenario: Tab keeps the open box edit group
- **WHEN** 已登录管理员在编辑草稿时已打开内边距分组并改了当前控件上内边距，再按 `Tab` 切到兄弟
- **THEN** 上一控件的上内边距保持改后的值，新选中控件上内边距分组仍打开

#### Scenario: Tab keeps the open loop group
- **WHEN** 已登录管理员在编辑草稿时已打开循环分组，再按 `Tab` 切到兄弟
- **THEN** 新选中控件上循环分组仍打开

#### Scenario: Ctrl+Enter selects the first child
- **WHEN** 已登录管理员在编辑草稿时选中一个有子控件的容器，且焦点不在输入框内，按下 `Ctrl+Enter`
- **THEN** 选中变为该容器的第一个子控件

#### Scenario: Ctrl+Shift+Enter selects the parent
- **WHEN** 已登录管理员在编辑草稿时选中某容器的子控件，且焦点不在输入框内，按下 `Ctrl+Shift+Enter`
- **THEN** 选中变为该容器

#### Scenario: Double Enter focuses the selected widget
- **WHEN** 已登录管理员在编辑草稿且画布缩放不是 `500%` 时选中一个控件，在 `300ms` 内连按两次 `Enter`
- **THEN** 该控件被放大到视野中，效果与对该控件 `Ctrl` 双击相同

#### Scenario: Double Enter at 500% restores the view
- **WHEN** 已登录管理员在编辑草稿且画布缩放为 `500%` 时选中一个控件，在 `300ms` 内连按两次 `Enter`
- **THEN** 画布还原为这次放大之前的视图

#### Scenario: Modifier shortcuts copy paste undo and redo
- **WHEN** 已登录管理员在编辑草稿时焦点不在输入框内，依次使用平台修饰键加 `C`、`V`、`Z` 以及 `Shift+Z`
- **THEN** 系统分别执行复制、粘贴、撤回与重做，效果与对应按钮一致

#### Scenario: Shortcuts ignored while typing in inspector
- **WHEN** 已登录管理员焦点在检查器文案输入框中，按下 `Backspace` 或平台修饰键加 `C` / `V`
- **THEN** 这些按键只作用于该输入框中的文本，控件树不被删除或粘贴

#### Scenario: Shortcuts work after clicking the canvas
- **WHEN** 已登录管理员在编辑草稿时点击 iframe 内的控件选中它，然后在 iframe 内按下 `Delete`
- **THEN** 该选中控件被删除，与在主窗口按下 `Delete` 的效果相同
