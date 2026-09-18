# lowcode-project Specification

## Purpose

为已登录管理员提供低代码工程的持久化与首页管理，使其能够创建、配置、列出、删除工程并进入工程编辑。

## Requirements

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

### Requirement: Project language tables
系统 SHALL 在配置的关系型数据库中为每个工程持久化语言库。`project_lang` MUST 保存该工程的语言：在工程内唯一的 `key`、显示名称、排列方向（仅 `ltr` 或 `rtl`）与声明顺序。`project_lang_value` MUST 保存文案：分组键、文案键、语言键与译文。语言键、分组键与文案键 MUST 非空，MUST NOT 包含 `.` 或 `"`。同一工程内分组键加文案键加语言键 MUST 唯一。删除工程时 MUST 级联删除其语言与文案。空译文 MUST NOT 保留为行。

#### Scenario: Schema exists after startup
- **WHEN** 后端以可写数据库启动且同步架构
- **THEN** 数据库中存在 `project_lang` 与 `project_lang_value` 表

#### Scenario: Duplicate language key is rejected
- **WHEN** 调用方在同一工程内创建第二条 `key` 均为 `en` 的语言
- **THEN** 系统拒绝该请求且不写入第二条语言

### Requirement: Project language APIs
系统 SHALL 允许已登录管理员读取与修改某工程的语言与文案，且不必选中页面或版本。新增语言、改名、改键、改方向、删除语言，以及新增分组与文案、编辑译文、删除文案 MUST 立即写入数据库。改语言键时 MUST 同步更新该语言下已有文案行的语言键。删除语言 MUST 删除该语言的全部译文。分组由文案行的分组键构成；新增分组时 MUST 同时新增一条缺省文案键以便落库。这些接口 SHALL 要求有效访问令牌。

#### Scenario: Add language persists for the project
- **WHEN** 已登录管理员在某工程语言库中新增 `key` 为 `en`、`dir` 为 `ltr` 的语言
- **THEN** `project_lang` 中出现该语言，该工程下任意页面的语言库都能看到它

#### Scenario: Add group and entry persists
- **WHEN** 已登录管理员在某工程语言库中新增分组 `home` 与文案键 `title`，并为 `zh` 填写「首页」
- **THEN** `project_lang_value` 中出现分组 `home`、文案 `title`、语言 `zh` 的译文「首页」

#### Scenario: Language library works without pages
- **WHEN** 已登录管理员打开尚无页面的工程并编辑语言库
- **THEN** 系统仍接受新增语言，且写入该工程的 `project_lang`

#### Scenario: Missing token cannot read project langs
- **WHEN** 客户端不携带访问令牌请求某工程的语言库
- **THEN** 系统返回未认证错误且不返回语言或文案
