## Purpose

为已登录管理员提供低代码工程的持久化与首页管理，使其能够创建、配置、列出、删除工程并进入工程编辑。

## ADDED Requirements

### Requirement: Project persistence
系统 SHALL 在配置的关系型数据库中持久化低代码工程。每条工程记录 MUST 包含名称、全局唯一的 `key`、描述以及创建与更新时间。

#### Scenario: Schema exists after startup
- **WHEN** 后端以可写数据库启动且同步架构
- **THEN** 数据库中存在 `project` 表，且可保存名称、`key`、描述与时间戳

#### Scenario: Duplicate project key is rejected
- **WHEN** 调用方尝试创建或更新工程，使用已被其他工程占用的 `key`
- **THEN** 系统拒绝该请求且不覆盖已有工程

### Requirement: Admin project home
已登录管理员访问管理后台工作区时，系统 SHALL 在首页展示工程列表，并提供创建、编辑配置、删除与进入工程的操作。未登录时 MUST NOT 展示工程列表或上述操作。

#### Scenario: Authenticated admin sees project list
- **WHEN** 已登录管理员打开管理后台首页且库中已有工程
- **THEN** 系统列出这些工程的名称、`key` 与描述

#### Scenario: Empty project list
- **WHEN** 已登录管理员打开管理后台首页且库中没有工程
- **THEN** 系统展示空列表，并仍提供创建工程的入口

#### Scenario: Unauthenticated visitor is blocked
- **WHEN** 未登录用户打开管理后台
- **THEN** 系统不展示工程列表、创建、编辑或删除操作

### Requirement: Create project
系统 SHALL 允许已登录管理员创建工程。提交 MUST 包含名称与 `key`；描述可为空。创建成功后 MUST 出现在首页列表中。

#### Scenario: Create project with required fields
- **WHEN** 已登录管理员提交有效的工程名称与未被占用的 `key`
- **THEN** 系统保存该工程，并在首页列表中展示它

#### Scenario: Create project without name or key is rejected
- **WHEN** 已登录管理员提交缺少名称或缺少 `key` 的创建请求
- **THEN** 系统拒绝创建且不写入新工程

### Requirement: Edit project configuration
系统 SHALL 允许已登录管理员编辑已有工程的名称、`key` 与描述。更新成功后首页 MUST 展示最新配置。

#### Scenario: Update project fields
- **WHEN** 已登录管理员将某工程的名称或描述改为新的有效值并保存
- **THEN** 系统持久化该变更，首页列表展示更新后的值

### Requirement: Delete project
系统 SHALL 允许已登录管理员删除工程。删除后该工程 MUST 不再出现在列表中，且 MUST NOT 再能进入该工程。

#### Scenario: Delete project from home
- **WHEN** 已登录管理员删除某个工程
- **THEN** 首页列表不再包含该工程

### Requirement: Enter project
系统 SHALL 允许已登录管理员从首页进入指定工程的编辑页。进入后 MUST 展示该工程的页面工作台，而不是首页工程列表。

#### Scenario: Open project editor
- **WHEN** 已登录管理员在首页选择进入某个已存在的工程
- **THEN** 系统打开该工程的编辑页

#### Scenario: Unknown project cannot be entered
- **WHEN** 已登录管理员请求进入一个不存在或已删除的工程
- **THEN** 系统拒绝进入编辑页并给出失败反馈

### Requirement: Project APIs require authentication
工程的创建、查询、更新与删除接口 SHALL 要求有效访问令牌。缺少、伪造或过期令牌时 MUST 拒绝访问。

#### Scenario: Missing token is rejected
- **WHEN** 客户端不携带访问令牌请求工程列表或创建工程
- **THEN** 系统返回未认证错误且不返回或写入工程数据

#### Scenario: Valid token can list projects
- **WHEN** 已登录管理员携带有效访问令牌请求工程列表
- **THEN** 系统返回该管理员可见的工程数据
