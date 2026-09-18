## MODIFIED Requirements

### Requirement: Page xml data variables
页面 XML 的 `page` 根 SHALL 可包含至多一个页面级 `<data>` 子元素，用于声明页面变量。`<data>` MUST 不是可渲染控件。变量 MUST 按声明顺序排列，并使用下列子元素：`num`（Number）、`str`（String）、`bool`（Boolean）、`arr`（Array）、`obj`（Object）、`widget`（控件）。每个变量 MUST 用属性 `n` 保存变量名，MUST 用可选属性 `desc` 保存描述。`num` / `str` / `arr` / `obj` / `bool` / `widget` 的文本内容分别为数字、字符串、数组字面量、对象字面量、`0` 或 `1`、以及当前页面某个控件的 `id`（未选择时为空）。`bool` MUST 允许带可选属性 `watch`；本期系统 MUST 在解析与序列化时保留该属性，MUST NOT 提供监听器编辑或运行。描述为空或未设置时 MUST 不写出 `desc`。无变量时 MUST 不写出 `<data>`。无 `<data>` 的既有页面 XML MUST 仍合法。无 `desc` 的既有变量 MUST 仍合法，解析后描述为空。无 `widget` 的既有 `<data>` MUST 仍合法。页面级以外出现的 `<data>`、以及 `<data>` 内未识别的子元素 MUST 被忽略，MUST NOT 使整页 XML 非法，也 MUST NOT 被当作控件。解析与序列化 MUST 对文本内容与 `desc` 做 XML 转义往返，变量值与描述本身不变。

#### Scenario: Data variables round-trip
- **WHEN** 系统解析一份 `page` 根下含 `<data>`，其中依次为 `<num n="count">1</num>`、`<str n="title">hello</str>`、`<arr n="list">["1","2"]</arr>`、`<obj n="user">{a:1,b:2}</obj>`、`<bool n="on">1</bool>`、`<widget n="target">n1</widget>` 的合法 XML，再序列化
- **THEN** 再次解析得到相同顺序、名称、类型与初始值

#### Scenario: Empty widget value round-trips
- **WHEN** 系统解析 `<widget n="target"></widget>` 并再序列化
- **THEN** 再次解析得到该控件变量，初始值为空

#### Scenario: Bool watch is preserved without UI
- **WHEN** 系统解析 `<bool n="on" watch="listener-1">0</bool>` 并再序列化
- **THEN** 结果仍包含同一 `watch` 值，工作台不展示监听器编辑入口

#### Scenario: Omitted data is valid
- **WHEN** 系统解析一份没有 `<data>` 的合法页面 XML
- **THEN** 解析成功，页面变量列表为空，且不把缺省数据当成错误

#### Scenario: Empty data is omitted
- **WHEN** 当前页面没有任何变量并序列化
- **THEN** 输出的 XML 不包含 `<data>` 元素

#### Scenario: Data is not a widget
- **WHEN** 页面 XML 在 `<data>` 之外还包含文本控件
- **THEN** 预览只渲染该文本控件，不把变量渲染成页面上的控件

#### Scenario: Nested or unknown data nodes are ignored
- **WHEN** 页面 XML 在某个 `flex` 内包含 `<data>`，或页面级 `<data>` 内包含未识别子元素
- **THEN** 系统仍成功解析已识别的页面级变量与控件，忽略这些非法位置或未知节点

#### Scenario: Description attribute round-trips
- **WHEN** 系统解析 `<num n="count" desc="计数">1</num>` 并再序列化
- **THEN** 再次解析得到同一变量名、初始值与描述「计数」

#### Scenario: Omitted description is empty
- **WHEN** 系统解析 `<str n="title">hello</str>`（没有 `desc`）
- **THEN** 该变量描述为空，且序列化结果不包含 `desc`

#### Scenario: Empty description is omitted
- **WHEN** 当前某变量描述为空并序列化
- **THEN** 对应变量元素不写出 `desc` 属性

