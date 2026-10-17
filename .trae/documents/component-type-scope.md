# 组件类型作用域：组件名命名空间 + importCpnts 闭包

## Context
当前类型目录是项目全局的：数据池命名空间对所有页面/组件可见（`useNamespaceCatalog(projectId)` 加载全部）。用户需求：
- 组件可定义自己的类型，**组件名（强制大驼峰）即该组件类型的命名空间**，作用域局部
- 类型可见性 = ①数据池全局类型（保留不变）②自身类型 ③使用到的组件的类型（直接 + 传递闭包）
- 页面/组件文档加 `importCpnts` 字段记录使用了哪些组件（存组件 id），服务端据此追踪类型
- 服务端新端点一次性解析作用域目录（避免前端 N+1）

已确认决策：数据池全局命名空间行为完全不变；importCpnts 由服务端在保存时从控件树派生；类型引用沿用现有 `ns:{namespace}\0{type}` 格式（组件名直接作为 namespace 名，级联/存储格式零改动）。

关键现状（已探明）：
- 编辑器 pageDocument 经 `normalizePageDocument` XML 往返会**剥离未知字段** → types/importCpnts 必须在 normalize 前摘出、写入时回填
- 服务端读白名单 `contentOf`（lowcode.ts L154-166）与写白名单 `applyDocument`（L168-178）都需加字段
- 组件 key 是 kebab-case（`KEY_PATTERN`，被 XML componentKey 依赖不可改）→ 命名空间用组件 **name**（大驼峰）
- 组件保存唯一入口 `saveLoadedDocument`（index.tsx L5519-5565），keepalive 旁路 L1555，跳存守卫依赖 documentKey（L557）

## ① 数据模型（packages/shared/src/index.ts）
- `PageDocumentDto`（L58-66）加 `types?: NamespaceTypeDto[]`（页面暂不用，预留对称）、`importCpnts?: string[]`
- 新增：
  - `TypeCatalogEntryDto { name: string; types: string[] }`
  - `TypeCatalogDto { global: TypeCatalogEntryDto[]; components: TypeCatalogEntryDto[]; own?: { name: string; types: NamespaceTypeDto[] } }`

## ② 服务端（apps/frontend-editor-server/src）
**lowcode.ts**：
1. `contentOf` / `applyDocument` 白名单各加 `types`、`importCpnts`
2. 新 helper `deriveComponentIds(widgets)`：递归遍历 `children` + `slotContent` 收集 `type==='component'` 的 `componentId`，去重排序（无环数据天然防环）
3. `updatePageDocument`（L510）/ `updateComponentVersion`（L634）：applyDocument 归一化**之前**从原始 input.document 摘出 `types`，`importCpnts` 一律服务端派生覆盖，随后写入 snapshot/version
4. `createComponent`（L529）/ `updateComponent`（L568）：name 校验加新 pattern `/^[A-Z][A-Za-z0-9]{0,63}$/`（大驼峰），改名时弹层提示引用断链由前端做
5. 新函数 `typeCatalog(projectId, { kind: 'page'|'component', ownerId, versionId })`：
   - global：读 `project.namespace` 列表 + 各 `namespace.version` 文件 → `{name, types[]}`
   - 闭包：owner 的 `importCpnts` 做 BFS，visited 防环；组件文档缺失/已删静默跳过；每个组件取 `component.currentVersionId` 对应版本的 `types` 入目录、`importCpnts` 继续入队
   - own：仅 kind=component 时返回该组件自身 `{name: 组件name, types}`
   - 返回 `TypeCatalogDto`

**server.ts**：`dispatch`（L112-264）加路由 `POST /api/projects/:id/type-catalog`（body: {kind, ownerId, versionId}）

