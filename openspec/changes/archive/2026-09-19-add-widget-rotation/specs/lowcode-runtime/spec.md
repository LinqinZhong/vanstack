## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Bubble text and box style controls
气泡样式编辑器 SHALL 按控件类型提供文字与盒样式入口，且 MUST 只编辑现有控件样式字段。当选中控件为 `text` 或 `button` 时，气泡 MUST 提供文本内容编辑入口（多行文本框），以及字体颜色、文字阴影、加粗、斜体、下划线与删除线。全部可选中控件的气泡 MUST 提供背景颜色与旋转入口。圆角与边框宽度 MUST 出现在 `swiper-item` 以外的控件。外边距与定位入口 MUST 出现在 `swiper-item` 以外的控件；内边距入口 MUST 出现在 `swiper` 以外的控件。外边距、内边距、圆角、边框宽度与定位偏移 MUST 逐行展示：总、上下、左右、上、左、下、右（圆角对应四角标签）。旋转 MUST 按 X、Y、Z 三轴逐行展示，单位 MUST 为 `deg` / `rad` / `grad` / `turn`，默认 `deg`。外边距 MUST 提供单位 `px` / `%` / `auto`；定位偏移 MUST 提供 `px` / `%`；内边距 MUST 提供 `px` / `%`。边框的线型与颜色 MUST 仍为控件级统一值。非 `text`/`button` 的气泡 MUST NOT 展示上述文字样式入口。本期气泡 MUST NOT 提供字号增减。

#### Scenario: Text widget bubble shows text styles
- **WHEN** 已登录管理员选中一个文本控件
- **THEN** 气泡包含文本内容编辑、字体颜色、文字阴影、加粗、斜体、下划线、删除线，以及背景、外边距、内边距、圆角、边框、定位、旋转与设置入口

#### Scenario: Flex widget bubble hides text styles
- **WHEN** 已登录管理员选中一个弹性盒
- **THEN** 气泡包含背景、外边距、内边距、圆角、边框、定位、旋转与设置入口，不包含字体颜色或加粗等文字样式入口

#### Scenario: Bubble can edit margin and padding
- **WHEN** 已登录管理员选中一个允许该边距的控件并打开外边距或内边距面板
- **THEN** 气泡按总、上下、左右、上、左、下、右逐行编辑对应边距，并可选择 `px` / `%` / `auto`（内边距无 `auto`），预览立即更新

#### Scenario: Swiper bubble hides padding
- **WHEN** 已登录管理员选中一个滑动器
- **THEN** 气泡包含背景、尺寸、外边距、圆角、边框、定位、旋转与设置入口，不包含内边距入口

#### Scenario: Swiper item bubble hides size, margin, border and radius
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 气泡包含背景、内边距、旋转与设置入口，不包含尺寸、外边距、圆角、边框与定位入口

#### Scenario: Four-side radius mode
- **WHEN** 已登录管理员将某控件圆角设为上下左右模式，并把四角设为不同数值
- **THEN** 预览中四个圆角分别使用这些值，且不把它们合并为单一相等圆角

#### Scenario: Bold toggle on button
- **WHEN** 已登录管理员在按钮的气泡中打开加粗
- **THEN** 该按钮以粗体渲染，关闭加粗后恢复为未设置粗细

### Requirement: Keyboard shortcuts for widget commands
工作台 SHALL 为删除、复制、粘贴、撤回、重做提供与按钮入口等效的快捷键。在编辑草稿且焦点不在文本输入、多行输入或可编辑区域内时：`Delete` MUST 删除当前选中控件；`Backspace` MUST NOT 删除控件。已选中控件时，`Tab` MUST 把选中切到当前控件的下一个兄弟节点；若当前已是最后一个兄弟，MUST 回到第一个兄弟。无选中或只有自身这一项时，`Tab` MUST NOT 改选中（仅一项时仍停留在该控件）。画布缩放不是 `500%` 时，`Tab` 切兄弟 MUST NOT 改变画布缩放或把该控件放大到视野中；当前缩放已是 `500%` 时，`Tab` 切到该兄弟后 MUST 把它放到视野中。若切兄弟前已打开内容、内边距、外边距、尺寸、圆角、边框、定位或旋转编辑分组，`Tab` 之后 MUST 在新选中控件上保持同一分组打开，MUST NOT 关掉该编辑模式；上一控件已改的值 MUST 保留。`Ctrl+Enter` 或 `⌘+Enter` MUST 选中当前控件的第一个子控件；没有子控件时 MUST NOT 改选中。`Ctrl+Shift+Enter` 或 `⌘+Shift+Enter` MUST 选中当前控件的父控件；已在页面根级时 MUST NOT 改选中。连按两次 `Enter`（间隔不超过 `300ms`）MUST 等同于对该节点 `Ctrl` 双击：把当前选中控件放大到视野中；若当前画布缩放已是 `500%`，第二次 `Enter` MUST 还原为放大前的视图（没有放大前记录则回到适配画布）。焦点在可编辑输入内时 MUST NOT 拦截这些键。平台修饰键加 `C` MUST 复制；平台修饰键加 `V` MUST 粘贴；平台修饰键加 `Z` MUST 撤回；平台修饰键加 `Shift+Z` 或平台修饰键加 `Y` MUST 重做。焦点在文本输入、多行输入或可编辑区域内时，系统 MUST NOT 用这些快捷键操作控件树，以便保留输入框自身的编辑行为。编辑态下，管理员在预览 iframe 内按下上述快捷键时，工作台 MUST 与主窗口快捷键产生相同效果。预览模式或非草稿版本下，除复制外的变更类快捷键 MUST NOT 改变控件树。

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
