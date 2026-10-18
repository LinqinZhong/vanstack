# 规范：使用组件时的「插槽使用编辑」

## 目标（用户原话）

> OK，参考这个逻辑，把使用组件时的操作插槽的方式也改一下：
> 1. 去掉编辑组件按钮以及编辑组件的功能
> 2. 选中组件时，在左上角显示插槽使用编辑（参考插槽调试编辑），选中插槽之后打开它的编辑

已澄清的两点：

- **画布范围**：进入「插槽使用编辑」后，**只显示该插槽内容，其余全部隐藏**（保留布局，与组件定义编辑器的插槽调试一致）。
- **面板与退出**：**选中组件实例时显示**面板；点某个插槽进入该插槽编辑，面板保持（可切换）；**再点当前插槽或 Esc 退出**编辑，回到「选中组件实例」状态。

## 术语

- **组件定义态**：编辑器正在编辑组件模板（`catalogKind === 'component'`，`centerContent`）。
- **插槽调试态**（已实现、本次不改）：组件定义编辑器内调试某个插槽（state `slotDebugId`，面板标题「插槽调试编辑」）。
- **组件编辑态**（本次删除）：页面上组件实例的整体编辑（入口为画布内「编辑组件」按钮，`componentEditId` + `componentEditing`）。
- **插槽使用编辑**（本次新增）：页面上选中组件实例后，在左上角面板里选中某个插槽，进入「只显示该插槽内容」的编辑。

## 现状（已核实）

- 入口按钮：`apps/frontend-editor/src/views/PreviewPage/scrollChrome.ts` 的 `paintComponentModeButton`（`[data-component-mode]`，挂在 iframe 的 `.preview-host` 上），点击后 postMessage `{type:'component-mode', action:'enter'|'exit'}`；`PreviewPage/index.tsx` 在 `refreshTableChrome()` 里调用；父页 `ProjectEditorPage/index.tsx` 在消息处理里调用 `enterComponentEditRef/exitComponentEditRef`。
- 隔离机制：`syncComponentReveal` 给 host 加 `.is-component-editing`、给主体组件加 `.lowcode-component.is-component-host`，配合 `PreviewPage/styles.less` 1094–1117 的 CSS：页面壳与所有 `[data-widget-id]` `visibility:hidden`，主体组件 `visibility:visible` 且 `position:fixed` 居中（「脱到屏幕中间」）。
- 白名单：`PreviewPage/index.tsx` 的 `componentEditTargetOk` 依赖 `.lowcode-component.is-component-host`，只放行位于 `[data-widget-type="slot"]` 内的节点；`hoverSafeTarget`、click 守卫、`preview/widget-style` 重绘、`paintChrome` 都走它。
- 编辑路由（**保留复用**）：`ProjectEditorPage/index.tsx`
  - `componentEditId` / `componentEditIdRef`，`resolveVirtualSelection`、`selectVirtual`、`virtualAncestorKeys`；
  - 控件树虚拟树 `withComponentVirtualTree`（`utils/widgetTree.ts`，插槽节点 `virtualInnerId(组件id, 模板插槽id)`，插槽下挂该实例 `slotContent`）；
  - 拖动路由 `handleComponentVirtualMove`；复制/删除/新增插槽内容的分支；
  - 状态宿主：第 1563–1625 行的 viewing 分派（`${实例id}__slot-${slotId}__${控件id}` 前缀）、`componentEditInstance`、`visibleStates`（仅选中插槽内容时显示）、`stateHostWidget`、`globalStateBarWidget`（该态下置空）。
- 运行时（**本次不改**）：`packages/lowcode-runtime/src/page.tsx` 的 `componentEditing`/`componentEditId` props；`elements/component.ts` 的 `prefixTree`（实例内模板 id 前缀 `实例id__`、插槽内容 id 前缀 `实例id__slot-${slotId}__`）、`editingThis`（组件自带 testData、`stripDataDrivenPresenceGates`）；`elements/slot.ts` 的 `slotChrome`/`slotOverrideMeta`。
- 画布边界 id 桥接：`PreviewPage/helpers.ts` 的 `toRawWidgetId` 会把 `xxx__slot-<slotId>__真实id` 还原成真实 id，编辑器只认真实 id。
- 旧版「组件编辑态」的插槽清单在状态栏区域渲染（`ComponentSlotList`，CanvasWorkspace 1533–1535）。

## 设计决策

