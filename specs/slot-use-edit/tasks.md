# 任务：使用组件时的「插槽使用编辑」

依赖规范：`specs/slot-use-edit/spec.md`

## T1 预览层：聚焦插槽的隔离与白名单

- [x] `PreviewPage/scrollChrome.ts`
  - 删除 `ComponentChromeLabels`、`COMPONENT_MODE_ATTR`、`editingComponentHost`、`syncComponentReveal`、`paintComponentModeButton`。
  - 新增 `syncComponentSlotFocus(host, root, editing, componentEditing, slotFocusId)`：按 `slotFocusId` 给 `.lowcode-slot` 加/移 `.is-slot-focus`，并按条件给 host 加/移 `.is-component-editing`。
- [x] `PreviewPage/styles.less`（约 1094–1117）：删掉「整组件 fixed 居中 / 整组件可见」规则，换成 `.is-editing.is-component-editing` 隐藏 `.lowcode-page` 与 `[data-widget-id]`，`.lowcode-slot.is-slot-focus`（含后代 `[data-widget-id]`）`visibility: visible`；保留 `.lowcode-window { outline: none }`。
- [x] `PreviewPage/index.tsx`
  - 删除 `componentLabelsRef` 与 `paintComponentModeButton` / `syncComponentReveal` 的 import 与调用。
  - 新增载荷字段 `slotFocusId` → `nextSlotFocusId` / `slotFocusIdRef` / `shouldRender` 条件；`refreshTableChrome()` 调用 `syncComponentSlotFocus`。
  - `componentEditTargetOk`：改为「有 `.lowcode-component` 祖先、目标非组件本体、目标位于 `.lowcode-slot.is-slot-focus` 内」。

## T2 编辑器：状态、进入/退出、载荷

- [x] `ProjectEditorPage/index.tsx`
  - 删除 `enterComponentEdit` / `exitComponentEdit` / `enterComponentEditRef` / `exitComponentEditRef` / `componentEditViewSnapshotRef` / `component-mode` 消息分支。
  - 新增 `slotUseEditId` state + `slotUseEditIdRef`。
  - 新增 `enterSlotUseEdit(componentId, slotWidgetId)`（置 `componentEditId`/`slotUseEditId`、清选区、`fitCanvas(false)`、展开插槽虚拟节点）与 `exitSlotUseEdit()`（清两个 id、`selectWidgetRef.current(componentId)`）。
  - `exitOneEditLayer`：component 层替换为插槽使用编辑层；`selectWidget` 中「选中组件实例即退出」分支改调 `exitSlotUseEdit()`；页面/组件文档切换与切预览态时清空 `slotUseEditId`。
  - 预览载荷：`componentEditing: componentEditId !== null` 不变；新增 `slotFocusId`。
  - 新增 `slotUseInstance`（`componentEditId || 选中的组件实例`，仅页面态）与 `slotUseSlots`（`{id, name}`）。
  - 控件树：页面态 + 插槽使用编辑态时改用 `componentSlotSubtree`，树只剩被编辑插槽的虚拟节点及其内容。
  - 删除工具栏「组件全局状态」下拉框相关计算与 props，以及状态栏区域 `componentEditSlots`。

## T3 画布：左上角「插槽使用编辑」面板

- [x] `ProjectEditorPage/components/CanvasWorkspace.tsx`
  - props：删 `componentEditSlots` / `onSelectSlot` / `showComponentGlobalState` / `componentGlobalStates` / `componentGlobalStateId` / `onComponentGlobalStateChange` 与 `ComponentSlotList` import；加 `slotUseSlots` / `slotUseActiveId` / `onToggleSlotUse`。
  - 删 1085–1099 的全局状态下拉框、1479 条件中的 `componentEditSlots` 分支、1533–1535 的 `ComponentSlotList`。
  - 复用 `.canvas-slot-debug-panel` 样式新增左上角面板：标题 + 每行「插槽名 + 编辑/退出按钮」。
- [x] `utils/widgetTree.ts`：新增 `componentSlotSubtree`（只返回被编辑插槽的虚拟节点及其内容）；`virtualSlotsTreeData` 支持按插槽过滤。
- [x] `locales/zh.json` / `locales/en.json`：新增 `slotUsePanelTitle`、`slotUseEnter`、`slotUseExit`。

## T4 验证

- [x] `npx tsc -p apps/frontend-editor/tsconfig.json --noEmit` 通过。
- [x] 无引用残留（`paintComponentModeButton` / `syncComponentReveal` / `ComponentSlotList` / `component-mode` / `enterComponentEdit` / `exitComponentEdit` / `ComponentChromeLabels` / `componentGlobalStates` / `editingComponentHost` 全仓 0 命中）。
- [x] 手动回归（浏览器实测，工程「末日战争-宣发活动」，组件实例 `nmv5bgnyl-1`）：
  - 画布内无 `[data-component-mode]`，无「编辑组件」文案；
  - 选中组件实例 → 左上角出现「插槽使用编辑」面板（列「奖品 / 按钮」）；改选非组件节点 → 面板消失；
  - 点「编辑插槽」→ 按钮变「退出编辑」，画布可见节点只剩该插槽 + 其 3 个内容控件（其余 64 个隐藏），控件树只剩「插槽 · 奖品」子树；
  - 选中插槽内容控件（虚拟 id 前缀 `实例id__slot-s8ii1dgieib__`）→ 状态栏只有「控件状态」区块，无「全局状态」；
  - 点「退出编辑」/ Esc → 回到「选中组件实例」，画布恢复整页，面板保留；
  - 切到「预览」→ 自动退出（面板消失，host 类名清空）。
- [x] 回归：组件定义编辑器「插槽调试编辑」未改动（`slotDebugId` 路径、运行时 `stripDebugPathPresenceGates` 均未触碰；`componentEditTargetOk` 等白名单逻辑均由 `componentEditingRef` 门控，组件定义态为 false）。
