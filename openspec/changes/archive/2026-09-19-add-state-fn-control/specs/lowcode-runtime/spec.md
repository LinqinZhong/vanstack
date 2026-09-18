## MODIFIED Requirements

### Requirement: Descendant state overrides
若某控件声明了自定义状态，其所有后代在工作台中 SHALL 具有同一组状态名称（含 `initial`）。后代若在某一祖先命名状态下有自己的属性差异，MUST 用该后代的直接子元素 `<__>` 表示，MUST 带与祖先状态相同的 `name`，MUST 使用两个下划线（任意深度 MUST NOT 使用三个或更多下划线）。`<__>` MUST NOT 被当作可渲染控件。后代没有差异且没有子状态时 MUST NOT 写出 `<__>`。`<__>` 未设置的属性 MUST 使用该后代自己的默认状态；已设置的 MUST 覆盖。`name` 对不上任何祖先命名状态的 `<__>` MUST 被忽略。祖先的 `<_>` 与后代的 `<__>` MUST 一起往返。

后代 MAY 在某个继承态下声明子状态：每个子状态 MUST 是对应 `<__>` 的直接子元素 `<_>`，MUST 带非空 `name`，MAY 带 `transition`。子状态相对该 `<__>`（继承态下的 `initial`）只写差异。仅有子状态、没有属性差异的 `<__>` MUST 仍写出，以便容纳内部的 `<_>`。`<__>` MUST NOT 写出选用 `state`。运行时该组用哪一个子状态，MUST 由该控件自己的 `state()` 返回名决定。

#### Scenario: Child override round-trips with double underscore
- **WHEN** 页面 XML 为 `<flex id="box" color="red" width="100px" height="100px"><_ name="active" /><text id="t1" value="hello" font-size="20"><__ name="active" underline="true" /></text><text id="t2" value="hello" font-size="20" /></flex>`
- **THEN** 解析结果中弹性盒拥有 `active` 状态，第一个文本在 `active` 下有下划线差异，第二个文本没有 `<__>`；再次序列化仍如此

#### Scenario: Nested sub-state lives inside the inherited override
- **WHEN** 页面 XML 为 `<flex><_ name="state"/><text><__ name="state"><_ name="subState"/></__></text></flex>`
- **THEN** 解析结果中该文本在继承的 `state` 下拥有子状态 `subState`；再次序列化仍把 `<_ name="subState"/>` 写在 `<__ name="state">` 内部且 `<__>` 不带 `state`

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
声明了自定义状态的控件 SHALL 用宿主元素的 `state` 属性存放 `state()` 函数体，用于预览模式与 H5 运行。函数体 MUST 作为 `function state(): string { ... }` 的内部语句执行，MUST 能读取 `$data`（页面变量池）、`$item` 与 `$index`（当前循环作用域；无循环则为空）。返回值转成字符串后，若等于该控件拥有的某个 `<_>` 的 `name`（顶层或任意 `<__>` 内子状态，且不是 `hover`），MUST 使用该状态；若等于 `initial`、为空、抛错、或对不上任何拥有的名称，MUST 回落 `initial` 且不得使整页失败。未设置或空函数 MUST 视为 `initial`，MUST NOT 写出 `state`。旧 XML 中裸标识符且恰好是拥有的状态名（例如 `state="active"`）MUST 解析为 `return "active"`。

预览模式与 H5 MUST 先按循环展开实例，再对每个实例求值 `state()`。后代 MUST 同时处于祖先链上所有当前命名状态。同一属性的优先级 MUST 为：该控件当前自己的状态 > 更近祖先的当前状态 > 更远祖先的当前状态 > 默认。运行时该控件自己的状态优先级 MUST 为：其它具名状态 > `hover` > `initial`。

若控件拥有名为 `hover` 的状态（顶层 `<_ name="hover">`，或当前生效的继承 `<__>` 内的 `<_ name="hover">`），则在预览模式与 H5 中，鼠标悬停该控件实例且当前不是其它具名状态时 MUST 使用 `hover`；离开后 MUST 回落到 `state()` 的结果（未命中则 `initial`）。循环展开后的多个实例 MUST 各自命中：悬停其中一项 MUST NOT 让同模板其它项进入 `hover`。编辑模式 MUST NOT 因悬停自动切换。`hover` 仍是普通命名状态：可在工作台查看与编辑。

#### Scenario: Omitted state uses initial at runtime
- **WHEN** 某文本声明了 `active` 状态但没有 `state` 属性，H5 渲染该页
- **THEN** 该文本按 `initial` 的属性绘制

#### Scenario: State function selects a named state
- **WHEN** 页面 XML 为 `<text id="t1" value="内容" color="red" background="white" font-size="12" state="return 'active'"><_ name="active" color="blue" background="red" /></text>`，工作台处于预览模式或 H5 打开该页
- **THEN** 该文本按蓝色字、红色背景绘制，字号仍为 12