1. **删除入口与整体编辑**：删除 `paintComponentModeButton`、`syncComponentReveal`、`editingComponentHost`、`ComponentChromeLabels`、`data-component-mode` 按钮、`component-mode` 消息分支、`enterComponentEdit`/`exitComponentEdit`、`componentEditViewSnapshotRef`、工具栏右上角「组件全局状态」下拉框及其 props。CSS 里「整组件脱到屏幕中央」的规则一并删除。
2. **复用编辑路由，不新增运行时能力**：`componentEditId`（= 正在编辑插槽内容的组件实例 id）与 `componentEditing: componentEditId !== null` 继续沿用，因此 `slotChrome`、白名单、虚拟选中、`slotContent` 前缀状态、控件树虚拟树全部照旧可用。新增 `slotUseEditId`（= 组件定义文档里那个插槽控件的 id）表示当前正在使用编辑的插槽。
3. **隔离用 CSS 类标记（不改运行时）**：新增 `syncComponentSlotFocus(host, root, editing, componentEditing, slotFocusId)`：
   - `editing && componentEditing && slotFocusId` 时：host 加 `.is-component-editing`，把 `[data-widget-id="<slotFocusId>"]`（`slotFocusId = 实例id__模板插槽id`，DOM 上就是这个 id）且带 `.lowcode-slot` 的元素加 `.is-slot-focus`；否则全部移除。
   - `styles.less`：`.preview-host.is-editing.is-component-editing .lowcode-page, .preview-host.is-editing.is-component-editing [data-widget-id] { visibility: hidden }`，再加 `.preview-host.is-editing.is-component-editing .lowcode-slot.is-slot-focus, ... .lowcode-slot.is-slot-focus [data-widget-id] { visibility: visible }`。删除旧的 `position:fixed` 居中与「整个组件可见」规则，保留 `.lowcode-window { outline: none }`。
   - 说明：`visibility` 可被子元素覆盖，隐藏元素不占空间的问题不存在（保留布局），与该模式下「只露出插槽内容」的目标一致。
4. **白名单收紧到聚焦插槽**：`componentEditTargetOk` 改为「存在 `.lowcode-component` 祖先、目标不是组件本体自身、且目标位于 `.lowcode-slot.is-slot-focus` 内」，不再依赖 `is-component-host`。
5. **面板**：`CanvasWorkspace` 左上角渲染与「插槽调试编辑」同结构的面板（复用 `.canvas-slot-debug-panel` 系列样式类），标题「插槽使用编辑」；每行插槽名 + 按钮（当前插槽显示「退出编辑」，其余显示「编辑插槽」）。
   - 显示条件：`catalogKind === 'page'` && `showStyleChrome`（编辑态 + 布局页）&& `!readOnly` && `!previewing` && 目标实例存在且其组件文档里有插槽。
   - 目标实例：`componentEditId` 有值则取它，否则取当前选中的组件实例（`selectedWidget.type === 'component'`）。
6. **进入/退出**：
   - `enterSlotUseEdit(componentId, slotWidgetId)`：设置 `componentEditId` / `slotUseEditId`（ref + state），选中清空（`selectWidget(null)`），`fitCanvas(false)`（聚焦该插槽内容），不写 viewing（沿用 1563 行 effect 的分派）。
   - `exitSlotUseEdit()`：清 `componentEditId` / `slotUseEditId`，`selectWidgetRef.current(componentId)`（回到「选中组件实例」，面板继续显示）。
   - `exitOneEditLayer`（Esc）把原来的 component 层替换为插槽使用编辑层。
   - 选中组件实例本身时（`selectWidget` 的 2752–2760 分支）改为调用 `exitSlotUseEdit()`；切到预览态、切换页面/组件文档时一并清空 `slotUseEditId`。
7. **控件树裁剪**：`withComponentVirtualTree` 增加可选参数 `onlySlotWidgetId`；插槽使用编辑态下只渲染该插槽的虚拟节点及其内容，避免树里点到画布不可见的其它插槽内容。面板仍是切换插槽的唯一入口。
8. **i18n**：新增 `slotUsePanelTitle`（插槽使用编辑 / Slot usage edit）、`slotUseEnter`（编辑插槽 / Edit slot）、`slotUseExit`（退出编辑 / Exit edit）。

## 改动清单（文件 / 位置）

1. `apps/frontend-editor/src/views/PreviewPage/scrollChrome.ts`
   - 删除 `ComponentChromeLabels`、`COMPONENT_MODE_ATTR`、`editingComponentHost`、`syncComponentReveal`、`paintComponentModeButton`。
   - 新增 `syncComponentSlotFocus(host, root, editing, componentEditing, slotFocusId)`。
2. `apps/frontend-editor/src/views/PreviewPage/index.tsx`
   - 删除 `componentLabelsRef`、`paintComponentModeButton` / `syncComponentReveal` 调用与 import。
   - 新增 `slotFocusId` 载荷字段 → `nextSlotFocusId` / `slotFocusIdRef` / `shouldRender` 依赖；`refreshTableChrome` 内调用 `syncComponentSlotFocus`。
   - `componentEditTargetOk` 改为依赖 `.lowcode-slot.is-slot-focus`。
