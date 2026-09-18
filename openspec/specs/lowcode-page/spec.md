# lowcode-page Specification

## Purpose

在工程内管理页面与页面版本，把每份页面 XML 存到 OSS，并维护页面当前在用版本及其资源地址。

## Requirements

### Requirement: Page and version persistence
系统 SHALL 在配置的关系型数据库中持久化工程页面与页面版本。页面记录 MUST 包含页名、在所属工程内唯一的 `key`、描述、当前在用版本以及当前页内容的 XML 资源地址。版本记录 MUST 包含版本号、描述与对应 XML 资源地址。

#### Scenario: Schema exists after startup
- **WHEN** 后端以可写数据库启动且同步架构
- **THEN** 数据库中存在 `project_page` 与 `project_page_version` 表

#### Scenario: Duplicate page key in same project is rejected
- **WHEN** 调用方在同一工程内创建或更新页面，使用该工程中已被占用的页面 `key`
- **THEN** 系统拒绝该请求且不覆盖已有页面

#### Scenario: Same page key in different projects is allowed
- **WHEN** 两个不同工程各自创建页面 `key` 均为 `home` 的页面
- **THEN** 系统接受这两次创建

### Requirement: Create page with initial version
系统 SHALL 允许已登录管理员在工程内创建页面。创建页面时 MUST 同时创建初始版本，MUST 将初始 XML 写入 OSS，MUST 把该初始版本设为当前在用版本，且页面的当前 XML 资源地址 MUST 指向该版本的 XML 资源。

#### Scenario: New page gets version one
- **WHEN** 已登录管理员在某工程中提交有效的页名与未被占用的页面 `key`
- **THEN** 系统创建该页面、一个初始版本及其 OSS 上的 XML 资源，并将该版本标记为当前在用

#### Scenario: Create page without name or key is rejected
- **WHEN** 已登录管理员提交缺少页名或缺少 `key` 的创建请求
- **THEN** 系统不创建页面、版本或 OSS 对象

### Requirement: List and select pages
工程编辑页 SHALL 列出该工程下的页面。选中某一页面后，系统 MUST 展示该页面的配置、版本列表，以及当前在用版本对应的页面内容，供后续编辑与预览使用。

#### Scenario: Page list in project editor
- **WHEN** 已登录管理员进入含有多个页面的工程编辑页
- **THEN** 系统列出这些页面的页名、`key` 与描述

#### Scenario: Selecting a page loads its versions
- **WHEN** 已登录管理员选中某个已有页面
- **THEN** 系统展示该页面的版本列表，并加载当前在用版本的 XML 内容

### Requirement: Edit page configuration
系统 SHALL 允许已登录管理员编辑页面的页名、`key` 与描述。更新成功后列表 MUST 展示最新配置。

#### Scenario: Update page fields
- **WHEN** 已登录管理员将某页面的页名或描述改为新的有效值并保存
- **THEN** 系统持久化该变更，页面列表展示更新后的值

### Requirement: Delete page
系统 SHALL 允许已登录管理员删除页面。删除后该页面及其版本 MUST 不再可被列出或选中；对应 OSS 上的 XML 资源 MUST 被删除或不再作为可访问的当前页内容。

#### Scenario: Delete page from editor
- **WHEN** 已登录管理员删除某工程中的一个页面
- **THEN** 该工程的页面列表不再包含该页面，且不能再选中它

### Requirement: Create page version
系统 SHALL 允许已登录管理员为选中页面创建新版本。每个版本 MUST 对应且仅对应一份 OSS 上的 XML 资源。新版本的版本号 MUST 在该页面内唯一且递增。

#### Scenario: Create version stores xml in oss
- **WHEN** 已登录管理员为选中页面创建新版本并提供 XML 内容
- **THEN** 系统写入新的版本记录与一份新的 OSS XML 资源，且该版本的资源地址指向这份 XML

#### Scenario: Version numbers increment per page
- **WHEN** 某页面已有初始版本，管理员再次创建版本
- **THEN** 新版本的版本号大于已有版本号，且不与该页面其他版本重复

