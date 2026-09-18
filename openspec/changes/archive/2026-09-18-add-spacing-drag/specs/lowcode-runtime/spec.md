## ADDED Requirements

### Requirement: Padding and margin shortcuts and canvas drag
工作台编辑草稿且点击选中某一控件后，系统 SHALL 接受修饰键加 `P` / `M` 立刻选中气泡的内边距或外边距分组。修饰键 MUST 为 `Ctrl` 或 `⌘`。按下时 MUST 展开对应面板，MUST NOT 在该分组已打开时把它关掉。主窗口与 iframe 画布 MUST 都能识别这些快捷键，并 MUST `preventDefault` 以免浏览器打开打印等默认行为。焦点在可编辑输入内时 MUST NOT 拦截。预览模式、非草稿版本或当前没有选中控件时 MUST NOT 改变分组或样式。

内外边距分组打开后，系统 MUST 在选中控件上叠加红色虚线辅助框：内边距 MUST 框住内容区（由边框盒向内缩进四边内边距），外边距 MUST 框住外边距盒。四边控制条与数值 MUST 按各边实际坐标独立放置，MUST NOT 把辅助框宽高钳成非负后再排手柄。当某边为负、或相对两边之和超过控件尺寸导致对边交错时，辅助框 MUST 允许反向（可自交），控制条 MUST 仍跟手。对边控制条重合时，其中一条 MUST 保持长条，另一条 MUST 收成约 16px 的圆钮叠在长条上，以免被盖住消失，MUST NOT 缩成一个点。画布其余内容 MUST 被半透明遮罩盖住，覆盖范围 MUST 包括页面周围的画布以及选中控件以外的页面内容；选中控件本身 MUST 保持完全可见。四边 MUST 各有一条可按住的控制条；控制条热区 MUST 明显大于可见细条。按住某条控制条后 MUST 只改该边；按住 `Alt` 时 MUST 同时改对边（左对右、上对下），对边 MUST 写成与当前边相同的值。悬停或按住控制条时 MUST 显示一条白色虚线，标出该边的拖动方向（上下边为竖线，左右边为横线），且悬停时该线 MUST 保持稳定、MUST NOT 闪烁。每边非零像素值 MUST 显示在对应虚线旁；当该边长度放不下数字时 MUST 隐藏该边的值。选中控件右下角 MUST 有取消（叉）与确定（勾）按钮；`Esc` MUST 等同取消，`Enter` MUST 等同确定（焦点在可编辑输入内时 `Enter` MUST NOT 确定）。取消 MUST 把该控件内外边距恢复为进入该分组前的值并关闭分组；确定 MUST 保留当前值并关闭分组。辅助线、控制条、遮罩与这两个按钮 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 或预览模式。关闭该分组、取消选中或切走布局编辑后 MUST 去掉辅助线与遮罩。拖动或输入改边距时辅助线 MUST 跟手更新，画布上的数值 MUST 与气泡输入为同一组边距。

内外边距分组打开后，按住某边控制条拖动 SHALL 按指针位移改写该边，并 MUST 写入与气泡输入相同的 `WidgetStyle` 字段。位移 MUST 按画布视觉缩放折算为 CSS 像素后按 `1` 步进写入整数（向 0 截断），MUST NOT 出现小数，MUST NOT 把不足 `1px` 的位移四舍五入成 `1`。按下控制条后，指针移出控制条热区、移到页面周围空白、或移出 iframe 时 MUST 仍按位移改写该边，MUST NOT 因热区外没有滑动事件而停在半路。该边的增量 MUST 跟手：外边距 MUST 向外为正（向上增加上边、向下增加下边、向左增加左边、向右增加右边）；内边距控制条在内容区边上，MUST 向内为正（把内容区上边往下拖增加上内边距、下边往上拖增加下内边距、左边往右拖增加左内边距、右边往左拖增加右内边距）。拖动结果 MUST 仅在按住 `Shift` 时吸附，优先级为：先对边当前值（左对右、上对下，距目标 10px 内；按住 `Alt` 镜像时 MUST 跳过对边吸附），再其余两边的值（同阈值），否则落到最近的 5 的倍数；未按 `Shift` 时 MUST 按 `1` 步进的整数值写入，MUST NOT 吸附。按住 `Shift` 时 MUST 在对应边的数值旁显示磁铁图标（该边无数字时显示在控制条旁）。按住 `Alt` 时 MUST 把对边写成与当前边相同的值（左右成对、上下成对，按住期间 MUST 相等），可与 `Shift` 同时按。松开 `Alt` 后对边 MUST 保持松开瞬间的值，MUST NOT 恢复为按住 `Alt` 之前的值；本次拖动后续未按 `Alt` 时 MUST 只改按住的那一边。画布上的边距数字 MUST 与写入的整数值一致。未按住控制条时 MUST NOT 把控件上的左键拖动当成改边距。内边距 MUST 钳在大于等于 `0`；外边距可为负，但从非负拖进负数时 MUST 先停在 `0`，指针还需再越过约 `20` CSS 像素才写出负数（已为负则不再加这段阻力）。拖动过程中预览 MUST 立即更新；一次拖动 MUST 合并为一步撤回。点选其他控件或空白画布 MUST 仍改变选中。中键平移 MUST 不受影响。

