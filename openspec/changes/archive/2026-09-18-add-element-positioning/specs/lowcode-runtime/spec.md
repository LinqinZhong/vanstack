## ADDED Requirements

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

### Requirement: Canvas position drag
工作台编辑草稿且点击选中某一可定位控件后，系统 SHALL 在气泡操纵栏提供定位分组入口，并接受修饰键加 `L` 立刻打开该分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开定位面板，MUST NOT 在该分组已打开时把它关掉，MUST `preventDefault` 以免浏览器把焦点送到地址栏。主窗口与 iframe 画布 MUST 都能识别。焦点在可编辑输入内时 MUST NOT 拦截。预览模式、非草稿版本、当前没有选中控件、或选中的是 `swiper-item` 时 MUST NOT 打开定位分组或改定位与偏移。`swiper-item` 的气泡 MUST NOT 展示定位入口。

定位分组打开后，气泡 MUST 提供定位方式选择（静态 / 相对 / 绝对 / 固定 / 吸附）。定位非静态时，系统 MUST 在选中控件边框盒四边各叠加一条控制条：上、右、下、左分别改 `top` / `right` / `bottom` / `left`。定位为静态时 MUST NOT 叠加这些控制条，MUST NOT 用拖动或选边改偏移。定位非静态时，系统 MUST 画定位对齐辅助线，并铺满当前可见编辑区。相对定位的辅助线 MUST 穿过控件未偏移前的静态位置盒四边，规则与绝对相同：按生效边画该盒的上/下/左/右；某一方向没有生效边时 MUST 把该方向两条都画出来。绝对、固定与吸附 MUST 按布局真正生效的偏移边画出对应包含块边：`top` / `bottom` 为穿过包含块上边或下边的水平线，`left` / `right` 为穿过包含块左边或右边的竖直线。某一方向（上下或左右）没有生效边时，MUST 把该方向两条都画出来；只生效一条时 MUST 只画该条。已写入但未把控件拉到该边的偏移（例如同时写 `left` / `right`，宽度仍是 `fit-content` 或像素，元素没有被左右撑开，此时 `right` 被 `left` 覆盖）MUST 视为未生效，MUST NOT 画该边对齐线。相对同时写 `left` / `right` 或 `top` / `bottom` 时，对边同样视为被覆盖。吸附的四边只要已设置即视为生效。固定的包含块 MUST 为 375×667 屏幕区域；绝对的包含块 MUST 为定位祖先（无则页面根）；吸附的包含块 MUST 为页面内最近滚动盒，没有则同屏幕区域。辅助线 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML。静态时 MUST NOT 画原点辅助线。控制条热区 MUST 明显大于可见细条。每边非零像素值 MUST 显示在对应边上；边长放不下时 MUST 隐藏该数字。画布其余内容 MUST 被半透明遮罩盖住，选中控件本身 MUST 保持完全可见。选中控件右下角 MUST 有取消与确定；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件定位方式与四边偏移恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。辅助线、控制条、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉辅助线与遮罩。

按住某条控制条拖动 SHALL 按指针位移改写该边偏移，并 MUST 写入与气泡、检查器相同的字段。位移 MUST 按画布视觉缩放折算为 CSS 像素后按 `1` 步进写入整数（向 0 截断）。方向 MUST 与外边距相同：向外为正。偏移可为负，但从非负拖进负数时 MUST 先停在 `0`，指针还需再越过约 `20` CSS 像素才写出负数（已为负则不再加这段阻力）。若拖动开始时该边未设置，MUST 先按该边相对包含块的当前计算像素作为起点再写入。按下控制条后，指针移出热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写。未按住控制条时 MUST NOT 把控件上的左键拖动当成改偏移。默认一次只改按住的那一边。按住 `Alt` 时 MUST 把对边写成与当前边相同的值；松开后保持该值。按住 `Shift` 时 MUST 吸附：先对边当前值（距目标 10px 内；按住 `Alt` 时 MUST 跳过对边吸附），再其余两边的值（同阈值），否则落到最近的 5 的倍数，并显示磁铁图标；未按 `Shift` 时 MUST NOT 吸附。一次拖动 MUST 合并为一步撤回。中键平移 MUST 不受影响。定位为静态时 MUST NOT 写入偏移。

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

#### Scenario: Drag top increases top inset
- **WHEN** 已选中控件、定位为相对、定位面板已打开，且 `top` 为 `10`，管理员按住上边控制条向上拖 `8` CSS 像素
- **THEN** `top` 变成 `18`，其余三边保持拖动开始时的值

#### Scenario: Unset inset starts from computed pixels
- **WHEN** 已选中控件、定位为绝对、未设置 `left`，该边相对包含块的计算偏移为 `40px`，管理员打开定位面板并按住左边控制条向外拖 `4` CSS 像素
- **THEN** `left` 写成 `44` 像素

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

## MODIFIED Requirements

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

