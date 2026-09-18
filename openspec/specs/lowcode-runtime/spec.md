# lowcode-runtime Specification

## Purpose

约定页面 XML 中文本与按钮的可观察行为，把渲染抽成公共能力，供管理后台同应用 iframe 预览与 H5 独立运行时共用，且两套宿主功能不同。

## Requirements

### Requirement: Page xml widget contract
页面 XML SHALL 以 `page` 为根。本期系统 MUST 识别子元素 `text`、`button`、`flex` 与 `swiper`。`text` MUST 使用 `id` 与 `value` 描述一段展示文本；`button` MUST 使用 `id` 与 `text` 描述一个按钮标签；`flex` MUST 使用 `id` 描述一个可嵌套的弹性容器；`swiper` MUST 使用 `id` 描述一个可嵌套的滑动器，其直接子元素为 `swiper-item`。未识别的元素 MUST 被忽略且 MUST NOT 阻止其余控件渲染。仅含 `text`、`button` 与 `flex` 的既有页面 XML MUST 仍合法。

#### Scenario: Text and button xml is accepted
- **WHEN** 系统解析包含一个 `text` 与一个 `button` 的合法页面 XML
- **THEN** 解析结果包含这两个控件及其 `id` 与对应文案

#### Scenario: Flex xml is accepted
- **WHEN** 系统解析包含一个 `flex` 的合法页面 XML
- **THEN** 解析结果包含该弹性盒及其 `id`

#### Scenario: Swiper xml is accepted
- **WHEN** 系统解析包含一个 `swiper` 的合法页面 XML
- **THEN** 解析结果包含该滑动器及其 `id`

#### Scenario: Unknown widget is ignored
- **WHEN** 页面 XML 在 `text`、`button`、`flex` 与 `swiper` 之外还包含未识别的子元素
- **THEN** 系统仍成功解析已识别控件，且不把未识别元素当作可渲染控件

#### Scenario: Invalid page xml is rejected
- **WHEN** 系统解析缺少 `page` 根或格式非法的 XML
- **THEN** 系统判定该 XML 无效并给出失败反馈，MUST NOT 当作空页面静默成功

### Requirement: Flex widget in page xml
页面 XML SHALL 识别 `flex` 为可渲染容器控件。每个 `flex` MUST 具有 `id`，MUST 允许子元素为 `text`、`button`、嵌套 `flex` 或 `swiper`。未设置弹性属性的 `flex` MUST 仍合法，渲染时按 CSS Flexbox 默认值布局。`flex` 内外未识别的元素 MUST 被忽略且 MUST NOT 阻止其余已识别控件渲染。

#### Scenario: Nested flex xml is accepted
- **WHEN** 系统解析一份 `page` 根下包含 `flex`，且该 `flex` 内依次含有 `text`、`button` 与嵌套 `flex` 的合法 XML
- **THEN** 解析结果包含该弹性盒及其子控件树，且各控件 `id` 与文案与 XML 一致

#### Scenario: Flex can contain swiper
- **WHEN** 系统解析一份 `flex` 内包含 `swiper` 的合法 XML
- **THEN** 解析结果将该滑动器作为该弹性盒的子控件

#### Scenario: Empty flex is accepted
- **WHEN** 系统解析包含一个没有子元素的 `flex` 的合法页面 XML
- **THEN** 解析结果包含该弹性盒，且其没有可渲染子控件

#### Scenario: Unknown nested element is ignored
- **WHEN** 页面 XML 中某个 `flex` 内除已识别控件外还包含未识别子元素
- **THEN** 系统仍成功解析该弹性盒与已识别子控件，且不把未识别元素当作可渲染控件

### Requirement: Flexbox container properties
每个 `flex` SHALL 可配置并持久化下列容器属性，缺省时 MUST 不写入 XML 属性并由渲染使用 CSS 默认值：`display`（`flex` 或 `inline-flex`，未设置时按 `flex` 渲染）、`flex-direction`（`row`、`row-reverse`、`column`、`column-reverse`）、`flex-wrap`（`nowrap`、`wrap`、`wrap-reverse`）、`justify-content`（`flex-start`、`flex-end`、`center`、`space-between`、`space-around`、`space-evenly`）、`align-items`（`stretch`、`flex-start`、`flex-end`、`center`、`baseline`）、`align-content`（`flex-start`、`flex-end`、`center`、`space-between`、`space-around`、`space-evenly`、`stretch`）、`row-gap` 与 `column-gap`（非负长度）。工作台可用 `gap` 同时设置行间距与列间距；当两者相等时 XML MUST 序列化为 `gap`，否则 MUST 分别序列化为 `row-gap` 与 `column-gap`。无法识别的属性值 MUST 视为未设置，MUST NOT 使整页 XML 非法。系统 MUST NOT 再提供与上述属性等价的缩写配置入口。

#### Scenario: Container properties round-trip
- **WHEN** 已登录管理员为某弹性盒设置 `display` 为 `inline-flex`、`flex-direction` 为 `column`、`flex-wrap` 为 `wrap`、`justify-content` 为 `space-between`、`align-items` 为 `center`、`align-content` 为 `stretch`、`gap` 为 `8px` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到相同容器属性，且预览中该容器按这些 CSS 值布局

#### Scenario: Unequal gaps serialize separately
- **WHEN** 已登录管理员将某弹性盒的 `row-gap` 设为 `4px`、`column-gap` 设为 `12px` 并应用到当前 XML
- **THEN** 序列化结果分别包含 `row-gap` 与 `column-gap`，且不把两者合并为单一 `gap`

#### Scenario: Omitted container properties use css defaults
- **WHEN** 页面 XML 中的 `flex` 只有 `id`、没有弹性容器属性
- **THEN** 系统将该弹性盒渲染为 `display: flex`，其余容器属性使用 CSS Flexbox 默认值

### Requirement: Flexbox item properties
当控件的直接父级为 `flex` 时，该子控件 SHALL 可配置并持久化下列项目属性，缺省时 MUST 不写入 XML 属性并由渲染使用 CSS 默认值：`order`（整数）、`flex-grow`（非负数）、`flex-shrink`（非负数）、`flex-basis`（`auto` 或非负长度）、`align-self`（`auto`、`stretch`、`flex-start`、`flex-end`、`center`、`baseline`）。页面根级控件 MUST NOT 被当作弹性项目展示或写入这些属性。无法识别的项目属性值 MUST 视为未设置，MUST NOT 使整页 XML 非法。系统 MUST NOT 再提供 `flex` 缩写配置入口。

#### Scenario: Item properties round-trip on flex child
- **WHEN** 已登录管理员选中某弹性盒内的文本或按钮，设置 `order` 为 `2`、`flex-grow` 为 `1`、`flex-shrink` 为 `0`、`flex-basis` 为 `80px`、`align-self` 为 `center` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到相同项目属性，且预览中该子控件按这些 CSS 值作为弹性项目布局

#### Scenario: Root widgets have no item properties
- **WHEN** 已登录管理员选中页面根级的文本或按钮
- **THEN** 属性面板不展示弹性项目属性，保存后的 XML 也不包含这些属性

### Requirement: Swiper widget in page xml
页面 XML SHALL 识别 `swiper` 为可渲染滑动器容器。每个 `swiper` MUST 具有 `id`，其直接子元素 MUST 仅为 `swiper-item`；`text`、`button`、`flex` 或嵌套 `swiper` 作为 `swiper` 的直接子元素 MUST 被忽略且 MUST NOT 阻止其余已识别控件渲染。未设置滑动器属性的 `swiper` MUST 仍合法。`swiper` 内外未识别的元素 MUST 被忽略。

#### Scenario: Swiper xml is accepted
- **WHEN** 系统解析一份 `page` 根下包含 `swiper`，且该 `swiper` 内含两个 `swiper-item` 的合法 XML
- **THEN** 解析结果包含该滑动器及其两个 item，且各控件 `id` 与 XML 一致

#### Scenario: Empty swiper is accepted
- **WHEN** 系统解析包含一个没有子元素的 `swiper` 的合法页面 XML
- **THEN** 解析结果包含该滑动器，且其没有可渲染 item

#### Scenario: Direct non-item children are ignored
- **WHEN** 页面 XML 中某个 `swiper` 的直接子元素除 `swiper-item` 外还包含 `text`
- **THEN** 系统仍成功解析该滑动器与已识别 item，且不把该 `text` 当作该滑动器的直接子控件

### Requirement: Swiper item widget in page xml
页面 XML SHALL 识别 `swiper-item` 为滑动器页。`swiper-item` MUST 仅作为 `swiper` 的直接子元素被识别；出现在页面根或 `flex` 下的 `swiper-item` MUST 被忽略。每个被识别的 `swiper-item` MUST 具有 `id`，MUST 允许子元素为 `text`、`button`、`flex` 或 `swiper`。空 `swiper-item` MUST 仍合法。item 内未识别的元素 MUST 被忽略且 MUST NOT 阻止其余已识别控件渲染。

#### Scenario: Item with nested widgets is accepted
- **WHEN** 系统解析一份 `swiper` 内含一个 `swiper-item`，且该 item 内依次含有 `text`、`button` 与 `flex` 的合法 XML
- **THEN** 解析结果包含该 item 及其子控件树，且各控件 `id` 与文案与 XML 一致

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

### Requirement: Swiper item fills swiper
滑动器页 `swiper-item` SHALL 始终撑满所属滑动器的展示区域，MUST NOT 由工作台单独设置宽高、外边距、边框、圆角或定位。选中 `swiper-item` 时，属性面板与气泡 MUST NOT 展示宽度、高度、外边距、边框、圆角或定位入口。渲染时 item 上的 `width` / `height` / 外边距 / 边框 / 圆角 / `position` / 四边偏移 MUST 被忽略，定位 MUST 保持静态。`Ctrl+T` / `⌘+T`、`Ctrl+M` / `⌘+M`、`Ctrl+R` / `⌘+R`、`Ctrl+Shift+B` / `⌘+Shift+B` 与 `Ctrl+L` / `⌘+L` MUST NOT 打开尺寸、外边距、圆角、边框或定位分组。非编辑态下，每个 item MUST 占满当前屏对应的滑动槽（`display-multiple-items` 大于 1 时按槽均分）；编辑态下每个可见 item MUST 与滑动器同宽同高。

#### Scenario: Inspector hides item size
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 右侧属性面板不展示宽度与高度输入

#### Scenario: Inspector hides item margin
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 右侧属性面板与气泡不展示外边距入口

#### Scenario: Inspector hides item border and radius
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 右侧属性面板与气泡不展示边框或圆角入口

#### Scenario: Inspector hides item position
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 右侧属性面板与气泡不展示定位方式或四边偏移入口

#### Scenario: Preview item fills the swiper
- **WHEN** 工作台处于预览模式或 H5 渲染一个带有 `swiper-item` 的滑动器
- **THEN** 该 item 铺满滑动器当前屏的展示区域，不按其 XML 中可能存在的宽高收缩

#### Scenario: Edit mode item fills the swiper
- **WHEN** 已登录管理员处于编辑模式并查看一个水平滑动器的多个 `swiper-item`
- **THEN** 每个可见 item 都与滑动器同宽同高，并排展开但不需要单独设置尺寸

### Requirement: Swiper size is required
滑动器 `swiper` SHALL 始终具有宽度与高度，单位 MUST 为 `px` 或 `%`，MUST NOT 使用自适应（`fit-content`）。未设置时解析与渲染 MUST 分别回落到宽度 `100%` 与高度 `150px`，新添加的滑动器 MUST 带上这两项。工作台尺寸输入 MUST 只提供 `px` / `%`，MUST NOT 提供自适应选项。选中 `swiper` 时，属性面板与气泡 MUST NOT 展示内边距入口；`Ctrl+P` / `⌘+P` MUST NOT 打开内边距分组。页面 XML 中 `swiper` 上的内边距 MUST 被忽略且序列化 MUST NOT 写出。

#### Scenario: New swiper has size
- **WHEN** 已登录管理员添加一个滑动器
- **THEN** 该滑动器宽度为 `100%`、高度为 `150px`

#### Scenario: Swiper size cannot be fit-content
- **WHEN** 已登录管理员选中一个滑动器并打开尺寸面板
- **THEN** 宽高单位只有 `px` 与 `%`，没有自适应

#### Scenario: Swiper padding is hidden
- **WHEN** 已登录管理员选中一个滑动器
- **THEN** 气泡与属性面板不展示内边距入口，按下 `Ctrl+P` 不打开内边距分组

#### Scenario: Swiper padding in xml is ignored
- **WHEN** 页面 XML 中某个 `swiper` 带有 `padding` 或四边 `padding-*`
- **THEN** 解析结果不包含该滑动器的内边距，序列化后的 XML 也不再写出这些属性

### Requirement: Swiper container properties
每个 `swiper` SHALL 可配置并持久化下列属性，缺省时 MUST 不写入 XML 属性并由渲染使用约定默认值：`indicator-dots`（布尔，默认 `false`）、`indicator-color`（颜色，默认 `rgba(0, 0, 0, 0.3)`）、`indicator-active-color`（颜色，默认 `#000000`）、`autoplay`（布尔，默认 `false`）、`current`（大于等于 0 的整数，默认 `0`）、`interval`（大于 0 的毫秒整数，默认 `5000`）、`duration`（大于等于 0 的毫秒整数，默认 `500`）、`circular`（布尔，默认 `false`）、`vertical`（布尔，默认 `false`）、`previous-margin` 与 `next-margin`（非负长度，默认 `0`）、`display-multiple-items`（大于等于 1 的整数，默认 `1`）、`snap-to-edge`（布尔，默认 `false`）、`easing-function`（`default`、`linear`、`easeInCubic`、`easeOutCubic`、`easeInOutCubic`，默认 `default`）。布尔真值 MUST 序列化为 `true`；为默认假值时 MUST 不写入。无法识别的属性值 MUST 视为未设置，MUST NOT 使整页 XML 非法。

#### Scenario: Swiper properties round-trip
- **WHEN** 已登录管理员为某滑动器设置 `indicator-dots` 为开启、`indicator-color` 为 `#cccccc`、`indicator-active-color` 为 `#1677ff`、`autoplay` 为开启、`current` 为 `1`、`interval` 为 `3000`、`duration` 为 `400`、`circular` 为开启、`vertical` 为开启、`previous-margin` 为 `12px`、`next-margin` 为 `8px`、`display-multiple-items` 为 `2`、`snap-to-edge` 为开启、`easing-function` 为 `linear` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到相同滑动器属性