#### Scenario: Unmatched function falls back to initial
- **WHEN** 某控件 `state` 为 `return 'missing'`，没有名为 `missing` 的 `<_>`
- **THEN** 预览与 H5 按 `initial` 绘制

#### Scenario: Legacy bare name wraps to a return
- **WHEN** 页面 XML 含 `<flex id="box" state="active"><_ name="active" /></flex>`
- **THEN** 解析后该弹性盒的状态函数为 `return "active"`；再次序列化写出该函数体而不是裸名称

#### Scenario: Loop item can pick state from item data
- **WHEN** 某循环项配置 `state` 为 `return $item.ok ? 'active' : 'initial'`，预览中一项 `ok` 为真、另一项为假
- **THEN** 第一项按 `active` 绘制，第二项按 `initial` 绘制

#### Scenario: Named state wins over hover
- **WHEN** 某弹性盒 `state()` 返回 `active`，且拥有 `hover`，工作台处于预览模式，鼠标移入该弹性盒
- **THEN** 该弹性盒仍按 `active` 绘制，MUST NOT 切到 `hover`

#### Scenario: Hover activates only when initial
- **WHEN** 某弹性盒含 `<_ name="hover" background="blue" />` 且 `state()` 回落 `initial`，工作台处于预览模式或 H5，鼠标移入该弹性盒
- **THEN** 该弹性盒按 `hover` 状态绘制；鼠标移出后回落 `initial`

#### Scenario: Hover hits only the hovered loop instance
- **WHEN** 某控件被循环展开为三份且拥有 `hover`，工作台处于预览模式，鼠标移入其中第二份
- **THEN** 只有第二份按 `hover` 绘制，第一份与第三份保持各自的 `state()` 结果

#### Scenario: Hover does not auto-activate while editing
- **WHEN** 同上弹性盒，工作台处于编辑模式，鼠标移入该弹性盒且当前查看不是 `hover`
- **THEN** 画布不因悬停切换到 `hover`

#### Scenario: Editor viewing switch does not animate
- **WHEN** 某控件带过渡时长，管理员在编辑模式的状态树中点到另一状态
- **THEN** 画布立刻按该查看状态绘制，MUST NOT 按过渡时长缓动

#### Scenario: Editing layout does not animate
- **WHEN** 某控件带过渡时长，管理员在编辑模式拖动定位、尺寸、边距或旋转
- **THEN** 这些属性立刻生效，MUST NOT 按过渡时长缓动

#### Scenario: Ancestor applied state reaches descendants
- **WHEN** 某弹性盒 `state()` 返回 `active`，其子文本带 `<__ name="active" underline="true" />`，H5 渲染该页
- **THEN** 弹性盒按自身 `active` 属性绘制，该子文本带下划线，另一没有 `<__>` 的子文本仍用自己的默认属性

#### Scenario: Nested owner stacks own state over ancestor state
- **WHEN** 父弹性盒 `state()` 返回 `state2` 且其 `<_ name="state2">` 把颜色设为红，子文本 `state()` 返回 `state4` 且 `<_ name="state4">` 把颜色设为蓝
- **THEN** 该子文本按蓝色绘制

#### Scenario: Nested owner inherits unset property from ancestor state
- **WHEN** 父弹性盒 `state()` 返回 `state2` 且其 `<_ name="state2">` 把颜色设为红，子文本 `state()` 返回 `state4` 但 `<_ name="state4">` 未设颜色
- **THEN** 该子文本按红色绘制（来自父级当前状态；子级未覆盖该属性）

### Requirement: Workbench state list and edit viewing
工作台处于编辑模式且选中某一控件时，画布网格左侧 SHALL 显示可折叠的状态树。每一级 MUST 以 `initial` 开头（控件隐式默认状态的显示名），其后为本级命名状态。根级 MUST 先列出选中控件自己的 `initial` 与顶层 `<_>`（叶子），再列出祖先拥有的命名状态。只有继承态 MUST 作为非叶子节点：其下 MUST 再列出该继承上下文中的 `initial`（对应 `<__>` 自身）以及写在该 `<__>` 内的子状态 `<_>`。同一控件的命名 `<_>` MUST 在整棵状态树中唯一（`initial` 除外，每组可各有一个）；已占用的名称 MUST NOT 再作为顶层或某个继承态下的子状态出现。拥有态 MUST 使用白色字体；继承态 MUST 使用灰白色字体。树 MUST 可折叠、可滚动；滚动条 MUST 不占布局宽度，仅在鼠标悬停时显示。

