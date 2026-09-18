## 1. Desktop 包骨架

- [x] 1.1 新增 `apps/desktop`（`package.json` `@vanstack/desktop`、TypeScript 主进程 `tsconfig`、`src/main.ts` / `src/preload.ts` 入口），`pnpm install` 后该包出现在 workspace 且能 `tsc` 通过
- [x] 1.2 为 desktop 添加 `electron` 与开发依赖（如 `wait-on`、主进程构建用 TypeScript），`webPreferences` 设为 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，preload 不暴露 Node API；用类型检查或代码审阅确认

## 2. 开发态窗口

- [x] 2.1 实现开发态 `BrowserWindow` 加载 `http://127.0.0.1:5174`，根脚本 `dev:desktop` 并行启动 packages、backend、两个 Vite，并在 5174 就绪后拉起 Electron；运行该命令后桌面窗口出现管理后台（未登录则为登录页）
- [x] 2.2 确认开发态 Electron 不额外 spawn 后端（避免 SQLite 双实例）；窗口内 `/api/health` 由已有 Nest 进程响应（网络面板或后端日志可见）

## 3. 生产态托管与 Node 后端

- [x] 3.1 实现本机 HTTP：`127.0.0.1:5174` 托管 admin dist、`127.0.0.1:5173` 托管 app dist，`/api` 代理到 `http://127.0.0.1:3000`；用构建产物启动后 curl 静态页与 `/api/health` 代理均成功
- [x] 3.2 生产态用系统 Node spawn `apps/backend` 的 `dist/main.js`（cwd 为 backend，沿用 `.env`），退出 Electron 时结束该子进程；任务管理器/进程列表能看到独立 `node` 后端，而不是主进程实现业务 API
- [x] 3.3 加载窗口前轮询 `/api/health`，超时或找不到 Node 时展示可见错误页（含 Node >= 20 提示），而不是空白窗口；通过停掉后端或故意指向错误 node 路径验证
- [x] 3.4 增加根脚本 `start:desktop`（先 build packages/backend/两个前端再启动 Electron 生产入口），执行后窗口加载构建后的管理后台且登录后可进入工作区

## 4. H5 与浏览器兼容

- [x] 4.1 桌面窗口登录后从侧栏打开 H5 入口，能加载 H5 宿主且无管理后台工作台；开发态走 Vite 5173，生产态走桌面托管的 5173 dist
- [x] 4.2 保持根脚本 `pnpm dev` 不变，浏览器打开 5174 仍为登录/工作台；用现有开发命令确认浏览器路径未中断

## 5. 文档

- [x] 5.1 更新 README：补充 `dev:desktop` / `start:desktop`、需要本机 Node 跑后端、浏览器入口仍可用；对照文档能按步骤启动桌面壳