#### Scenario: Omitted swiper properties use defaults
- **WHEN** 页面 XML 中的 `swiper` 只有 `id`、没有滑动器属性
- **THEN** 系统按默认值渲染：无指示点、不自动播放、不循环、水平方向、`current` 为 `0`、`interval` 为 `5000`、`duration` 为 `500`、`display-multiple-items` 为 `1`

#### Scenario: Invalid swiper property is ignored
- **WHEN** 页面 XML 中某个 `swiper` 的 `easing-function` 为无法识别的值、`interval` 为负数
- **THEN** 这两个字段视为未设置，整页 XML 仍合法，其余合法属性仍生效

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

### Requirement: Workbench iframe preview
工程编辑页 SHALL 使用主窗口加 iframe 子窗口的模式：主窗口展示工作台（页面列表、版本管理与控件编辑），子窗口加载管理后台自己的预览页并展示根据当前 XML 渲染出的页面。预览页 MUST 与工作台同源，MUST NOT 使用 H5 应用作为 iframe 目标。工作台壳层 MUST NOT 出现在子窗口的渲染结果中。

#### Scenario: Preview runs inside admin iframe
- **WHEN** 已登录管理员打开工程编辑页并选中一个页面
- **THEN** 渲染结果出现在指向管理后台预览页的 iframe 子窗口中，而不是主窗口工作台区域

#### Scenario: Preview is not the h5 app
- **WHEN** 工程编辑页挂载预览 iframe
- **THEN** iframe 的文档来自管理后台应用，而不是 H5 应用

#### Scenario: Workbench chrome stays in parent
- **WHEN** iframe 完成一次页面渲染
- **THEN** 子窗口中不包含工程列表、页面列表或版本管理界面

### Requirement: Page background and padding
页面 XML 的 `page` 根 SHALL 可配置并持久化背景与内边距。背景 MUST 使用 `background` 属性；内边距 MUST 使用与控件相同的 `padding` 缩写或 `padding-top` / `padding-right` / `padding-bottom` / `padding-left`。缺省时 MUST 不写入这些属性，渲染 MUST 使用透明背景与 0 内边距，控件 MUST 可贴齐页面边缘。无法识别的属性值 MUST 视为未设置，MUST NOT 使整页 XML 非法。无这些属性的既有页面 XML MUST 仍合法。管理后台 iframe 预览与 H5 独立运行时 MUST 对同一份页面样式渲染出相同的背景与内边距。工作台 MUST NOT 再给页面强制加默认内边距或白色填充。

#### Scenario: Page style round-trip
- **WHEN** 已登录管理员将页面背景设为某颜色、四边内边距设为 `16px` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到相同背景与内边距，且预览中页面使用该背景，控件与页面边缘之间为 `16px`

#### Scenario: Omitted page style has no default padding or fill
- **WHEN** 页面 XML 的 `page` 根没有 `background` 与 `padding` 相关属性
- **THEN** 预览中页面背景透明、内边距为 0，根级控件可贴齐页面边缘

#### Scenario: Unequal padding serializes separately
- **WHEN** 已登录管理员将页面上内边距设为 `8px`、其余三边设为 `0` 并应用到当前 XML
- **THEN** 序列化结果能还原这四边值，且不把它们合并为单一相等的 `padding`

#### Scenario: Same page style matches in admin preview and h5
- **WHEN** 同一份带页面背景与内边距的合法 XML 分别在管理后台预览页与 H5 运行时中渲染
- **THEN** 两处的页面背景与内边距一致

### Requirement: Workbench canvas page chrome
工程编辑页画布上的页面轮廓 SHALL 使用浅蓝色实线框标出屏幕边界。该实线框 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 独立运行时。画布上的页面区域 MUST NOT 使用白色填充或投影来标出边界。编辑模式与预览模式下，该实线框 MUST 都可见，以便在网格背景上辨认页面范围。

#### Scenario: Empty page shows light blue frame
- **WHEN** 已登录管理员在工程编辑页打开一份没有背景的页面
- **THEN** 画布上能看到浅蓝色实线框勾出的页面范围，框内不是白色填充

#### Scenario: H5 does not show editor frame
- **WHEN** 用户在 H5 独立运行时打开同一份没有背景的页面 XML
- **THEN** 渲染结果不包含该浅蓝色实线框

### Requirement: Widget style bubble on selected widget
工作台编辑草稿且点击选中某一控件后 SHALL 在画布右上角显示气泡样式编辑器。气泡 MUST 固定在画布右上角，MUST NOT 随画布平移、缩放或控件矩形移动，MUST NOT 遮挡该控件，MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 独立运行时。气泡 MUST 提供设置入口（螺丝图标）；点击后 MUST 弹出检查器弹窗，标题为「控件属性【类型-ID】」，并以四列字符串属性表展示该控件的完整属性。弹窗顶部 MUST 提供属性筛选。工作台 MUST NOT 再保留独立的右侧控件信息栏。预览模式时系统 MUST NOT 显示可编辑气泡。非草稿版本 MUST 仍可通过设置入口打开只读检查器弹窗。气泡与弹窗 MUST 写入同一套控件样式；编辑草稿时修改后子窗口 MUST 立即按更新后的 XML 重新渲染，且不必先保存版本。

#### Scenario: Clicking a widget pins the bubble
- **WHEN** 已登录管理员在编辑草稿时点击选中一个控件
- **THEN** 画布右上角出现气泡样式编辑器，且不遮挡该控件

#### Scenario: Bubble stays pinned while editing
- **WHEN** 已登录管理员打开气泡中的圆角或边框面板，平移或缩放画布，或修改该控件样式
- **THEN** 气泡仍留在画布右上角，不移动

#### Scenario: Settings icon opens inspector dialog
- **WHEN** 已登录管理员点击气泡上的设置图标
- **THEN** 弹出检查器弹窗，标题含控件类型与 ID，属性以四列字符串表展示（可用筛选过滤），且画布上不再有独立的右侧控件信息栏

#### Scenario: Deselecting keeps page settings entry
- **WHEN** 气泡已显示，且管理员取消选中该控件
- **THEN** 文字与盒样式工具条不再显示，画布右上角仍保留设置图标；点击后弹出页面属性弹窗

#### Scenario: Preview hides the bubble
- **WHEN** 已登录管理员处于预览模式
- **THEN** 不显示可编辑的气泡样式编辑器

#### Scenario: Bubble edits update preview and inspector
- **WHEN** 已登录管理员在气泡中修改选中控件的背景颜色
- **THEN** 子窗口立即使用该背景渲染该控件，打开检查器弹窗时显示相同颜色，且不必先保存版本

#### Scenario: H5 does not show the bubble
- **WHEN** 用户在 H5 独立运行时打开同一份页面 XML
- **THEN** 渲染结果不包含气泡样式编辑器

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

#### Scenario: Four-side radius mode
- **WHEN** 已登录管理员将某控件圆角设为上下左右模式，并把四角设为不同数值
- **THEN** 预览中四个圆角分别使用这些值，且不把它们合并为单一相等圆角

#### Scenario: Bold toggle on button
- **WHEN** 已登录管理员在按钮的气泡中打开加粗
- **THEN** 该按钮以粗体渲染，关闭加粗后恢复为未设置粗细

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

### Requirement: Widget position and inset style
控件样式 SHALL 可配置并持久化定位方式与四边偏移。定位方式 MUST 为 `static`、`relative`、`absolute`、`fixed` 或 `sticky`；缺省或无法识别的值 MUST 视为 `static`，MUST 不写入 `position` 属性，MUST NOT 使整页 XML 非法。四边偏移 MUST 使用 `top` / `right` / `bottom` / `left` 属性，单位 MUST 为 `px` 或 `%`；像素与百分比的数值 MUST 为整数，像素可为负。四边相等时 MUST 可序列化为 `inset`，否则 MUST 分别写出对应边。缺省的边与 `auto` MUST 不写入。工作台定位编辑 MUST NOT 提供 `auto` 单位。定位为静态（含缺省）时 MUST NOT 持久化四边偏移；解析时若静态仍带有这些属性，MUST 丢弃且 MUST NOT 再写出。无这些属性的既有页面 XML MUST 仍合法，渲染 MUST 保持静态文档流。

渲染 MUST 把定位方式映射为 CSS `position`，把已设置的边映射为对应 CSS 偏移。`static` 时 MUST NOT 因偏移产生位移，MUST NOT 写出偏移 CSS。页面根 MUST 作为其未再套定位祖先的子控件的绝对定位包含块，宽度 MUST 为页面宽度；编辑态 MUST NOT 把编辑溢出区或预览宿主当作这些控件的包含块。`fixed` MUST 仍渲染为 CSS `fixed`，MUST NOT 改写成相对页面盒的 `absolute`。工作台 iframe 中 `fixed` MUST 相对 375×667 屏幕区域（`.preview-mount`）定位，MUST NOT 相对编辑溢出画布或 iframe 文档视口；H5 MUST 相对浏览器视口。页面根 MUST NOT 使用这些属性。工作台检查器 MUST 为 `swiper-item` 以外的选中控件提供定位方式入口；四边偏移与层级（`z-index`）入口 MUST 仅在定位非静态时出现，并与气泡、画布写入同一组字段。`z-index` MUST 为整数（可为负），缺省 MUST 不写入；静态时 MUST NOT 持久化。

#### Scenario: Omitted position stays static
- **WHEN** 页面 XML 中某个文本控件没有 `position` 与 `top` / `right` / `bottom` / `left`
- **THEN** 解析结果不包含定位与偏移，渲染按静态文档流排列

#### Scenario: Relative position round-trips
- **WHEN** 已登录管理员把某按钮的定位设为相对，并把 `top` 设为 `12`、`left` 设为 `8` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到定位 `relative` 与相同的上、左偏移，且预览中该按钮相对其静态位置偏移

#### Scenario: Absolute uses containing block
- **WHEN** 当前 XML 含一个定位为绝对、`top` 为 `20`、`left` 为 `16` 的文本
- **THEN** 管理后台预览与 H5 都按绝对定位渲染该文本，并使用这两项像素偏移

#### Scenario: Edit mode page is the absolute containing block
- **WHEN** 已登录管理员处于编辑模式，页面宽为 `375`，一个页面根下的控件定位为绝对且 `left` 为 `0`、`right` 为 `0`
- **THEN** 该控件宽度为页面宽度 `375`，不随编辑溢出区被拉宽

#### Scenario: Fixed stays viewport-relative
- **WHEN** 当前 XML 含一个定位为固定、`bottom` 为 `0`、`right` 为 `0` 的按钮
- **THEN** 渲染仍为 CSS `fixed`，不改成相对页面根的绝对定位；H5 把它贴在浏览器视口右下

#### Scenario: Edit mode fixed uses phone screen
- **WHEN** 已登录管理员处于编辑模式，一个控件定位为固定且 `top` 为 `0`、`left` 为 `0`
- **THEN** 该控件贴在 375×667 屏幕区域上左，不贴在编辑溢出画布或 iframe 文档视口上左

#### Scenario: Sticky uses inset as stick offset
- **WHEN** 当前 XML 含一个定位为吸附、`top` 为 `0` 的文本
- **THEN** 管理后台预览与 H5 都按 `sticky` 渲染，且上偏移为 `0`

#### Scenario: Static drops stored insets
- **WHEN** 当前 XML 含一个定位为静态（或未写 `position`）、同时带有 `top="20"` 的按钮
- **THEN** 该按钮仍按文档流排列；解析结果不包含该偏移，序列化后的 XML 也不再写出 `top`

#### Scenario: Inspector hides insets while static
- **WHEN** 已登录管理员选中一个定位为静态的文本控件
- **THEN** 检查器与气泡可改定位方式，但不展示 `inset` / `top` / `right` / `bottom` / `left` 入口

#### Scenario: Invalid position is ignored
- **WHEN** 页面 XML 中某个控件的 `position` 为无法识别的值
- **THEN** 解析结果将该定位视为未设置（静态），其余已识别属性仍成功解析

#### Scenario: Unequal insets serialize separately
- **WHEN** 已登录管理员把某控件四边偏移写成互不相同的像素值并应用到当前 XML
- **THEN** 序列化结果能还原这四边值，且不把它们合并为单一相等的 `inset`

#### Scenario: Inspector can edit position
- **WHEN** 已登录管理员选中一个文本控件并在检查器把定位改为绝对、把 `left` 写成 `24px`
- **THEN** 子窗口立即按绝对定位与左偏移 `24` 渲染该控件，且不必先保存版本

#### Scenario: Non-static can set z-index
- **WHEN** 已登录管理员把某控件定位改为固定，并把层级写成 `3`
- **THEN** XML 含 `z-index="3"`，渲染使用 CSS `z-index: 3`；改回静态后不再写出该属性

### Requirement: Widget rotate style
控件样式 SHALL 可配置并持久化绕 X、Y、Z 三轴的旋转。XML 属性 MUST 为 `rotate-x`、`rotate-y`、`rotate-z`，值 MUST 为带单位的 CSS 角度：`deg`、`rad`、`grad` 或 `turn`。未写单位时 MUST 视为 `deg`。缺省、无法识别的值、或数值为 `0` MUST 不写入对应属性，MUST NOT 使整页 XML 非法。无这些属性的既有页面 XML MUST 仍合法，渲染 MUST 不旋转该控件。

渲染 MUST 把已设置的轴映射为 CSS `transform` 中的 `rotateX()` / `rotateY()` / `rotateZ()`，书写顺序 MUST 为 X 再 Y 再 Z；未设置或 `0` 的轴 MUST NOT 写入该函数。变换原点 MUST 为控件边框盒中心（CSS 默认）。管理后台预览与 H5 的页面宿主 MUST 提供透视（`800px`），使绕水平轴或竖直轴的旋转可见；该透视 MUST NOT 写入页面 XML。工作台检查器与气泡 MUST 为全部可选中控件（含 `swiper-item`）提供三轴角度输入与单位选择，默认单位 MUST 为 `deg`，并与画布写入同一组字段。切换某轴单位时 MUST 换算数值以保持该轴实际角度不变。

