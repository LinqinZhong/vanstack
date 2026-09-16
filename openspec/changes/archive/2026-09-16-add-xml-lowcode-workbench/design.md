## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-project/spec.md`、`specs/lowcode-page/spec.md`、`specs/lowcode-runtime/spec.md`。

现状：`frontend-admin` 登录后工作区内容为空，无路由库；`frontend-app` 是空 H5 壳（5173）。后端 NestJS + TypeORM，已有 JWT/RBAC 与 `OssService`（local / S3）。本机 MinIO 已通过 `minio` 包的 `start:win` 跑在 `:9000`（控制台 `:9001`），根用户与 `minio/package.json` 中脚本一致。`OssStorage.getPublicUrl` 在未配 `OSS_PUBLIC_URL` 时指向 `/api/files/content/:key`，但仓库中没有对应控制器，不能把该 URL 当作可读取入口。`packages/xml` 目前只处理 documents XML。实体风格为 uuid 主键、snake_case 列名、非生产 `synchronize`。

## Goals / Non-Goals

**Goals:**

- 用现有 TypeORM 连接落地三张表，并用现有 S3 `OssService` 把页面 XML 写到本机 MinIO。
- Admin 用路由区分工程首页、工程编辑页与同应用预览页；编辑页主窗口管数据与控件 AST，iframe 加载 admin 自己的 `/preview`，为后续父子窗口交互保留同源通道。
- 页面 XML 的解析/序列化放在 `@vanstack/xml`；`text`/`button` 的 React 底层渲染（`createElement` + `createRoot().render()`）放在 `@vanstack/lowcode-runtime`，供 admin 预览与 H5 共用。
- H5（`frontend-app`）独立实现运行时宿主：只消费公共渲染，不承担工作台，也不作为 admin iframe 目标。
- 低代码 API 默认走全局 JWT Guard，并用权限码 `lowcode:manage`（管理员 `*` 已覆盖）。

**Non-Goals:**

- 不实现 `/api/files/content` 公开读（避免 XML 未鉴权泄露）；`xmlUrl` 只作为资源地址字段保存。
- 不把 admin 预览 iframe 指向 `frontend-app`；H5 与工作台预览功能分离。
- 不引入拖拽坐标、画布选区或绝对定位；控件按 XML 顺序纵向排列。
- 不改 `admin-login` / `rbac-jwt` 契约，不给 `frontend-app` 加登录。
- 本期不实现父子窗口选中、高亮、回写 AST 等交互，只保留同源 iframe + preview postMessage，便于后续加协议。

## Decisions

### 1. 三表模型，页面当前版本用可空引用避免建表环

| 表 | 关键字段 |
| --- | --- |
| `project` | `id` uuid、`name`、`key`（全局 unique）、`description`、时间戳 |
| `project_page` | `id` uuid、`project_id`、`name`、`key`、`description`、`current_version_id`（可空）、`xml_key`、`xml_url`、时间戳；`UNIQUE(project_id, key)` |
| `project_page_version` | `id` uuid、`page_id`、`version_no` int、`description`、`xml_key`、`xml_url`、时间戳；`UNIQUE(page_id, version_no)` |

创建页面顺序：先插入 `project_page`（`current_version_id` 为空）→ 上传初始 XML → 插入 `version_no=1` → 回写页面的 `current_version_id` / `xml_key` / `xml_url`。页面 `ManyToOne` 工程 `onDelete: CASCADE`；版本 `ManyToOne` 页面 `onDelete: CASCADE`。`current_version_id` 不做强制数据库外键（避免与 `page_id` 循环），由服务层保证引用有效。

`key` 校验：`^[a-z][a-z0-9-]{0,63}$`。删除工程或页面时，服务层先收集相关 `xml_key` 再删库，再 `deleteObject`。

备选：把当前 XML 只存在版本表、页面不冗余 `xml_url`。否决原因：需求明确页面要有「当前页内容的 xml 资源地址」。

### 2. 本机 MinIO + 现有 S3 驱动存 XML

本地开发走已启动的 MinIO，不新建 OSS 实现。`apps/backend/.env`：

