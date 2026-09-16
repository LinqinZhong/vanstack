## Purpose

为管理后台提供用户名密码登录、会话保持与未登录拦截，使未认证访问无法进入后台工作区。

## ADDED Requirements

### Requirement: Admin login page
管理后台 SHALL 提供用户名与密码登录页。未认证访问后台工作区时 MUST 展示该登录页，且 MUST NOT 展示文档列表、对象列表或删除操作。

#### Scenario: Unauthenticated visitor sees login
- **WHEN** 未登录用户打开管理后台
- **THEN** 系统展示用户名与密码登录表单，且不展示后台工作区内容

#### Scenario: Successful login enters workspace
- **WHEN** 用户在登录页提交正确的用户名与密码
- **THEN** 系统进入后台工作区，不再展示登录表单

#### Scenario: Failed login stays on page
- **WHEN** 用户提交错误的用户名或密码
- **THEN** 系统保持在登录页，并展示可通过 i18n 切换的失败提示

### Requirement: Session persistence
管理后台 SHALL 在登录成功后保持会话。页面刷新后，有效会话 MUST 仍视为已登录。

#### Scenario: Refresh keeps session
- **WHEN** 已登录用户刷新管理后台页面且会话令牌仍有效
- **THEN** 系统仍展示后台工作区，不要求重新登录

### Requirement: Logout
管理后台 SHALL 允许已登录用户登出。登出后 MUST 清除本地会话，后续访问 MUST 回到登录页。

#### Scenario: User logs out
- **WHEN** 已登录用户触发登出
- **THEN** 系统清除本地会话并展示登录页

### Requirement: Authenticated API calls
管理后台在已登录状态下调用后端 API 时 SHALL 在请求中携带访问令牌。令牌无效或过期时 MUST 回到登录页。

#### Scenario: Requests include access token
- **WHEN** 已登录用户在后台发起 API 请求
- **THEN** 请求包含该用户的访问令牌

#### Scenario: Expired session returns to login
- **WHEN** 本地会话令牌已失效且用户访问后台工作区
- **THEN** 系统展示登录页并清除失效会话

### Requirement: Login copy i18n
登录页文案 SHALL 支持现有 `zh` 与 `en` 语言切换。

#### Scenario: Switch language on login page
- **WHEN** 用户在登录页将界面语言从中文切换为英文
- **THEN** 登录页标签、按钮与错误提示以英文展示
