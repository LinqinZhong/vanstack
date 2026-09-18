## ADDED Requirements

### Requirement: Page background and padding
页面 XML 的 `page` 根 SHALL 可配置并持久化背景与内边距。背景 MUST 使用 `background` 属性；内边距 MUST 使用与控件相同的 `padding` 缩写或 `padding-top` / `padding-right` / `padding-bottom` / `padding-left`。缺省时 MUST 不写入这些属性，渲染 MUST 使用透明背景与 0 内边距，控件 MUST 可贴齐页面边缘。无法识别的属性值 MUST 视为未设置，MUST NOT 使整页 XML 非法。无这些属性的既有页面 XML MUST 仍合法。管理后台 iframe 预览与 H5 独立运行时 MUST 对同一份页面样式渲染出相同的背景与内边距。工作台 MUST NOT 再给页面强制加默认内边距或白色填充。

#### Scenario: Page style round-trip
- **WHEN** 已登录管理员将页面背景设为某颜色、四边内边距设为 `16px` 并应用到当前 XML
- **THEN** 再次解析该 XML 得到相同背景与内边距，且预览中页面使用该背景，控件与页面边缘之间为 `16px`

#### Scenario: Omitted page style has no default padding or fill
- **WHEN** 页面 XML 的 `page` 根没有 `background` 与 `padding` 相关属性
- **THEN** 预览中页面背景透明、内边距为 0，根级控件可贴齐页面边缘

#### Scenario: Unequal padding serializes separately
- **WHEN** 已登录管理员将页面上内边距设为 `8px`、其余三边设为 `0` 并应用到当前 XML
- **THEN** 序列化结果能还原这四边值，且不把它们合并为单一相等的 `padding`

#### Scenario: Same page style matches in admin preview and h5
- **WHEN** 同一份带页面背景与内边距的合法 XML 分别在管理后台预览页与 H5 运行时中渲染
- **THEN** 两处的页面背景与内边距一致

### Requirement: Workbench canvas page chrome
工程编辑页画布上的页面轮廓 SHALL 使用浅蓝色实线框标出屏幕边界。该实线框 MUST 只作为工作台编辑铬，MUST NOT 写入页面 XML，MUST NOT 出现在 H5 独立运行时。画布上的页面区域 MUST NOT 使用白色填充或投影来标出边界。编辑模式与预览模式下，该实线框 MUST 都可见，以便在网格背景上辨认页面范围。

#### Scenario: Empty page shows light blue frame
- **WHEN** 已登录管理员在工程编辑页打开一份没有背景的页面
- **THEN** 画布上能看到浅蓝色实线框勾出的页面范围，框内不是白色填充

#### Scenario: H5 does not show editor frame
- **WHEN** 用户在 H5 独立运行时打开同一份没有背景的页面 XML
- **THEN** 渲染结果不包含该浅蓝色实线框

### Requirement: Page inspector when no widget selected
工作台右侧原控件信息位置 SHALL 在未选中任何控件时展示当前页面的背景与内边距。选中某一控件后，该位置 MUST 改回该控件的属性。点击画布上控件以外的页面区域 MUST 取消控件选中并展示页面属性。预览模式或非草稿版本时，页面属性 MUST 只读，MUST NOT 被编辑。编辑草稿时修改这些字段后，子窗口 MUST 立即按更新后的 XML 重新渲染，且不必先保存版本。

#### Scenario: Empty selection shows page properties
- **WHEN** 已登录管理员已选中一个页面且当前没有选中任何控件
- **THEN** 右侧面板展示页面的背景与内边距，而不是「未选中控件」空状态

#### Scenario: Clicking empty canvas opens page inspector
- **WHEN** 已登录管理员在编辑态点击 iframe 内控件以外的页面区域
- **THEN** 控件选中被取消，右侧面板展示页面的背景与内边距

#### Scenario: Selecting a widget restores widget inspector
- **WHEN** 已登录管理员在页面属性面板可见时选中一个控件
- **THEN** 右侧面板改为该控件的属性，不再展示页面背景与内边距编辑入口

#### Scenario: Page style edit updates preview
- **WHEN** 已登录管理员在编辑草稿时修改页面背景或内边距
- **THEN** 子窗口立即按新的背景与内边距渲染，且不必先保存版本

#### Scenario: Page style is read-only when locked
- **WHEN** 已登录管理员处于预览模式或当前版本不是草稿，且未选中任何控件
- **THEN** 右侧仍展示页面背景与内边距，但不可编辑

## MODIFIED Requirements

### Requirement: Undo and redo widget tree edits
工作台 SHALL 为当前草稿版本的控件树变更与页面背景/内边距变更提供会话内撤回与重做。可撤回的变更 MUST 包括添加、删除、粘贴，以及检查器中的控件属性/文案编辑与页面背景/内边距编辑。对同一控件同一字段或同一页面字段的连续编辑，在焦点离开该字段或开始另一类操作之前 MUST 记为一步撤回。执行新的可记录变更后，重做栈 MUST 被清空。撤回与重做后，控件树、页面样式、选中控件与子窗口 MUST 回到对应步骤的状态。预览模式、非草稿版本、无可撤回步骤或无可重做步骤时，对应入口 MUST 不可用且 MUST NOT 改变控件树或页面样式。切换页面或切换版本 MUST 清空撤回与重做历史。页面/版本的创建删除、画布平移缩放与单纯改变选中 MUST NOT 进入该历史。

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

#### Scenario: Switching version clears history
- **WHEN** 已登录管理员在某草稿上删除一个控件后，切换到同一页面的另一个版本
- **THEN** 撤回与重做入口都不可用，再切回原草稿也不会用历史自动还原刚才的删除
