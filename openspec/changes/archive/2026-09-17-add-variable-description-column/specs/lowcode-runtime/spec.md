## MODIFIED Requirements

### Requirement: Page xml data variables
页面 XML 的 `page` 根 SHALL 可包含至多一个页面级 `<data>` 子元素，用于声明页面变量。`<data>` MUST 不是可渲染控件。变量 MUST 按声明顺序排列，并使用下列子元素：`num`（Number）、`str`（String）、`bool`（Boolean）、`arr`（Array）、`obj`（Object）。每个变量 MUST 用属性 `n` 保存变量名，MUST 用可选属性 `desc` 保存描述。`num` / `str` / `arr` / `obj` / `bool` 的文本内容分别为数字、字符串、数组字面量、对象字面量、以及 `0` 或 `1`。`bool` MUST 允许带可选属性 `watch`；本期系统 MUST 在解析与序列化时保留该属性，MUST NOT 提供监听器编辑或运行。描述为空或未设置时 MUST 不写出 `desc`。无变量时 MUST 不写出 `<data>`。无 `<data>` 的既有页面 XML MUST 仍合法。无 `desc` 的既有变量 MUST 仍合法，解析后描述为空。页面级以外出现的 `<data>`、以及 `<data>` 内未识别的子元素 MUST 被忽略，MUST NOT 使整页 XML 非法，也 MUST NOT 被当作控件。解析与序列化 MUST 对文本内容与 `desc` 做 XML 转义往返，变量值与描述本身不变。

#### Scenario: Data variables round-trip
- **WHEN** 系统解析一份 `page` 根下含 `<data>`，其中依次为 `<num n="count">1</num>`、`<str n="title">hello</str>`、`<arr n="list">["1","2"]</arr>`、`<obj n="user">{a:1,b:2}</obj>`、`<bool n="on">1</bool>` 的合法 XML，再序列化
- **THEN** 再次解析得到相同顺序、名称、类型与初始值

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
工作台数据 tab SHALL 以列表展示当前页面变量，列 MUST 包括变量名、类型、描述与初始值，描述列 MUST 位于类型与初始值之间。类型 MUST 为 Number、String、Boolean、Array、Object，并分别对应 XML 的 `num` / `str` / `bool` / `arr` / `obj`。编辑草稿时，管理员 MUST 能新增、删除变量，MUST 能拖动列表行以改变 XML 中的声明顺序，MUST 能在列表内直接编辑描述。变量名 MUST 非空、在同一页面内唯一，且 MUST 是合法的 JavaScript `IdentifierName`。描述 MUST 为可选纯文本，可为空，MUST NOT 要求唯一。Number 初始值 MUST 在列表内按数字编辑；String 按文本编辑；Boolean MUST 只能取 `0` 或 `1`。更改类型时，该变量的初始值 MUST 换成该类型的缺省值（Number 为 `0`，String 为空，Boolean 为 `0`，Array 为 `[]`，Object 为 `{}`），描述 MUST 保持不变。改名 MUST NOT 清空描述。新增变量 MUST 使用未占用的缺省名与缺省类型/值，且描述 MUST 为空。预览模式或非草稿版本时，列表 MUST 只读：不可新增、删除、改名、改类型、改描述、改值或拖动排序。修改变量后 MUST 写入当前草稿 XML，且不必先保存版本。

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

### Requirement: Undo and redo widget tree edits
工作台 SHALL 为当前草稿版本的控件树变更、页面背景/内边距变更与页面变量变更提供会话内撤回与重做。可撤回的变更 MUST 包括添加、删除、粘贴，检查器中的控件属性/文案编辑与页面背景/内边距编辑，以及数据 tab 中变量的新增、删除、改名、改类型、改描述、改初始值与拖动排序。对同一控件同一字段、同一页面样式字段或同一变量同一字段的连续编辑，在焦点离开该字段或开始另一类操作之前 MUST 记为一步撤回。执行新的可记录变更后，重做栈 MUST 被清空。撤回与重做后，控件树、页面样式、页面变量、选中控件与子窗口 MUST 回到对应步骤的状态。预览模式、非草稿版本、无可撤回步骤或无可重做步骤时，对应入口 MUST 不可用且 MUST NOT 改变控件树、页面样式或页面变量。切换页面或切换版本 MUST 清空撤回与重做历史。页面/版本的创建删除、画布平移缩放、切换布局/数据/事件 tab 与单纯改变选中 MUST NOT 进入该历史。

#### Scenario: Undo delete restores the widget
- **WHEN** 已登录管理员在编辑草稿时删除一个控件，再执行撤回
- **THEN** 该控件及其子树回到删除前的位置，子窗口恢复为删除前的渲染

#### Scenario: Redo reapplies the undone change
- **WHEN** 已登录管理员撤回一次删除后立即执行重做
- **THEN** 该控件再次被删除，子窗口与撤回前的删除结果一致

#### Scenario: New edit clears redo
- **WHEN** 已登录管理员撤回一次变更后再添加一个新控件
- **THEN** 重做入口不可用，执行重做快捷键也不恢复被撤回的那一步

#### Scenario: Consecutive inspector edits undo as one step
- **WHEN** 已登录管理员在检查器中连续修改同一文本控件的文案，然后把焦点移出该输入框并执行撤回
- **THEN** 该文案一次回到开始这次连续编辑之前的值，而不是只回退最后一个字符

#### Scenario: Undo restores page style
- **WHEN** 已登录管理员在编辑草稿时修改页面内边距或背景，再执行撤回
- **THEN** 页面样式回到修改前的值，子窗口恢复为修改前的渲染

#### Scenario: Undo restores page data
- **WHEN** 已登录管理员在编辑草稿的数据 tab 删除一个变量，再执行撤回
- **THEN** 该变量回到删除前的名称、类型、描述、初始值与顺序

#### Scenario: Switching version clears history
- **WHEN** 已登录管理员在某草稿上删除一个控件后，切换到同一页面的另一个版本
- **THEN** 撤回与重做入口都不可用，再切回原草稿也不会用历史自动还原刚才的删除

#### Scenario: Undo restores variable description
- **WHEN** 已登录管理员在编辑草稿时把某变量描述从「计数」改成「总额」，把焦点移出该输入框后再执行撤回
- **THEN** 该变量描述回到「计数」，XML 中的 `desc` 与撤回前一致