#### Scenario: Omitted rotate stays identity
- **WHEN** 页面 XML 中某个文本控件没有 `rotate-x` / `rotate-y` / `rotate-z`
- **THEN** 解析结果不包含旋转，渲染不旋转该控件

#### Scenario: Degree rotate round-trips
- **WHEN** 已登录管理员把某按钮的 `rotate-z` 设为 `45deg` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到绕 Z 轴 `45deg`，预览中该按钮绕垂直于屏幕的轴旋转 `45` 度

#### Scenario: Default unit is degree
- **WHEN** 页面 XML 中某个控件写有 `rotate-x="30"`
- **THEN** 解析结果将该角视为 `30deg`，渲染为 `rotateX(30deg)`

#### Scenario: Radian rotate renders
- **WHEN** 当前 XML 含一个 `rotate-y="1.570796rad"` 的文本
- **THEN** 管理后台预览与 H5 都按绕竖直轴约四分之一圈渲染该文本

#### Scenario: Zero rotate is omitted
- **WHEN** 已登录管理员把某控件三轴都写成 `0deg` 并应用到当前 XML
- **THEN** 序列化结果不写出 `rotate-x` / `rotate-y` / `rotate-z`

#### Scenario: Invalid rotate is ignored
- **WHEN** 页面 XML 中某个控件的 `rotate-z` 为无法识别的值
- **THEN** 解析结果将该轴视为未设置，其余已识别属性仍成功解析

#### Scenario: Inspector can edit rotate
- **WHEN** 已登录管理员选中一个文本控件并在检查器把绕 Z 轴写成 `90`、单位为 `deg`
- **THEN** 子窗口立即按 `rotateZ(90deg)` 渲染该控件，且不必先保存版本

#### Scenario: Changing unit keeps the angle
- **WHEN** 已登录管理员把某控件绕 Z 轴从 `180deg` 改成单位 `turn`
- **THEN** 该轴数值变成 `0.5turn`，预览中的旋转角度不变

#### Scenario: Swiper item can rotate
- **WHEN** 已登录管理员选中一个 `swiper-item` 并把绕 Z 轴写成 `15deg`
- **THEN** 该 item 仍铺满滑动槽，同时按 `rotateZ(15deg)` 渲染

#### Scenario: Preview host has perspective
- **WHEN** 当前 XML 含一个 `rotate-x="45deg"` 的按钮
- **THEN** 管理后台预览与 H5 都能看出绕水平轴的透视缩短，而不是完全压扁成一条线

### Requirement: Padding and margin shortcuts and canvas drag
工作台编辑草稿且点击选中某一控件后，系统 SHALL 接受修饰键加 `P` / `M` 立刻选中气泡的内边距或外边距分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开对应面板，MUST NOT 在该分组已打开时把它关掉。主窗口与 iframe 画布 MUST 都能识别这些快捷键，并 MUST `preventDefault` 以免浏览器打开打印等默认行为。焦点在可编辑输入内时 MUST NOT 拦截。预览模式、非草稿版本或当前没有选中控件时 MUST NOT 改变分组或样式。

内外边距分组打开后，系统 MUST 在选中控件上叠加红色虚线辅助框：内边距 MUST 框住内容区（由边框盒向内缩进四边内边距），外边距 MUST 框住外边距盒。四边控制条与数值 MUST 按各边实际坐标独立放置，MUST NOT 把辅助框宽高钳成非负后再排手柄。当某边为负、或相对两边之和超过控件尺寸导致对边交错时，辅助框 MUST 允许反向（可自交），控制条 MUST 仍跟手。对边控制条重合时，其中一条 MUST 保持长条，另一条 MUST 收成约 16px 的圆钮叠在长条上，以免被盖住消失，MUST NOT 缩成一个点。画布其余内容 MUST 被半透明遮罩盖住，覆盖范围 MUST 包括页面周围的画布以及选中控件以外的页面内容；选中控件本身 MUST 保持完全可见。四边 MUST 各有一条可按住的控制条；控制条热区 MUST 明显大于可见细条。按住某条控制条后 MUST 只改该边；按住 `Alt` 时 MUST 同时改对边（左对右、上对下），对边 MUST 写成与当前边相同的值。悬停或按住控制条时 MUST 显示一条白色虚线，标出该边的拖动方向（上下边为竖线，左右边为横线），且悬停时该线 MUST 保持稳定、MUST NOT 闪烁。每边非零像素值 MUST 显示在对应虚线旁；当该边长度放不下数字时 MUST 隐藏该边的值。选中控件右下角 MUST 有取消（叉）与确定（勾）按钮；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件内外边距恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。辅助线、控制条、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉辅助线与遮罩。拖动或输入改边距时辅助线 MUST 跟手更新，画布上的数值 MUST 与气泡输入为同一组边距。

内外边距分组打开后，按住某边控制条拖动 SHALL 按指针位移改写该边，并 MUST 写入与气泡输入相同的 `WidgetStyle` 字段。位移 MUST 按画布视觉缩放折算为 CSS 像素后按 `1` 步进写入整数（向 0 截断），MUST NOT 出现小数，MUST NOT 把不足 `1px` 的位移四舍五入成 `1`。按下控制条后，指针移出控制条热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写该边，MUST NOT 因热区外没有滑动事件而停在半路。该边的增量 MUST 跟手：外边距 MUST 向外为正（向上增加上边、向下增加下边、向左增加左边、向右增加右边）；内边距控制条在内容区边上，MUST 向内为正（把内容区上边往下拖增加上内边距、下边往上拖增加下内边距、左边往右拖增加左内边距、右边往左拖增加右内边距）。拖动结果 MUST 仅在按住 `Shift` 时吸附，优先级为：先对边当前值（左对右、上对下，距目标 10px 内；按住 `Alt` 镜像时 MUST 跳过对边吸附），再其余两边的值（同阈值），否则落到最近的 5 的倍数；未按 `Shift` 时 MUST 按 `1` 步进的整数值写入，MUST NOT 吸附。按住 `Shift` 时 MUST 在对应边的数值旁显示磁铁图标（该边无数字时显示在控制条旁）。按住 `Alt` 时 MUST 把对边写成与当前边相同的值（左右成对、上下成对，按住期间 MUST 相等），可与 `Shift` 同时按。松开 `Alt` 后对边 MUST 保持松开瞬间的值，MUST NOT 恢复为按住 `Alt` 之前的值；本次拖动后续未按 `Alt` 时 MUST 只改按住的那一边。画布上的边距数字 MUST 与写入的整数值一致。未按住控制条时 MUST NOT 把控件上的左键拖动当成改边距。内边距 MUST 钳在大于等于 `0`；外边距可为负，但从非负拖进负数时 MUST 先停在 `0`，指针还需再越过约 `20` CSS 像素才写出负数（已为负则不再加这段阻力）。拖动过程中预览 MUST 立即更新；一次拖动 MUST 合并为一步撤回。点选其他控件或空白画布 MUST 仍改变选中。中键平移 MUST 不受影响。

内外边距、圆角或边框分组打开后，系统 SHALL 接受按住数字键 `1`–`7` 选择边或角：内边距、外边距与边框为 `1` 上 / `2` 右 / `3` 下 / `4` 左，`5` 上下，`6` 左右，`7` 全部；圆角为 `1` 左上 / `2` 右上 / `3` 右下 / `4` 左下，`5` 左上与右下，`6` 左下与右上，`7` 全部。这些选边键 MUST 为主键盘数字行（`Digit1`–`Digit7`），MUST NOT 把小键盘 `Numpad1`–`Numpad7` 当成选边。按住数字的同时按下 `ArrowUp` MUST 立刻增加 `1` 像素，按下 `ArrowDown` MUST 立刻减小 `1` 像素；未选中全部边或角时 `ArrowLeft` / `ArrowRight` MUST NOT 改样式。按住方向键不放时 MUST NOT 使用系统按键重复，MUST 每 `100ms` 再触发一次，每次步进 `2` 像素（上/右加、下/左减）。按住 `7`（或按住的键合起来覆盖四边/四角）时 MUST 视为选中全部操纵条（四条都为黄色），此时 `ArrowUp` / `ArrowRight` MUST 同时增加全部边或角，`ArrowDown` / `ArrowLeft` MUST 同时减小全部边或角。可同时按住多个数字，方向键 MUST 对当前选中的每一边/角施加同一增量。未按住选边键时方向键 MUST NOT 改样式。`Alt` MUST NOT 再作为键盘选边；拖动操纵条时 `Alt` 仍镜像对边。按住选边键时，小键盘数字键 `Numpad0`–`Numpad9`（NumLock 开启，`key` 为 `0`–`9`）MUST 把当前选中边或角写成该次按住期间输入的整数值：每按一位 MUST 立刻写入（例如先 `1` 再 `2` 写成 `12`）；`Backspace` MUST 删掉最后一位并立刻写入（删空则写成 `0`），MUST NOT 删除控件；`-`（主键盘 Minus 或小键盘 `NumpadSubtract`）MUST 作为负号输入：尚未带负号时写入 `-` 前缀（例如先 `-` 再小键盘 `8` 写成 `-8`），已有负号则忽略；松开全部选边键后再按住 MUST 清空这次输入，从新数字开始，MUST NOT 接到上次后面。未选边时小键盘数字、`Backspace` 与 `-` MUST NOT 改样式。内边距、圆角与边框宽度 MUST 钳在大于等于 `0`；外边距可为负。焦点在可编辑输入内时 MUST NOT 拦截。主窗口与 iframe 画布 MUST 都能识别。按住数字时画布上对应控制条 MUST 显示为黄色。

#### Scenario: Shortcut opens padding
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并按下 `Ctrl+P` 或 `⌘+P`
- **THEN** 气泡立刻展开内边距面板，选中控件上出现内边距辅助线，浏览器不打开打印对话框

#### Scenario: Padding shortcut ignored on swiper
- **WHEN** 已登录管理员选中一个滑动器并按下 `Ctrl+P`
- **THEN** 不展开内边距分组，也不改任何控件样式

#### Scenario: Padding guides sit on the content box
- **WHEN** 已登录管理员打开内边距面板，且该控件上内边距为 `8px`、其余为 `0`
- **THEN** 内容区被红色虚线框住（边框盒向内缩进 `8px`），上边旁显示 `8`（放得下时），其余为 0 的边不显示数字

#### Scenario: Margin guides sit outside the box
- **WHEN** 已登录管理员打开外边距面板，且该控件左边距为 `12px`
- **THEN** 红色虚线框在控件外侧扩出左边距，左侧旁显示 `12`（放得下时）

#### Scenario: Guides hide when group closes
- **WHEN** 内边距辅助线已显示，管理员关闭内边距面板或取消选中该控件
- **THEN** 辅助线与遮罩消失

#### Scenario: Spacing isolate masks the rest of the canvas
- **WHEN** 已选中控件且内边距或外边距面板已打开
- **THEN** 选中控件保持完全可见（含左上角），页面上其余控件与页面周围的画布都被半透明遮罩盖住

#### Scenario: Overflow around the page stays visible
- **WHEN** 已选中控件且外边距为负，控件或辅助线溢出页面左上
- **THEN** 溢出部分仍可见，MUST NOT 被遮罩挖洞偏移或 iframe 裁切挡住

#### Scenario: Confirm keeps spacing edits
- **WHEN** 内边距或外边距已打开且管理员已拖动改过边距，管理员点勾或按 `Enter`
- **THEN** 边距保持拖动后的值，辅助线、遮罩与按钮消失

#### Scenario: Cancel restores spacing
- **WHEN** 内边距或外边距已打开且管理员已拖动改过边距，管理员点叉或按 `Esc`
- **THEN** 该控件内外边距恢复为打开分组前的值，辅助线、遮罩与按钮消失

#### Scenario: Shortcut opens margin
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并按下 `Ctrl+M` 或 `⌘+M`
- **THEN** 气泡立刻展开外边距面板

#### Scenario: Margin shortcut ignored on swiper-item
- **WHEN** 已登录管理员选中一个 `swiper-item` 并按下 `Ctrl+M`
- **THEN** 不展开外边距分组，也不改任何控件样式

#### Scenario: Radius shortcut ignored on swiper-item
- **WHEN** 已登录管理员选中一个 `swiper-item` 并按下 `Ctrl+R`
- **THEN** 不展开圆角分组，也不改任何控件样式

#### Scenario: Border shortcut ignored on swiper-item
- **WHEN** 已登录管理员选中一个 `swiper-item` 并按下 `Ctrl+Shift+B`
- **THEN** 不展开边框分组，也不改任何控件样式

#### Scenario: Shortcut does not toggle closed
- **WHEN** 气泡内边距面板已打开，管理员再次按下 `Ctrl+P`
- **THEN** 内边距面板保持打开

#### Scenario: Shortcut ignored without selection
- **WHEN** 当前没有选中控件，管理员按下 `Ctrl+P` 或 `Ctrl+M`
- **THEN** 不展开气泡分组，也不改任何控件样式

#### Scenario: Drag updates one direction
- **WHEN** 已选中控件且内边距面板已打开，管理员按住左边控制条向右拖动
- **THEN** 只有左边内边距增加，其余三边保持拖动开始时的值，并出现标出左右方向的白色虚线

#### Scenario: Drag right updates the right edge
- **WHEN** 已选中控件且外边距面板已打开，管理员按住右边控制条向右拖动
- **THEN** 只有右边外边距增加约等于水平位移的像素值，预览立即更新

#### Scenario: Drag padding right inward
- **WHEN** 已选中控件且内边距面板已打开，管理员按住右边控制条向左拖动
- **THEN** 只有右边内边距增加

#### Scenario: Drag top updates the top edge
- **WHEN** 已选中控件且内边距面板已打开，管理员按住上边控制条向下拖动
- **THEN** 只有上边内边距增加，其余三边保持拖动开始时的值

#### Scenario: Drag bottom follows the pointer
- **WHEN** 已选中控件且内边距面板已打开，管理员按住下边控制条向上拖动
- **THEN** 只有下边内边距增加，其余三边保持拖动开始时的值

#### Scenario: Alt mirrors the opposite edge
- **WHEN** 已选中控件且内边距左边为 `8`、右边为 `12`，管理员按住 `Alt` 并按住左边控制条向右拖 `4` CSS 像素
- **THEN** 左边与右边都写成 `12`，上下边保持原值