### Requirement: Bubble text and box style controls
气泡样式编辑器 SHALL 按控件类型提供文字与盒样式入口，且 MUST 只编辑现有控件样式字段。当选中控件为 `text` 或 `button` 时，气泡 MUST 提供文本内容编辑入口（多行文本框），以及字体颜色、文字阴影、加粗、斜体、下划线与删除线。全部可选中控件的气泡 MUST 提供背景颜色；圆角与边框宽度 MUST 出现在 `swiper-item` 以外的控件。外边距与定位入口 MUST 出现在 `swiper-item` 以外的控件；内边距入口 MUST 出现在 `swiper` 以外的控件。外边距、内边距、圆角、边框宽度与定位偏移 MUST 逐行展示：总、上下、左右、上、左、下、右（圆角对应四角标签）。外边距 MUST 提供单位 `px` / `%` / `auto`；定位偏移 MUST 提供 `px` / `%`；内边距 MUST 提供 `px` / `%`。边框的线型与颜色 MUST 仍为控件级统一值。非 `text`/`button` 的气泡 MUST NOT 展示上述文字样式入口。本期气泡 MUST NOT 提供字号增减。

#### Scenario: Text widget bubble shows text styles
- **WHEN** 已登录管理员选中一个文本控件
- **THEN** 气泡包含文本内容编辑、字体颜色、文字阴影、加粗、斜体、下划线、删除线，以及背景、外边距、内边距、圆角、边框、定位与设置入口

#### Scenario: Flex widget bubble hides text styles
- **WHEN** 已登录管理员选中一个弹性盒
- **THEN** 气泡包含背景、外边距、内边距、圆角、边框、定位与设置入口，不包含字体颜色或加粗等文字样式入口

#### Scenario: Bubble can edit margin and padding
- **WHEN** 已登录管理员选中一个允许该边距的控件并打开外边距或内边距面板
- **THEN** 气泡按总、上下、左右、上、左、下、右逐行编辑对应边距，并可选择 `px` / `%` / `auto`（内边距无 `auto`），预览立即更新

#### Scenario: Swiper bubble hides padding
- **WHEN** 已登录管理员选中一个滑动器
- **THEN** 气泡包含背景、尺寸、外边距、圆角、边框、定位与设置入口，不包含内边距入口

#### Scenario: Swiper item bubble hides size, margin, border and radius
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 气泡包含背景、内边距与设置入口，不包含尺寸、外边距、圆角、边框与定位入口

#### Scenario: Four-side radius mode
- **WHEN** 已登录管理员将某控件圆角设为上下左右模式，并把四角设为不同数值
- **THEN** 预览中四个圆角分别使用这些值，且不把它们合并为单一相等圆角

#### Scenario: Bold toggle on button
- **WHEN** 已登录管理员在按钮的气泡中打开加粗
- **THEN** 该按钮以粗体渲染，关闭加粗后恢复为未设置粗细

### Requirement: Keyboard shortcuts for widget commands
工作台 SHALL 为删除、复制、粘贴、撤回、重做提供与按钮入口等效的快捷键。在编辑草稿且焦点不在文本输入、多行输入或可编辑区域内时：`Delete` MUST 删除当前选中控件；`Backspace` MUST NOT 删除控件。已选中控件时，`Tab` MUST 把选中切到当前控件的下一个兄弟节点；若当前已是最后一个兄弟，MUST 回到第一个兄弟。无选中或只有自身这一项时，`Tab` MUST NOT 改选中（仅一项时仍停留在该控件）。画布缩放不是 `500%` 时，`Tab` 切兄弟 MUST NOT 改变画布缩放或把该控件放大到视野中；当前缩放已是 `500%` 时，`Tab` 切到该兄弟后 MUST 把它放到视野中。若切兄弟前已打开内容、内边距、外边距、尺寸、圆角、边框或定位编辑分组，`Tab` 之后 MUST 在新选中控件上保持同一分组打开，MUST NOT 关掉该编辑模式；上一控件已改的值 MUST 保留。`Ctrl+Enter` 或 `⌘+Enter` MUST 选中当前控件的第一个子控件；没有子控件时 MUST NOT 改选中。`Ctrl+Shift+Enter` 或 `⌘+Shift+Enter` MUST 选中当前控件的父控件；已在页面根级时 MUST NOT 改选中。连按两次 `Enter`（间隔不超过 `300ms`）MUST 等同于对该节点 `Ctrl` 双击：把当前选中控件放大到视野中；若当前画布缩放已是 `500%`，第二次 `Enter` MUST 还原为放大前的视图（没有放大前记录则回到适配画布）。焦点在可编辑输入内时 MUST NOT 拦截这些键。平台修饰键加 `C` MUST 复制；平台修饰键加 `V` MUST 粘贴；平台修饰键加 `Z` MUST 撤回；平台修饰键加 `Shift+Z` 或平台修饰键加 `Y` MUST 重做。焦点在文本输入、多行输入或可编辑区域内时，系统 MUST NOT 用这些快捷键操作控件树，以便保留输入框自身的编辑行为。编辑态下，管理员在预览 iframe 内按下上述快捷键时，工作台 MUST 与主窗口快捷键产生相同效果。预览模式或非草稿版本下，除复制外的变更类快捷键 MUST NOT 改变控件树。

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
