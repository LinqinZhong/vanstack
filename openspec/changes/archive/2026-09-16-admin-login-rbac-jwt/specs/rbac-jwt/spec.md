## Purpose

提供基于 `sys_user`/`sys_role` 的账号持久化、JWT 鉴权与角色权限码 RBAC，作为管理后台访问控制的后端契约。

## ADDED Requirements

### Requirement: User and role persistence
系统 SHALL 在配置的关系型数据库中持久化 `sys_user` 与 `sys_role`。用户与角色 MUST 为多对多，并通过 `sys_user_role` 关联。密码 MUST 以单向哈希存储，MUST NOT 以明文落库。

#### Scenario: Schema exists after startup
- **WHEN** 后端以可写数据库启动且同步架构
- **THEN** 数据库中存在 `sys_user`、`sys_role` 与 `sys_user_role` 表

#### Scenario: Password is hashed
- **WHEN** 系统创建或种子化一个用户
- **THEN** `sys_user` 中保存的是密码哈希而非明文密码

### Requirement: Seed administrator
当库中没有任何用户时，系统 SHALL 创建默认管理员用户，并赋予包含全部管理权限的 `admin` 角色。种子用户名与密码 MUST 来自环境变量，MUST NOT 硬编码到源码。

#### Scenario: Empty database seeds admin
- **WHEN** 后端启动且 `sys_user` 中没有记录
- **THEN** 系统创建种子管理员及其 `admin` 角色，使该账号可以登录

#### Scenario: Existing users are not duplicated
- **WHEN** 后端启动且 `sys_user` 中已有记录
- **THEN** 系统不重复插入种子管理员

### Requirement: Password login issues JWT
系统 SHALL 提供公开的登录接口，接受用户名与密码。凭据正确且账号启用时 MUST 返回访问令牌；凭据错误、账号不存在或账号停用时 MUST 拒绝登录且 MUST NOT 签发令牌。

#### Scenario: Valid credentials return token
- **WHEN** 客户端向登录接口提交启用账号的正确用户名与密码
- **THEN** 响应包含访问令牌，以及该用户的标识、用户名、角色与权限码

#### Scenario: Invalid credentials are rejected
- **WHEN** 客户端提交错误密码或不存在的用户名
- **THEN** 系统返回未认证错误，且不返回访问令牌

#### Scenario: Disabled account cannot login
- **WHEN** 客户端提交停用账号的正确密码
- **THEN** 系统拒绝登录且不签发令牌

### Requirement: Current principal
系统 SHALL 提供查询当前登录主体的接口。有效访问令牌 MUST 返回用户标识、用户名、角色列表与权限码列表。缺少、伪造或过期令牌 MUST 被拒绝。

#### Scenario: Valid token returns profile
- **WHEN** 客户端携带有效访问令牌请求当前主体
- **THEN** 响应包含该用户的标识、用户名、角色与权限码

#### Scenario: Missing token is rejected
- **WHEN** 客户端不携带访问令牌请求当前主体
- **THEN** 系统返回未认证错误

#### Scenario: Invalid token is rejected
- **WHEN** 客户端携带伪造或过期令牌请求当前主体
- **THEN** 系统返回未认证错误

### Requirement: RBAC permission enforcement
受保护接口 SHALL 按角色权限码进行授权。调用方已认证但缺少所需权限时 MUST 被拒绝。拥有所需权限或管理员通配权限的调用方 MUST 被允许。公开接口（健康检查、登录、以及本变更范围内的文档与文件 API）MUST 保持无需令牌即可访问。

#### Scenario: Missing permission is forbidden
- **WHEN** 已认证但缺少目标权限码的调用方访问受保护接口
- **THEN** 系统返回权限不足错误

#### Scenario: Admin wildcard is allowed
- **WHEN** 持有管理员通配权限的调用方访问受保护接口
- **THEN** 系统允许该请求

#### Scenario: Public routes remain open
- **WHEN** 未携带令牌的客户端请求健康检查、登录，或现有文档/文件接口
- **THEN** 系统不因缺少令牌而拒绝这些请求