### Requirement: Page data list editor
工作台数据 tab SHALL 以列表展示当前页面变量，列 MUST 包括变量名、类型、描述与初始值，描述列 MUST 位于类型与初始值之间。类型 MUST 为 Number、String、Boolean、Array、Object、控件，并分别对应 XML 的 `num` / `str` / `bool` / `arr` / `obj` / `widget`。编辑草稿时，管理员 MUST 能新增、删除变量，MUST 能拖动列表行以改变 XML 中的声明顺序，MUST 能在列表内直接编辑描述。变量名 MUST 非空、在同一页面内唯一，且 MUST 是合法的 JavaScript `IdentifierName`。描述 MUST 为可选纯文本，可为空，MUST NOT 要求唯一。Number 初始值 MUST 在列表内按数字编辑；String 按文本编辑；Boolean MUST 只能取 `0` 或 `1`。控件类型的初始值 MUST 为所选控件 `id` 或空，MUST NOT 在列表内当普通文本编辑。更改类型时，该变量的初始值 MUST 换成该类型的缺省值（Number 为 `0`，String 为空，Boolean 为 `0`，Array 为 `[]`，Object 为 `{}`，控件为空），描述 MUST 保持不变。改名 MUST NOT 清空描述。新增变量 MUST 使用未占用的缺省名与缺省类型/值，且描述 MUST 为空。预览模式或非草稿版本时，列表 MUST 只读：不可新增、删除、改名、改类型、改描述、改值或拖动排序。修改变量后 MUST 写入当前草稿 XML，且不必先保存版本。

#### Scenario: List shows stored variables
- **WHEN** 已登录管理员打开一份含三个页面变量的草稿并进入数据 tab
- **THEN** 列表按 XML 声明顺序展示这三个变量的名称、类型、描述与初始值

#### Scenario: Add variable writes xml
- **WHEN** 已登录管理员在编辑草稿的数据 tab 新增一个 Number 变量
- **THEN** 当前 XML 的 `<data>` 中出现对应 `num`，且列表能看到该行

#### Scenario: Drag reorder persists
- **WHEN** 已登录管理员在编辑草稿时把列表中的第二行拖到第一行
- **THEN** 序列化后 `<data>` 子元素顺序与拖动后的列表一致

#### Scenario: Duplicate name is rejected
- **WHEN** 已登录管理员把某变量名改成页面中已存在的另一个变量名
- **THEN** 系统拒绝这次改名，原名称与 XML 保持不变

#### Scenario: Type change resets value
- **WHEN** 已登录管理员把某个 Number 变量的类型改为 Array
- **THEN** 该变量初始值变为 `[]`，XML 使用 `arr` 而不是 `num`

#### Scenario: Type change to widget clears value
- **WHEN** 已登录管理员把某个 Number 变量的类型改为控件
- **THEN** 该变量初始值为空，XML 使用 `widget` 而不是 `num`

#### Scenario: Data list is read-only when locked
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿，并打开数据 tab
- **THEN** 仍能看到变量列表，但不能新增、删除、编辑或拖动排序

#### Scenario: Description is editable inline
- **WHEN** 已登录管理员在编辑草稿时把某变量描述改为「用户信息」
- **THEN** 当前 XML 对应变量带有 `desc="用户信息"`，列表该行显示同一描述

#### Scenario: Type change keeps description
- **WHEN** 已登录管理员把带描述「计数」的 Number 变量改成 Array
- **THEN** 初始值变为 `[]`，描述仍为「计数」

#### Scenario: New variable has empty description
- **WHEN** 已登录管理员在编辑草稿的数据 tab 新增一个变量
- **THEN** 该行描述为空，序列化结果不包含 `desc`

### Requirement: Array and object value code editor
编辑 Array 或 Object 变量的初始值时，系统 SHALL 打开代码编辑器，而不是普通单行输入。编辑器 MUST 用三部分展示：第一行只读 `function 变量名(){`，中间可编辑的 `return` 表达式，最后一行只读 `}`。变量名变化后，只读第一行 MUST 使用新名称。Array 的可编辑部分 MUST 是数组字面量（例如 `["1","2"]`）；Object 的可编辑部分 MUST 是对象字面量（例如 `{a:1,b:2}`）。用户 MUST NOT 能编辑只读的函数外壳两行。表达式非法时，系统 MUST NOT 写入 XML，MUST 保留原值并给出失败反馈。Number、String、Boolean、控件 MUST NOT 使用该代码编辑器。

