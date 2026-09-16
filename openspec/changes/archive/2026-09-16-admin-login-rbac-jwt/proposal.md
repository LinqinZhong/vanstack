## Why

管理后台 `frontend-admin` 目前无登录与权限边界，任何打开页面的人都可以查看并删除文档/对象。需要在 admin 增加用户名+密码登录，并用 JWT + RBAC 把身份和权限落到后端与数据表，作为后台访问控制的基础。

## What Changes

- 在 `apps/frontend-admin` 新增登录页：用户名 + 密码；未登录不能进入后台工作区；支持登出。
- 后端新增认证 API：校验凭据后签发 JWT，并提供当前用户/角色/权限查询。
- 新增 TypeORM 实体并在目标库中创建 `sys_user`、`sys_role` 表；用户与角色为多对多，使用 `sys_user_role` 关联表。
- 角色携带权限码，后端以 JWT + RBAC Guard 校验鉴权与权限。
- 启动时若无用户则种子化默认管理员账号与 `admin` 角色。
- 本地开发连接本机 MySQL：`127.0.0.1:3306`、库名 `vanstack`、用户 `root`、密码通过环境变量 `DB_PASSWORD` 配置（本机值为 `Password_1727`）。代码默认仍保留 `DB_TYPE=sqlite`，并继续支持 `postgres`。
- 登录文案走现有 `zh` / `en` i18n。
- 本变更不给 `frontend-app` 工作台加登录；现有 `/api/documents` 与 `/api/files` **暂不**强制 JWT，以免打断工作台。Admin 调用这些 API 时仍附带 Bearer Token，为后续收口做准备。

## Capabilities

### New Capabilities

- `admin-login`: 管理后台登录页、会话保持、未登录拦截与登出。
- `rbac-jwt`: `sys_user` / `sys_role` 持久化、JWT 签发校验、基于角色权限码的 RBAC 控制。

### Modified Capabilities

- （无。仓库尚无主 spec。）

## Impact

- **前端**：`apps/frontend-admin`（登录视图、请求头携带 JWT、本地会话）；`packages/shared` 增加登录/用户 DTO。
- **后端**：`apps/backend` 新增 Auth 模块、实体、Guard、种子数据；依赖 `@nestjs/jwt`、`passport-jwt`、`bcrypt`。
- **配置**：`apps/backend/.env` 与根目录 `.env.example` 增加 `JWT_SECRET`、`ADMIN_SEED_USERNAME`、`ADMIN_SEED_PASSWORD`；本地 MySQL 使用 `DB_TYPE=mysql`、`DB_HOST=127.0.0.1`、`DB_PORT=3306`、`DB_USER=root`、`DB_NAME=vanstack`、`DB_PASSWORD=Password_1727`。
- **数据库**：目标库 `vanstack` 新增 `sys_user`、`sys_role`、`sys_user_role`。
- **非目标**：工作台登录、用户/角色管理 CRUD 页面、刷新令牌、第三方登录。