#### Scenario: Alt mirrors top and bottom
- **WHEN** 已选中控件且内边距上边为 `26`、下边为 `44`，管理员按住 `Alt` 并按住上边控制条拖动
- **THEN** 上下两边始终为相同值

#### Scenario: Releasing Alt keeps the mirrored value
- **WHEN** 已选中控件且上内边距为 `13`、下内边距为 `19`，管理员按住上边控制条并按住 `Alt` 拖到上下均为 `13`，然后松开 `Alt`（指针未再移动）
- **THEN** 下边仍为 `13`，MUST NOT 回到 `19`

#### Scenario: Drag snaps to the opposite edge first
- **WHEN** 已选中控件且内边距右边为 `12`、其余为 `0`，管理员按住 `Shift` 并按住左边控制条拖到约 `11`
- **THEN** 左边吸附为 `12`，而不是 `10`，且左边数值旁出现磁铁图标

#### Scenario: Drag snaps to another edge before the grid
- **WHEN** 已选中控件且内边距上边为 `2`、其余为 `0`，管理员按住 `Shift` 并按住左边控制条拖到约 `3`
- **THEN** 左边吸附为 `2`，而不是 `0` 或 `5`

#### Scenario: Drag snaps to multiples of five
- **WHEN** 已选中控件且内边距四边均为 `0`，管理员按住 `Shift` 并按住左边控制条拖到约 `13`
- **THEN** 左边吸附为 `15`

#### Scenario: Drag does not snap without Shift
- **WHEN** 已选中控件且内边距四边均为 `0`，管理员不按 `Shift`、按住左边控制条拖到约 `13`
- **THEN** 左边为 `13`，不吸附到 `15`，也不显示磁铁图标

#### Scenario: Handles stay independent when the box inverts
- **WHEN** 已选中控件且外边距面板已打开，左边为 `-265`、右边为 `115`，且左边绝对值大于控件宽度与右边之和
- **THEN** 左边控制条出现在右边控制条的右侧，两边的数字分别标在各自边上且不叠在一起，红色虚线框反向，控制条仍可继续拖动

#### Scenario: Overlapping handle becomes a circle
- **WHEN** 已选中控件且外边距面板已打开，上下两边控制条重合在同一条线上
- **THEN** 其中一条保持长条，另一条收成约 16px 圆钮叠在长条上，两条都仍可按住拖动

#### Scenario: Bubble input and canvas guides stay in sync
- **WHEN** 已选中控件且内边距面板已打开，管理员把右边输入改成 `33`
- **THEN** 画布右边辅助线立即显示 `33`，内容区右缘按 `33px` 缩进

#### Scenario: Guides show the stored value without rounding
- **WHEN** 已选中控件且内边距上边为 `0`
- **THEN** 上边不显示数字，MUST NOT 显示为 `1`

#### Scenario: Drag steps by one pixel
- **WHEN** 已选中控件且内边距为 `0`，管理员拖动位移不足 `1` CSS 像素
- **THEN** 该边仍为 `0`，不写成小数，也不进位成 `1`

#### Scenario: Drag follows the pointer outside the handle
- **WHEN** 已选中控件且上内边距大于 `0`，管理员按住上边控制条向外快速拖过页面空白或画出 iframe
- **THEN** 该边继续跟手，可减到 `0`，MUST NOT 停在半路（例如仍停在 `8`）

#### Scenario: Padding drag does not go negative
- **WHEN** 管理员在内边距拖动中把某边减到 `0` 以下
- **THEN** 该边停在 `0`，不写成负数

#### Scenario: Margin drag resists crossing below zero
- **WHEN** 已选中控件且外边距为 `0`，管理员向内拖过零点不足 `20` CSS 像素
- **THEN** 该边保持 `0`

#### Scenario: Margin drag can go negative after extra travel
- **WHEN** 已选中控件且外边距为 `0`，管理员向内多拖超过 `20` CSS 像素
- **THEN** 该边写成负数，超出部分扣掉这段阻力距离

#### Scenario: Drag is one undo step
- **WHEN** 管理员拖动改边距后再执行撤回
- **THEN** 四边恢复为这次拖动开始前的值

#### Scenario: Preview and locked versions ignore drag
- **WHEN** 管理员处于预览模式或当前版本不是草稿
- **THEN** `Ctrl+P` / `Ctrl+M` 与左键拖动都不改变内外边距

#### Scenario: Digit and arrow nudge padding
- **WHEN** 已选中控件且内边距面板已打开，上内边距为 `8`，管理员按住 `1` 并按 `ArrowUp`
- **THEN** 只有上内边距变成 `9`

#### Scenario: Holding arrow repeats every 100ms by 2px
- **WHEN** 已选中控件且内边距面板已打开，上内边距为 `8`，管理员按住 `1` 并按住 `ArrowUp` 超过 `100ms`
- **THEN** 上内边距先变成 `9`，之后每 `100ms` 再增加 `2`

#### Scenario: Digit maps radius corners
- **WHEN** 已选中控件且圆角面板已打开，左上圆角为 `0`，管理员按住 `1` 并按 `ArrowUp`
- **THEN** 只有左上圆角变成 `1`

#### Scenario: Left and right arrows do not nudge without all edges
- **WHEN** 已选中控件且内边距面板已打开，上内边距为 `8`，管理员按住 `1` 并按 `ArrowRight` 或 `ArrowLeft`
- **THEN** 上内边距仍为 `8`

#### Scenario: Arrow without digit does not nudge
- **WHEN** 已选中控件且内边距面板已打开，管理员未按数字键就按 `ArrowUp`
- **THEN** 四边内边距保持不变

#### Scenario: Digit 5 selects top and bottom
- **WHEN** 已选中控件且内边距面板已打开，四边内边距均为 `8`，管理员按住 `5` 并按 `ArrowUp`
- **THEN** 上、下内边距变成 `9`，左、右仍为 `8`，上下控制条呈黄色

#### Scenario: Digit 6 selects left and right
- **WHEN** 已选中控件且内边距面板已打开，四边内边距均为 `8`，管理员按住 `6` 并按 `ArrowUp`
- **THEN** 左、右内边距变成 `9`，上、下仍为 `8`，左右控制条呈黄色

#### Scenario: Digit 7 selects all handles for nudge
- **WHEN** 已选中控件且内边距面板已打开，四边内边距均为 `8`，管理员按住 `7` 并按 `ArrowUp`
- **THEN** 四边内边距均变成 `9`，四条控制条均呈黄色

#### Scenario: Digit 7 allows left and right arrows
- **WHEN** 已选中控件且内边距面板已打开，四边内边距均为 `8`，管理员按住 `7` 并按 `ArrowRight`
- **THEN** 四边内边距均变成 `9`

#### Scenario: Digit 5 maps radius diagonal
- **WHEN** 已选中控件且圆角面板已打开，四角均为 `0`，管理员按住 `5` 并按 `ArrowUp`
- **THEN** 左上与右下圆角变成 `1`，右上与左下仍为 `0`

#### Scenario: Numpad types the held edge value
- **WHEN** 已选中控件且内边距面板已打开，上内边距为 `8`，管理员按住主键盘 `1`，再依次按小键盘 `2`、`4`
- **THEN** 上内边距先变成 `2`，再变成 `24`，其余边不变

#### Scenario: Reholding starts a new numpad value
- **WHEN** 已选中控件且内边距面板已打开，管理员按住主键盘 `1` 并用小键盘输入 `24` 后松开，再按住 `1` 并按小键盘 `6`
- **THEN** 上内边距变成 `6`，MUST NOT 变成 `246`

#### Scenario: Numpad without a held edge does not type
- **WHEN** 已选中控件且内边距面板已打开，管理员未按 `1`–`7` 就按小键盘 `5`
- **THEN** 四边内边距保持不变

#### Scenario: Backspace deletes the last typed digit
- **WHEN** 已选中控件且内边距面板已打开，管理员按住主键盘 `1` 并用小键盘输入 `24`，再按 `Backspace`
- **THEN** 上内边距变成 `2`，该控件不被删除

#### Scenario: Minus starts a negative typed value
- **WHEN** 已选中控件且外边距面板已打开，管理员按住主键盘 `1`，再按 `-`，再按小键盘 `8`
- **THEN** 上外边距变成 `-8`

#### Scenario: Minus is ignored if the typed value is already negative
- **WHEN** 已选中控件且外边距面板已打开，管理员按住主键盘 `1` 并用小键盘输入 `-8` 后再按 `-`
- **THEN** 上外边距仍为 `-8`

#### Scenario: Minus without a held edge does not change style
- **WHEN** 已选中控件且外边距面板已打开，管理员未按选边键就按 `-`
- **THEN** 四边外边距保持不变

### Requirement: Canvas size drag
工作台编辑草稿且点击选中某一可设宽高的控件后，系统 SHALL 在气泡操纵栏提供尺寸分组入口，并接受修饰键加 `T` 立刻打开该分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开尺寸面板，MUST NOT 在该分组已打开时把它关掉，MUST `preventDefault` 以免浏览器打开新标签页。主窗口与 iframe 画布 MUST 都能识别。焦点在可编辑输入内时 MUST NOT 拦截。预览模式、非草稿版本、当前没有选中控件、或选中的是 `swiper-item` 时 MUST NOT 打开尺寸分组或改宽高。`swiper-item` 的气泡 MUST NOT 展示尺寸入口。

尺寸分组打开后，系统 MUST 在选中控件边框盒四边各叠加一条控制条：左、右 MUST 改宽度，上、下 MUST 改高度。控制条热区 MUST 明显大于可见细条。左右非零宽度 MUST 显示在对应边上，上下非零高度 MUST 显示在对应边上；边长放不下时 MUST 隐藏该数字。画布其余内容 MUST 被半透明遮罩盖住，选中控件本身 MUST 保持完全可见。选中控件右下角 MUST 有取消与确定；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件宽高恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。辅助线、控制条、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉辅助线与遮罩。

按住某条控制条拖动 SHALL 按指针位移改写对应维度，并 MUST 写入与气泡、检查器相同的 `width` / `height` 字段，模式 MUST 为像素。位移 MUST 按画布视觉缩放折算为 CSS 像素后按 `1` 步进写入整数（向 0 截断）。向外拖 MUST 增大，向内拖 MUST 减小。宽高 MUST 钳在大于等于 `0`。若拖动开始时该维未设置或不是像素（例如百分比），MUST 先按当前计算像素作为起点再写成像素。按下控制条后，指针移出热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写。未按住控制条时 MUST NOT 把控件上的左键拖动当成改尺寸。默认一次只改按住边对应的那一维。按住 `Alt` 时 MUST 把宽和高写成相同值（按下 `Alt` 或按住 `Alt` 抓住控制条时立刻对齐）；松开后保持该值。按住 `Shift` 时 MUST 吸附：先另一维的当前像素值（距目标 10px 内；按住 `Alt` 时 MUST 跳过这一步），否则落到最近的 5 的倍数，并显示磁铁图标；未按 `Shift` 时 MUST NOT 吸附。一次拖动 MUST 合并为一步撤回。中键平移 MUST 不受影响。

尺寸分组打开后，系统 SHALL 接受按住数字键 `1`–`3` 选择维度：`1` MUST 改宽度（左右控制条），`2` MUST 改高度（上下控制条），`3` MUST 同时改宽与高（四条控制条）。这些选维键 MUST 为主键盘数字行，MUST NOT 把小键盘当成选维，MUST NOT 把 `4`–`7` 当成尺寸选维。同一维度被多条边同时选中时，方向键与小键盘 MUST 对该维只施加一次增量，MUST NOT 把高度或宽度加两遍。按住数字的同时 `ArrowUp` MUST 立刻增加 `1` 像素，`ArrowDown` MUST 立刻减小 `1` 像素；未选中宽与高时 `ArrowLeft` / `ArrowRight` MUST NOT 改样式。按住 `3` 时 `ArrowUp` / `ArrowRight` MUST 同时增加宽和高，`ArrowDown` / `ArrowLeft` MUST 同时减小。长按方向键 MUST 每 `100ms` 步进 `2` 像素。按住选维键时，小键盘数字 MUST 把当前选中维度写成该次按住期间输入的整数值；`Backspace` MUST 删末位；`-` MUST NOT 把宽高写成负数。未选维时这些键 MUST NOT 改样式。按住数字时对应控制条 MUST 显示为黄色。`Tab` 切到兄弟后若上一控件已打开尺寸分组，新选中控件 MUST 仍打开尺寸分组（该兄弟为 `swiper-item` 时 MUST 关闭）。

#### Scenario: Shortcut opens size
- **WHEN** 已登录管理员在编辑草稿时选中一个文本控件并按下 `Ctrl+T` 或 `⌘+T`
- **THEN** 气泡立刻展开尺寸面板，选中控件上出现尺寸控制条，浏览器不打开新标签页

#### Scenario: Shortcut does not toggle closed
- **WHEN** 气泡尺寸面板已打开，管理员再次按下 `Ctrl+T`
- **THEN** 尺寸面板保持打开

#### Scenario: Swiper item has no size group
- **WHEN** 已登录管理员选中一个 `swiper-item` 并按下 `Ctrl+T`
- **THEN** 不展开尺寸分组，也不改该 item 的宽高

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

### Requirement: Canvas corner radius drag
工作台编辑草稿且圆角分组打开后，系统 MUST 在选中控件边框盒四角各叠加一条切线控制条（相对该角平分线旋转 90°，贴在圆角切线方向）。控制条热区 MUST 明显大于可见细条。按住某一角拖动 SHALL 按指针位移改写该角对应的 `WidgetStyle` 圆角字段（左上 `radiusTopLeft`、右上 `radiusTopRight`、右下 `radiusBottomRight`、左下 `radiusBottomLeft`），并 MUST 写入与气泡输入相同的字段。位移 MUST 按画布视觉缩放折算为 CSS 像素后，投影到该角向内的 45° 方向再按 `1` 步进写入整数（向 0 截断）。把该角往控件内部拖 MUST 增大圆角，往外拖 MUST 减小。未按住控制条时 MUST NOT 把控件上的左键拖动当成改圆角。圆角 MUST 钳在大于等于 `0`。按下控制条后，指针移出热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写该角。

