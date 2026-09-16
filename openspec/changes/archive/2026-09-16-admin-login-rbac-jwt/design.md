## Context

现状与约束见仓库实现，动机见 `proposal.md` 的 Why。管理后台是单页 `App.tsx`，无路由库，API 经 Vite 代理到 `http://127.0.0.1:3000/api`。后端 NestJS + TypeORM，已支持 `sqlite` / `postgres`，尚无认证模块。行为契约见 `specs/admin-login/spec.md` 与 `specs/rbac-jwt/spec.md`。

本地目标库为本机已运行的 MySQL 8（`127.0.0.1:3306`，库名 `vanstack`，用户 `root`，密码由 `DB_PASSWORD` 提供，本机值为 `Password_1727`）。规划阶段曾假设 PostgreSQL，apply 时确认 5432 未监听而 3306 可用。仍保留 sqlite / postgres 分支。

## Goals / Non-Goals

**Goals:**

- 用现有 TypeORM 连接在目标库建 `sys_user` / `sys_role` / `sys_user_role`，并种子化管理员。
- 后端 JWT 鉴权 + 权限码 Guard；前端登录页与会话门闩。
- 新增依赖与环境变量可在 sqlite 与 postgres 两种 `DB_TYPE` 下工作。

**Non-Goals:**

- 不在此设计用户/角色管理 UI、刷新令牌、OAuth。
- 不把 `/api/documents`、`/api/files` 改为强制鉴权。
- 不把代码层默认 `DB_TYPE` 从 sqlite 改为 postgres。

## Decisions

### 1. MySQL 凭据走环境变量，保留 sqlite / postgres 分支

本地 `apps/backend/.env` 设 `DB_TYPE=mysql`、`DB_HOST=127.0.0.1`、`DB_PORT=3306`、`DB_USER=root`、`DB_NAME=vanstack`、`DB_PASSWORD=Password_1727`。代码默认仍为 sqlite。新增 `mysql2` 与 TypeORM `mysql` 分支；原 postgres 配置保留。

备选：只用 Postgres。否决原因：本机未运行 5432，实际库是 MySQL `vanstack`。

### 2. 三表 RBAC，权限码存在角色上

| 表 | 作用 |
| --- | --- |
| `sys_user` | `id` (uuid)、`username` (unique)、`password_hash`、`status` (`enabled`/`disabled`)、时间戳 |
| `sys_role` | `id` (uuid)、`code` (unique，如 `admin`)、`name`、`permissions` (JSON 字符串数组)、时间戳 |
| `sys_user_role` | `user_id` + `role_id` 联合主键 |

不建 `sys_permission` 表：本期权限集合小，角色上的码足够做 Guard。管理员角色权限为 `["*"]`。

备选：完整五表（含权限目录与角色-权限表）。推迟到需要动态权限管理 UI 时。

### 3. Access JWT only，HS256

- 算法 HS256，密钥 `JWT_SECRET`，有效期 `JWT_EXPIRES_IN`（默认 `8h`）。
- 载荷：`sub`（用户 id）、`username`、`roles`、`permissions`（角色权限去重合并）。
- 请求头：`Authorization: Bearer <token>`。
- 无 refresh token：过期后重新登录。

备选：httpOnly Cookie。SPA 已用 `credentials: true` CORS，但 Vite 代理与双前端会使 Cookie 域更复杂；Bearer + `localStorage` 更直接。风险见下文。

### 4. Nest 全局 JwtAuthGuard + `@Public()` + `@RequirePermissions()`

- 全局 JWT Guard：默认要令牌。
- `@Public()`：`POST /api/auth/login`、`GET /api/health`、现有 documents/files 控制器。
- `GET /api/auth/me`：需有效 JWT。
- `GET /api/auth/permission-check`：需 JWT 且具备 `system:admin`（`*` 视为拥有任意码）。用于验收 403 与通配放行，不作为产品功能暴露给 UI。

密码用 bcrypt（cost 10）。登录失败统一 401，不区分用户是否存在。

### 5. 空库种子管理员

`AuthModule` 启动时：若 `sys_user` 为空，则创建 `admin` 角色（`permissions: ["*"]`）和种子用户。`ADMIN_SEED_USERNAME` / `ADMIN_SEED_PASSWORD` 必填于 env（示例值写入 `.env.example`，不写进源码）。已有用户则跳过。

### 6. Admin 前端：条件渲染，不加路由库

`App.tsx` 按会话切换登录页 / 工作区。令牌键 `vanstack.admin.token`。启动时若有令牌则调 `/api/auth/me`，失败则清会话。`api.ts` 在已登录时附加 `Authorization`；401 清令牌并回到登录页。侧栏增加登出。文案进现有 `locales/zh.json` 与 `en.json`。

共享 DTO 放 `packages/shared`（`LoginInput`、`AuthSessionDto`、`AuthUserDto`）。

备选：引入 `react-router-dom`。单页两态足够，不增加依赖。

## Risks / Trade-offs

- [文档/文件 API 仍公开] → 工作台不受影响；Admin 仍带 Token，后续可去掉 `@Public()`。在 README / 任务中标明。
- [XSS 可窃取 localStorage 令牌] → 本期不引入新 HTML 渲染；后续可迁 Cookie。有效期限制为 8h。
- [本机 Postgres 用户名不是 `vanstack`] → 用 `DB_USER` 覆盖；不把用户名写死在代码。
- [弱 `JWT_SECRET` 或漏配] → `.env.example` 给出占位；启动时若生产环境缺少密钥则拒绝启动。
- [TypeORM `synchronize`] → 非生产保持现有行为以建表；生产仍关闭，后续再补 migration。

## Migration Plan

1. 更新 `apps/backend/.env`：`DB_TYPE=postgres` 及本机连接信息、`JWT_SECRET`、种子账号。
2. 安装后端 JWT / bcrypt 依赖与前端无需新运行时依赖（除非共享类型构建）。
3. 启动后端，确认 `vanstack` 库出现三张表并写入种子管理员。
4. 启动 admin，用种子账号登录。
5. 回滚：还原 `.env` 为 sqlite、去掉 Auth 模块与前端登录门闩；表可保留无害。