3. `apps/frontend-editor/src/views/PreviewPage/styles.less`（约 1094–1117）
   - 旧「组件编辑」规则换成「插槽聚焦」规则（见设计决策 3）。
4. `apps/frontend-editor/src/views/ProjectEditorPage/index.tsx`
   - 删除 `enterComponentEdit` / `exitComponentEdit` / `enterComponentEditRef` / `exitComponentEditRef` / `componentEditViewSnapshotRef` / `component-mode` 消息分支 / 工具栏「组件全局状态」下拉框相关计算与 props（`componentGlobalOwnerId`、`componentGlobalStates`、`componentGlobalStateId`、`commitComponentGlobalState`）。
   - 新增 `slotUseEditId`（state + ref）；`enterSlotUseEdit` / `exitSlotUseEdit`；`exitOneEditLayer` 与 `selectWidget` 的对应分支调整；文档切换/预览态清空。
   - 载荷新增 `slotFocusId: componentEditId && slotUseEditId ? \`${componentEditId}__${slotUseEditId}\` : null`。
   - 新增 `slotUseInstance` / `slotUseSlots`（`{ id, name }`，复用 `collectTemplateSlots` + 声明名回退）；控件树传入 `onlySlotWidgetId`。
   - 删除状态栏区域 `componentEditSlots` 的计算与 props。
5. `apps/frontend-editor/src/views/ProjectEditorPage/components/CanvasWorkspace.tsx`
   - props：删 `componentEditSlots` / `onSelectSlot` / `showComponentGlobalState` / `componentGlobalStates` / `componentGlobalStateId` / `onComponentGlobalStateChange`；加 `slotUseSlots: Array<{id:string;name:string}>`、`slotUseActiveId: string | null`、`onToggleSlotUse: (slotId: string) => void`。
   - 删除 1533–1535 的 `ComponentSlotList` 渲染、1479 条件里的 `(componentEditId && componentEditSlots.length > 0)`、1085–1099 的全局状态下拉框、`ComponentSlotList` import。
   - 新增左上角「插槽使用编辑」面板（复用 `.canvas-slot-debug-panel` 类）。
6. `apps/frontend-editor/src/utils/widgetTree.ts`
   - `withComponentVirtualTree` 增加可选 `onlySlotWidgetId?: string`，透传给 `virtualSlotsTreeData` 过滤插槽。
7. `apps/frontend-editor/src/locales/zh.json`、`en.json`：新增三个文案键。

## 验证

1. 类型检查：`npx tsc -p apps/frontend-editor/tsconfig.json --noEmit`。
2. 手动（页面态，含插槽的组件实例）：
   - 画布内不再出现「编辑组件」按钮；
   - 选中组件实例 → 左上角出现「插槽使用编辑」面板并列出其插槽；选中非组件节点/空白 → 面板消失；
   - 点某插槽「编辑插槽」→ 画布只剩该插槽内容（其它插槽内容、组件模板、页面其它控件全部隐藏，位置不跳动）；控件树只剩该插槽节点及其内容；
   - 可点选/拖动/删除该插槽内容，属性面板与状态栏「状态」区块按 `实例id__slot-插槽id__控件id` 前缀正常工作；不出现「全局状态」区块；
   - 点当前插槽「退出编辑」或 Esc → 回到「选中组件实例」，画布恢复整页；
   - 切换到预览态 → 自动退出。
3. 回归：组件定义编辑器的「插槽调试编辑」行为不变（`slotDebugId` 路径与运行时 `stripDebugPathPresenceGates` 未改动）。

## 风险与边界

- 组件模板里若存在常量 `return false` 的存在与显示闸门挡住插槽路径：仅靠 `stripDataDrivenPresenceGates`（只剥数据驱动闸门）不够，常量闸门会让插槽整棵子树不进渲染树，隔离 CSS 找不到节点、画布仍显示整页（表现为只有无闸门的插槽能隔离）。已补「路径闸门剥离」：`slotFocusId` 透传进运行时，`component.ts` 对「组件根 → 聚焦插槽」链上的 `existsFn/displayFn/visibleFn` 一并剥掉（复用 `@vanstack/xml` 的 `stripPathPresenceGates`，与组件定义编辑器插槽调试态同一实现）。
- 聚焦插槽在使用方页面里没有内容（实例未提供该插槽的 slotContent）时，插槽本会返回 `null`：已让 `slot.ts` 把聚焦插槽视为 chrome 目标，即使无内容也渲染空占位，隔离画布才有节点可显示。
- 插槽内容里嵌套组件时，其内部节点同样位于 `.is-slot-focus` 子树内，可见且可编辑（与既有组件编辑态一致）。