#### Scenario: Array editor uses locked wrapper
- **WHEN** 已登录管理员在编辑草稿时打开名为 `list` 的 Array 变量的初始值编辑器
- **THEN** 编辑器第一行是不可编辑的 `function list(){`，最后一行是不可编辑的 `}`，中间可以改 `return` 后的数组字面量

#### Scenario: Object literal is stored
- **WHEN** 已登录管理员把 Object 变量 `user` 的可编辑部分改为 `{a:1,b:2}` 并确认
- **THEN** XML 中对应节点为 `<obj n="user">{a:1,b:2}</obj>`

#### Scenario: Invalid expression is rejected
- **WHEN** 已登录管理员在 Array 代码编辑器中输入无法作为数组字面量的内容并确认
- **THEN** 系统不更新该变量，XML 仍为确认前的值，并向管理员提示失败

#### Scenario: Number uses inline editor
- **WHEN** 已登录管理员在数据列表中编辑 Number 或 String 或 Boolean 的初始值
- **THEN** 不打开带 `function 变量名()` 外壳的代码编辑器

#### Scenario: Widget does not use code editor
- **WHEN** 已登录管理员在数据列表中编辑控件类型变量的初始值
- **THEN** 不打开带 `function 变量名()` 外壳的代码编辑器

## ADDED Requirements

### Requirement: Widget data value picker
编辑草稿时，控件类型变量的初始值列 SHALL 展示所选控件在当前页面控件树中的标签，并提供打开选择弹窗的入口。未选择控件时 MUST 展示空态，MUST NOT 把空当成错误。弹窗 MUST 展示当前页面控件树并允许单选一个控件；确认后 MUST 把该控件 `id` 写入变量初始值。管理员 MUST 能清空已选控件，清空后初始值为空。若已存 `id` 在当前页面找不到对应控件，列表 MUST 以缺失态展示该值，MUST NOT 自动清空所存 `id`。预览模式或非草稿版本时 MUST NOT 改选或清空。选择或清空 MUST 写入当前草稿 XML，且不必先保存版本。

#### Scenario: Picker assigns widget id
- **WHEN** 已登录管理员在编辑草稿的数据 tab 打开某控件类型变量的选择弹窗，选中页面上的按钮控件并确认
- **THEN** 该变量初始值为该按钮的 `id`，XML 中对应节点为带同一 `id` 文本的 `widget`

#### Scenario: Picker can clear selection
- **WHEN** 已登录管理员在编辑草稿时清空某控件类型变量已选的控件
- **THEN** 该变量初始值为空，XML 中对应 `widget` 文本为空

#### Scenario: Missing widget stays stored
- **WHEN** 某控件类型变量存着已删除控件的 `id`，管理员打开数据 tab
- **THEN** 该行以缺失态展示，XML 仍保留原来的 `id`

#### Scenario: Picker is read-only when locked
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿，并查看控件类型变量
- **THEN** 仍能看到已选控件摘要，但不能改选或清空

### Requirement: Drag widget onto data variable
编辑草稿且停留在数据 tab 时，管理员 SHALL 能把左侧控件树中的一个控件拖到数据列表里类型为控件的变量上，系统 MUST 把该控件 `id` 写入该变量初始值。拖到 Number / String / Boolean / Array / Object 行上时 MUST NOT 改这些变量的值，也 MUST NOT 把它们改成控件类型。该拖入 MUST NOT 改变控件树结构或控件在页面中的位置。预览模式、非草稿版本或当前不在数据 tab 时，MUST NOT 用控件树拖入改写变量。拖入 MUST 写入当前草稿 XML，且不必先保存版本。

#### Scenario: Drop onto widget variable assigns id
- **WHEN** 已登录管理员在编辑草稿的数据 tab 把控件树中的文本控件拖到某条控件类型变量上
- **THEN** 该变量初始值为该文本控件的 `id`，控件树结构不变

#### Scenario: Drop onto other types is ignored
- **WHEN** 已登录管理员把控件树中的按钮拖到某条 Number 变量上
- **THEN** 该 Number 变量的类型与初始值不变

#### Scenario: Drop is ignored when locked
- **WHEN** 已登录管理员处于预览模式，并把控件树节点拖到控件类型变量上
- **THEN** 该变量初始值不变
