# lowcode-runtime Specification

## Purpose

约定页面 XML 中文本与按钮的可观察行为，把渲染抽成公共能力，供管理后台同应用 iframe 预览与 H5 独立运行时共用，且两套宿主功能不同。

## Requirements

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

### Requirement: Render text and button from xml
子窗口 SHALL 按当前 XML 渲染 `text` 与 `button`。XML 中每个 `text` MUST 在预览中显示其 `value`；每个 `button` MUST 在预览中显示其 `text` 标签。控件顺序 MUST 与 XML 中的声明顺序一致。

#### Scenario: Preview shows text and button
- **WHEN** 当前 XML 依次包含 `value` 为「你好」的 `text` 与 `text` 为「确定」的 `button`
- **THEN** 子窗口先展示文本「你好」，再展示标签为「确定」的按钮

#### Scenario: Empty page renders no widgets
- **WHEN** 当前 XML 是合法的空 `page`（没有任何控件子元素）
- **THEN** 子窗口不展示文本或按钮控件

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

### Requirement: Preview follows selected version
选中某一页面版本后，子窗口 SHALL 渲染该版本 XML 对应的页面。将某版本设为当前在用后，在未做未保存编辑的前提下，预览 MUST 与该版本 XML 一致。

#### Scenario: Selecting a version previews its xml
- **WHEN** 已登录管理员选中某页面的一个已有版本
- **THEN** 子窗口按该版本的 XML 渲染文本与按钮

### Requirement: Invalid xml preview feedback
当工作台向子窗口提供的 XML 无效时，子窗口 SHALL 展示错误状态，MUST NOT 继续展示上一份有效页面并假装当前 XML 有效。

#### Scenario: Invalid xml shows error in iframe
- **WHEN** 子窗口收到无法解析为合法页面的 XML
- **THEN** 子窗口展示错误反馈，且不渲染出文本或按钮控件

### Requirement: Shared renderer across hosts
`text` 与 `button` 的页面渲染 SHALL 由公共渲染能力提供。管理后台预览页与 H5 独立运行时 MUST 对同一份合法页面 XML 渲染出相同的控件文案与顺序。工作台编辑、版本管理与预览协议 MUST NOT 放入该公共渲染能力。

#### Scenario: Same xml matches in admin preview and h5
- **WHEN** 同一份依次包含文本「你好」与按钮「确定」的合法页面 XML 分别在管理后台预览页与 H5 运行时中渲染
- **THEN** 两处都先展示「你好」，再展示标签为「确定」的按钮

### Requirement: H5 standalone runtime
H5 应用 SHALL 作为独立运行时宿主使用公共渲染能力展示页面控件。H5 MUST NOT 提供工程/页面/版本工作台，MUST NOT 作为管理后台预览 iframe 的目标，也 MUST NOT 依赖工作台预览消息才能完成一次渲染。

#### Scenario: H5 renders widgets without workbench
- **WHEN** 用户在 H5 独立运行时中打开一份含文本与按钮的合法页面 XML
- **THEN** H5 展示对应文本与按钮，且不展示工程列表、页面列表或版本管理界面

#### Scenario: H5 can render without admin preview protocol
- **WHEN** H5 运行时获得一份合法页面 XML（不经由管理后台 iframe 预览消息）
- **THEN** 它仍能渲染其中的 `text` 与 `button`

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
工作台 SHALL 允许把当前选中控件（含其完整子树）复制到会话内剪贴板。粘贴 MUST 插入一份结构与属性相同、但每个控件 `id` 都是新值的副本。若当前选中控件是弹性盒，副本 MUST 成为该弹性盒的最后一个子控件；若当前选中的是非弹性盒控件，副本 MUST 成为该控件的下一个兄弟；若没有选中控件，副本 MUST 成为页面根的最后一个控件。粘贴后 MUST 选中新插入的根控件，子窗口 MUST 立即渲染该副本，且不必先保存版本。剪贴板为空时粘贴 MUST NOT 改变控件树。复制在只读态仍可用；粘贴在预览模式或非草稿版本时 MUST NOT 改变控件树。切换到其他页面 MUST 清空剪贴板；同一页面切换版本 MUST 保留剪贴板。

#### Scenario: Paste into selected flex
- **WHEN** 已登录管理员复制一个文本控件，再选中一个弹性盒并执行粘贴
- **THEN** 该弹性盒末尾出现一份文案与样式相同、`id` 不同的文本，子窗口在该弹性盒内展示它，且原控件仍在原位置

