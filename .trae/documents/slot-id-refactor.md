# 插槽改造：去掉 name，改用 id 标识 + 编辑模式

## Context

用户要求：
1. 插槽去掉 `name`，改为 `desc`（描述）+ 自动生成的 `id` 做唯一标识
2. 外部使用组件时，插槽不用显示在画布上
3. 选中 component 控件时，右上角显示「编辑组件」按钮
4. 进入编辑时，插槽才显示，且画布其它内容隐藏（参考滚动容器编辑）
5. 插槽显示到控件树上

当前问题：`ComponentSlot` 用 `name` 做唯一标识，slot widget 也有 `name` 字段，所有匹配（slotArgs、slotContent、loop.ts materialize、component.ts evaluateSlotArgs）都按 name 匹配。改为 id 后，slot widget 的 `name` 去掉，匹配全部改用 slot 的 widget id。

## 改动范围

### 1. XML 层：ComponentSlot 去掉 name，加 id

**文件**: `packages/xml/src/page.ts`

- `ComponentSlot` 类型：`name` → `id`（string，必填）
- `compactComponentSlots`：校验 id 非空且唯一，不校验 isJsIdentifier
- `parseComponentSlots`：读 `@_id` 而非 `@_n`
- `serializeComponentSlots`：写 `@_id` 而非 `@_n`
- slot widget 的 `name` 字段去掉（PageWidget union 中 slot 变体）
- `parseWidgets` slot 分支：不再解析 `name` 属性
- `serializeWidgets` slot 分支：不再写 `@_name`
- `compactComponentSlotArgs`：外层键从 slotName 改为 slotId，不再校验 isJsIdentifier
- `parseComponentSlotArgs` / `serializeComponentSlotArgs`：用 `@_id` 替换 `@_n`
- `parseComponentSlotContent` / `serializeComponentSlotContent`：同上
- slot widget 的 `name` → `slotId`（引用 ComponentSlot 的 id）

**文件**: `packages/xml/src/index.ts`
- 导出不变（ComponentSlot 类型已导出）

### 2. 运行时：匹配改用 id

**文件**: `packages/lowcode-runtime/src/loop.ts`
- `SlotExpandContext`：`args` 和 `content` 的 key 从 slotName 改为 slotId
- `materialize` slot 分支：`slotCtx.defs?.find(item => item.id === next.slotId)` 替换 `item.name === next.name`
- `slotCtx.args?.[next.slotId]` 和 `slotCtx.content?.[next.slotId]`

**文件**: `packages/lowcode-runtime/src/elements/component.ts`
- `evaluateSlotArgs`：`defs?.find(item => item.id === slotId)` 替换 `item.name === slotName`
- slotArgs key 从 slotName 改为 slotId
- `slotExpand` 构造：args/content key 用 slotId

**文件**: `packages/lowcode-runtime/src/elements/slot.ts`
- `data-slot-name` → `data-slot-id`
- 不再读 `widget.name`

**文件**: `packages/lowcode-runtime/src/binding.ts`
- 无需改（$slot 参数读取不受影响）

### 3. 外部使用组件时插槽不显示

**文件**: `packages/lowcode-runtime/src/elements/slot.ts`
- 当 `!ctx.editing` 时，slot widget 渲染为空（不显示占位图标）
- slot 的 children 正常渲染（组件内部的图片等内容仍显示）
- 即：slot 容器本身不显示 chrome，只渲染子内容

### 4. 选中 component 时显示「编辑组件」按钮

**文件**: `apps/frontend-editor/src/views/PreviewPage/scrollChrome.ts`（或新建 componentChrome.ts）
- 仿照 `paintScrollModeButton`，新增 `paintComponentModeButton`
- 当编辑模式、选中 component 控件、组件有 slots 时，在右上角显示「编辑组件」按钮
- 点击发 `component-mode` postMessage

**文件**: `apps/frontend-editor/src/views/PreviewPage/index.tsx`
- 接收 `componentEditing` 状态
- 渲染循环中调用 `paintComponentModeButton`

