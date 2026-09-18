## ADDED Requirements

### Requirement: Widget named states in page xml
可选中控件 SHALL 具有隐式默认状态，其属性即该控件元素自身的已识别属性（`id`、文案与现有样式 / 弹性 / 滑动器属性）。默认状态 MUST NOT 写成子元素。控件 MAY 声明一个或多个命名自定义状态：每个自定义状态 MUST 是该控件的直接子元素 `<_>`，MUST 带非空属性 `name`，MUST NOT 被当作可渲染控件。`<_>` 上 MAY 携带与宿主控件相同的外观与布局属性（样式、弹性容器、弹性项目、滑动器属性），MAY 携带非负整数属性 `transition`（毫秒，进入该状态时的 CSS 过渡时长）；MUST NOT 携带 `id`、`value`、`text` 或子控件。默认状态的过渡时长 MUST 写在宿主元素自身的 `transition` 属性上（例如 `<flex transition="1000">`），MUST NOT 写成 `<_>`。`transition` 为 0 或省略时 MUST NOT 写出，且 MUST NOT 产生过渡。`name` MUST 在同一宿主控件的全部 `<_>` 中唯一（含顶层与所有 `<__>` 内的子状态）；无法识别或重名的 `<_>` MUST 被忽略且 MUST NOT 使整页 XML 非法。无 `<_>` 的既有页面 XML MUST 仍合法。页面根下的 `<_>` MUST 被忽略。

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

### Requirement: Custom state properties inherit default
命名自定义状态的属性 SHALL 叠加在默认状态之上。自定义状态未设置的属性 MUST 使用默认状态的对应值；已设置的属性 MUST 覆盖默认值。序列化自定义状态时，与默认状态相同的属性 MUST NOT 写入 `<_>`。控件身份与结构（`id`、类型、子控件树、文本 `value` / 按钮 `text`）MUST 在各状态间共享，MUST NOT 按状态分叉。

#### Scenario: Unset custom property uses default
- **WHEN** 某文本默认 `color` 为红、`font-size` 为 12，其 `active` 状态只设置 `color` 为蓝
- **THEN** 解析后的 `active` 状态颜色为蓝、字号仍为 12

#### Scenario: Matching custom property is omitted
- **WHEN** 已登录管理员在某控件的 `active` 状态下把 `color` 改回与默认状态相同的值并应用到当前 XML
- **THEN** 该控件的 `<_ name="active">` 不再写出 `color`

#### Scenario: Content is not per-state
- **WHEN** 已登录管理员在 `active` 状态下修改某文本的展示文案
- **THEN** 默认状态与所有自定义状态都使用这份文案，XML 不把文案写进 `<_>`

### Requirement: Descendant state overrides
若某控件声明了自定义状态，其所有后代在工作台中 SHALL 具有同一组状态名称（含 `initial`）。后代若在某一祖先命名状态下有自己的属性差异，MUST 用该后代的直接子元素 `<__>` 表示，MUST 带与祖先状态相同的 `name`，MUST 使用两个下划线（任意深度 MUST NOT 使用三个或更多下划线）。`<__>` MUST NOT 被当作可渲染控件。后代没有差异且没有子状态时 MUST NOT 写出 `<__>`。`<__>` 未设置的属性 MUST 使用该后代自己的默认状态；已设置的 MUST 覆盖。`name` 对不上任何祖先命名状态的 `<__>` MUST 被忽略。祖先的 `<_>` 与后代的 `<__>` MUST 一起往返。

后代 MAY 在某个继承态下声明子状态：每个子状态 MUST 是对应 `<__>` 的直接子元素 `<_>`，MUST 带非空 `name`，MAY 带 `transition`。子状态相对该 `<__>`（继承态下的 `initial`）只写差异。仅有子状态、没有属性差异的 `<__>` MUST 仍写出，以便容纳内部的 `<_>`。该组的选用默认 MUST 写在 `<__>` 的 `state` 属性上；省略则该组默认是 `initial`。