| 键 | 本地值 |
| --- | --- |
| `OSS_DRIVER` | `s3` |
| `OSS_ENDPOINT` | `http://127.0.0.1:9000`（与 MinIO API 同源，不用局域网广告地址） |
| `OSS_ACCESS_KEY` | `neweb` |
| `OSS_SECRET_KEY` | `Aa123456` |
| `OSS_BUCKET` | `vanstack`（若不存在则创建） |
| `OSS_REGION` | `us-east-1` |
| `OSS_PUBLIC_URL` | `http://127.0.0.1:9000/vanstack` |

凭据与 `pnpm start:win`（`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`）以及 `mc alias set ... neweb Aa123456` 一致。代码层 `OSS_DRIVER` 默认仍可为 `local`，与上次 MySQL 不改代码默认的做法相同。

对象键：`lowcode/{projectKey}/{pageKey}/v{versionNo}.xml`。创建版本用新 key；修改版本覆盖同一 key。Content-Type：`application/xml`。初始 XML：`<page></page>`。

在 `OssService` 增加 `putObject(key, body, contentType)`（不要伪造 Multer 文件）。版本详情与页面详情 API 返回 `xml` 字符串（服务端 `getObject`），前端不直接 GET `xmlUrl`。写入前用 `parsePageXml` 校验，非法 XML 拒绝保存。

备选：继续用 `OSS_DRIVER=local` 写 `uploads/`。否决原因：本机 MinIO 已在跑，需求是 XML 进 OSS；S3 驱动已存在。

备选：实现公开 `GET /api/files/content/:key` 让预览页自己拉对象。否决原因：现有 URL 设计无鉴权，且规格要求 XML 读写需要令牌。

### 3. REST 与权限

`LowcodeModule` 注册到 `AppModule`。控制器加 `@RequirePermissions('lowcode:manage')`（不标 `@Public()`）。

- `GET/POST /api/projects`，`GET/PATCH/DELETE /api/projects/:id`
- `GET/POST /api/projects/:id/pages`，`PATCH/DELETE /api/projects/:id/pages/:pageId`
- `GET/POST /api/projects/:id/pages/:pageId/versions`
- `PATCH/DELETE /api/projects/:id/pages/:pageId/versions/:versionId`
- `POST /api/projects/:id/pages/:pageId/activate-version` body：`{ versionId }`

创建/修改版本的 body 含 `xml` 与可选 `description`。删除当前在用版本返回 409。DTO 放 `packages/shared`。校验用现有 `ValidationPipe`。

备选：细拆 `lowcode:project:read` 等码。推迟：本期只有管理员种子账号，`*` 已够用，保留单码便于后续拆。

### 4. Admin 引入 `react-router-dom`，预览页与工作台同应用

登录门闩仍在 `App.tsx`（与现有会话逻辑一致）。已登录后：

- `/` 工程首页（列表/创建/编辑配置/删除/进入）
- `/projects/:id` 工程编辑页；未知 id 展示失败并提供回首页
- `/preview` 预览页：无侧栏、无工程/页面/版本 UI，只挂载公共渲染器；由编辑页 iframe 加载

编辑页布局：左侧页面列表与配置，中部 iframe，右侧版本列表，顶部或侧栏提供添加文本/按钮。父窗口持有页面 AST（`parsePageXml` / `serializePageXml`），控件列表在父窗口选择与改文案；iframe 只负责渲染。保存动作为「修改当前选中版本」或「创建新版本」，与草稿预览分离。

`iframe.src` 使用相对路径 `/preview`（同源 `127.0.0.1:5174`）。同源便于后续用 `contentWindow` / `postMessage` 做选中、高亮等父子交互；本期只发 preview XML。

备选：iframe 指向 `frontend-app`。否决原因：后续要做父子窗口交互，跨源会限制 DOM 与协议演进；H5 运行时功能也与工作台预览不同，不应绑在同一宿主上。

### 5. 公共渲染包装 `@vanstack/lowcode-runtime`，两套宿主功能分离

新增 `packages/lowcode-runtime`：依赖 `@vanstack/xml`，`react` / `react-dom` 作为 peer（与两个前端的 React 19 对齐）。导出例如 `renderPageXml(container, xml)`：

1. `parsePageXml`；失败则清空上一棵树并返回错误信息给宿主（宿主决定错误 UI）。
2. 成功则用 `createElement` 按声明顺序生成 `span`（text）与 `button`（button），包在一个 `div` 中；控件树不使用 JSX。
3. 对挂载点 `createRoot` 只创建一次，之后 `root.render(...)`。不使用已移除的 `ReactDOM.render`。用户口中的 `createNode` 对应 `createElement`。

