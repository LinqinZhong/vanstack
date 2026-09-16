## ADDED Requirements

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