状态树 MUST NOT 提供「设为默认」，MUST NOT 用对勾表示运行选用。左键点击 MUST 只切换编辑态查看，MUST NOT 改写 `state` 函数。只有叶子节点的右键菜单 MUST 提供「编辑」「删除」（`initial` 不可删除、不可重命名；根级 `initial` 可编辑过渡时长）。继承态（非叶子）的右键菜单 MUST 提供「添加状态」，行尾 MUST 另有添加图标按钮，二者行为相同。根级 `initial` 的菜单 MUST 也可添加顶层状态。列表底部 MUST 另有「添加状态」按钮，行为与根级 `initial` 上添加顶层状态相同。

添加状态 MUST 打开弹窗，填写名称与「过渡时长」，确认后才创建。名称 MUST 在该选中控件全部 `<_>` 中唯一（含顶层与所有继承组内的子状态；各组 `initial` 可重复）。已占用的名称 MUST NOT 再出现在树中其它位置。创建与重命名 MUST 拒绝重名。从根级 `initial` 添加 MUST 在选中控件上写顶层 `<_>`。从继承态添加 MUST 在该控件对应 `<__ name="继承名">` 内写 `<_ name="子状态">`（没有则创建 `<__>`），MUST NOT 改写祖先的 `<_>`。新状态加入后 MUST 成为查看状态，MUST NOT 自动改写 `state()`。进入某命名状态时，该状态的 `transition` MUST 作为该作用域内控件的 CSS 过渡时长（含位移、尺寸、边距、旋转与外观）。编辑模式下切换查看状态、以及改定位、尺寸、边距或旋转 MUST NOT 触发该过渡；预览模式与 H5 进入命名状态（含悬停命中 `hover`）时 MUST 使用该时长。`<__>` MUST NOT 写出 `transition`。

切到另一控件时，若新控件的可见状态中仍有当前查看的命名状态，MUST 保持查看该状态。否则 MUST 回落到最近祖先的当前查看命名状态（若有），再否则 `initial`。MUST NOT 因该控件的 `state()` 改写编辑态查看。

重命名 MUST 同步子孙对应 `<__>` 的 `name`。删除顶层 `<_>` MUST 去掉该控件对应 `<_>`、子孙对应 `<__>`；删除子状态 MUST 去掉 `<__>` 内对应 `<_>`。

列表当前查看的状态 SHALL 驱动编辑态。编辑模式下，画布、气泡与检查器 MUST 展示并写入该查看状态下的解析属性：改根级 `initial` MUST 写控件自身属性；查看该控件自己的顶层命名状态 MUST 写 `<_>`；查看祖先命名状态下的 `initial` MUST 写该控件的 `<__>`（没有则创建，差异被压空且无子状态则删除）；查看 `<__>` 内子状态 MUST 写该 `<_>`。预览模式与只读版本 MUST NOT 用查看状态覆盖 `state()` 求值结果。添加、改属性、重命名与删除 MUST 立即反映到当前 XML 与子窗口，且不必先保存版本。无选中控件时 MUST NOT 显示状态列表。

#### Scenario: List always starts with initial
- **WHEN** 已登录管理员在编辑草稿时选中一个还没有自定义状态的文本
- **THEN** 画布左侧状态树显示 `initial`（白色），右键可添加状态，且没有对勾或「设为默认」

#### Scenario: Creating on the selected widget does not apply it
- **WHEN** 已登录管理员选中某弹性盒，在其 `initial` 上添加名为 `active` 的状态
- **THEN** 新状态出现为该弹性盒根级叶子，弹性盒带有 `<_ name="active">`，工作台查看 `active`，MUST NOT 因此改写 `state()`

#### Scenario: Creating hover does not set it as applied
- **WHEN** 已登录管理员选中某弹性盒，在其 `initial` 上添加名为 `hover` 的状态
- **THEN** 弹性盒带有 `<_ name="hover">`，工作台查看 `hover`，MUST NOT 写出选用 `hover`

#### Scenario: Creating a sub-state under an inherited state
- **WHEN** 某弹性盒已有 `active` 状态，管理员选中其内部一个文本，在继承的 `active` 上添加名为 `mine` 的状态
- **THEN** 该文本 XML 含 `<__ name="active"><_ name="mine"/></__>`，弹性盒的 `<_>` 不增加新状态

#### Scenario: Duplicate named states are not listed or created
- **WHEN** 选中文本已有顶层 `<_ name="a">`，管理员在继承的 `active` 下再添加名为 `a` 的子状态
- **THEN** 弹窗提示名称已存在且不创建；状态树只出现一个 `a`

#### Scenario: Child selection shows a state tree
- **WHEN** 某弹性盒已有 `active` 状态，管理员选中其内部一个尚无自己状态的文本
- **THEN** 状态树为 `initial`、`active`（灰白、可折叠），`active` 下为 `initial`；只有叶子可编辑删除，`active` 菜单可添加状态

