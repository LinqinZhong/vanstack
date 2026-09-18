## Why

语言库现在写在页面 XML 的 `<i18n>` 里，无法跨页复用，也无法在发布时冻结一份给 H5 按语言加载的快照。工程级文案应落在数据库，发布时再按页面版本打 JSON 到 OSS。

## What Changes

- 每个工程用 `project_lang` 存语言（键、名称、LTR/RTL、顺序），用 `project_lang_value` 存文案（分组键、文案键、语言键、译文）。
- 工作台语言库读写上述表，不再写入页面 XML；`$t("分组.键")` 仍写在控件 XML 上。
- **BREAKING**：`parsePageXml` / `serializePageXml` 不再把语言库当页面文档字段；已有 `<i18n>` 继续忽略、不当控件。
- 发布页面版本时，把当时工程语言库打成每语言一份 JSON，上传到 OSS 工程目录的 `lang/`，文件名含页面 `key`、版本号与语言键。
- H5 按运行时语言加载对应 JSON，不再从页面 XML 解析语言库。
- 工作台预览仍用数据库里的当前语言库；语言库编辑不再进入控件撤回栈。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-project`: 工程持久化增加语言表、文案表及管理 API。
- `lowcode-page`: 发布版本时写出语言 JSON 快照；运行时页面元数据提供按语言的 JSON 地址。
- `lowcode-runtime`: 语言库从 XML 目录改为工程库 + 发布快照；工作台、预览、H5、撤回相关要求随之修改。

## Impact

- 后端：`project_lang` / `project_lang_value` 实体与 CRUD；`publishVersion` 写 OSS JSON；运行时 DTO 带语言快照地址。
- OSS：`lowcode/{projectKey}/lang/{pageKey}-v{versionNo}-{langKey}.json`。
- `@vanstack/xml`：去掉页面文档上的 i18n 序列化；渲染入参改为外部目录。
- `@vanstack/lowcode-runtime`、工作台、H5：目录来源从 XML 改为 API / JSON。
- 管理端语言库面板改为调工程 API，跨页共享同一份库。
