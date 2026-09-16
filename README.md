# Vanstack

NestJS、React 19、TypeScript、i18n、XML、TypeORM、OSS 的 pnpm monorepo。

默认用 SQLite + 本地磁盘即可启动。需要 PostgreSQL 和 MinIO（S3 兼容对象存储）时，使用根目录的 `docker-compose.yml`。

## 仓库结构

```text
apps/backend         NestJS 后端（TypeORM、nestjs-i18n、XML、OSS）
apps/frontend-app    React 19 H5 客户端
apps/frontend-admin  React 19 管理后台
packages/shared      共享类型与语言常量
packages/xml         XML 解析 / 序列化
```

## 快速开始

```bash
pnpm install
copy .env.example .env
copy .env.example apps\backend\.env
pnpm dev
```

启动后：

- H5 客户端：http://127.0.0.1:5173
- 管理后台：http://127.0.0.1:5174
- 后端：http://127.0.0.1:3000/api/health

## 脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 并行启动共享包、backend、frontend-app、frontend-admin |
| `pnpm dev:backend` | 只启动 NestJS |
| `pnpm dev:app` | 只启动 H5 客户端 |
| `pnpm dev:admin` | 只启动管理后台 |
| `pnpm build` | 构建全部包和应用 |

## 能力

- **I18n**：前端 `zh` / `en` 切换；后端通过 `x-lang` 或 `Accept-Language` 返回对应文案。
- **TypeORM**：默认 SQLite（`apps/backend/data/vanstack.sqlite`），也可使用 MySQL / PostgreSQL。
- **OSS**：默认写入本地 `apps/backend/uploads/`；设置 `OSS_DRIVER=s3` 后走 MinIO / S3 / 兼容对象存储。

## PostgreSQL + MinIO

```bash
docker compose up -d
```

把 `apps/backend/.env` 改成：

```env
DB_TYPE=postgres
OSS_DRIVER=s3
OSS_ENDPOINT=http://127.0.0.1:9000
OSS_ACCESS_KEY=vanstack
OSS_SECRET_KEY=vanstack_secret
OSS_BUCKET=vanstack
```

MinIO 控制台：http://127.0.0.1:9001
