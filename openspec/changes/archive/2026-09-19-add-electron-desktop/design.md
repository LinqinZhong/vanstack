## Context

现状：pnpm monorepo，`apps/frontend-admin`（Vite `:5174`）与 `apps/frontend-app`（Vite `:5173`）通过 dev proxy 把 `/api` 转到 NestJS `:3000`。Admin 使用 `BrowserRouter` 与同源 `/preview` iframe；侧栏 H5 入口写死 `http://127.0.0.1:5173`。后端已 `enableCors({ origin: true })`，含 `better-sqlite3` / `bcrypt` 等需按 Node ABI 编译的 native 模块。Workspace 已包含 `apps/*`。动机见 `proposal.md`。

## Goals / Non-Goals

**Goals:**

- 新增独立 `apps/desktop` 包作为 Electron 壳，前端源码仍留在 `frontend-admin` / `frontend-app`。
- 开发态 Electron 加载 Vite admin URL；生产态由桌面主进程在本机 HTTP 托管两套前端 dist，并代理 `/api`。
- 用系统 Node 拉起 `apps/backend` 的 `dist/main.js`，避开 Electron ABI 重编 native 模块。
- 保持 `pnpm dev` 浏览器工作流。

**Non-Goals:**

- 不把 Nest 模块搬进 Electron 主进程或 utility process。
- 不把 renderer 业务改写成 Electron 专用 UI 框架。
- 本期不捆绑独立 Node 运行时，不覆盖 macOS/Linux 安装包商店分发。
- 不修改登录、RBAC、低代码控件契约。

## Decisions

### 1. 新包 `apps/desktop`，而不是把 Electron 塞进 admin

Electron 主进程、preload、本机静态服务与后端子进程放在 `apps/desktop`。Renderer 继续是现有 Vite 应用，避免 admin 的 `tsconfig`（DOM + bundler）与 Electron 主进程（Node）混编。

备选：在 `frontend-admin` 加 `electron` 字段。否决原因：H5 也要托管，且主进程职责不属于管理后台包。

### 2. 开发态加载 Vite，生产态本机 HTTP 托管 dist

```
+------------------+     loadURL      +---------------------------+
| Electron Browser | <--------------- | 5174 admin (Vite or dist) |
| Window (admin)   |                  +-------------+-------------+
+------------------+                                |
        | fetch /api                                | proxy /api
        v                                           v
+------------------+                  +---------------------------+
| NestJS Node      | <--------------- | 3000 backend              |
| (child or pnpm)  |                  +---------------------------+
+------------------+
        ^
        | 5173 H5 (Vite or dist)
+------------------+
| H5 BrowserWindow |
| or external tab  |
+------------------+
```

- **开发**：`pnpm dev:desktop` 并行启动 shared/xml/lowcode-runtime、backend、两个 Vite、以及 wait-on `http://127.0.0.1:5174` 后启动 Electron。`BrowserWindow` 加载 `http://127.0.0.1:5174`。Vite proxy 维持现状。
- **生产 / `start:desktop`**：先构建 packages、backend、两个前端；Electron 主进程用 Node `http` 在 `127.0.0.1:5174` 与 `127.0.0.1:5173` 提供静态文件，并把以 `/api` 开头的请求代理到 `http://127.0.0.1:3000`。`H5_ORIGIN` 与相对 `/api` 无需改契约。

备选 A：`loadFile` + `file://`。否决原因：`BrowserRouter`、同源 `/preview` iframe、相对 `/api` 在 `file:` 下会坏。

备选 B：改 `API_BASE` 为绝对 `http://127.0.0.1:3000`。可作后备，但本机 HTTP 代理更少动前端。

### 3. 后端用系统 Node spawn，不用 Electron 的 Node

生产态主进程 `spawn(nodeExecutable, ['dist/main.js'], { cwd: backendRoot, env, stdio })`，`nodeExecutable` 取 `process.env.npm_node_execpath` 或 PATH 上的 `node`。`cwd` 为 `apps/backend`，沿用其 `.env`、SQLite 与 `uploads/`。

窗口加载前轮询 `http://127.0.0.1:3000/api/health`（超时则展示错误页，满足「后端不可见失败」）。退出时结束子进程。

开发态不由 Electron 再 spawn 一份后端，避免双实例锁库；由 `dev:desktop` 组合现有 `dev:backend`。

备选：`electron-rebuild` 后在主进程 `require` Nest。否决原因：native 模块、与「后端依旧是 Node」不符。

### 4. 安全默认

`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。preload 仅在需要时暴露只读环境标记（例如是否桌面壳），不把 Node API 交给 renderer。不开启远程模块。

### 5. 打包范围

可用 electron-builder 打 Windows 目录包，把 admin/app dist 与 backend `dist` 列为 extraResources。安装包仍依赖机器上的 Node 来跑后端。完整离线安装列为后续。

### 6. 前端改动保持最小

优先零改 `api.ts`（继续 `API_BASE = '/api'`）。若生产托管后 H5 外链或 CSP 有缺口，再把 `H5_ORIGIN` 抽成可配置常量，默认仍为 `http://127.0.0.1:5173`。

## Risks / Trade-offs

- [系统未装 Node 或 PATH 找不到] → 启动错误页明确提示需要 Node >= 20；开发文档写明。
- [5173/5174 已被浏览器 `pnpm dev` 占用] → 生产托管失败时提示端口占用；开发态桌面与浏览器共用同一套 Vite，可同时开窗口。
- [SQLite 被第二份后端锁住] → 开发态禁止 Electron 再 spawn backend；生产只 spawn 一份。
- [本机 HTTP 无 TLS] → 仅绑定 `127.0.0.1`，与现有 Vite 一致。
- [electron-builder 打进 asar 后 backend 路径/native 失效] → backend 与 native 依赖放 extraResources 且 `asarUnpack`，或生产直接从仓库路径跑 `start:desktop`。
- [Google Fonts 需联网] → 与现浏览器行为相同，本期不内联字体。

## Migration Plan

1. 新增 `apps/desktop` 与根脚本，默认不改变 `pnpm dev`。
2. 验证：`pnpm dev` 浏览器路径；`pnpm dev:desktop` 窗口加载 admin、登录、工作台、打开 H5。
3. 验证：构建后 `pnpm start:desktop`（或等价）spawn 后端并托管 dist。
4. 回滚：删除/停用 desktop 包与脚本即可，前后端包无强制耦合。

## Open Questions

- 是否在下一期用 electron-builder 增加 macOS/Linux 目标，以及是否捆绑独立 Node 运行时。
