## 1. 数据表与工程 API

- [x] 1.1 增加 `project_lang`、`project_lang_value` 实体并注册到 TypeORM，重启后端后确认两表存在且 `(project_id, key)` / `(project_id, group_key, entry_key, lang_key)` 唯一
- [x] 1.2 在 shared 增加工程语言库 DTO（语言列表 + 分组文案，形状可与现有 `PageI18n` 对齐），并实现 `GET/PUT /projects/:id/langs`（需登录）。用无 token 请求确认 401；PUT 重复语言键确认拒绝；删工程后确认行被级联删除
- [x] 1.3 PUT 时去掉空译文行、改语言键同步文案行、删语言删译文。写入 `en` 与 `home.title` 后再 GET，确认聚合结果与写入一致

## 2. 发布快照与运行时元数据

- [x] 2.1 `publishVersion` 按 `lowcode/{projectKey}/lang/{pageKey}-v{versionNo}-{langKey}.json` 为每种语言写入快照（含 key/name/dir/values）。发布含 zh/ar 的 `home` v2 后，用 `getObject` 读回两份 JSON 内容正确
- [x] 2.2 再次发布同一版本后 JSON 为最新库；无语言时不写文件。改文案后不发布，旧 JSON 不变
- [x] 2.3 `getRuntimeProject` 为在用版本返回各语言 `jsonUrl`。H5 元数据里地址指向该版本快照；删除版本/页面时删除对应 JSON

## 3. XML 与公共渲染

- [x] 3.1 `PageXmlDocument` 去掉 `i18n`；`serializePageXml` 不再输出 `<i18n>`；含旧 `<i18n>` 的 XML 仍能解析出控件且目录为空。构建 xml 包后确认入口不再把页面文档当作语言库来源
- [x] 3.2 `renderPageXml` 增加宿主传入的 `catalog`（或 JSON 同构对象），按 `locale` 解析 `$t` 与 `dir`。传入 ar 目录后文案与 `dir=rtl` 正确，XML 中无 `<i18n>`
- [x] 3.3 预览协议继续带 `locale`，并带上工作台从 API 取得的目录。切地球下拉后 iframe 换文案，不触发版本保存

## 4. 工作台

- [x] 4.1 `LanguageLibraryPanel` 改为 GET/防抖 PUT 工程语言库；`commitDraft` / `HistoryEntry` 去掉 `pageI18n`。新增语言后 XML 无 `<i18n>`，撤回不删该语言；未选页面时语言库仍可打开
- [x] 4.2 画布地球下拉与 `CopyI18nPicker` 改用工程语言库。页面 A 新增 `en` 后页面 B 也能选到；绑定 `$t("common.ok")` 后预览用库中译文

## 5. H5 与验收

- [x] 5.1 H5 根据运行时 `jsonUrl` 按区域加载一种语言 JSON（精确匹配否则第一种），交给 `renderPageXml`。区域 `ar` 命中 ar 快照；`fr` 且只有 zh/en 时用 zh；未发布语言时按字面量 LTR
- [x] 5.2 走通：登录 → 语言库写入库表 → 文本绑定 `$t` → 画布切语言即时预览 → 发布后 OSS 出现 JSON → H5 加载该 JSON；改库不发布则 H5 仍是旧快照；保存页面 XML 不含 `<i18n>`