#### Scenario: Child override round-trips with double underscore
- **WHEN** 页面 XML 为 `<flex id="box" color="red" width="100px" height="100px"><_ name="active" /><text id="t1" value="hello" font-size="20"><__ name="active" underline="true" /></text><text id="t2" value="hello" font-size="20" /></flex>`
- **THEN** 解析结果中弹性盒拥有 `active` 状态，第一个文本在 `active` 下有下划线差异，第二个文本没有 `<__>`；再次序列化仍如此

#### Scenario: Nested sub-state lives inside the inherited override
- **WHEN** 页面 XML 为 `<flex><_ name="state"/><text><__ name="state"><_ name="subState"/></__></text></flex>`
- **THEN** 解析结果中该文本在继承的 `state` 下拥有子状态 `subState`；再次序列化仍把 `<_ name="subState"/>` 写在 `<__ name="state">` 内部

#### Scenario: Child without override has no xml node
- **WHEN** 已登录管理员给某弹性盒添加 `active` 状态，但不改其某个子文本的任何属性
- **THEN** 该子文本的 XML 不含 `<__>`

#### Scenario: Nested descendant still uses two underscores
- **WHEN** 某弹性盒拥有 `active` 状态，其孙控件对 `active` 有颜色差异
- **THEN** 该孙控件用 `<__ name="active">` 写出差异，而不是三个下划线的标签

#### Scenario: Unknown descendant state name is ignored
- **WHEN** 某文本的父级没有名为 `hover` 的状态，但该文本含 `<__ name="hover" color="green" />`
- **THEN** 解析忽略该 `<__>`，文本仍成功解析

### Requirement: Applied state for preview and runtime
声明了自定义状态的控件 SHALL 可设置选用状态，用于预览模式与 H5 运行。选用状态 MUST 写在该控件元素的 `state` 属性上，值为该控件拥有的某个 `<_>` 的 `name`（顶层，或当前继承 `<__>` 内的子状态）。未设置、空值、或指向不存在的名称时 MUST 使用默认状态，且默认选用 MUST NOT 写出 `state`。预览模式与 H5 MUST 按选用状态合并该控件及其后代的属性后渲染。后代 MUST 同时处于祖先链上所有当前命名状态：祖先选用的命名状态对该后代用 `<__>` 叠加，该后代若自己也有选用的命名状态则再叠加自己的 `<_>`（顶层或该 `<__>` 内的子状态）。同一属性的优先级 MUST 为：该控件当前自己的状态 > 更近祖先的当前状态 > 更远祖先的当前状态 > 默认。无自定义状态的控件 MUST NOT 写出 `state`。

若控件拥有名为 `hover` 的状态（顶层 `<_ name="hover">`，或当前生效的继承 `<__>` 内的 `<_ name="hover">`），则在预览模式与 H5 中，鼠标悬停该控件时 MUST 临时将该拥有者的当前状态切到 `hover`（覆盖其选用状态，并照常叠加后代对应的 `<__ name="hover">`）；鼠标离开后 MUST 回落到选用状态。编辑模式 MUST NOT 因悬停自动切换。`hover` 仍是普通命名状态：可在工作台查看、编辑与选用。

#### Scenario: Omitted state uses default at runtime
- **WHEN** 某文本声明了 `active` 状态但没有 `state` 属性，H5 渲染该页
- **THEN** 该文本按默认状态的属性绘制

#### Scenario: Applied custom state renders at runtime
- **WHEN** 页面 XML 为 `<text id="t1" value="内容" color="red" background="white" font-size="12" state="active"><_ name="active" color="blue" background="red" /></text>`，工作台处于预览模式或 H5 打开该页
- **THEN** 该文本按蓝色字、红色背景绘制，字号仍为 12

#### Scenario: Hover state activates on pointer enter in preview
- **WHEN** 某弹性盒含 `<_ name="hover" background="blue" />`，工作台处于预览模式或 H5，鼠标移入该弹性盒
- **THEN** 该弹性盒按 `hover` 状态绘制；鼠标移出后回落其选用状态（未选用则默认）

#### Scenario: Hover does not auto-activate while editing
- **WHEN** 同上弹性盒，工作台处于编辑模式，鼠标移入该弹性盒且当前查看不是 `hover`
- **THEN** 画布不因悬停切换到 `hover`

