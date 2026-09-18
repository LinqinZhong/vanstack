## ADDED Requirements

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