## ③ 编辑器（apps/frontend-editor/src）
1. **apis/api.ts**：加 `scopedTypeCatalog(projectId, body): Promise<TypeCatalogDto>`
2. **views/ProjectEditorPage/helpers.ts**：加 `PASCAL_CASE_PATTERN`；**PageFormModal.tsx**（L34-38）：kind='component' 时 name 用大驼峰校验（替换现有 required 校验）
3. **components/TypeKindFields.tsx**：导出 `useScopedTypeCatalog(projectId, owner | null)`——owner 为 null 时回退现有 `useNamespaceCatalog`（数据池等场景）；owner 变化/versionId 变化时重新拉取，返回 `NamespaceCatalogEntry[]`（global + components 合并，同名字段由调用方去重）。`useNamespaceCatalog` 保留
4. **components/NamespaceTypesPane.tsx**：
   - `NamespaceTypesPane` 加可选 `namespaces` prop 覆盖内部 useNamespaceCatalog（组件模式编辑类型字段时级联需 scoped 目录）
   - 新增 `ComponentTypesSection`：无命名空间 Select，标题「类型定义（命名空间：{组件名}）」，折叠 chevron 样式对齐 NamespaceTypesSection；内部复用 `NamespaceTypesPane`（headless），伪 doc = `{name: 组件名, versionId: 组件versionId, types: componentTypes, data: []}`，onCommit 把 types 回传编辑器
5. **components/CanvasWorkspace.tsx**：L622 换 `useScopedTypeCatalog(projectId, scopedOwner)`；新增 props `scopedOwner` / `componentTypes` / `commitComponentTypes`；L1237 数据 tab componentMode 分支改渲染 `ComponentTypesSection`（页面模式保留 NamespaceTypesSection 管理全局命名空间）
6. **views/ProjectEditorPage/index.tsx**：
   - 新增 `componentTypes` state + ref；hydrateVersion（L2251）在 normalize 前从原始 `version.document` 摘出 types
   - documentKey（L557）并入 types（否则纯类型编辑命中跳存守卫不保存）
   - `saveLoadedDocument` 组件分支（L5552）与 keepalive 载荷（L1555）追加 `types: componentTypesRef.current`
   - 构造 `scopedOwner = componentMode ? { kind:'component', ownerId: 组件id, versionId, name } : null` 传 CanvasWorkspace
   - 页面 importCpnts 零改动（服务端派生）

## 已接受的限制（v1）
- 组件改名后旧引用 `ns:{旧名}\0{type}` 断链（与全局命名空间 rename 行为一致），改名弹窗加提示文案
- 组件名与全局命名空间重名时级联分组重名（罕见，不校验）
- types 不进 XML 导出（serializePageXml）；云端 Nest 后端不同步（本地开发服务器独立路由）

## 关键文件
- packages/shared/src/index.ts — DTO 扩展（改后需 `pnpm build:packages`）
- apps/frontend-editor-server/src/lowcode.ts — 白名单、deriveComponentIds、typeCatalog、大驼峰校验
- apps/frontend-editor-server/src/server.ts — type-catalog 路由
- apps/frontend-editor/src/views/ProjectEditorPage/index.tsx — types 状态/摘取/documentKey/保存载荷
- apps/frontend-editor/src/components/NamespaceTypesPane.tsx — ComponentTypesSection、namespaces prop
- apps/frontend-editor/src/components/TypeKindFields.tsx — useScopedTypeCatalog
- apps/frontend-editor/src/components/CanvasWorkspace.tsx — 目录切换 + 类型区分流
- apps/frontend-editor/src/components/PageFormModal.tsx + views/ProjectEditorPage/helpers.ts — 大驼峰校验

## 验证
1. `pnpm build:packages`（shared 变更后必须）→ `pnpm typecheck`（忽略 InspectorPropertyGrid.tsx 既有 7 个 grid 错误）
2. 重启本地开发服务器（frontend-editor-server 需重启加载新路由）
3. 浏览器（dev server 5173，war 项目）：
   - 新建组件：name 非 大驼峰被拦截；合法名通过
   - 组件模式数据 tab：类型区显示「类型定义（命名空间：组件名）」，增删类型→保存→刷新后仍在（验证 documentKey 修复）
   - 组件模式属性面板类型级联：出现「组件名」分组及其中类型
   - 页面拖入该组件：页面类型级联出现该组件命名空间分组
   - 传递闭包：组件 A 内嵌组件 B，页面用 A → 页面级联同时可见 A、B 的类型
   - 防御：删除已引用组件后打开页面 type-catalog 不报错、级联正常（缺失静默跳过）
   - 回归：数据池全局命名空间增删改查不变；页面模式类型区（全局命名空间管理）不变