#### Scenario: Selecting a child keeps the parent state
- **WHEN** 父弹性盒 A 正在查看 `state2`，管理员选中没有自己状态的子控件 A1
- **THEN** A1 的列表仍查看 `state2`，画布上 A 与 A1 都按 `state2` 显示

#### Scenario: Selecting a nested owner without applied follows parent
- **WHEN** 父弹性盒 A 正在查看 `state2`，子控件 A2 拥有 `state4` 但未查看它，管理员选中 A2
- **THEN** A2 仍查看继承的 `state2`

#### Scenario: Clicking a state only views it
- **WHEN** 已登录管理员选中一个拥有 `active` 的文本，并左键点击列表中的 `active`
- **THEN** 画布与检查器立刻显示 `active` 的解析属性，该文本的 `state` 函数不因此被改写

#### Scenario: Clicking an inherited state does not apply
- **WHEN** 已登录管理员选中子文本并点击继承的 `active`
- **THEN** 画布与检查器按祖先 `active` 显示该子文本（含其 `<__>`），该子文本不因此写出 `state`

#### Scenario: Editing a named state writes a delta
- **WHEN** 已登录管理员在查看 `active` 时把选中文本的颜色改为绿
- **THEN** 该文本的 `<__ name="active">`（若 `active` 为自身拥有则为 `<_>`）含 `color` 为绿，默认状态的颜色不变

#### Scenario: Preview uses state function not viewing state
- **WHEN** 某控件 `state()` 回落 `initial`，管理员在编辑模式正查看继承的 `active`，然后切到预览模式
- **THEN** 画布按 `initial` 绘制，而不是按 `active`

#### Scenario: Renaming an owned state updates xml
- **WHEN** 已登录管理员把选中弹性盒拥有的 `active` 重命名为 `hover`，且一子文本带 `<__ name="active">`
- **THEN** 弹性盒写出 `<_ name="hover">`，子文本写出 `<__ name="hover">`

#### Scenario: Deleting an owned state removes deltas
- **WHEN** 已登录管理员删除选中弹性盒拥有的 `active`
- **THEN** 该弹性盒不再有 `<_ name="active">`，子孙不再有 `<__ name="active">`

### Requirement: Bubble text and box style controls
气泡样式编辑器 SHALL 按控件类型提供文字与盒样式入口，且 MUST 只编辑现有控件样式字段。当选中控件为 `text` 或 `button` 时，气泡 MUST 提供文本内容编辑入口（多行文本框），以及字体颜色、文字阴影、加粗、斜体、下划线与删除线。全部可选中控件的气泡 MUST 提供背景颜色、旋转、状态控制与循环入口。圆角与边框宽度 MUST 出现在 `swiper-item` 以外的控件。外边距与定位入口 MUST 出现在 `swiper-item` 以外的控件；内边距入口 MUST 出现在 `swiper` 以外的控件。外边距、内边距、圆角、边框宽度与定位偏移 MUST 逐行展示：总、上下、左右、上、左、下、右（圆角对应四角标签）。旋转 MUST 按 X、Y、Z 三轴逐行展示，单位 MUST 为 `deg` / `rad` / `grad` / `turn`，默认 `deg`。外边距 MUST 提供单位 `px` / `%` / `auto`；定位偏移 MUST 提供 `px` / `%`；内边距 MUST 提供 `px` / `%`。边框的线型与颜色 MUST 仍为控件级统一值。非 `text`/`button` 的气泡 MUST NOT 展示上述文字样式入口。本期气泡 MUST NOT 提供字号增减。

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

## ADDED Requirements

### Requirement: Workbench state function editor
工作台编辑草稿且选中某一控件后，气泡工具栏 SHALL 为全部可选中控件提供状态控制入口。点击后 MUST 打开弹窗，标题为编辑状态，编辑器 MUST 包在 `function state(): string{` 与 `}` 之间。已填写函数时，工具栏图标 MUST 呈激活态；清空后 MUST 为普通未激活态。确认时若函数体无法作为 JavaScript 语句编译，MUST 提示且不保存。空函数 MUST 清除宿主 `state`。预览模式 MUST NOT 从气泡改该函数。非草稿版本打开时 MUST 只读。修改后 MUST 写入当前草稿 XML，子窗口 MUST 立即重新渲染，且不必先保存版本。

#### Scenario: State icon opens the editor
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并点击气泡上的状态控制图标
- **THEN** 弹出 `function state(): string{ ... }` 编辑器

#### Scenario: Configured state function activates the icon
- **WHEN** 选中控件已有非空 `state()` 函数体
- **THEN** 气泡状态控制图标呈激活态

#### Scenario: Invalid function is rejected
- **WHEN** 管理员在弹窗中填入无法编译的语句并确认
- **THEN** 系统提示未保存，宿主 `state` 保持原值