#### Scenario: Paste as next sibling
- **WHEN** 已登录管理员复制一个按钮，再选中页面根上另一个非弹性盒控件并执行粘贴
- **THEN** 副本出现在该选中控件的下一个兄弟位置，而不是页面根末尾或某个弹性盒内部

#### Scenario: Paste nested flex clones the subtree
- **WHEN** 已登录管理员复制一个含有子控件的弹性盒并粘贴到页面根
- **THEN** 页面上出现一份相同嵌套结构的弹性盒，副本子树中每个控件的 `id` 都与原树不同

#### Scenario: Paste without copy does nothing
- **WHEN** 已登录管理员尚未复制任何控件（或刚切换页面导致剪贴板已空）并执行粘贴
- **THEN** 控件树与子窗口保持不变

#### Scenario: Paste is disabled when read-only
- **WHEN** 已登录管理员已复制一个控件，但处于预览模式或当前版本不是草稿
- **THEN** 粘贴入口不可用，执行粘贴快捷键也不插入副本

### Requirement: Undo and redo widget tree edits
工作台 SHALL 为当前草稿版本的控件树变更提供会话内撤回与重做。可撤回的变更 MUST 包括添加、删除、粘贴，以及检查器中的属性/文案编辑。对同一控件同一字段的连续编辑，在焦点离开该字段或开始另一类操作之前 MUST 记为一步撤回。执行新的可记录变更后，重做栈 MUST 被清空。撤回与重做后，控件树、选中控件与子窗口 MUST 回到对应步骤的状态。预览模式、非草稿版本、无可撤回步骤或无可重做步骤时，对应入口 MUST 不可用且 MUST NOT 改变控件树。切换页面或切换版本 MUST 清空撤回与重做历史。页面/版本的创建删除、画布平移缩放与单纯改变选中 MUST NOT 进入该历史。

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

#### Scenario: Switching version clears history
- **WHEN** 已登录管理员在某草稿上删除一个控件后，切换到同一页面的另一个版本
- **THEN** 撤回与重做入口都不可用，再切回原草稿也不会用历史自动还原刚才的删除

### Requirement: Keyboard shortcuts for widget commands
工作台 SHALL 为删除、复制、粘贴、撤回、重做提供与按钮入口等效的快捷键。在编辑草稿且焦点不在文本输入、多行输入或可编辑区域内时：`Delete` 或 `Backspace` MUST 删除当前选中控件；平台修饰键加 `C` MUST 复制；平台修饰键加 `V` MUST 粘贴；平台修饰键加 `Z` MUST 撤回；平台修饰键加 `Shift+Z` 或平台修饰键加 `Y` MUST 重做。焦点在文本输入、多行输入或可编辑区域内时，系统 MUST NOT 用这些快捷键操作控件树，以便保留输入框自身的编辑行为。编辑态下，管理员在预览 iframe 内按下上述快捷键时，工作台 MUST 与主窗口快捷键产生相同效果。预览模式或非草稿版本下，除复制外的变更类快捷键 MUST NOT 改变控件树。

#### Scenario: Delete key removes the selected widget
- **WHEN** 已登录管理员在编辑草稿时选中一个控件，且焦点不在输入框内，按下 `Delete`
- **THEN** 该控件按删除要求从控件树与子窗口中移除

#### Scenario: Modifier shortcuts copy paste undo and redo
- **WHEN** 已登录管理员在编辑草稿时焦点不在输入框内，依次使用平台修饰键加 `C`、`V`、`Z` 以及 `Shift+Z`
- **THEN** 系统分别执行复制、粘贴、撤回与重做，效果与对应按钮一致

#### Scenario: Shortcuts ignored while typing in inspector
- **WHEN** 已登录管理员焦点在检查器文案输入框中，按下 `Backspace` 或平台修饰键加 `C` / `V`
- **THEN** 这些按键只作用于该输入框中的文本，控件树不被删除或粘贴

#### Scenario: Shortcuts work after clicking the canvas
- **WHEN** 已登录管理员在编辑草稿时点击 iframe 内的控件选中它，然后在 iframe 内按下 `Delete`
- **THEN** 该选中控件被删除，与在主窗口按下 `Delete` 的效果相同