#### Scenario: Editor viewing switch does not animate
- **WHEN** 某控件带过渡时长，管理员在编辑模式的状态树中点到另一状态
- **THEN** 画布立刻按该查看状态绘制，MUST NOT 按过渡时长缓动

#### Scenario: Editing layout does not animate
- **WHEN** 某控件带过渡时长，管理员在编辑模式拖动定位、尺寸、边距或旋转
- **THEN** 这些属性立刻生效，MUST NOT 按过渡时长缓动

#### Scenario: Unknown applied state falls back to default
- **WHEN** 某控件写有 `state="missing"`，但没有名为 `missing` 的 `<_>`
- **THEN** 预览与 H5 按默认状态绘制，序列化 MUST NOT 再写出该非法 `state`

#### Scenario: Ancestor applied state reaches descendants
- **WHEN** 某弹性盒 `state="active"`，其子文本带 `<__ name="active" underline="true" />`，H5 渲染该页
- **THEN** 弹性盒按自身 `active` 属性绘制，该子文本带下划线，另一没有 `<__>` 的子文本仍用自己的默认属性

#### Scenario: Nested owner stacks own state over ancestor state
- **WHEN** 父弹性盒选用 `state2` 且其 `<_ name="state2">` 把颜色设为红，子文本选用 `state4` 且 `<_ name="state4">` 把颜色设为蓝
- **THEN** 该子文本按蓝色绘制

#### Scenario: Nested owner inherits unset property from ancestor state
- **WHEN** 父弹性盒选用 `state2` 且其 `<_ name="state2">` 把颜色设为红，子文本选用 `state4` 但 `<_ name="state4">` 未设颜色
- **THEN** 该子文本按红色绘制（来自父级当前状态；子级未覆盖该属性）

### Requirement: Workbench state list and edit viewing
工作台处于编辑模式且选中某一控件时，画布网格左侧 SHALL 显示可折叠的状态树。每一级 MUST 以 `initial` 开头（控件隐式默认状态的显示名），其后为本级命名状态。根级 MUST 先列出选中控件自己的 `initial` 与顶层 `<_>`（叶子），再列出祖先拥有的命名状态。只有继承态 MUST 作为非叶子节点：其下 MUST 再列出该继承上下文中的 `initial`（对应 `<__>` 自身）以及写在该 `<__>` 内的子状态 `<_>`。同一控件的命名 `<_>` MUST 在整棵状态树中唯一（`initial` 除外，每组可各有一个）；已占用的名称 MUST NOT 再作为顶层或某个继承态下的子状态出现。拥有态 MUST 使用白色字体；继承态 MUST 使用灰白色字体。树 MUST 可折叠、可滚动；滚动条 MUST 不占布局宽度，仅在鼠标悬停时显示。

当前运行选用的叶子节点 MUST 在名称后显示绿色对勾；非叶子节点 MUST NOT 显示对勾。每一组同级叶子 MUST 可以各自选用一个默认：根级叶子的默认写在宿主元素的 `state` 上；某个继承态下叶子的默认写在对应 `<__>` 的 `state` 上（值为该 `<__>` 内某个 `<_>` 的 `name`；选用该组 `initial` 则 MUST NOT 在 `<__>` 上写出 `state`）。各组默认互相独立，可同时打勾。左键点击 MUST 只切换编辑态查看，MUST NOT 改写 `state`。只有叶子节点的右键菜单 MUST 提供「编辑」「删除」（`initial` 不可删除、不可重命名；根级 `initial` 可编辑过渡时长）。继承态（非叶子）的右键菜单 MUST 提供「添加状态」，行尾 MUST 另有添加图标按钮，二者行为相同。根级 `initial` 的菜单 MUST 也可添加顶层状态。列表底部 MUST 另有「添加状态」按钮，行为与根级 `initial` 上添加顶层状态相同。