### 5. 进入编辑组件时画布其它内容隐藏

**文件**: `apps/frontend-editor/src/views/ProjectEditorPage/index.tsx`
- 新增 `componentEditId` state（仿 `scrollEditId`）
- `enterComponentEdit` / `exitComponentEdit` 函数
- 向 iframe 推送 `componentEditing` 状态
- `exitOneEditLayer` 加入 component edit layer

**文件**: `apps/frontend-editor/src/views/PreviewPage/index.tsx`
- 接收 `componentEditing` 状态
- 编辑组件时隐藏画布其它内容，只显示组件内部

**文件**: `apps/frontend-editor/src/views/PreviewPage/styles.less`
- 仿 `.is-scroll-editing`，加 `.is-component-editing` CSS 规则

### 6. 插槽显示到控件树

**文件**: `apps/frontend-editor/src/utils/widgetTree.ts`
- slot widget 已经是 container 类型（slot helper 的 `container: true`），tree 应该自动包含
- 检查 `hasChildren` 是否正确处理 slot 类型

### 7. 编辑器适配

**文件**: `apps/frontend-editor/src/components/InspectorPropertyGrid.tsx`
- SlotParamsTab：`slotName` → `slotId`，用 `widget.slotId` 匹配
- slot 控件属性：`name` → `slotId`（只读，自动生成）

**文件**: `apps/frontend-editor/src/widgets/slot.ts`
- `create`：去掉 `name: ''`，加 `slotId: ''`
- `clone`/`patch`：适配 slotId

**文件**: `apps/frontend-editor/src/widgets/types.ts`
- WidgetPatch：`name` → `slotId`（如果是 slot 专用的）

**文件**: `apps/frontend-editor/src/widgets/component.ts`
- clone/patch 的 slotArgs key 改用 slotId

**文件**: `apps/frontend-editor/src/components/ComponentContractPanel.tsx`
- ComponentSlotsPanel：name 列改为 id 列（只读）+ desc 列

### 8. 生成 slot id

Slot id 生成策略：在创建 slot widget 或声明 ComponentSlot 时自动生成。
- 格式：`s` + 10 位 [a-z0-9] 随机字符（仿状态 id 生成）
- 或直接用 widget id（slot widget 的 `id` 字段）作为 slotId

**推荐方案**：slot widget 不再加 `slotId` 字段，直接用 widget 自身的 `id` 匹配 ComponentSlot 的 `id`。ComponentSlot 的 `id` 在创建时自动生成，和 slot widget 的 id 一致。这样最简洁。

但这需要在组件文档中，slot widget 和 ComponentSlot 的 id 保持一致。创建 slot widget 时同时创建 ComponentSlot 声明并共用同一个 id。

## id 关系决策

slot widget 有自己的 `id`，另加 `slotId` 字段引用 ComponentSlot 的 `id`。两者独立。
- slot widget: `{ type: 'slot', id: 'n1', slotId: 's1abc123', children: [...], desc?: string }`
- ComponentSlot: `{ id: 's1abc123', desc?: string, params?: ComponentProp[] }`
- 匹配逻辑全部用 `slotId` ↔ `ComponentSlot.id`

## 编辑模式决策

「编辑组件」在当前页面上下文编辑组件实例，不跳转到组件文档。
- 选中 component 控件 → 右上角显示「编辑组件」按钮
- 点击后隐藏画布其它内容，只显示该组件实例的内部内容（含插槽）
- 编辑的是组件实例在当前页面的渲染副本（不修改组件文档本身）
- 退出编辑回到正常页面视图
- 插槽内容编辑通过 slotContent 保存到当前页面的 component widget 上


1. 编辑组件文档：添加 slot 控件 → 出参 tab 可添加参数 → 保存
2. 外部页面：引用组件 → 画布上不显示插槽 chrome → 选中组件显示「编辑组件」按钮
3. 点「编辑组件」→ 画布只显示组件内部内容 + 插槽 → 可编辑插槽内容
4. 控件树：slot 节点可见
5. XML roundtrip：slot id、slot-args id、slot-content id 都正确
