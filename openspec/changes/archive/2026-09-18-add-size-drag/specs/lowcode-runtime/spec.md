## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Keyboard shortcuts for widget commands
工作台 SHALL 为删除、复制、粘贴、撤回、重做提供与按钮入口等效的快捷键。在编辑草稿且焦点不在文本输入、多行输入或可编辑区域内时：`Delete` MUST 删除当前选中控件；`Backspace` MUST NOT 删除控件。已选中控件时，`Tab` MUST 把选中切到当前控件的下一个兄弟节点；若当前已是最后一个兄弟，MUST 回到第一个兄弟。无选中或只有自身这一项时，`Tab` MUST NOT 改选中（仅一项时仍停留在该控件）。画布缩放不是 `500%` 时，`Tab` 切兄弟 MUST NOT 改变画布缩放或把该控件放大到视野中；当前缩放已是 `500%` 时，`Tab` 切到该兄弟后 MUST 把它放到视野中。若切兄弟前已打开内容、内边距、外边距、尺寸、圆角或边框编辑分组，`Tab` 之后 MUST 在新选中控件上保持同一分组打开，MUST NOT 关掉该编辑模式；上一控件已改的值 MUST 保留。`Ctrl+Enter` 或 `⌘+Enter` MUST 选中当前控件的第一个子控件；没有子控件时 MUST NOT 改选中。`Ctrl+Shift+Enter` 或 `⌘+Shift+Enter` MUST 选中当前控件的父控件；已在页面根级时 MUST NOT 改选中。连按两次 `Enter`（间隔不超过 `300ms`）MUST 等同于对该节点 `Ctrl` 双击：把当前选中控件放大到视野中；若当前画布缩放已是 `500%`，第二次 `Enter` MUST 还原为放大前的视图（没有放大前记录则回到适配画布）。焦点在可编辑输入内时 MUST NOT 拦截这些键。平台修饰键加 `C` MUST 复制；平台修饰键加 `V` MUST 粘贴；平台修饰键加 `Z` MUST 撤回；平台修饰键加 `Shift+Z` 或平台修饰键加 `Y` MUST 重做。焦点在文本输入、多行输入或可编辑区域内时，系统 MUST NOT 用这些快捷键操作控件树，以便保留输入框自身的编辑行为。编辑态下，管理员在预览 iframe 内按下上述快捷键时，工作台 MUST 与主窗口快捷键产生相同效果。预览模式或非草稿版本下，除复制外的变更类快捷键 MUST NOT 改变控件树。

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
