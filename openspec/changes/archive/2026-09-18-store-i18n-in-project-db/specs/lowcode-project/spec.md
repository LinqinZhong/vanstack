## ADDED Requirements

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