默认 MUST 只改按住的那一角。按住 `Alt` 时 MUST 同时改全部四个角，写成与当前角相同的值（按下 `Alt` 或按住 `Alt` 抓住控制条时立刻对齐，MUST NOT 只改对角）；松开 `Alt` 后四角 MUST 保持松开瞬间的值，MUST NOT 恢复为按住 `Alt` 之前的值。拖动结果 MUST 仅在按住 `Shift` 时吸附，优先级为：先其它三角的当前值（距目标 10px 内；按住 `Alt` 时 MUST 跳过其它角吸附），否则落到最近的 5 的倍数；未按 `Shift` 时 MUST 按 `1` 步进的整数值写入，MUST NOT 吸附。按住 `Shift` 时 MUST 显示磁铁图标。

打开圆角分组时，画布其余内容 MUST 被半透明遮罩盖住，选中控件本身 MUST 保持完全可见。选中控件右下角 MUST 有取消（叉）与确定（勾）按钮；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件圆角恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。控制条、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉。拖动或输入改圆角时控制条旁数值 MUST 跟手更新。一次拖动 MUST 合并为一步撤回。预览模式或非草稿版本 MUST NOT 响应圆角拖动。工作台编辑草稿且已选中控件时，系统 SHALL 接受修饰键加 `R` 立刻打开圆角分组、修饰键加 `Shift` 加 `B` 立刻打开边框分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开对应面板，MUST NOT 在该分组已打开时把它关掉。主窗口与 iframe 画布 MUST 都能识别这些快捷键，并 MUST `preventDefault` 以免浏览器刷新或切换书签栏。焦点在可编辑输入内时 MUST NOT 拦截。当前没有选中控件、预览模式或非草稿版本时 MUST NOT 改变分组或样式。

#### Scenario: Radius handles appear on corners
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并打开圆角面板
- **THEN** 选中控件四角出现切线控制条，画布其余内容被遮罩盖住

#### Scenario: Drag inward increases a corner
- **WHEN** 已选中控件且圆角面板已打开，左上圆角为 `0`，管理员按住左上控制条向控件内拖动
- **THEN** 只有左上圆角增加，其余三角保持拖动开始时的值

#### Scenario: Drag outward decreases a corner
- **WHEN** 已选中控件且左上圆角为 `20`，管理员按住左上控制条向控件外拖动
- **THEN** 只有左上圆角减小，不小于 `0`

#### Scenario: Radius drag does not go negative
- **WHEN** 管理员在圆角拖动中把某角减到 `0` 以下
- **THEN** 该角停在 `0`，不写成负数

#### Scenario: Alt equalizes all corners
- **WHEN** 已选中控件且四角分别为 `4`、`8`、`12`、`16`，管理员按住 `Alt` 并按住左上控制条拖到左上为 `10`
- **THEN** 四个角都写成 `10`

#### Scenario: Releasing Alt keeps equal corners
- **WHEN** 管理员按住 `Alt` 把四角拖成相同值后松开 `Alt`（指针未再移动）
- **THEN** 四角仍为该值，MUST NOT 跳回按住 `Alt` 之前的数

#### Scenario: Shift snaps radius to another corner
- **WHEN** 已选中控件且右上圆角为 `12`、其余为 `0`，管理员按住 `Shift` 并按住左上控制条拖到约 `11`
- **THEN** 左上吸附为 `12`，并出现磁铁图标

#### Scenario: Radius drag snaps to multiples of five
- **WHEN** 已选中控件且四角均为 `0`，管理员按住 `Shift` 并按住左上控制条拖到约 `13`
- **THEN** 左上吸附为 `15`

#### Scenario: Confirm keeps radius edits
- **WHEN** 圆角已打开且管理员已拖动改过圆角，管理员点勾或按 `Enter`
- **THEN** 圆角保持拖动后的值，控制条、遮罩与按钮消失

#### Scenario: Cancel restores radius
- **WHEN** 圆角已打开且管理员已拖动改过圆角，管理员点叉或按 `Esc`
- **THEN** 该控件圆角恢复为打开分组前的值，控制条、遮罩与按钮消失

#### Scenario: Preview ignores radius drag
- **WHEN** 管理员处于预览模式或当前版本不是草稿
- **THEN** 左键拖动不改变圆角

#### Scenario: Shortcut opens radius
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并按下 `Ctrl+R` 或 `⌘+R`
- **THEN** 气泡立刻展开圆角面板，选中控件上出现圆角控制条，浏览器不刷新

#### Scenario: Shortcut opens border
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并按下 `Ctrl+Shift+B` 或 `⌘+Shift+B`
- **THEN** 气泡立刻展开边框面板，浏览器不切换书签栏

#### Scenario: Radius shortcut does not toggle closed
- **WHEN** 气泡圆角面板已打开，管理员再次按下 `Ctrl+R`
- **THEN** 圆角面板保持打开

#### Scenario: Group shortcut ignored without selection
- **WHEN** 当前没有选中控件，管理员按下 `Ctrl+R` 或 `Ctrl+Shift+B`
- **THEN** 不展开气泡分组，也不改任何控件样式

#### Scenario: Digit and arrow nudge a corner
- **WHEN** 已选中控件且圆角面板已打开，右上圆角为 `4`，管理员按住 `2` 并按 `ArrowDown`
- **THEN** 只有右上圆角变成 `3`

### Requirement: Canvas position drag
工作台编辑草稿且点击选中某一可定位控件后，系统 SHALL 在气泡操纵栏提供定位分组入口，并接受修饰键加 `L` 立刻打开该分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开定位面板，MUST NOT 在该分组已打开时把它关掉，MUST `preventDefault` 以免浏览器把焦点送到地址栏。主窗口与 iframe 画布 MUST 都能识别。焦点在可编辑输入内时 MUST NOT 拦截。预览模式、非草稿版本、当前没有选中控件、或选中的是 `swiper-item` 时 MUST NOT 打开定位分组或改定位与偏移。`swiper-item` 的气泡 MUST NOT 展示定位入口。

定位分组打开后，气泡 MUST 提供定位方式选择（静态 / 相对 / 绝对 / 固定 / 吸附）。定位非静态时，系统 MUST 在选中控件边框盒四边各叠加一条控制条：上、右、下、左分别改 `top` / `right` / `bottom` / `left`。定位为静态时 MUST NOT 叠加这些控制条，MUST NOT 用拖动或选边改偏移。定位非静态时，系统 MUST 画定位对齐辅助线，并铺满当前可见编辑区。相对定位的辅助线 MUST 穿过控件未偏移前的静态位置盒四边，规则与绝对相同：按生效边画该盒的上/下/左/右；某一方向没有生效边时 MUST 把该方向两条都画出来。绝对、固定与吸附 MUST 按布局真正生效的偏移边画出对应包含块边：`top` / `bottom` 为穿过包含块上边或下边的水平线，`left` / `right` 为穿过包含块左边或右边的竖直线。某一方向（上下或左右）没有生效边时，MUST 把该方向两条都画出来；只生效一条时 MUST 只画该条。已写入但未把控件拉到该边的偏移（例如同时写 `left` / `right`，宽度仍是 `fit-content` 或像素，元素没有被左右撑开，此时 `right` 被 `left` 覆盖）MUST 视为未生效，MUST NOT 画该边对齐线。相对同时写 `left` / `right` 或 `top` / `bottom` 时，对边同样视为被覆盖。吸附的四边只要已设置即视为生效。固定的包含块 MUST 为 375×667 屏幕区域；绝对的包含块 MUST 为定位祖先（无则页面根）；吸附的包含块 MUST 为页面内最近滚动盒，没有则同屏幕区域。辅助线 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML。静态时 MUST NOT 画原点辅助线。控制条热区 MUST 明显大于可见细条。每边非零像素值 MUST 显示在对应边上；边长放不下时 MUST 隐藏该数字。画布其余内容 MUST 被半透明遮罩盖住，选中控件本身 MUST 保持完全可见。选中控件右下角 MUST 有取消与确定；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件定位方式与四边偏移恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。辅助线、控制条、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉辅助线与遮罩。

按住某条控制条拖动 SHALL 按指针位移改写该边偏移，并 MUST 写入与气泡、检查器相同的字段。位移 MUST 按画布视觉缩放折算为 CSS 像素后按 `1` 步进写入整数（向 0 截断）。方向 MUST 使控件跟随指针：按住上边向上拖 MUST 减小 `top`，按住左边向左拖 MUST 减小 `left`，按住下边向下拖 MUST 减小 `bottom`，按住右边向右拖 MUST 减小 `right`。偏移可为负，但从非负拖进负数时 MUST 先停在 `0`，指针还需再越过约 `20` CSS 像素才写出负数（已为负则不再加这段阻力）。若拖动开始时该边未设置，MUST 先按该边相对包含块的当前计算像素作为起点再写入。按下控制条后，指针移出热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写。未按住控制条时 MUST NOT 把控件上的左键拖动当成改偏移。默认一次只改按住的那一边。按住 `Alt` 时 MUST 把对边写成与当前边相同的值；松开后保持该值。按住 `Shift` 时 MUST 吸附：先对边当前值（距目标 10px 内；按住 `Alt` 时 MUST 跳过对边吸附），再其余两边的值（同阈值），否则落到最近的 5 的倍数，并显示磁铁图标；未按 `Shift` 时 MUST NOT 吸附。一次拖动 MUST 合并为一步撤回。中键平移 MUST 不受影响。定位为静态时 MUST NOT 写入偏移。

定位分组打开且定位非静态时，系统 SHALL 接受按住数字键 `1`–`7` 选择边：`1` 上 / `2` 右 / `3` 下 / `4` 左，`5` 上下，`6` 左右，`7` 全部。定位为静态时这些选边键 MUST NOT 改偏移。这些选边键 MUST 为主键盘数字行，MUST NOT 把小键盘当成选边。按住数字的同时 `ArrowUp` MUST 立刻增加 `1` 像素，`ArrowDown` MUST 立刻减小 `1` 像素；未选中全部边时 `ArrowLeft` / `ArrowRight` MUST NOT 改样式。按住 `7`（或按住的键合起来覆盖四边）时 MUST 视为选中全部控制条，此时 `ArrowUp` / `ArrowRight` MUST 同时增加全部边，`ArrowDown` / `ArrowLeft` MUST 同时减小全部边。长按方向键 MUST 每 `100ms` 步进 `2` 像素。按住选边键时，小键盘数字 MUST 把当前选中边写成该次按住期间输入的整数值；`Backspace` MUST 删末位；`-` MUST 可作为负号。未选边时这些键 MUST NOT 改样式。按住数字时对应控制条 MUST 显示为黄色。`Tab` 切到兄弟后若上一控件已打开定位分组，新选中控件 MUST 仍打开定位分组（该兄弟为 `swiper-item` 时 MUST 关闭）。

#### Scenario: Origin axes for absolute
- **WHEN** 已选中控件、定位为绝对、四边都未设置，且定位面板已打开
- **THEN** 画布上出现穿过包含块上、下、左、右四边的辅助线

#### Scenario: Origin axes for relative
- **WHEN** 已选中控件、定位为相对、四边都未设置，且定位面板已打开
- **THEN** 画布上出现穿过该控件未偏移前静态位置上、下、左、右四边的辅助线

#### Scenario: Origin axes for relative follow static box
- **WHEN** 已选中控件、定位为相对并写了 `top` 与 `left`，且定位面板已打开
- **THEN** 辅助线穿过未偏移前静态位置的上边与左边，而不是当前边框盒上左；下边与右边因该方向已有生效边而不画

#### Scenario: Origin axes for fixed
- **WHEN** 已选中控件、定位为固定且仅 `bottom` 有值，且定位面板已打开
- **THEN** 画布出现穿过屏幕下边的水平辅助线，以及穿过屏幕左边和右边的竖直辅助线，MUST NOT 只画屏幕上左

#### Scenario: Origin axes for sticky
- **WHEN** 已选中控件、定位为吸附且仅 `top` 有值，且定位面板已打开
- **THEN** 画布出现穿过包含块上边的水平辅助线，以及该方向未设置时的左、右两边竖直辅助线

#### Scenario: Origin axes hide unused overconstrained edge
- **WHEN** 已选中控件、定位为绝对，`left` 与 `right` 都有值，但控件宽度没有被这两边撑开，且定位面板已打开
- **THEN** 画布出现穿过包含块左边的竖直辅助线，MUST NOT 出现穿过包含块右边的竖直辅助线

#### Scenario: Shortcut opens position
- **WHEN** 已登录管理员在编辑草稿时选中一个定位为相对的文本控件并按下 `Ctrl+L` 或 `⌘+L`
- **THEN** 气泡立刻展开定位面板，选中控件上出现四边控制条，浏览器不把焦点送到地址栏

#### Scenario: Static shortcut has no inset handles
- **WHEN** 已登录管理员在编辑草稿时选中一个定位为静态的文本控件并按下 `Ctrl+L`
- **THEN** 气泡立刻展开定位面板，选中控件上不出现四边控制条，也不改偏移

#### Scenario: Shortcut does not toggle closed
- **WHEN** 气泡定位面板已打开，管理员再次按下 `Ctrl+L`
- **THEN** 定位面板保持打开

#### Scenario: Swiper item has no position group
- **WHEN** 已登录管理员选中一个 `swiper-item` 并按下 `Ctrl+L`
- **THEN** 不展开定位分组，也不改该 item 的定位或偏移

#### Scenario: Drag top moves the widget up
- **WHEN** 已选中控件、定位为相对、定位面板已打开，且 `top` 为 `10`，管理员按住上边控制条向上拖 `8` CSS 像素
- **THEN** `top` 变成 `2`，其余三边保持拖动开始时的值

#### Scenario: Unset inset starts from computed pixels
- **WHEN** 已选中控件、定位为绝对、未设置 `left`，该边相对包含块的计算偏移为 `40px`，管理员打开定位面板并按住左边控制条向左拖 `4` CSS 像素
- **THEN** `left` 写成 `36` 像素

#### Scenario: Digit 1 nudges top
- **WHEN** 已选中控件且定位面板已打开，`top` 为 `8`，管理员按住 `1` 并按 `ArrowUp`
- **THEN** 只有 `top` 变成 `9`，上边控制条呈黄色

#### Scenario: Digit 4 nudges left
- **WHEN** 已选中控件且定位面板已打开，`left` 为 `8`，管理员按住 `4` 并按 `ArrowUp`
- **THEN** 只有 `left` 变成 `9`，左边控制条呈黄色