### Requirement: Modify page version
系统 SHALL 允许已登录管理员修改已有版本的描述与 XML 内容。修改 XML 后，该版本的资源地址 MUST 仍能取到更新后的内容。若被修改的是当前在用版本，页面的当前 XML 资源地址 MUST 指向更新后的内容。

#### Scenario: Update version xml
- **WHEN** 已登录管理员保存某版本的新 XML 内容
- **THEN** 再次读取该版本的 XML 资源时得到更新后的内容

#### Scenario: Updating current version refreshes page xml address
- **WHEN** 已登录管理员修改当前在用版本的 XML
- **THEN** 页面记录的当前 XML 资源地址读取到的是更新后的内容

### Requirement: Delete page version
系统 SHALL 允许已登录管理员删除非当前在用版本。当前在用版本 MUST NOT 被删除，除非页面本身被删除。删除版本后其 OSS XML 资源 MUST 被删除或不再可按该版本读取。

#### Scenario: Delete unused version
- **WHEN** 已登录管理员删除一个不是当前在用版本的页面版本
- **THEN** 该版本不再出现在版本列表中，且不能再读取其 XML

#### Scenario: Current version cannot be deleted
- **WHEN** 已登录管理员尝试删除页面的当前在用版本
- **THEN** 系统拒绝删除，该版本与其 XML 资源仍可用

### Requirement: Switch current version
系统 SHALL 允许已登录管理员将某一已有版本设为页面的当前在用版本。切换后，页面的当前 XML 资源地址 MUST 指向该版本的 XML 资源。

#### Scenario: Activate another version
- **WHEN** 已登录管理员将某页面的非当前版本设为当前在用
- **THEN** 页面的当前在用版本变为该版本，且当前 XML 资源地址指向该版本的 XML

### Requirement: Page APIs require authentication
页面与版本的创建、查询、更新、删除以及 XML 读写接口 SHALL 要求有效访问令牌。缺少、伪造或过期令牌时 MUST 拒绝访问。

#### Scenario: Missing token cannot read page xml
- **WHEN** 客户端不携带访问令牌请求某页面或某版本的 XML
- **THEN** 系统返回未认证错误且不返回 XML 内容

### Requirement: Publish language snapshots to oss
系统 SHALL 在发布某一页面版本时，把当时该工程语言库打成快照并写入 OSS。每个语言 MUST 对应一个 JSON 文件，对象键 MUST 为 `lowcode/{工程key}/lang/{页面key}-v{版本号}-{语言key}.json`。JSON MUST 包含该语言的 `key`、`name`、`dir`，以及扁平文案表（键为 `分组键.文案键`，值为译文）。空译文 MUST NOT 出现在该文件中。无语言时 MUST NOT 写出语言 JSON。再次发布同一版本 MUST 覆盖同路径快照。H5 运行时元数据 MUST 为当前在用版本提供各语言 JSON 的公开地址。删除页面或版本时，对应语言快照 MUST 被删除或不再可作为该版本内容读取。

#### Scenario: Publish writes one json per language
- **WHEN** 某工程有语言 `zh` 与 `ar`，管理员发布页面 `home` 的版本 `2`
- **THEN** OSS 上出现 `lowcode/{工程key}/lang/home-v2-zh.json` 与 `home-v2-ar.json`，且文件中含当时的名称、方向与译文

#### Scenario: Republish overwrites snapshot
- **WHEN** 管理员在改过工程文案后再次发布同一页面版本
- **THEN** 该版本对应语言 JSON 的内容变为发布当时的语言库，而不是上次发布的旧译文

#### Scenario: Runtime metadata lists lang json urls
- **WHEN** H5 请求某工程运行时元数据，且某页面的当前在用版本已发布过语言快照
- **THEN** 该页面条目包含各语言的 JSON 公开地址，地址指向该在用版本的快照而不是工作台数据库的实时内容

#### Scenario: Unpublished catalog does not affect h5
- **WHEN** 管理员发布后再在工作台改了一条文案，且尚未再次发布
- **THEN** H5 加载到的仍是上次发布的 JSON，不包含这次未发布的修改
