## 1. 共享类型与页面 XML

- [x] 1.1 在 `packages/shared/src/index.ts` 导出工程/页面/版本 DTO（含 `id`、`name`、`key`、`description`、`xml`、`xmlKey`、`xmlUrl`、`currentVersionId`、`versionNo` 及创建/更新输入类型），构建后确认 `packages/shared/dist/index.d.ts` 包含这些类型
- [x] 1.2 在 `packages/xml` 新增 `parsePageXml` / `serializePageXml`：合法 `<page>`+`text`/`button` 可往返；未知子元素被忽略；缺 `page` 根或非法 XML 抛 `XmlParseError`；构建后用一段示例 XML 跑通解析与序列化，并确认 `parseDocumentsXml` 仍可用
- [x] 1.3 新增 `packages/lowcode-runtime`（依赖 `@vanstack/xml`，peer `react`/`react-dom`），导出 `renderPageXml(container, xml)`：用 `createElement` + 单例 `createRoot().render()` 按顺序渲染 `span`/`button`，控件树不使用 JSX；包内不含工作台 UI 或 postMessage。根目录构建脚本纳入该包，构建后两端能解析该导出

## 2. 数据模型与 OSS

- [x] 2.1 新增 TypeORM 实体 `Project`、`ProjectPage`、`ProjectPageVersion`，字段与 `design.md` 决策 1 一致（含 `UNIQUE` 与 cascade），启动后端后在目标库确认三张表已创建
- [x] 2.2 将 `apps/backend/.env` 改为 `OSS_DRIVER=s3`、`OSS_ENDPOINT=http://127.0.0.1:9000`、`OSS_ACCESS_KEY=neweb`、`OSS_SECRET_KEY=Aa123456`、`OSS_BUCKET=vanstack`、`OSS_PUBLIC_URL=http://127.0.0.1:9000/vanstack`（`.env.example` 只写占位，不写真实密码）；确认 MinIO 已在 9000 端口运行并创建 `vanstack` bucket
- [x] 2.3 为 `OssService` 增加 `putObject(key, body, contentType)`，向 MinIO 写入 `lowcode/demo/home/v1.xml` 后再 `getObject` 读回相同内容

## 3. 低代码 API

- [x] 3.1 新增 `LowcodeModule` 并注册到 `AppModule`，实现工程 `GET/POST /api/projects` 与 `GET/PATCH/DELETE /api/projects/:id`，全部加 `@RequirePermissions('lowcode:manage')`；无令牌返回 401，种子管理员可创建/列出/更新/删除；重复 `key` 被拒绝
- [x] 3.2 实现页面 `GET/POST/PATCH/DELETE /api/projects/:id/pages/:pageId?`：创建页面时写入初始 `<page></page>` 到 OSS、生成 `version_no=1` 并回写当前版本与 `xmlUrl`；详情返回当前 XML；缺 name/key 不落库；同工程重复页面 `key` 被拒绝
- [x] 3.3 实现版本 `GET/POST/PATCH/DELETE` 与 `POST .../activate-version`：新版本号递增且新 OSS key；修改覆盖同一 key 后再次读取为新 XML；删除非当前版本成功、删除当前版本返回 409；激活版本后页面 `xmlUrl` 指向该版本

## 4. 管理后台首页

- [x] 4.1 在 `frontend-admin` 增加 `react-router-dom` 依赖，登录门闩保持在 `App.tsx`，已登录后 `/` 为工程首页、`/projects/:id` 为编辑页、`/preview` 为无侧栏预览页；未登录打开 5174 仍只见登录页
- [x] 4.2 实现工程首页：列表、创建、配置编辑、删除、进入工程；空列表仍有创建入口；创建/编辑校验名称与 `key`；删除后列表不再包含该工程；进入后 URL 变为 `/projects/:id`。文案写入 zh/en i18n

## 5. 工程编辑页

- [x] 5.1 实现工程编辑页的页面列表与配置：创建/编辑/删除页面，选中页面加载版本列表与当前 XML；未知工程 id 展示失败并提供回首页
- [x] 5.2 实现版本面板：创建版本（提交当前 XML）、修改选中版本、删除非当前版本、设为当前在用；创建页面后可见初始版本 1。保存非法 XML 时接口失败且界面有提示
- [x] 5.3 实现控件编辑：可添加 `text`/`button`、在父窗口列表中改文案并用 `serializePageXml` 更新草稿；编辑页 iframe 的 `src` 为同源 `/preview`（不是 5173）；每次有效编辑后向 iframe postMessage `{ source: 'vanstack-lowcode', type: 'preview', xml }`（等 `ready` 后再发，必要时在 iframe load 后重发）

## 6. 预览宿主与 H5 运行时

- [x] 6.1 在 `frontend-admin` 实现 `/preview`：无工作台壳层，同源校验后监听 preview 消息，调用 `renderPageXml` 渲染；用含「你好」文本与「确定」按钮的 XML 确认 iframe 内可见二者且顺序正确。空 `<page></page>` 不渲染控件；非法 XML 展示错误态且不保留上一份有效控件树；子窗口发出 `ready`
- [x] 6.2 在 `frontend-app` 用同一 `renderPageXml` 实现独立运行时宿主：不监听工作台 preview 协议、不展示工程/页面/版本 UI、不作为 admin iframe 目标。用与 6.1 相同的示例 XML 确认 H5 同样先展示「你好」再展示「确定」按钮

## 7. 端到端验收

- [x] 7.1 使用种子管理员走通：登录 → 建工程 → 进入工程 → 建页面（自动 v1）→ 添加文本与按钮看到 **admin `/preview` iframe** 预览 → 保存为新版本 → 再改草稿并修改版本 → 切换当前在用版本预览随之变化 → 删除非当前版本成功、删除当前版本失败 → 删除页面与工程后无法再进入。确认 iframe 文档来自 5174 而非 5173；确认 H5 独立宿主能渲染同一套控件且无工作台；确认未登录无法调用 `/api/projects`；确认 MinIO `vanstack` bucket 中出现对应 `lowcode/...xml` 对象
