## Why

当前管理后台与 H5 只能在浏览器里跑，开发与本地使用都依赖打开多个 Vite 端口。需要一个桌面壳把前端装进 Electron 窗口，同时后端继续作为 NestJS Node 进程提供 API，而不是把业务搬进 Electron 主进程。

## What Changes

- 新增 `apps/desktop` Electron 应用：主窗口加载管理后台（`frontend-admin`），并在桌面壳内提供 H5（`frontend-app`）静态资源，使侧栏打开 H5 仍可用。
- 桌面开发命令并行启动共享包、NestJS 后端、两个 Vite 前端，以及 Electron 窗口（开发态加载 `http://127.0.0.1:5174`）。
- 生产/打包态由 Electron 主进程用系统 Node 拉起已构建的 `apps/backend`，并在本机 HTTP 上托管前端构建产物、把 `/api` 代理到后端；前端业务代码不迁入主进程。
- 现有浏览器工作流（`pnpm dev`、5173/5174）保持可用，登录、低代码工作台与 H5 运行时行为不变。
- 本期不做把 Nest 编译进 Electron ABI、也不做跨平台安装包商店分发。

## Capabilities

### New Capabilities

- `electron-desktop`: Electron 桌面壳加载管理后台与 H5 前端资源，用独立 Node 进程运行 NestJS 后端，并在后端不可用时给出可见失败。

### Modified Capabilities

- （无。`admin-login`、`rbac-jwt`、`lowcode-project`、`lowcode-page`、`lowcode-runtime` 的用户可见契约不变；桌面壳只是新的宿主。）

## Impact

- **新包**：`apps/desktop`（Electron main / preload、本机静态+代理、后端子进程）。
- **前端**：`frontend-admin` / `frontend-app` 仍为 Vite React 应用；为适配 `file:` 或桌面托管 origin，最多调整 API 基址或 H5 origin，不改登录与工作台交互。
- **后端**：继续 `apps/backend` NestJS；仍监听 `PORT`（默认 3000）；不改为 Electron utility process。
- **仓库脚本**：根 `package.json` 增加 `dev:desktop` / `start:desktop`（或等价命令）；`pnpm-workspace` 已覆盖 `apps/*`。
- **依赖**：Electron、等待端口就绪的开发工具；生产态可选用 electron-builder 打 Windows 目录/安装包，但后端 native 模块（`better-sqlite3`、`bcrypt`）仍由系统 Node 加载。
- **文档**：README 补充桌面启动方式。
- **非目标**：把后端重写为 Electron 主进程、去掉浏览器入口、本期内置完整离线安装（捆绑独立 Node 运行时与 native rebuild）。
