# Vanstack

NestJS、React 19、TypeScript、i18n、XML、TypeORM、OSS 的 pnpm monorepo。

默认用 SQLite + 本地磁盘即可启动。需要 PostgreSQL 和 MinIO（S3 兼容对象存储）时，使用根目录的 `docker-compose.yml`。

## 仓库结构

```text
apps/backend         NestJS 后端（TypeORM、nestjs-i18n、XML、OSS）
apps/frontend-app    React 19 H5 客户端
apps/frontend-admin  React 19 管理后台
apps/desktop         Electron 桌面壳（窗口加载前端，后端仍用 Node 跑）
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
| `pnpm dev` | 并行启动共享包、backend、frontend-app、frontend-admin（浏览器入口） |
| `pnpm dev:backend` | 只启动 NestJS |
| `pnpm dev:app` | 只启动 H5 客户端 |
| `pnpm dev:admin` | 只启动管理后台 |
| `pnpm dev:desktop` | 开发态打开 Electron 窗口（同时启动 backend 与两个 Vite） |
| `pnpm start:desktop` | 构建后打开 Electron，并由系统 Node 拉起 Nest 后端 |
| `pnpm build` | 构建全部包和应用 |

## 桌面应用

管理后台和 H5 可以跑在 Electron 窗口里；后端依旧是本机 Node 上的 NestJS，不进入 Electron 主进程。需要 Node >= 20。

```bash
pnpm dev:desktop
```

开发态窗口加载 `http://127.0.0.1:5174`。浏览器入口仍然可用：另开终端执行 `pnpm dev` 后访问 5173 / 5174。

```bash
pnpm start:desktop
```

生产入口会先构建前后端，再由 Electron 在 `127.0.0.1:5174` / `5173` 托管构建产物，并用系统 Node 启动 `apps/backend`。不要与占用同一端口的 `pnpm dev` 同时开生产桌面。

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