内外边距、圆角或边框分组打开后，系统 SHALL 接受按住数字键 `1`–`7` 选择边或角：内边距、外边距与边框为 `1` 上 / `2` 右 / `3` 下 / `4` 左，`5` 上下，`6` 左右，`7` 全部；圆角为 `1` 左上 / `2` 右上 / `3` 右下 / `4` 左下，`5` 左上与右下，`6` 左下与右上，`7` 全部。这些选边键 MUST 为主键盘数字行（`Digit1`–`Digit7`），MUST NOT 把小键盘 `Numpad1`–`Numpad7` 当成选边。按住数字的同时按下 `ArrowUp` MUST 立刻增加 `1` 像素，按下 `ArrowDown` MUST 立刻减小 `1` 像素；未选中全部边或角时 `ArrowLeft` / `ArrowRight` MUST NOT 改样式。按住方向键不放时 MUST NOT 使用系统按键重复，MUST 每 `100ms` 再触发一次，每次步进 `2` 像素（上/右加、下/左减）。按住 `7`（或按住的键合起来覆盖四边/四角）时 MUST 视为选中全部操纵条（四条都为黄色），此时 `ArrowUp` / `ArrowRight` MUST 同时增加全部边或角，`ArrowDown` / `ArrowLeft` MUST 同时减小全部边或角。可同时按住多个数字，方向键 MUST 对当前选中的每一边/角施加同一增量。未按住选边键时方向键 MUST NOT 改样式。`Alt` MUST NOT 再作为键盘选边；拖动操纵条时 `Alt` 仍镜像对边。按住选边键时，小键盘数字键 `Numpad0`–`Numpad9`（NumLock 开启，`key` 为 `0`–`9`）MUST 把当前选中边或角写成该次按住期间输入的整数值：每按一位 MUST 立刻写入（例如先 `1` 再 `2` 写成 `12`）；`Backspace` MUST 删掉最后一位并立刻写入（删空则写成 `0`），MUST NOT 删除控件；`-`（主键盘 Minus 或小键盘 `NumpadSubtract`）MUST 作为负号输入：尚未带负号时写入 `-` 前缀（例如先 `-` 再小键盘 `8` 写成 `-8`），已有负号则忽略；松开全部选边键后再按住 MUST 清空这次输入，从新数字开始，MUST NOT 接到上次后面。未选边时小键盘数字、`Backspace` 与 `-` MUST NOT 改样式。内边距、圆角与边框宽度 MUST 钳在大于等于 `0`；外边距可为负。焦点在可编辑输入内时 MUST NOT 拦截。主窗口与 iframe 画布 MUST 都能识别。按住数字时画布上对应控制条 MUST 显示为黄色。

#### Scenario: Shortcut opens padding
- **WHEN** 已登录管理员在编辑草稿时选中一个控件并按下 `Ctrl+P` 或 `⌘+P`
- **THEN** 气泡立刻展开内边距面板，选中控件上出现内边距辅助线，浏览器不打开打印对话框

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