#### Scenario: Numpad types the held edge
- **WHEN** 已选中控件且定位面板已打开，管理员按住主键盘 `1`，再依次按小键盘 `1`、`2`
- **THEN** `top` 先变成 `1`，再变成 `12`，其余边不变

#### Scenario: Confirm keeps position edits
- **WHEN** 定位已打开且管理员已把定位改为绝对并拖过 `top`，管理员点勾或按 `Enter`
- **THEN** 定位与偏移保持改后的值，辅助线、遮罩与按钮消失

#### Scenario: Cancel restores position
- **WHEN** 定位已打开且管理员已把定位改为固定并拖过 `top`，管理员点叉或按 `Esc`
- **THEN** 该控件定位方式与四边偏移恢复为打开分组前的值，辅助线、遮罩与按钮消失

#### Scenario: Tab keeps the position group
- **WHEN** 已登录管理员在编辑草稿时已打开定位分组并改了当前控件 `top`，再按 `Tab` 切到可定位的兄弟
- **THEN** 上一控件的 `top` 保持改后的值，新选中控件上定位分组仍打开

#### Scenario: Preview ignores position drag
- **WHEN** 管理员处于预览模式或当前版本不是草稿
- **THEN** `Ctrl+L` 与左键拖动都不改变定位或偏移

### Requirement: Canvas rotation drag
工作台编辑草稿且点击选中某一控件后，系统 SHALL 在气泡操纵栏提供旋转分组入口，并接受修饰键加 `Shift+R` 立刻打开该分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开旋转面板，MUST NOT 在该分组已打开时把它关掉，MUST `preventDefault` 以免浏览器强制刷新。主窗口与 iframe 画布 MUST 都能识别。焦点在可编辑输入内时 MUST NOT 拦截。预览模式、非草稿版本或当前没有选中控件时 MUST NOT 打开旋转分组或改旋转。`swiper-item` MUST 仍可打开该分组。

旋转分组打开后，气泡 MUST 提供 X / Y / Z 三轴角度输入，每轴 MUST 可选择单位 `deg`（默认）/ `rad` / `grad` / `turn`。系统 MUST 在选中控件边框盒外叠加三轴操纵环：X 为绕水平轴、Y 为绕竖直轴、Z 为绕垂直于屏幕的轴。画布其余内容 MUST 被半透明遮罩盖住，选中控件本身 MUST 保持完全可见。选中控件右下角 MUST 有取消与确定；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件三轴旋转恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。操纵环、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉操纵环与遮罩。

按住某一操纵环拖动 SHALL 只改该环对应轴，并 MUST 写入与气泡、检查器相同的字段。未按住环时在遮罩上拖动 MUST 改 Z 轴。按住主键盘 `1` / `2` / `3` 时，拖动 MUST 只改对应轴：`1` 为 Z，`2` 为 X（绕水平方向），`3` 为 Y（绕竖直方向）。位移 MUST 按画布视觉缩放折算；Z 轴 MUST 按指针相对控件中心的角位移写入，X 轴 MUST 按竖直位移写入（上为正），Y 轴 MUST 按水平位移写入（右为正）。当前单位为 `deg` 或 `grad` 时 MUST 按 `1` 步进写入（向 0 截断）；为 `rad` 或 `turn` 时 MUST 按 `0.01` 步进。按下环或开始拖动后，指针移出热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写。未按住环且未按住 `1`–`3` 开始的左键拖动 MUST NOT 在未拖动遮罩时改其它轴。按住 `Shift` 时 MUST 吸附到 `15deg` 的等价角度并显示磁铁图标；未按 `Shift` 时 MUST NOT 吸附。一次拖动 MUST 合并为一步撤回。中键平移 MUST 不受影响。

旋转分组打开后，系统 SHALL 接受按住数字键 `1`–`3` 选择轴：`1` MUST 改 Z，`2` MUST 改 X，`3` MUST 改 Y。这些选轴键 MUST 为主键盘数字行，MUST NOT 把小键盘当成选轴，MUST NOT 把 `4`–`7` 当成旋转选轴。可同时按住多个数字，方向键 MUST 对当前选中的每一轴施加同一增量。按住数字的同时 `ArrowUp` MUST 立刻增加一步，`ArrowDown` MUST 立刻减小一步；`ArrowLeft` / `ArrowRight` MUST NOT 改旋转。长按方向键 MUST NOT 使用系统按键重复，MUST 每 `100ms` 再触发一次，每次步进两倍（`deg` / `grad` 为 `2`，`rad` / `turn` 为 `0.02`）。未按住选轴键时方向键 MUST NOT 改旋转。按住选轴键时，小键盘数字 MUST 把当前选中轴写成该次按住期间输入的数值：每按一位 MUST 立刻写入；`Backspace` MUST 删掉最后一位并立刻写入（删空则写成 `0`），MUST NOT 删除控件；`.` MUST 作为小数点；`-` MUST 作为负号。松开全部选轴键后再按住 MUST 清空这次输入。未选轴时小键盘数字、`Backspace` 与 `-` MUST NOT 改旋转。按住数字时对应操纵环 MUST 显示为黄色。焦点在可编辑输入内时 MUST NOT 拦截。`Tab` 切到兄弟后若上一控件已打开旋转分组，新选中控件 MUST 仍打开旋转分组。

#### Scenario: Shortcut opens rotation
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并按下 `Ctrl+Shift+R` 或 `⌘+Shift+R`
- **THEN** 气泡立刻展开旋转面板，选中控件上出现三轴操纵环，浏览器不强制刷新

#### Scenario: Shortcut does not toggle closed
- **WHEN** 气泡旋转面板已打开，管理员再次按下 `Ctrl+Shift+R`
- **THEN** 旋转面板保持打开

#### Scenario: No selection ignores shortcut
- **WHEN** 当前没有选中控件，管理员按下 `Ctrl+Shift+R`
- **THEN** 不打开旋转分组，也不改任何控件样式

#### Scenario: Swiper item can open rotation
- **WHEN** 已登录管理员选中一个 `swiper-item` 并按下 `Ctrl+Shift+R`
- **THEN** 展开旋转分组，该 item 上出现三轴操纵环

#### Scenario: Drag Z ring spins in plane
- **WHEN** 已选中控件且旋转面板已打开，绕 Z 轴为 `0deg`，管理员按住 Z 环相对控件中心顺时针拖过 `30` 度
- **THEN** `rotate-z` 写成 `30deg`，X 与 Y 不变

#### Scenario: Drag without ring rotates Z
- **WHEN** 已选中控件且旋转面板已打开，绕 Z 轴为 `0deg`，管理员未按数字键、在遮罩上拖出相对中心 `20` 度
- **THEN** `rotate-z` 写成 `20deg`

#### Scenario: Hold 2 and drag rotates X
- **WHEN** 已选中控件且旋转面板已打开，绕 X 轴为 `0deg`，管理员按住 `2` 并向上拖 `10` CSS 像素
- **THEN** `rotate-x` 写成 `10deg`，Y 与 Z 不变，X 环呈黄色

#### Scenario: Hold 3 and drag rotates Y
- **WHEN** 已选中控件且旋转面板已打开，绕 Y 轴为 `0deg`，管理员按住 `3` 并向右拖 `12` CSS 像素
- **THEN** `rotate-y` 写成 `12deg`，X 与 Z 不变

#### Scenario: Digit 1 nudges Z
- **WHEN** 已选中控件且旋转面板已打开，绕 Z 轴为 `10deg`，管理员按住 `1` 并按 `ArrowUp`
- **THEN** 绕 Z 轴变成 `11deg`，X 与 Y 不变，Z 环呈黄色

#### Scenario: Digit 2 nudges X
- **WHEN** 已选中控件且旋转面板已打开，绕 X 轴为 `0deg`，管理员按住 `2` 并按 `ArrowDown`
- **THEN** 绕 X 轴变成 `-1deg`，Y 与 Z 不变

#### Scenario: Digit 3 nudges Y
- **WHEN** 已选中控件且旋转面板已打开，绕 Y 轴为 `5deg`，管理员按住 `3` 并按 `ArrowUp`
- **THEN** 绕 Y 轴变成 `6deg`，X 与 Z 不变

#### Scenario: Arrows without digit do nothing
- **WHEN** 已选中控件且旋转面板已打开，管理员未按住 `1`–`3` 时按 `ArrowUp`
- **THEN** 三轴旋转均不变

#### Scenario: Numpad types Z angle
- **WHEN** 已选中控件且旋转面板已打开，管理员按住主键盘 `1`，再依次按小键盘 `4`、`5`
- **THEN** 绕 Z 轴先变成 `4deg`，再变成 `45deg`

#### Scenario: Bubble can type an angle
- **WHEN** 已选中控件且旋转面板已打开，管理员在气泡把绕 X 轴写成 `30`、单位保持 `deg`
- **THEN** 预览立即按 `rotateX(30deg)` 更新，检查器显示相同值

#### Scenario: Shift snaps to 15 degrees
- **WHEN** 已选中控件且绕 Z 轴为 `0deg`，管理员按住 `Shift` 并把 Z 环拖到约 `16` 度
- **THEN** 绕 Z 轴吸附为 `15deg`，并出现磁铁图标

#### Scenario: Confirm keeps rotate edits
- **WHEN** 旋转已打开且管理员已拖动改过绕 Z 轴，管理员点勾或按 `Enter`
- **THEN** 绕 Z 轴保持拖动后的值，操纵环、遮罩与按钮消失

#### Scenario: Cancel restores rotate
- **WHEN** 旋转已打开且管理员已拖动改过绕 Z 轴，管理员点叉或按 `Esc`
- **THEN** 该控件三轴旋转恢复为打开分组前的值，操纵环、遮罩与按钮消失

#### Scenario: Tab keeps the rotation group
- **WHEN** 已登录管理员在编辑草稿时已打开旋转分组并改了当前控件绕 Z 轴，再按 `Tab` 切到兄弟
- **THEN** 上一控件的绕 Z 轴保持改后的值，新选中控件上旋转分组仍打开

#### Scenario: Preview ignores rotation drag
- **WHEN** 管理员处于预览模式或当前版本不是草稿
- **THEN** `Ctrl+Shift+R` 与左键拖动都不改变旋转

### Requirement: Copy field i18n picker
文本控件的 `value` 与按钮控件的 `text` 输入框 SHALL 允许填写 `$t("分组键.文案键")` 以引用工程语言库中的某条文案。这些输入框后方 MUST 提供地球按钮；点击后 MUST 弹出选择器，列出当前工程的分组与文案键。选中某一文案后 MUST 把该输入框的值写成 `$t("分组键.文案键")`。预览模式或非草稿版本时，地球按钮 MUST 不可写入。

#### Scenario: Picker writes t expression
- **WHEN** 已登录管理员在编辑草稿时打开某文本的文案输入，点击地球按钮并选择分组 `common` 的键 `ok`
- **THEN** 该文本的 `value` 变为 `$t("common.ok")`，子窗口按当前预览语言展示对应译文

#### Scenario: Manual t expression is accepted
- **WHEN** 已登录管理员在编辑草稿时把某按钮的 `text` 写成 `$t("home.title")`
- **THEN** 系统保存该表达式，子窗口按当前预览语言展示 `home.title` 的译文

#### Scenario: Picker is read-only when locked
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿，并查看文本文案输入
- **THEN** 地球按钮不可把文案改成 `$t(...)` 表达式

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

### Requirement: Page inspector when no widget selected
工作台 MUST NOT 再用独立右侧栏展示控件或页面属性。未选中任何控件时，画布右上角 SHALL 提供设置入口；点击后 MUST 弹出页面属性弹窗，展示当前页面的背景与内边距。选中某一控件后，同一设置入口 MUST 改为弹出该控件的属性。点击画布上控件以外的页面区域 MUST 取消控件选中。预览模式或非草稿版本时，页面属性 MUST 只读，MUST NOT 被编辑。编辑草稿时修改这些字段后，子窗口 MUST 立即按更新后的 XML 重新渲染，且不必先保存版本。

#### Scenario: Empty selection shows page properties
- **WHEN** 已登录管理员已选中一个页面且当前没有选中任何控件，并点击画布右上角设置图标
- **THEN** 弹出页面属性弹窗，展示页面的背景与内边距，而不是「未选中控件」空状态

#### Scenario: Clicking empty canvas opens page inspector
- **WHEN** 已登录管理员在编辑态点击 iframe 内控件以外的页面区域
- **THEN** 控件选中被取消，画布右上角设置入口可打开页面属性弹窗

#### Scenario: Selecting a widget restores widget inspector
- **WHEN** 已登录管理员在页面属性弹窗可见时选中一个控件
- **THEN** 弹窗改为该控件的属性，不再展示页面背景与内边距编辑入口

#### Scenario: Page style edit updates preview
- **WHEN** 已登录管理员在编辑草稿时修改页面背景或内边距
- **THEN** 子窗口立即按新的背景与内边距渲染，且不必先保存版本

#### Scenario: Page style is read-only when locked
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿，且未选中任何控件
- **THEN** 仍可通过设置入口查看页面背景与内边距，但不可编辑

### Requirement: Workbench header compact actions
工程编辑页顶栏 SHALL 使用小号按钮展示返回首页、显示版本（版本栏收起时）与保存，且每个按钮 MUST 带图标。左侧窄栏 SHALL 提供语言库图标入口。语言库入口 MUST 在已打开工程时可用，MUST NOT 因为尚未选中页面或版本而禁用。

#### Scenario: Header buttons are compact with icons
- **WHEN** 已登录管理员打开工程编辑页
- **THEN** 顶栏的返回首页、保存按钮为小号并带图标

#### Scenario: Language library available without page
- **WHEN** 已登录管理员打开尚无页面的工程编辑页
- **THEN** 语言库入口仍可用

### Requirement: Workbench language library dialog
工作台 SHALL 允许已登录管理员从左侧窄栏打开工程语言库面板。面板上部 MUST 列出当前工程语言，项 MUST 包括名称、键与排列方向（`LTR`、`RTL`），MUST 能新增、编辑与删除语言。面板下部 MUST 用 tab 展示分组，MUST 能新增分组；每个分组 MUST 用表格展示文案，列 MUST 为已声明语言，行 MUST 为该分组内的文案键，单元格 MUST 为对应译文。MUST 能新增文案键并编辑各语言译文。同一工程内各页面 MUST 看到同一份语言库。修改语言库后 MUST 立即写入工程数据库，MUST NOT 写入页面 XML，MUST NOT 要求先保存页面版本。

