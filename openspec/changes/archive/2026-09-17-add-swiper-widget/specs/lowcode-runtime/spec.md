## ADDED Requirements

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

## MODIFIED Requirements

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
