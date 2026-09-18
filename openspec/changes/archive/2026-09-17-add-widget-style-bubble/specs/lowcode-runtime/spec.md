## ADDED Requirements

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
气泡样式编辑器 SHALL 按控件类型提供文字与盒样式入口，且 MUST 只编辑现有控件样式字段。当选中控件为 `text` 或 `button` 时，气泡 MUST 提供文本内容编辑入口（多行文本框），以及字体颜色、文字阴影、加粗、斜体、下划线与删除线。全部可选中控件（含 `flex`、`swiper` 与 `swiper-item`）的气泡 MUST 提供背景颜色、外边距、内边距、圆角与边框宽度。外边距、内边距、圆角与边框宽度 MUST 各自提供四种编辑模式：统一（单一值作用于全部边或角）、上下左右（四边或四角独立）、水平（左右两边或左右两角）、竖直（上下两边或上下两角）。边框的线型与颜色 MUST 仍为控件级统一值。非 `text`/`button` 的气泡 MUST NOT 展示上述文字样式入口。本期气泡 MUST NOT 提供字号增减。

#### Scenario: Text widget bubble shows text styles
- **WHEN** 已登录管理员选中一个文本控件
- **THEN** 气泡包含文本内容编辑、字体颜色、文字阴影、加粗、斜体、下划线、删除线，以及背景、外边距、内边距、圆角、边框与设置入口

#### Scenario: Flex widget bubble hides text styles
- **WHEN** 已登录管理员选中一个弹性盒
- **THEN** 气泡包含背景、外边距、内边距、圆角、边框与设置入口，不包含字体颜色或加粗等文字样式入口

#### Scenario: Bubble can edit margin and padding
- **WHEN** 已登录管理员选中任意控件并打开外边距或内边距面板
- **THEN** 气泡可用统一、四向、水平、竖直四种模式编辑对应边距，预览立即更新

#### Scenario: Four-side radius mode
- **WHEN** 已登录管理员将某控件圆角设为上下左右模式，并把四角设为不同数值
- **THEN** 预览中四个圆角分别使用这些值，且不把它们合并为单一相等圆角

#### Scenario: Bold toggle on button
- **WHEN** 已登录管理员在按钮的气泡中打开加粗
- **THEN** 该按钮以粗体渲染，关闭加粗后恢复为未设置粗细

## MODIFIED Requirements

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
