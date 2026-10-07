# Vanstack

NestJS、React 19、TypeScript、i18n、XML、TypeORM、OSS 的 pnpm monorepo。

默认用 SQLite + 本地磁盘即可启动。需要 PostgreSQL 和 MinIO（S3 兼容对象存储）时，使用根目录的 `docker-compose.yml`。

## 仓库结构

```text
apps/backend                 NestJS 后端（TypeORM、nestjs-i18n、XML、OSS）
apps/frontend-editor         React 19 工程编辑器
apps/frontend-editor-server  桌面本地工程服务（编辑器与 backend 之间）
apps/desktop                 Electron 桌面壳
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

- 工程编辑器：http://127.0.0.1:5174
- 本地工程服务：http://127.0.0.1:3010
- 后端：http://127.0.0.1:3000/api/health

## 脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 并行启动共享包、backend、frontend-editor-server、frontend-editor |
| `pnpm dev:backend` | 只启动 NestJS |
| `pnpm dev:editor` | 只启动工程编辑器 |
| `pnpm dev:editor-server` | 只启动本地工程服务 |
| `pnpm dev:desktop` | 开发态打开 Electron 窗口 |
| `pnpm start:desktop` | 构建后打开 Electron，并由系统 Node 拉起 Nest 后端 |
| `pnpm build` | 构建全部包和应用 |

## 桌面应用

工程编辑器可以跑在 Electron 窗口里。本地工程服务和 Nest 后端都由系统 Node 启动，不进入 Electron 主进程。需要 Node >= 20。

```bash
pnpm dev:desktop
```

开发态窗口加载 `http://127.0.0.1:5174`。浏览器入口仍然可用：另开终端执行 `pnpm dev` 后访问 5174。

```bash
pnpm start:desktop
```

生产入口会先构建，再由 Electron 在 `127.0.0.1:5174` 托管编辑器，并用系统 Node 启动本地工程服务和 `apps/backend`。不要与占用同一端口的 `pnpm dev` 同时开生产桌面。

## 能力

- **I18n**：前端 `zh` / `en` 切换；后端通过 `x-lang` 或 `Accept-Language` 返回对应文案。
- **TypeORM**：默认 SQLite（`apps/backend/data/vanstack.sqlite`），也可使用 MySQL / PostgreSQL。
- **对象存储**：语言快照、素材和图标写入 MinIO / S3（`OSS_DRIVER=s3`），也可改成本地目录（`local`）。

## MongoDB

工程目录、页面版本、函数、事件和语言库存在本机 MongoDB：`mongodb://localhost:27017`，数据库 `vanstack`，集合为 `project`、`page.version`、`function`、`event`、`lang`。MySQL 只保留登录账号。文件不进 Mongo。

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
