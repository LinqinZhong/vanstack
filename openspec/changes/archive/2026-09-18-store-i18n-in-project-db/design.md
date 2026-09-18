## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/`。

现状：`PageXmlDocument.i18n` 随版本 XML 存 OSS；工作台 `commitDraft` 把语言库塞进撤回栈；`renderPageXml({ locale })` 从解析结果取目录；H5 `parsePageXml(xml).i18n` 再 `pickPageLocale`。OSS XML 键为 `lowcode/{projectKey}/{pageKey}/v{n}.xml`。`publishVersion` 只改状态，不写额外对象。TypeORM `synchronize` 在非生产开启。

## Goals / Non-Goals

**Goals:**

- 语言与文案落在工程级两张表，工作台经 REST 读写。
- 发布时按语言写 JSON 快照；H5 只加载当前在用版本对应语言文件。
- 公共渲染改为宿主传入目录；XML 不再序列化 `<i18n>`。

**Non-Goals:**

- 不把 XML 里已有 `<i18n>` 迁入数据库。
- 不做语言库的撤回/重做，不做工程级草稿。
- 不新增独立分组表；分组键存在文案行上。
- 不改 `$t("group.key")` 语法。

## Decisions

### 1. 表结构

`project_lang`：`id`、`project_id`（级联删）、`key`、`name`、`dir`（`ltr`/`rtl`，缺省 `ltr`）、`sort_order`。唯一 `(project_id, key)`。

`project_lang_value`：`id`、`project_id`、`group_key`、`entry_key`、`lang_key`、`value`。唯一 `(project_id, group_key, entry_key, lang_key)`。空字符串不落行。删语言时按 `lang_key` 删译文。

新增空分组时同时插入一条缺省 `entry_key`（与现有 `keyN` 规则相同），以便没有第三张分组表也能刷新后还原 tab。

**备选**：页面级表。否决：用户要求每个工程一份库。

### 2. 管理 API

挂在现有 `GET/POST /projects/:id` 下，仍要 `lowcode:manage`：

- `GET /projects/:id/langs` 返回语言列表 + 按分组聚合的文案（工作台可继续用现有 `PageI18n` 形状组装）。
- `PUT /projects/:id/langs` 提交完整目录（语言顺序、分组、译文）。工作台每次提交整份面板状态，避免细粒度补丁与改键竞态。连续改同一单元格仍可在前端防抖后再 PUT。

**备选**：逐行 PATCH。否决：改语言键/删分组需要多行事务，整份替换更简单。

### 3. 发布快照

`publishVersion` 在标 `published` 之后，读取该工程两张表，按 `sort_order` 为每种语言 `putObject`：

`lowcode/{projectKey}/lang/{pageKey}-v{versionNo}-{langKey}.json`

```json
{
  "key": "zh-CN",
  "name": "简体中文",
  "dir": "ltr",
  "values": {
    "common.ok": "确定"
  }
}
```

`getRuntimeProject` 对当前在用版本拼出各语言 `jsonUrl`（`OssService.getPublicUrl`）。无语言则 `langs` 为空。删除页面/版本时按同一键规则 `deleteObject`。

工作台预览继续走协议：主窗口 GET 工程语言库，把目录和 `locale` 发给 iframe；不读 OSS 快照。

**备选**：H5 调 API 读库。否决：用户要求按语言加载 OSS JSON，与 XML 一样可走 CDN。

### 4. XML 与渲染

`PageXmlDocument` 去掉 `i18n`。`serializePageXml` 不再写 `<i18n>`。`splitPageChildren` 继续丢掉名为 `i18n` 的未知节点（与其他未知元素相同）。`resolveI18nCopy` / `pickPageLocale` 保留，目录改由调用方传入。`renderPageXml` 增加 `catalog`（或与 JSON 同构的 `{ langs, values }`），不再 `page.i18n`。

IndexedDB 草稿只存 XML，语言库以服务器为准；刷新工作台后 GET langs。

### 5. 工作台

`LanguageLibraryPanel` 的 `onChange` 改为防抖 PUT，不再 `commitDraft`。`HistoryEntry` 去掉 `pageI18n`。左侧语言库在未选页面时也可打开。地球下拉绑定工程语言列表。

## Risks / Trade-offs

- [发布后改库，H5 仍是旧快照] → 规格如此；需再次发布才更新。
- [整份 PUT 覆盖并发] → 单管理员工作台可接受；后写赢。
- [旧 XML 目录丢失] → 不迁移；本期数据可手搓进新库。

## Migration Plan

1. 上线表与 API，工作台改读库。
2. 发布路径写 JSON；H5 改加载 JSON。
3. 去掉 XML i18n 字段。回滚：停用新 API 后旧客户端仍能渲染字面量；已写 JSON 不影响 XML。
