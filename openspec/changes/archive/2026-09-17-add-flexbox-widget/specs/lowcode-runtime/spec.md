## ADDED Requirements

### Requirement: Flex widget in page xml
页面 XML SHALL 识别 `flex` 为可渲染容器控件。每个 `flex` MUST 具有 `id`，MUST 允许子元素为 `text`、`button` 或嵌套 `flex`。未设置弹性属性的 `flex` MUST 仍合法，渲染时按 CSS Flexbox 默认值布局。`flex` 内外未识别的元素 MUST 被忽略且 MUST NOT 阻止其余已识别控件渲染。

#### Scenario: Nested flex xml is accepted
- **WHEN** 系统解析一份 `page` 根下包含 `flex`，且该 `flex` 内依次含有 `text`、`button` 与嵌套 `flex` 的合法 XML
- **THEN** 解析结果包含该弹性盒及其子控件树，且各控件 `id` 与文案与 XML 一致

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

### Requirement: Add nested widgets from workbench
工作台 SHALL 允许为当前页面添加 `flex`。若当前选中控件是 `flex`，新添加的 `text`、`button` 或 `flex` MUST 成为该弹性盒的最后一个子控件；否则新控件 MUST 成为页面根的最后一个子控件。控件树 MUST 按嵌套层级展示弹性盒及其子控件，而不是把所有控件列成一层。

#### Scenario: Adding a flex widget updates tree and preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个弹性盒
- **THEN** 控件树出现该弹性盒，子窗口渲染出对应的弹性容器

#### Scenario: Adding a child into selected flex
- **WHEN** 已登录管理员选中一个已有弹性盒后添加一个文本控件
- **THEN** 该文本成为该弹性盒的子控件，出现在控件树的对应层级下，且子窗口在该弹性盒内展示该文案

#### Scenario: Adding a widget without a flex selected
- **WHEN** 已登录管理员未选中弹性盒（或选中的是非容器控件）后添加一个按钮
- **THEN** 该按钮成为页面根的最后一个控件，而不是某个弹性盒的子控件

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

## MODIFIED Requirements

### Requirement: Page xml widget contract
页面 XML SHALL 以 `page` 为根。本期系统 MUST 识别子元素 `text`、`button` 与 `flex`。`text` MUST 使用 `id` 与 `value` 描述一段展示文本；`button` MUST 使用 `id` 与 `text` 描述一个按钮标签；`flex` MUST 使用 `id` 描述一个可嵌套的弹性容器。未识别的元素 MUST 被忽略且 MUST NOT 阻止其余控件渲染。仅含 `text` 与 `button` 的既有页面 XML MUST 仍合法。

#### Scenario: Text and button xml is accepted
- **WHEN** 系统解析包含一个 `text` 与一个 `button` 的合法页面 XML
- **THEN** 解析结果包含这两个控件及其 `id` 与对应文案

#### Scenario: Flex xml is accepted
- **WHEN** 系统解析包含一个 `flex` 的合法页面 XML
- **THEN** 解析结果包含该弹性盒及其 `id`

#### Scenario: Unknown widget is ignored
- **WHEN** 页面 XML 在 `text`、`button` 与 `flex` 之外还包含未识别的子元素
- **THEN** 系统仍成功解析已识别控件，且不把未识别元素当作可渲染控件

#### Scenario: Invalid page xml is rejected
- **WHEN** 系统解析缺少 `page` 根或格式非法的 XML
- **THEN** 系统判定该 XML 无效并给出失败反馈，MUST NOT 当作空页面静默成功

### Requirement: Live preview after widget edits
工作台 SHALL 允许为当前页面添加 `text`、`button` 或 `flex`，并编辑已有文本/按钮的文案以及弹性盒的容器与项目属性。每次有效编辑后，子窗口 MUST 用更新后的 XML 重新渲染，且不必要求先保存为新版本。

#### Scenario: Adding a text widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个文本控件并给出文案
- **THEN** 子窗口展示该文案

#### Scenario: Adding a button widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个按钮控件并给出标签
- **THEN** 子窗口展示该标签的按钮

#### Scenario: Adding a flex widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个弹性盒
- **THEN** 子窗口展示该弹性容器

#### Scenario: Editing widget copy updates preview
- **WHEN** 已登录管理员修改已有文本的 `value` 或已有按钮的 `text` 并应用到当前 XML
- **THEN** 子窗口展示修改后的文案

#### Scenario: Editing flex properties updates preview
- **WHEN** 已登录管理员修改已有弹性盒的容器属性或其中子控件的项目属性并应用到当前 XML
- **THEN** 子窗口按更新后的弹性布局重新渲染
