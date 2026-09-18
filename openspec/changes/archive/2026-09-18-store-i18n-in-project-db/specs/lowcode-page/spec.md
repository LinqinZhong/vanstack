## ADDED Requirements

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
