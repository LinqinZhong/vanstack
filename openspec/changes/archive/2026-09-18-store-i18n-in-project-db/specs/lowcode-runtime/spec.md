## ADDED Requirements

### Requirement: Render catalog is supplied by host
公共渲染能力 SHALL 接受宿主提供的当前语言键与语言目录（语言列表、方向与译文），MUST NOT 从页面 XML 读取语言库。工作台预览 MUST 把数据库中的当前工程语言库交给渲染；H5 MUST 把已加载的发布 JSON 交给渲染。

#### Scenario: Preview uses live project catalog
- **WHEN** 已登录管理员将某文本设为 `$t("common.ok")`，并在工程语言库把 `zh` 下该键改为「好的」
- **THEN** 子窗口立即展示「好的」，且页面 XML 中该 `value` 仍为 `$t("common.ok")`

#### Scenario: Xml i18n node is ignored
- **WHEN** 页面 XML 的 `page` 根下仍包含旧的 `<i18n>` 元素
- **THEN** 系统仍成功解析控件，不把该节点当控件，也不把它当作当前语言库

## MODIFIED Requirements

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

### Requirement: Shared renderer across hosts
`text` 与 `button` 的页面渲染 SHALL 由公共渲染能力提供。管理后台预览页与 H5 独立运行时 MUST 对同一份合法页面 XML 在相同当前语言与相同语言目录下渲染出相同的控件文案、顺序与页面排列方向。工作台编辑、版本管理与预览协议 MUST NOT 放入该公共渲染能力；当前语言与语言目录可作为渲染输入交给该公共能力。

#### Scenario: Same xml matches in admin preview and h5
- **WHEN** 同一份依次包含文本「你好」与按钮「确定」的合法页面 XML 分别在管理后台预览页与 H5 运行时中渲染
- **THEN** 两处都先展示「你好」，再展示标签为「确定」的按钮

#### Scenario: Same locale resolves the same copy
- **WHEN** 同一份含 `$t("common.ok")` 的页面 XML，工作台预览语言为 `ar` 且工程库中有对应译文，H5 加载同一版本发布的 `ar` JSON
- **THEN** 两处都展示相同的 `ar` 译文，且页面都为从右到左

### Requirement: H5 page language selection
H5 独立运行时 SHALL 按运行时区域选择语言 JSON：若存在语言键与运行时区域匹配的已发布快照，MUST 加载该 JSON；否则 MUST 加载该页面在用版本的第一种语言 JSON；没有语言快照时 MUST 按字面文案与 LTR 渲染。H5 MUST 把 JSON 中的译文与 `dir` 交给公共渲染能力，MUST NOT 从页面 XML 解析语言库，MUST NOT 依赖工作台预览消息中的当前语言。

#### Scenario: H5 matches runtime locale
- **WHEN** 用户在区域为 `ar` 的 H5 中打开一份已发布 `zh` 与 `ar` 快照的页面，且某文本 `value` 为 `$t("common.ok")`
- **THEN** H5 加载 `ar` JSON，展示其中译文，且页面为从右到左

#### Scenario: H5 falls back to first language
- **WHEN** 用户在区域为 `fr` 的 H5 中打开一份只发布了 `zh` 与 `en` 快照的页面
- **THEN** H5 加载第一种语言 `zh` 的 JSON 并按其文案与方向渲染

## REMOVED Requirements

### Requirement: Page xml i18n catalog
**Reason**: 语言库改为工程数据库存储，发布时写入 OSS JSON 快照，不再作为页面 XML 的一部分。
**Migration**: 解析继续忽略页面级 `<i18n>` 且不把它当控件；工作台改为工程语言 API；H5 改为加载对应版本的语言 JSON。既有 XML 中的目录不迁移。
