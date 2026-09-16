## Purpose

约定页面 XML 中文本与按钮的可观察行为，把渲染抽成公共能力，供管理后台同应用 iframe 预览与 H5 独立运行时共用，且两套宿主功能不同。

## ADDED Requirements

### Requirement: Page xml widget contract
页面 XML SHALL 以 `page` 为根。本期系统 MUST 识别子元素 `text` 与 `button`。`text` MUST 使用 `id` 与 `value` 描述一段展示文本；`button` MUST 使用 `id` 与 `text` 描述一个按钮标签。未识别的元素 MUST 被忽略且 MUST NOT 阻止其余控件渲染。

#### Scenario: Text and button xml is accepted
- **WHEN** 系统解析包含一个 `text` 与一个 `button` 的合法页面 XML
- **THEN** 解析结果包含这两个控件及其 `id` 与对应文案

#### Scenario: Unknown widget is ignored
- **WHEN** 页面 XML 在 `text` 与 `button` 之外还包含未识别的子元素
- **THEN** 系统仍成功解析已识别控件，且不把未识别元素当作可渲染控件

#### Scenario: Invalid page xml is rejected
- **WHEN** 系统解析缺少 `page` 根或格式非法的 XML
- **THEN** 系统判定该 XML 无效并给出失败反馈，MUST NOT 当作空页面静默成功

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

### Requirement: Live preview after widget edits
工作台 SHALL 允许为当前页面添加 `text` 或 `button`，并编辑已有控件的文案。每次有效编辑后，子窗口 MUST 用更新后的 XML 重新渲染，且不必要求先保存为新版本。

#### Scenario: Adding a text widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个文本控件并给出文案
- **THEN** 子窗口展示该文案

#### Scenario: Adding a button widget updates preview
- **WHEN** 已登录管理员在工作台为当前页面添加一个按钮控件并给出标签
- **THEN** 子窗口展示该标签的按钮

#### Scenario: Editing widget copy updates preview
- **WHEN** 已登录管理员修改已有文本的 `value` 或已有按钮的 `text` 并应用到当前 XML
- **THEN** 子窗口展示修改后的文案

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