包内 MUST NOT 包含：Ant Design、工作台布局、版本列表、preview postMessage 协议。

**Admin 预览宿主**（`/preview`）：校验 `event.origin` 为本 app origin；`source: 'vanstack-lowcode'`。

- 子 → 父：`{ source, type: 'ready' }`，父收到后再发当前 XML。
- 父 → 子：`{ source, type: 'preview', xml: string }`。
- 收到非法 XML 时由宿主展示错误态，并卸载上一棵有效树。
- 父在 `ready` 后发送，iframe `load` 后若超时未 ready 则重发一次。

**H5 宿主**（`frontend-app`）：独立页面调用同一 `renderPageXml`。不监听工作台 preview 协议，不展示工作台。本期用一份可注入的合法 XML（例如开发用示例或后续数据源）证明独立渲染；不把 admin 编辑态同步到 H5。

备选：把 `createElement` 渲染写在 `@vanstack/xml`。否决原因：xml 包目前无 React 依赖，应保持可被后端使用。

### 6. `@vanstack/xml` 扩展页面 schema，保留 documents API

新增 `parsePageXml` / `serializePageXml`，独立 parser 配置（`ignoreAttributes: false`，`text`/`button` 按数组处理）。控件类型：

```xml
<page>
  <text id="t1" value="你好" />
  <button id="b1" text="确定" />
</page>
```

未知子元素跳过；无 `page` 根或 XML 非法抛 `XmlParseError`。`id` 在序列化时若缺则生成 `n{n}`。现有 `parseDocumentsXml` 保持不变。Admin、App 与 lowcode-runtime 均通过 Vite alias / workspace 依赖引用源码。

根目录 `dev` / `build` / `build:packages` 脚本须把 `@vanstack/lowcode-runtime` 与 xml/shared 一起先构建。

## Risks / Trade-offs

- [跨源 iframe 被浏览器挡第三方 cookie / 严格 origin] → 预览改为 admin 同源 `/preview`，不再依赖 5173；后续父子交互也走同源。
- [公共渲染包被塞进宿主功能] → 包边界只导出 `renderPageXml`（及必要类型）；postMessage 与工作台 UI 留在 admin，H5 自己写宿主。
- [MinIO 未启动或 bucket 不存在导致 put 失败] → 实现任务先确认 `:9000` 可连并创建 `vanstack` bucket；文档写明需先 `pnpm start:win`。
- [覆盖同一 OSS key 时 CDN 缓存旧 XML] → 本期实际读取走后端 `getObject`，不经过公开 URL；MinIO 无 CDN。
- [删除 OSS 失败导致孤儿对象] → 先删库记录再尽力删对象；记录错误日志，不回滚已删页面（页面已对用户不可见）。
- [修改工程/页面 `key` 使已有 OSS 路径不一致] → 改 `key` 不移动历史对象；新版本按新 key 写。地址以记录中的 `xml_key` 为准。
- [父窗口未等 `ready` 就发 XML] → 父在 `ready` 后发送，并在 iframe `load` 后若超时未 ready 则重发一次。

## Migration Plan

1. 确认 MinIO 在 `127.0.0.1:9000` 运行，创建 `vanstack` bucket；更新 `apps/backend/.env` 为 `OSS_DRIVER=s3` 及上表凭据。
2. 后端启动后确认 `project`、`project_page`、`project_page_version` 出现在当前库（本地仍为 MySQL `vanstack` 或 `.env` 所指库）。
3. 构建 `@vanstack/xml` / `@vanstack/lowcode-runtime` / `@vanstack/shared`，启动 admin:5174 与 app:5173。
4. 用种子管理员登录，走通：建工程 → 进编辑页 → 建页面（自动 v1）→ 加文本/按钮 → **admin iframe** 预览 → 存版本 / 切当前版本；再在 H5 独立宿主用同一份 XML 确认控件渲染一致。MinIO 中应出现 `lowcode/.../v1.xml`。
5. 回滚：下线 `LowcodeModule` 与前端路由，表与 MinIO `vanstack/lowcode/` 前缀可保留无害；把 `.env` 的 `OSS_DRIVER` 改回 `local` 即可停用 MinIO 写入；不改动认证表。

## Open Questions

- 新建控件的默认文案用「文本」/「按钮」还是空字符串：实现时按 i18n 默认文案即可，不影响规格。
