## Why

工作台对草稿的修改只活在内存里，刷新或误关标签就会丢失；同时若把每一次属性拖动都 `PATCH` 到版本接口，会无意义地反复写 MySQL / OSS。需要先把草稿落到本机 IndexedDB，并保证与上次成功提交相同的内容不再打到服务器。

## What Changes

- 编辑草稿时，工作台把当前页 XML 以当前工程/页面/版本为键写入 IndexedDB；写入 MUST 合并连续手势（与现有 `coalesceKey` 同类），MUST NOT 按每一帧或每一次 `commitDraft` 都写库。
- 再次打开同一草稿版本时，若 IndexedDB 中存在相对上次成功服务器快照的未提交改动，工作台 MUST 恢复该本地草稿并继续预览；无本地脏数据时仍加载服务器版本 XML。
- 向现有 `updateVersion`（MySQL 元数据 + OSS XML）提交时，仅当当前 XML 与上次成功落盘的服务器快照不同才发出请求。无改动时，手动保存、停手刷新、关页都 MUST NOT 调用该接口。
- 停手、关页、`Ctrl+S` /「更新版本」在存在未提交改动时仍可把草稿提交到现有版本接口；已发布或预览只读态 MUST NOT 写 IndexedDB，也 MUST NOT 提交服务器。
- 不新增 Redis / Mongo，不在 `project_page_version` 上增加草稿列；跨设备持久化仍走现有版本接口。撤销栈仍只存在会话内存，不写入 IndexedDB。

## Capabilities

### New Capabilities

- 无。IndexedDB 草稿与脏检查提交是现有工作台编辑契约的扩展，不单独成能力。

### Modified Capabilities

- `lowcode-runtime`: 工作台在编辑草稿时将未提交 XML 持久化到 IndexedDB 并在刷新后恢复；仅当内容相对上次成功服务器快照有改动时才提交版本保存接口。

## Impact

- `frontend-admin`：工程编辑页增加 IndexedDB 草稿读写、脏标记、停手/关页/快捷键触发的条件提交；保存成功后更新「上次服务器快照」并清理对应脏草稿。
- 后端版本 API、OSS 对象键、`lowcode-page` 持久化契约、`@vanstack/xml`、`@vanstack/lowcode-runtime` 渲染包与 H5 运行时不变。
- 中英 i18n 覆盖保存中、已保存、无改动等状态（若 UI 展示）。
- 非目标：协同编辑、多标签页实时互相同步、撤销历史跨刷新、草稿列进 MySQL、Redis 热层、已发布版本自动保存。
