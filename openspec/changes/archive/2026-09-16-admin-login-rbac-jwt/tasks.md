## 1. 配置与依赖

- [x] 1.1 在 `apps/backend/package.json` 增加 `@nestjs/jwt`、`@nestjs/passport`、`passport`、`passport-jwt`、`bcrypt` 及对应 `@types`，执行安装后确认 `pnpm --filter @vanstack/backend typecheck` 能解析这些包
- [x] 1.2 更新根目录 `.env.example` 与 `apps/backend/.env`：加入 `JWT_SECRET`、`JWT_EXPIRES_IN`、`ADMIN_SEED_USERNAME`、`ADMIN_SEED_PASSWORD`；本地 `.env` 设 `DB_TYPE=postgres`、`DB_HOST=127.0.0.1`、`DB_NAME=vanstack`、`DB_PASSWORD=Password_1727`，确认文件中可见这些键且 `.env.example` 不含真实密钥

## 2. 共享类型

- [x] 2.1 在 `packages/shared/src/index.ts` 导出 `LoginInput`、`AuthUserDto`、`AuthSessionDto`（含 `accessToken`、用户、角色、权限码），构建共享包后确认 `packages/shared/dist/index.d.ts` 包含这些类型

## 3. 数据模型与种子

- [x] 3.1 新增 `SysUser`、`SysRole` 实体及 `sys_user_role` 多对多关系（字段与 `design.md` 一致，密码列名为 `password_hash`），启动后端后在 `vanstack` 库中确认三张表已创建
- [x] 3.2 实现空库种子：创建 `admin` 角色（`permissions: ["*"]`）与 env 种子用户，密码 bcrypt 哈希；重启后确认不会重复插入，且库中密码列不是明文

## 4. JWT 与 RBAC API

- [x] 4.1 实现 `POST /api/auth/login`（`@Public()`）：正确凭据返回令牌与用户/角色/权限；错误密码、不存在用户、停用账号均 401 且无令牌。用 curl 或等价请求验证三种失败与一种成功
- [x] 4.2 实现全局 JwtAuthGuard 与 `@Public()`：无令牌访问 `GET /api/health`、`POST /api/auth/login`、现有 `/api/documents` 与 `/api/files` 仍成功；无令牌访问 `GET /api/auth/me` 返回 401
- [x] 4.3 实现 `GET /api/auth/me`：有效令牌返回 id、username、roles、permissions；伪造或过期令牌返回 401
- [x] 4.4 实现 `@RequirePermissions` 与 `GET /api/auth/permission-check`（需要 `system:admin`，`*` 通配放行）：种子管理员可 200；临时插入无该权限的已认证用户时返回 403

## 5. 管理后台登录页

- [x] 5.1 新增登录表单（用户名+密码）与 zh/en i18n 文案；未登录打开 http://127.0.0.1:5174 只看到登录页，看不到文档/对象表格
- [x] 5.2 登录成功将令牌写入 `vanstack.admin.token` 并进入现有工作区；错误凭据停留在登录页并显示失败提示。刷新后有效令牌仍保持工作区
- [x] 5.3 `api.ts` 在已登录时附加 `Authorization: Bearer`；侧栏提供登出（清令牌并回到登录页）；`/api/auth/me` 返回 401 时同样清会话并回到登录页

## 6. 端到端验收

- [x] 6.1 使用种子管理员走通：登录 → 工作区加载文档/文件 → 登出 → 再打开为登录页；确认工作台 `frontend-app` 无需登录仍能调用文档 API
