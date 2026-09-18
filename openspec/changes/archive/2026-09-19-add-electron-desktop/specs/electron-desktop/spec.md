## Purpose

为 Vanstack 提供 Electron 桌面宿主：窗口内加载管理后台与 H5 前端，后端仍以独立 Node 进程提供 API。

## ADDED Requirements

### Requirement: Desktop window hosts admin frontend
桌面应用 SHALL 以独立窗口打开管理后台前端。用户启动桌面应用后 MUST 看到管理后台（未登录则为登录页），MUST NOT 要求先手动用浏览器打开管理后台开发端口。

#### Scenario: Launch shows admin
- **WHEN** 用户启动桌面应用且前端资源可用
- **THEN** 系统打开桌面窗口并展示管理后台界面

#### Scenario: Unauthenticated desktop visit
- **WHEN** 未登录用户启动桌面应用
- **THEN** 窗口展示管理后台登录页，且不展示后台工作区内容

### Requirement: Backend runs as a Node process
系统 SHALL 以独立 Node 进程运行现有后端。桌面壳 MUST NOT 把后端业务逻辑迁入 Electron 主进程。后端监听地址与 API 前缀 MUST 与现有浏览器工作流使用的后端一致。

#### Scenario: API served by Node backend
- **WHEN** 桌面窗口内的管理后台请求 `/api/health`
- **THEN** 该请求由独立 Node 后端进程响应，而不是由 Electron 主进程实现业务接口

#### Scenario: Same API contract
- **WHEN** 已登录用户在桌面窗口中调用受保护的工程或页面接口
- **THEN** 请求携带访问令牌，鉴权与权限行为与浏览器宿主中的同一后端一致

### Requirement: H5 frontend is available from the desktop shell
桌面壳 SHALL 提供 H5 前端资源。从管理后台打开 H5 入口时 MUST 能加载 H5 独立宿主，MUST NOT 因桌面壳未托管 H5 而空白失败。

#### Scenario: Open H5 from admin
- **WHEN** 已登录用户在桌面窗口的管理后台中打开 H5 入口
- **THEN** 系统加载 H5 宿主页面，且该宿主不包含管理后台工作台

### Requirement: Backend unavailability is visible
当后端进程未就绪或无法连接时，桌面应用 MUST 向用户展示可见失败说明，MUST NOT 无限期停留在无说明的空白窗口。

#### Scenario: Backend is down
- **WHEN** 用户启动桌面应用但后端无法在约定时间内提供健康检查
- **THEN** 系统展示后端不可用的可见提示

### Requirement: Browser hosts remain available
系统 SHALL 继续允许通过现有浏览器入口使用管理后台与 H5。新增桌面壳 MUST NOT 移除或阻断浏览器开发入口。

#### Scenario: Browser admin still works
- **WHEN** 用户按现有方式启动开发服务并用浏览器打开管理后台
- **THEN** 登录与工作台行为与引入桌面壳之前一致
