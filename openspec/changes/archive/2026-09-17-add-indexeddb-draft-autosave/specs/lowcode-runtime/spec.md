## ADDED Requirements

### Requirement: Local uncommitted draft persistence
工作台 SHALL 在编辑草稿版本时，将当前页面内容持久化到本机，以便刷新或重新打开同一版本后恢复尚未提交到服务器的改动。对同一控件同一字段的连续编辑，在手势结束或停手之前 MUST 合并为本机草稿的最新完整内容，MUST NOT 要求调用方观察到每一次中间值都单独落盘。预览模式或当前版本非草稿时，系统 MUST NOT 写入或更新该版本的本机草稿。本机草稿 MUST 按工程、页面与版本区分；某一版本的未提交内容 MUST NOT 被套用到其他工程、页面或版本。本机草稿 MUST NOT 包含撤回/重做历史；刷新后历史栈 MUST 为空。

#### Scenario: Refresh restores uncommitted edits
- **WHEN** 已登录管理员在编辑草稿时改了控件文案且尚未成功提交到版本保存接口，然后刷新工作台并再次打开同一版本
- **THEN** 控件树与子窗口展示刷新前的文案，而不是该版本上次成功保存到服务器的内容

#### Scenario: Local draft is not written when read-only
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿
- **THEN** 系统不把当前画布内容写入该版本的本机草稿

#### Scenario: Drafts do not leak across versions
- **WHEN** 已登录管理员在草稿 A 上留有未提交的本机草稿，再打开同一页面且没有本机草稿的草稿 B
- **THEN** 工作台展示草稿 B 的服务器内容，不展示草稿 A 的未提交内容

#### Scenario: Refresh does not restore undo history
- **WHEN** 已登录管理员在草稿上删除一个控件后刷新，并恢复到包含该删除的本机草稿
- **THEN** 撤回入口不可用，执行撤回也不会把该控件按刷新前的历史栈还原

### Requirement: Version save skipped when unchanged
工作台 SHALL 仅在当前页面 XML 与该版本上次成功提交到服务器的快照不同时，才调用版本保存接口。无改动时，管理员触发保存、停手等待或关闭/刷新页面，系统 MUST NOT 向服务器提交该版本。存在未提交改动时，停手、关闭/刷新页面或显式保存 MUST 将该草稿提交到现有版本保存接口；提交成功后该版本的本机未提交草稿 MUST 被清除，且在没有进一步编辑前 MUST NOT 再次提交。预览模式或非草稿版本下，系统 MUST NOT 用该自动或显式保存路径覆盖服务器上的版本内容。当前检查器存在未通过的属性校验时，系统 MUST NOT 提交该次保存。

#### Scenario: Save with no edits does not hit the server
- **WHEN** 已登录管理员打开一份草稿且未做任何使 XML 变化的编辑，然后触发保存
- **THEN** 系统不调用版本保存接口，服务器上该版本内容保持不变

#### Scenario: Idle after edits submits once
- **WHEN** 已登录管理员在编辑草稿时改了文案后停手，且检查器没有未通过的校验
- **THEN** 系统将该草稿提交到版本保存接口一次，且在没有进一步编辑前不再提交

#### Scenario: Repeat save after success is skipped
- **WHEN** 已登录管理员将草稿成功提交到服务器后，未再编辑即再次触发保存
- **THEN** 系统不调用版本保存接口

#### Scenario: Close with dirty draft submits
- **WHEN** 已登录管理员在编辑草稿时仍有未提交改动并关闭或刷新页面
- **THEN** 系统在离开前将该草稿提交到版本保存接口

#### Scenario: Read-only does not save
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿
- **THEN** 停手或触发保存都不会调用版本保存接口去覆盖该版本

#### Scenario: Invalid inspector blocks save
- **WHEN** 已登录管理员在检查器中留下未通过校验的属性并停手或触发保存
- **THEN** 系统不调用版本保存接口，本机草稿仍保留当前编辑

## MODIFIED Requirements

### Requirement: Preview follows selected version
选中某一页面版本后，子窗口 SHALL 渲染该版本对应的页面。若该草稿版本在本机存在尚未提交到服务器的草稿，预览 MUST 使用该本机草稿；否则 MUST 使用服务器上该版本的 XML。将某版本设为当前在用后，在未做未保存编辑且无本机未提交草稿的前提下，预览 MUST 与该版本 XML 一致。

#### Scenario: Selecting a version previews its xml
- **WHEN** 已登录管理员选中某页面的一个已有版本，且该版本没有未提交的本机草稿
- **THEN** 子窗口按该版本服务器上的 XML 渲染文本与按钮

#### Scenario: Selecting a version restores local draft
- **WHEN** 已登录管理员选中某草稿版本，且本机存在该版本相对上次成功保存的未提交草稿
- **THEN** 子窗口按本机草稿 XML 渲染