添加状态 MUST 打开弹窗，填写名称与「过渡时长」，确认后才创建。名称 MUST 在该选中控件全部 `<_>` 中唯一（含顶层与所有继承组内的子状态；各组 `initial` 可重复）。已占用的名称 MUST NOT 再出现在树中其它位置。创建与重命名 MUST 拒绝重名。从根级 `initial` 添加 MUST 在选中控件上写顶层 `<_>`。从继承态添加 MUST 在该控件对应 `<__ name="继承名">` 内写 `<_ name="子状态">`（没有则创建 `<__>`），MUST NOT 改写祖先的 `<_>`。子状态加入后 MUST 成为查看状态；除名为 `hover` 外 MUST 被该控件选用。名为 `hover` 的状态加入后 MUST 成为查看状态，MUST NOT 自动写成选用（预览与 H5 靠悬停命中）。进入某命名状态时，该状态的 `transition` MUST 作为该作用域内控件的 CSS 过渡时长（含位移、尺寸、边距、旋转与外观）。编辑模式下切换查看状态、以及改定位、尺寸、边距或旋转 MUST NOT 触发该过渡；预览模式与 H5 进入命名状态（含悬停命中 `hover`）时 MUST 使用该时长。`<__>` MUST NOT 写出 `transition`。

切到另一控件时，若新控件的可见状态中仍有当前查看的命名状态，MUST 保持查看该状态。若新控件自己已选用了另一个自定义状态，MUST 改为查看该选用状态，同时祖先的当前状态 MUST 仍叠加在显示上。无自身选用时，没有该命名状态的控件 MUST 回落到最近祖先的当前命名状态（若有）。

叶子拥有态的右键菜单 MUST 提供「设为默认」。点「设为默认」MUST 把该叶子写成其所在一组的默认：根级则写宿主 `state="name"`（`initial` 则清除）；继承态下则写 `<__ name="继承名" state="子状态名">`（该组 `initial` 则去掉 `<__>` 的 `state`）。继承态节点本身 MUST NOT 提供「设为默认」。

重命名 MUST 同步该控件 `state` 属性（若指向旧名）以及子孙对应 `<__>` 的 `name`。删除顶层 `<_>` MUST 去掉该控件对应 `<_>`、子孙对应 `<__>`；删除子状态 MUST 去掉 `<__>` 内对应 `<_>`。若当前 `state` 指向它则回落 `initial`。

列表当前查看的状态 SHALL 驱动编辑态。编辑模式下，画布、气泡与检查器 MUST 展示并写入该查看状态下的解析属性：改根级 `initial` MUST 写控件自身属性；查看该控件自己的顶层命名状态 MUST 写 `<_>`；查看祖先命名状态下的 `initial` MUST 写该控件的 `<__>`（没有则创建，差异被压空且无子状态则删除）；查看 `<__>` 内子状态 MUST 写该 `<_>`。预览模式与只读版本 MUST NOT 用查看状态覆盖选用状态。添加、改属性、选用、重命名与删除 MUST 立即反映到当前 XML 与子窗口，且不必先保存版本。无选中控件时 MUST NOT 显示状态列表。

#### Scenario: List always starts with initial
- **WHEN** 已登录管理员在编辑草稿时选中一个还没有自定义状态的文本
- **THEN** 画布左侧状态树显示 `initial`（白色），右键可添加状态

#### Scenario: Creating on the selected widget copies from a named source
- **WHEN** 已登录管理员选中某弹性盒，在其 `initial` 上添加名为 `hover` 的状态
- **THEN** 新状态出现为该弹性盒根级叶子，弹性盒带有 `<_ name="hover">`，且该弹性盒选用 `hover`

#### Scenario: Creating hover does not set it as applied
- **WHEN** 已登录管理员选中某弹性盒，在其 `initial` 上添加名为 `hover` 的状态
- **THEN** 弹性盒带有 `<_ name="hover">`，工作台查看 `hover`，但 MUST NOT 写出 `state="hover"`（悬停才命中）

#### Scenario: Creating a non-hover state applies it
- **WHEN** 已登录管理员选中某弹性盒，在其 `initial` 上添加名为 `active` 的状态
- **THEN** 新状态出现为该弹性盒根级叶子，弹性盒带有 `<_ name="active">`，且该弹性盒选用 `active`

