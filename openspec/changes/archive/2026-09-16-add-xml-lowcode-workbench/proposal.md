## Why

管理后台工作区目前是空壳，仓库虽有 OSS 与 `@vanstack/xml`，但没有以 XML 描述页面、按工程组织页面版本、并在隔离窗口中渲染控件的低代码能力。现在需要先打通工程/页面/版本数据与按钮、文本两个控件的可编辑预览，作为后续控件扩展的底座。

## What Changes

- 在管理后台首页提供工程的创建、删除、配置编辑、列表与进入工程。
- 新增工程编辑页：页面的创建、删除、配置编辑、列表；选中页面后管理版本（创建、删除、修改）；创建页面时自动生成初始版本。
- 每个版本对应一份保存在 OSS 的 XML 资源；页面记录当前在用版本及其 XML 资源地址。
- 工作台主窗口与 iframe 预览页都放在 `frontend-admin`：主窗口负责编排，子窗口加载同应用预览路由，便于后续父子窗口交互。
- `text`/`button` 的 XML→React 渲染抽到公共包，admin 预览与 H5（`frontend-app`）共用同一套渲染逻辑；H5 独立做运行时宿主，不承担工作台编辑能力。
- 后端新增 `project`、`project_page`、`project_page_version` 持久化与受 JWT/RBAC 保护的 API；复用现有 `OssService` 存取 XML。
- 扩展 `@vanstack/xml` 增加页面 XML 的解析/序列化（与现有 documents XML 并存）。
- 本期不做拖拽画布、布局容器、发布到独立域名、控件市场，也不改登录/RBAC 契约；父子窗口的选中/高亮等交互留到后续变更。

## Capabilities

### New Capabilities

- `lowcode-project`: 低代码工程的持久化与管理后台首页上的工程创建、删除、配置编辑、列表和进入工程。
- `lowcode-page`: 工程页面与页面版本的生命周期、当前在用版本、以及版本 XML 在 OSS 中的存储与读取。
- `lowcode-runtime`: 页面 XML 中的 `text`/`button` 控件契约、公共渲染逻辑，以及 admin 同应用 iframe 预览与 H5 独立运行时两套宿主。

### Modified Capabilities

- （无。现有 `admin-login` 与 `rbac-jwt` 的登录与鉴权要求不变；新 API 走已有受保护接口规则。）

## Impact

- **前端**：`apps/frontend-admin` 增加工程首页、工程编辑工作台、同应用 iframe 预览页，并引入路由；`apps/frontend-app` 作为 H5 独立运行时宿主，调用同一套公共渲染，不嵌入工作台、不作为 admin iframe 目标。
- **共享包**：`packages/xml` 增加页面 XML schema；新增 `packages/lowcode-runtime` 承载 React 底层渲染；`packages/shared` 增加工程/页面/版本 DTO。
- **后端**：`apps/backend` 新增 TypeORM 实体与模块；XML 经现有 S3 OSS 驱动写入本机 MinIO；相关接口需 JWT，权限码由管理员通配 `*` 覆盖。
- **配置**：本地 `apps/backend/.env` 设 `OSS_DRIVER=s3`、`OSS_ENDPOINT=http://127.0.0.1:9000`、`OSS_ACCESS_KEY`/`OSS_SECRET_KEY` 与 `minio` 的 `start:win`（`neweb` / `Aa123456`）一致；代码默认仍可保留 `OSS_DRIVER=local`。
- **数据库**：新增 `project`、`project_page`、`project_page_version`（非生产仍用 TypeORM synchronize）。
- **依赖**：admin 增加 `react-router-dom`；admin 与 app 依赖 `@vanstack/xml` 与 `@vanstack/lowcode-runtime`；不新增第二个 OSS 实现。
- **非目标**：拖拽坐标布局、更多控件、页面发布/访问控制、可视化 XML 源码编辑器、用户级多租户隔离、本期实现父子窗口选中/高亮协议。