#### Scenario: Panel shows project languages then groups
- **WHEN** 已登录管理员打开一份已有两种语言与一个分组的工程语言库
- **THEN** 面板先展示这两种语言的名称、键与方向，下方 tab 展示该分组，表格列为这两种语言、行为该分组的文案键

#### Scenario: Add language writes database
- **WHEN** 已登录管理员在语言库中新增一种 `key` 为 `en`、`dir` 为 `ltr` 的语言
- **THEN** 工程语言表出现对应语言，各分组表格增加一列 `en`，当前页面 XML 不出现 `<i18n>`

#### Scenario: Add group and entry writes database
- **WHEN** 已登录管理员在语言库中新增分组 `home`，并在其中新增文案键 `title`、为当前语言填写译文「首页」
- **THEN** 工程文案表出现分组 `home` 与文案 `title`，且对应语言的译文为「首页」

#### Scenario: Duplicate language key is rejected
- **WHEN** 已登录管理员把某语言键改成工程中已存在的另一个语言键
- **THEN** 系统拒绝这次改键，原语言键与数据库保持不变

#### Scenario: Pages share the same catalog
- **WHEN** 已登录管理员在页面 A 的语言库中新增语言 `en`，再打开同一工程的页面 B
- **THEN** 页面 B 的语言库与画布地球下拉也能看到 `en`

### Requirement: Workbench layout data events tabs
工程编辑页中间预览卡片 SHALL 用「布局 / 数据 / 事件」三个 tab 替换原标题栏屏幕宽度输入。布局 tab MUST 展示现有画布（缩放、还原、编辑/预览），画布屏幕 MUST 固定为宽 375px、高 667px，工作台 MUST NOT 再提供改宽入口。数据 tab MUST 展示当前页面变量列表。事件 tab MUST 展示空态，MUST NOT 在本期提供事件编辑。切换 tab MUST NOT 丢弃当前草稿中的控件、页面样式、变量，也 MUST NOT 丢弃工程语言库。无选中页面时，三个 tab MUST 仍可见但内容按现有空页面态处理。

#### Scenario: Screen width control is gone
- **WHEN** 已登录管理员打开工程编辑页并选中一个页面
- **THEN** 中间卡片标题栏不再出现屏幕宽度输入，也不再显示可编辑的「375 px × 667px」

#### Scenario: Layout tab shows fixed canvas
- **WHEN** 已登录管理员停留在布局 tab
- **THEN** 中间区域展示画布，页面屏幕宽 375px、高 667px，且仍可缩放、还原与切换编辑/预览

#### Scenario: Data tab shows variable list
- **WHEN** 已登录管理员切换到数据 tab
- **THEN** 中间区域展示页面变量列表，而不再展示画布

#### Scenario: Events tab is empty
- **WHEN** 已登录管理员切换到事件 tab
- **THEN** 中间区域展示空态，且没有可保存的事件配置入口

#### Scenario: Switching tabs keeps draft
- **WHEN** 已登录管理员在数据 tab 新增一个变量后再切回布局 tab
- **THEN** 该变量仍在当前草稿中，画布仍按同一份 XML 预览

#### Scenario: Switching tabs keeps i18n
- **WHEN** 已登录管理员在语言库中新增一种语言后再切换布局/数据/事件 tab
- **THEN** 该语言仍在工程语言库中，地球下拉框仍能选到它

### Requirement: Canvas preview language
工程编辑页中间画布卡片标题栏右侧 SHALL 提供地球下拉框，选项 MUST 为当前工程语言库中的语言，用于选择当前预览语言。无语言时 MUST 不提供可选项，页面按 LTR 渲染。切换当前预览语言 MUST 立即按该语言重新渲染子窗口，MUST NOT 改写 XML 中的控件文案，MUST NOT 进入撤回历史。切换页面后，若工程仍有相同语言键 MUST 保持该选择，否则 MUST 落到工程的第一种语言。

#### Scenario: Globe lists project languages
- **WHEN** 已登录管理员打开一份含 `zh` 与 `ar` 两种工程语言的页面
- **THEN** 画布标题栏右侧地球下拉框列出这两种语言

#### Scenario: Switching language updates preview without saving
- **WHEN** 已登录管理员将当前预览语言从 `zh` 改为 `ar`，且某文本的 `value` 为 `$t("common.ok")`
- **THEN** 子窗口立即展示 `ar` 下该键的译文，XML 中该 `value` 仍为 `$t("common.ok")`

#### Scenario: Language switch is not undoable
- **WHEN** 已登录管理员只切换了当前预览语言，然后执行撤回
- **THEN** 当前预览语言不变，控件树与语言库也不变

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

### Requirement: Render catalog is supplied by host
公共渲染能力 SHALL 接受宿主提供的当前语言键与语言目录（语言列表、方向与译文），MUST NOT 从页面 XML 读取语言库。工作台预览 MUST 把数据库中的当前工程语言库交给渲染；H5 MUST 把已加载的发布 JSON 交给渲染。

#### Scenario: Preview uses live project catalog
- **WHEN** 已登录管理员将某文本设为 `$t("common.ok")`，并在工程语言库把 `zh` 下该键改为「好的」
- **THEN** 子窗口立即展示「好的」，且页面 XML 中该 `value` 仍为 `$t("common.ok")`

#### Scenario: Xml i18n node is ignored
- **WHEN** 页面 XML 的 `page` 根下仍包含旧的 `<i18n>` 元素
- **THEN** 系统仍成功解析控件，不把该节点当控件，也不把它当作当前语言库

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

### Requirement: Page direction follows language
公共渲染能力 SHALL 把页面根排列方向设为当前语言的 `dir`。当前语言为 `rtl` 时，页面 MUST 以从右到左排列；为 `ltr` 或没有语言时 MUST 以从左到右排列。该方向 MUST 作用于页面内联排版与弹性容器的起止边，MUST NOT 改写 XML 中已保存的 `flex-direction` 或其他物理边距属性。管理后台 iframe 预览与 H5 在相同当前语言下 MUST 使用相同方向。

#### Scenario: Rtl language flips page direction
- **WHEN** 当前预览语言的 `dir` 为 `rtl`，页面含一个 `flex-direction` 为 `row` 的弹性盒
- **THEN** 子窗口页面为从右到左，该弹性盒的主轴起点在右侧，且 XML 中的 `flex-direction` 仍为 `row`

#### Scenario: Ltr language uses left to right
- **WHEN** 当前预览语言的 `dir` 为 `ltr`，或页面没有语言库
- **THEN** 子窗口页面为从左到右

### Requirement: Render flex container from xml
公共渲染能力 SHALL 把每个 `flex` 渲染为 CSS 弹性容器，其子控件 MUST 按 XML 声明顺序成为该容器的弹性项目。空弹性盒 MUST 仍出现在渲染结果中。容器属性与项目属性 MUST 映射为对应 CSS。管理后台 iframe 预览与 H5 独立运行时 MUST 对同一份含 `flex` 的合法 XML 渲染出相同的嵌套结构与弹性布局。

#### Scenario: Preview shows nested flex children
- **WHEN** 当前 XML 含一个 `flex-direction` 为 `row` 的弹性盒，其内依次为文案「左」的文本与标签「右」的按钮
- **THEN** 子窗口将该二者作为同一弹性容器的子项，按声明顺序排列，且容器主轴为水平方向

#### Scenario: Empty flex still renders
- **WHEN** 当前 XML 只包含一个没有子控件的合法 `flex`
- **THEN** 子窗口展示该弹性容器，且不展示文本或按钮控件

#### Scenario: Same flex xml matches in admin preview and h5
- **WHEN** 同一份含嵌套弹性盒及容器/项目属性的合法页面 XML 分别在管理后台预览页与 H5 运行时中渲染
- **THEN** 两处的控件嵌套顺序与弹性布局属性一致

### Requirement: Render swiper from xml
公共渲染能力 SHALL 把每个 `swiper` 渲染为滑动器，其子 `swiper-item` MUST 按 XML 声明顺序成为幻灯片。空滑动器与空 item MUST 仍出现在渲染结果中。在非编辑态（工作台预览模式与 H5 独立运行时），系统 MUST 按滑动器属性展示当前屏：`current` 超出 item 数量时 MUST 落到最后一页（没有 item 时不切换）；`display-multiple-items` 大于 1 时 MUST 同时露出对应数量的 item；`circular` 为真且 item 不少于 2 个时 MUST 可循环；`autoplay` 为真时 MUST 按 `interval` 自动切换，切换动画时长为 `duration`；`indicator-dots` 为真且存在 item 时 MUST 显示指示点，颜色分别使用 `indicator-color` 与 `indicator-active-color`；`vertical` 为真时 MUST 沿垂直方向切换。管理后台非编辑预览与 H5 MUST 对同一份含 `swiper` 的合法 XML 渲染出相同的嵌套结构与轮播属性。

#### Scenario: Preview shows current slide
- **WHEN** 当前 XML 含一个有三个 `swiper-item`、`current` 为 `1` 的滑动器，且工作台处于预览模式
- **THEN** 子窗口展示第二个 item 为当前屏，不把三个 item 同时并排铺开

#### Scenario: Empty swiper still renders
- **WHEN** 当前 XML 只包含一个没有 item 的合法 `swiper`
- **THEN** 子窗口展示该滑动器容器，且不展示幻灯片内容

#### Scenario: Same swiper xml matches in admin preview and h5
- **WHEN** 同一份含滑动器、item 及滑动器属性的合法页面 XML 分别在管理后台预览模式与 H5 运行时中渲染
- **THEN** 两处的控件嵌套顺序与轮播属性一致，且都不展示编辑态下的 item 描边或全部展开布局

### Requirement: Edit mode shows every swiper item
工作台处于编辑模式时，滑动器 SHALL 同时展示其全部 `swiper-item`，MUST NOT 只显示当前屏、MUST NOT 自动播放、MUST NOT 因轮播裁剪而隐藏未激活 item。水平滑动器的 item MUST 在容器内并排可见；`vertical` 为真时 MUST 纵向堆叠可见。空 item MUST 仍占据可见占位，并带有仅编辑态存在的描边，该描边 MUST NOT 写入 XML，也 MUST NOT 出现在预览模式或 H5。切换到预览模式后，同一滑动器 MUST 恢复为只展示当前屏的轮播行为。

#### Scenario: Edit mode lays out all items
- **WHEN** 已登录管理员处于编辑模式，当前 XML 含一个有三个空 `swiper-item` 的水平滑动器
- **THEN** 子窗口同时展示这三个 item，它们在滑动器内并排可见，且每个空 item 都有可见描边与占位

#### Scenario: Edit mode follows vertical
- **WHEN** 已登录管理员处于编辑模式，将某滑动器的 `vertical` 设为开启
- **THEN** 子窗口把全部 item 纵向堆叠展示，而不是并排

#### Scenario: Preview mode hides the edit layout
- **WHEN** 已登录管理员从编辑模式切换到预览模式，且该滑动器有多个 item
- **THEN** 子窗口不再并排展开全部 item，改为按当前屏轮播，且空 item 的编辑描边消失

### Requirement: Live preview after widget edits
工作台 SHALL 允许为当前页面添加 `text`、`button`、`flex` 或 `swiper`，并编辑已有文本/按钮的文案、弹性盒的容器与项目属性以及滑动器属性。每次有效编辑后，子窗口 MUST 用更新后的 XML 重新渲染，且不必要求先保存为新版本。

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

#### Scenario: Editing widget copy updates preview
- **WHEN** 已登录管理员修改已有文本的 `value` 或已有按钮的 `text` 并应用到当前 XML
- **THEN** 子窗口展示修改后的文案

#### Scenario: Editing flex properties updates preview
- **WHEN** 已登录管理员修改已有弹性盒的容器属性或其中子控件的项目属性并应用到当前 XML
- **THEN** 子窗口按更新后的弹性布局重新渲染

#### Scenario: Editing swiper properties updates preview
- **WHEN** 已登录管理员修改已有滑动器的 `autoplay`、`circular` 或 `vertical` 并应用到当前 XML
- **THEN** 子窗口按更新后的滑动器属性重新渲染

### Requirement: Add nested widgets from workbench
工作台 SHALL 允许为当前页面添加 `flex` 与 `swiper`。若当前选中控件是 `flex`，新添加的 `text`、`button`、`flex` 或 `swiper` MUST 成为该弹性盒的最后一个子控件。若当前选中控件是 `swiper` 或 `swiper-item`，新控件 MUST 按「Add swiper from workbench」的插入规则进入对应滑动器树。否则新控件 MUST 成为页面根的最后一个子控件（`swiper-item` 除外）。控件树 MUST 按嵌套层级展示容器及其子控件，而不是把所有控件列成一层。

#### Scenario: Adding a flex widget updates tree and preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个弹性盒
- **THEN** 控件树出现该弹性盒，子窗口渲染出对应的弹性容器

#### Scenario: Adding a child into selected flex
- **WHEN** 已登录管理员选中一个已有弹性盒后添加一个文本控件
- **THEN** 该文本成为该弹性盒的子控件，出现在控件树的对应层级下，且子窗口在该弹性盒内展示该文案

#### Scenario: Adding a swiper into selected flex
- **WHEN** 已登录管理员选中一个已有弹性盒后添加一个滑动器
- **THEN** 该滑动器成为该弹性盒的子控件，出现在控件树的对应层级下

#### Scenario: Adding a widget without a flex selected
- **WHEN** 已登录管理员未选中弹性盒（或选中的是非容器控件）后添加一个按钮
- **THEN** 该按钮成为页面根的最后一个控件，而不是某个弹性盒的子控件