#### Scenario: Creating a sub-state under an inherited state
- **WHEN** 某弹性盒已有 `active` 状态，管理员选中其内部一个文本，在继承的 `active` 上添加名为 `mine` 的状态
- **THEN** 该文本 XML 含 `<__ name="active"><_ name="mine"/></__>`，弹性盒的 `<_>` 不增加新状态

#### Scenario: Duplicate named states are not listed or created
- **WHEN** 选中文本已有顶层 `<_ name="a">`，管理员在继承的 `active` 下再添加名为 `a` 的子状态
- **THEN** 弹窗提示名称已存在且不创建；状态树只出现一个 `a`

#### Scenario: Child selection shows a state tree
- **WHEN** 某弹性盒已有 `active` 状态，管理员选中其内部一个尚无自己状态的文本
- **THEN** 状态树为 `initial`、`active`（灰白、可折叠），`active` 下为 `initial`；只有叶子可编辑删除，`active` 菜单可添加状态

#### Scenario: Each non-leaf group has its own default
- **WHEN** 选中控件根级选用 `B`，继承态 `C` 下选用 `A`，继承态 `D` 下选用 `B`
- **THEN** 状态树在根级 `B`、`C` 下的 `A`、`D` 下的 `B` 后同时显示绿色对勾；`C` 与 `D` 自身不打勾；XML 宿主为 `state="B"`，并含 `<__ name="C">` 无 `state`、`<__ name="D" state="B">`

#### Scenario: Selecting a child keeps the parent state
- **WHEN** 父弹性盒 A 正在查看 `state2`，管理员选中没有自己状态的子控件 A1
- **THEN** A1 的列表仍查看 `state2`，画布上 A 与 A1 都按 `state2` 显示

#### Scenario: Selecting a nested owner keeps its own applied state
- **WHEN** 父弹性盒 A 正在查看 `state2`，子控件 A2 已选用 `state4`，管理员选中 A2
- **THEN** A2 查看并打勾 `state4`，同时 `state2` 仍作为继承态打勾并叠加显示；A 仍处于 `state2`

#### Scenario: Selecting a nested owner without applied follows parent
- **WHEN** 父弹性盒 A 正在查看 `state2`，子控件 A2 拥有 `state4` 但未选用，管理员选中 A2
- **THEN** A2 仍查看继承的 `state2`

#### Scenario: Clicking a state only views it
- **WHEN** 已登录管理员选中一个拥有 `active` 的文本，并左键点击列表中的 `active`
- **THEN** 画布与检查器立刻显示 `active` 的解析属性，该文本的 `state` 不因此被改写

#### Scenario: Set as default applies an owned state
- **WHEN** 已登录管理员对拥有的 `active` 右键选择「设为默认」
- **THEN** 该文本元素带有 `state="active"`，列表中 `active` 后显示绿色对勾

#### Scenario: Clicking an inherited state does not apply
- **WHEN** 已登录管理员选中子文本并点击继承的 `active`
- **THEN** 画布与检查器按祖先 `active` 显示该子文本（含其 `<__>`），该子文本不因此写出 `state`

#### Scenario: Editing a named state writes a delta
- **WHEN** 已登录管理员在查看 `active` 时把选中文本的颜色改为绿
- **THEN** 该文本的 `<__ name="active">`（若 `active` 为自身拥有则为 `<_>`）含 `color` 为绿，默认状态的颜色不变

#### Scenario: Preview uses applied state not viewing state
- **WHEN** 某控件选用状态为默认，管理员在编辑模式正查看继承的 `active`，然后切到预览模式
- **THEN** 画布按默认状态绘制，而不是按 `active`

#### Scenario: Renaming an owned state updates xml
- **WHEN** 已登录管理员把选中弹性盒拥有的 `active` 重命名为 `hover`，且一子文本带 `<__ name="active">`
- **THEN** 弹性盒写出 `<_ name="hover">`，子文本写出 `<__ name="hover">`；若原先 `state="active"` 则改为 `state="hover"`

#### Scenario: Deleting an owned state removes deltas
- **WHEN** 已登录管理员删除选中弹性盒拥有的 `active`
- **THEN** 该弹性盒不再有 `<_ name="active">`，子孙不再有 `<__ name="active">`，若原先选用 `active` 则回落默认且不写 `state`