### Requirement: Add swiper from workbench
工作台 SHALL 允许为当前页面添加 `swiper` 与 `swiper-item`。新添加的 `swiper` MUST 带有 3 个空的 `swiper-item`。若当前选中控件是 `swiper`，新添加的 `swiper-item` MUST 成为其最后一个 item；新添加的 `text`、`button`、`flex` 或 `swiper` MUST 成为其最后一个 item 的子控件（若尚无 item 则先创建一个空 item 再放入）。若当前选中控件是 `swiper-item`，新添加的 `swiper-item` MUST 成为该 item 的下一个兄弟；新添加的 `text`、`button`、`flex` 或 `swiper` MUST 成为该 item 的最后一个子控件。若当前选中控件是 `flex`，新添加的 `swiper` MUST 成为该弹性盒的最后一个子控件。`swiper-item` MUST NOT 被添加到页面根或 `flex` 下。控件树 MUST 按嵌套层级展示滑动器、item 及其子控件。

#### Scenario: Adding a swiper creates three items
- **WHEN** 已登录管理员在工作台为当前页面添加一个滑动器
- **THEN** 控件树出现该滑动器及其 3 个空 item，子窗口在编辑态同时展示这 3 个 item

#### Scenario: Adding an item into selected swiper
- **WHEN** 已登录管理员选中一个已有滑动器后添加一个 `swiper-item`
- **THEN** 该 item 成为该滑动器的最后一个子控件，出现在控件树对应层级下，且编辑态子窗口展示出新增的一页

#### Scenario: Adding content into selected item
- **WHEN** 已登录管理员选中一个 `swiper-item` 后添加一个文本控件
- **THEN** 该文本成为该 item 的子控件，出现在控件树对应层级下，且子窗口在该 item 内展示该文案

#### Scenario: Adding a widget without a swiper selected
- **WHEN** 已登录管理员未选中滑动器或 item（或选中的是文本/按钮）后添加一个滑动器
- **THEN** 该滑动器成为页面根的最后一个控件，而不是某个已有滑动器的子控件

### Requirement: Preview follows selected version
选中某一页面版本后，子窗口 SHALL 渲染该版本对应的页面。若该草稿版本在本机存在尚未提交到服务器的草稿，预览 MUST 使用该本机草稿；否则 MUST 使用服务器上该版本的 XML。将某版本设为当前在用后，在未做未保存编辑且无本机未提交草稿的前提下，预览 MUST 与该版本 XML 一致。

#### Scenario: Selecting a version previews its xml
- **WHEN** 已登录管理员选中某页面的一个已有版本，且该版本没有未提交的本机草稿
- **THEN** 子窗口按该版本服务器上的 XML 渲染文本与按钮

#### Scenario: Selecting a version restores local draft
- **WHEN** 已登录管理员选中某草稿版本，且本机存在该版本相对上次成功保存的未提交草稿
- **THEN** 子窗口按本机草稿 XML 渲染

### Requirement: Invalid xml preview feedback
当工作台向子窗口提供的 XML 无效时，子窗口 SHALL 展示错误状态，MUST NOT 继续展示上一份有效页面并假装当前 XML 有效。

#### Scenario: Invalid xml shows error in iframe
- **WHEN** 子窗口收到无法解析为合法页面的 XML
- **THEN** 子窗口展示错误反馈，且不渲染出文本或按钮控件

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

### Requirement: H5 standalone runtime
H5 应用 SHALL 作为独立运行时宿主使用公共渲染能力展示页面控件。H5 MUST NOT 提供工程/页面/版本工作台，MUST NOT 作为管理后台预览 iframe 的目标，也 MUST NOT 依赖工作台预览消息才能完成一次渲染。

#### Scenario: H5 renders widgets without workbench
- **WHEN** 用户在 H5 独立运行时中打开一份含文本与按钮的合法页面 XML
- **THEN** H5 展示对应文本与按钮，且不展示工程列表、页面列表或版本管理界面

#### Scenario: H5 can render without admin preview protocol
- **WHEN** H5 运行时获得一份合法页面 XML（不经由管理后台 iframe 预览消息）
- **THEN** 它仍能渲染其中的 `text` 与 `button`

### Requirement: H5 page language selection
H5 独立运行时 SHALL 按运行时区域选择语言 JSON：若存在语言键与运行时区域匹配的已发布快照，MUST 加载该 JSON；否则 MUST 加载该页面在用版本的第一种语言 JSON；没有语言快照时 MUST 按字面文案与 LTR 渲染。H5 MUST 把 JSON 中的译文与 `dir` 交给公共渲染能力，MUST NOT 从页面 XML 解析语言库，MUST NOT 依赖工作台预览消息中的当前语言。

#### Scenario: H5 matches runtime locale
- **WHEN** 用户在区域为 `ar` 的 H5 中打开一份已发布 `zh` 与 `ar` 快照的页面，且某文本 `value` 为 `$t("common.ok")`
- **THEN** H5 加载 `ar` JSON，展示其中译文，且页面为从右到左

#### Scenario: H5 falls back to first language
- **WHEN** 用户在区域为 `fr` 的 H5 中打开一份只发布了 `zh` 与 `en` 快照的页面
- **THEN** H5 加载第一种语言 `zh` 的 JSON 并按其文案与方向渲染

### Requirement: Delete selected widget
工作台 SHALL 允许在编辑草稿版本时删除当前选中控件。删除容器控件时 MUST 同时移除其全部子树。删除后控件树与子窗口 MUST 立即反映更新后的 XML，且不必先保存版本。无选中控件、预览模式或当前版本非草稿时，系统 MUST NOT 删除任何控件。

#### Scenario: Delete a leaf widget
- **WHEN** 已登录管理员在编辑草稿时选中一个文本或按钮并执行删除
- **THEN** 该控件从控件树与子窗口中消失，其余控件保持原有层级与顺序

#### Scenario: Delete a flex removes its subtree
- **WHEN** 已登录管理员在编辑草稿时选中一个含有子控件的弹性盒并执行删除
- **THEN** 该弹性盒及其全部子孙控件都从控件树与子窗口中消失

#### Scenario: Delete is disabled when read-only
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿，且已选中一个控件
- **THEN** 删除入口不可用，执行删除快捷键也不改变控件树

#### Scenario: Delete with no selection does nothing
- **WHEN** 已登录管理员在编辑草稿时未选中任何控件并执行删除
- **THEN** 控件树与子窗口保持不变

### Requirement: Copy and paste widget
工作台 SHALL 允许把当前选中控件（含其完整子树）复制到会话内剪贴板。粘贴 MUST 插入一份结构与属性相同、但每个控件 `id` 都是新值的副本。若当前选中控件是弹性盒，且副本根类型不是 `swiper-item`，副本 MUST 成为该弹性盒的最后一个子控件。若当前选中控件是 `swiper` 且副本根类型是 `swiper-item`，副本 MUST 成为该滑动器的最后一个 item；若副本根类型不是 `swiper-item`，副本 MUST 成为其最后一个 item 的子控件（若尚无 item 则先创建一个空 item 再放入）。若当前选中控件是 `swiper-item` 且副本根类型是 `swiper-item`，副本 MUST 成为该 item 的下一个兄弟；否则副本 MUST 成为该 item 的最后一个子控件。若当前选中的是非上述容器控件，副本 MUST 成为该控件的下一个兄弟；若没有选中控件，副本 MUST 成为页面根的最后一个控件。`swiper-item` MUST NOT 被粘贴到页面根或弹性盒下。粘贴后 MUST 选中新插入的根控件，子窗口 MUST 立即渲染该副本，且不必先保存版本。剪贴板为空时粘贴 MUST NOT 改变控件树。复制在只读态仍可用；粘贴在预览模式或非草稿版本时 MUST NOT 改变控件树。切换到其他页面 MUST 清空剪贴板；同一页面切换版本 MUST 保留剪贴板。

#### Scenario: Paste into selected flex
- **WHEN** 已登录管理员复制一个文本控件，再选中一个弹性盒并执行粘贴
- **THEN** 该弹性盒末尾出现一份文案与样式相同、`id` 不同的文本，子窗口在该弹性盒内展示它，且原控件仍在原位置

#### Scenario: Paste as next sibling
- **WHEN** 已登录管理员复制一个按钮，再选中页面根上另一个非弹性盒控件并执行粘贴
- **THEN** 副本出现在该选中控件的下一个兄弟位置，而不是页面根末尾或某个弹性盒内部

#### Scenario: Paste nested flex clones the subtree
- **WHEN** 已登录管理员复制一个含有子控件的弹性盒并粘贴到页面根
- **THEN** 页面上出现一份相同嵌套结构的弹性盒，副本子树中每个控件的 `id` 都与原树不同

#### Scenario: Paste into selected swiper item
- **WHEN** 已登录管理员复制一个文本控件，再选中一个 `swiper-item` 并执行粘贴
- **THEN** 该 item 末尾出现一份文案相同、`id` 不同的文本，子窗口在该 item 内展示它

#### Scenario: Paste swiper-item into selected swiper
- **WHEN** 已登录管理员复制一个 `swiper-item`，再选中其所属滑动器并执行粘贴
- **THEN** 该滑动器末尾出现一份结构相同、各控件 `id` 都不同的 item

#### Scenario: Paste without copy does nothing
- **WHEN** 已登录管理员尚未复制任何控件（或刚切换页面导致剪贴板已空）并执行粘贴
- **THEN** 控件树与子窗口保持不变

#### Scenario: Paste is disabled when read-only
- **WHEN** 已登录管理员已复制一个控件，但处于预览模式或当前版本不是草稿
- **THEN** 粘贴入口不可用，执行粘贴快捷键也不插入副本

### Requirement: Undo and redo widget tree edits
工作台 SHALL 为当前草稿版本的控件树变更、页面背景/内边距变更与页面变量变更提供会话内撤回与重做。可撤回的变更 MUST 包括添加、删除、粘贴，检查器中的控件属性/文案编辑与页面背景/内边距编辑，以及数据 tab 中变量的新增、删除、改名、改类型、改描述、改初始值与拖动排序。对同一控件同一字段、同一页面样式字段或同一变量同一字段的连续编辑，在焦点离开该字段或开始另一类操作之前 MUST 记为一步撤回。执行新的可记录变更后，重做栈 MUST 被清空。撤回与重做后，控件树、页面样式、页面变量、选中控件与子窗口 MUST 回到对应步骤的状态。预览模式、非草稿版本、无可撤回步骤或无可重做步骤时，对应入口 MUST 不可用且 MUST NOT 改变控件树、页面样式或页面变量。切换页面或切换版本 MUST 清空撤回与重做历史。页面/版本的创建删除、画布平移缩放、切换布局/数据/事件 tab、切换当前预览语言、语言库的增删改与单纯改变选中 MUST NOT 进入该历史。

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

#### Scenario: Undo does not revert language library
- **WHEN** 已登录管理员在语言库中新增一种语言，再执行撤回
- **THEN** 该语言仍在工程语言库中，控件树撤回栈也不包含这次新增

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

### Requirement: Local uncommitted draft persistence
工作台 SHALL 在编辑草稿版本时，将当前页面内容持久化到本机，以便刷新或重新打开同一版本后恢复尚未提交到服务器的改动。对同一控件同一字段的连续编辑，在手势结束或停手之前 MUST 合并为本机草稿的最新完整内容，MUST NOT 要求调用方观察到每一次中间值都单独落盘。预览模式或当前版本非草稿时，系统 MUST NOT 写入或更新该版本的本机草稿。本机草稿 MUST 按工程、页面与版本区分；某一版本的未提交内容 MUST NOT 被套用到其他工程、页面或版本。本机草稿 MUST NOT 包含撤回/重做历史；刷新后历史栈 MUST 为空。

#### Scenario: Refresh restores uncommitted edits
- **WHEN** 已登录管理员在编辑草稿时改了控件文案且尚未成功提交到版本保存接口，然后刷新工作台并再次打开同一版本
- **THEN** 控件树与子窗口展示刷新前的文案，而不是该版本上次成功保存到服务器的内容

#### Scenario: Local draft is not written when read-only
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿
- **THEN** 系统不把当前画布内容写入该版本的本机草稿

#### Scenario: Drafts do not leak across versions
- **WHEN** 已登录管理员在草稿 A 上留有未提交的本机草稿，再打开同一页面且没有本机草稿的草稿 B
- **THEN** 工作台展示草稿 B 的服务器内容，不展示草稿 A 的未提交内容

#### Scenario: Refresh does not restore undo history
- **WHEN** 已登录管理员在草稿上删除一个控件后刷新，并恢复到包含该删除的本机草稿
- **THEN** 撤回入口不可用，执行撤回也不会把该控件按刷新前的历史栈还原

### Requirement: Version save skipped when unchanged
工作台 SHALL 仅在当前页面 XML 与该版本上次成功提交到服务器的快照不同时，才调用版本保存接口。无改动时，管理员触发保存、停手等待或关闭/刷新页面，系统 MUST NOT 向服务器提交该版本。存在未提交改动时，停手、关闭/刷新页面或显式保存 MUST 将该草稿提交到现有版本保存接口；提交成功后该版本的本机未提交草稿 MUST 被清除，且在没有进一步编辑前 MUST NOT 再次提交。预览模式或非草稿版本下，系统 MUST NOT 用该自动或显式保存路径覆盖服务器上的版本内容。当前检查器存在未通过的属性校验时，系统 MUST NOT 提交该次保存。

#### Scenario: Save with no edits does not hit the server
- **WHEN** 已登录管理员打开一份草稿且未做任何使 XML 变化的编辑，然后触发保存
- **THEN** 系统不调用版本保存接口，服务器上该版本内容保持不变

#### Scenario: Idle after edits submits once
- **WHEN** 已登录管理员在编辑草稿时改了文案后停手，且检查器没有未通过的校验
- **THEN** 系统将该草稿提交到版本保存接口一次，且在没有进一步编辑前不再提交

#### Scenario: Repeat save after success is skipped
- **WHEN** 已登录管理员将草稿成功提交到服务器后，未再编辑即再次触发保存
- **THEN** 系统不调用版本保存接口

#### Scenario: Close with dirty draft submits
- **WHEN** 已登录管理员在编辑草稿时仍有未提交改动并关闭或刷新页面
- **THEN** 系统在离开前将该草稿提交到版本保存接口

#### Scenario: Read-only does not save
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿
- **THEN** 停手或触发保存都不会调用版本保存接口去覆盖该版本

#### Scenario: Invalid inspector blocks save
- **WHEN** 已登录管理员在检查器中留下未通过校验的属性并停手或触发保存
- **THEN** 系统不调用版本保存接口，本机草稿仍保留当前编辑
