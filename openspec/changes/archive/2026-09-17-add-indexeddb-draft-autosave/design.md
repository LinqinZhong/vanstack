## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`ProjectEditorPage` 用 `widgets` / `pageStyle` / `pageData` 派生 `xml`，`Ctrl+S` 与「保存」调用 `api.updateVersion`，无脏检查，每次都 PUT OSS。撤销已用 `coalesceKey` 合并连续检查器编辑，但持久化没有对应层。刷新只加载服务器版本 XML。后端版本 API、表结构与 OSS 键本期不改。

## Goals / Non-Goals

**Goals:**

- 草稿的未提交 XML 先写入 IndexedDB，刷新同一版本能恢复。
- 服务器提交走现有 `updateVersion`，仅当 XML 相对上次成功快照有变化。
- 本机写入与服务器提交都合并连续手势，并在在途请求期间只保留最新一份。

**Non-Goals:**

- 不改后端、不加 `xml_content` 列、不上 Redis/Mongo。
- 不把撤回栈、选中控件、画布平移缩放写入 IndexedDB。
- 不处理多标签页实时同步或跨浏览器冲突 UI。

## Decisions

### 1. 草稿库只放在 `frontend-admin`

新增小模块（例如 `draftStore.ts`）：打开名为 `vanstack-lowcode` 的 IndexedDB，对象仓库 `drafts`，主键 `projectId:pageId:versionId`。记录至少含 `xml` 与写入时间。读写失败（隐私模式等）时降级为仅内存，脏检查提交规则仍生效。

不把草稿能力放进 `@vanstack/lowcode-runtime`：该包是公共渲染，工作台存储不属于它。

备选：`localStorage`。否决原因：同步写入会卡住检查器拖动，且容量约 5MB。

备选：按用户拆库。本期单管理员本机即可；键已含版本 id，换账号清站点数据即可。

### 2. 两层写入，脏标记以服务器快照为准

```
commitDraft / xml 变化
        |
        +-- 约 200ms 合并 --> IndexedDB.put 最新 xml（与上次本机写入相同则跳过）
        |
        +-- 停手约 1.5s / 关页 / Ctrl+S
               |
               v
          xml === lastServerXml ? 不请求
               |
               v
          inspectorInvalid 或只读 ? 不请求（IndexedDB 仍可保留）
               |
               v
          PATCH updateVersion；在途期间又变了则回来只再发最后一份
```

`lastServerXml` 在加载版本、保存成功、创建版本时设为当时的服务器 XML。脏 = 当前 `xml !== lastServerXml`。保存成功后删除该主键的 IndexedDB 记录，并把 `lastServerXml` 更新为刚提交的内容。

IndexedDB 在只读/已发布时不写；切走某版本不删其他版本的草稿。

备选：定时每秒都 PATCH。否决原因：无改动仍打 MySQL/OSS。

备选：只写 IndexedDB、服务器仍纯手动。否决原因：规格要求停手与关页在有改动时提交版本接口。

### 3. 打开版本时本机脏草稿优先

`applyXml` / 选中版本：先读该键的 IndexedDB。若存在且 `xml !==` 服务器该版本 XML，则用本机草稿并视为脏；否则用服务器 XML，并清掉等于服务器内容的过期记录。切换页面或版本只加载目标键，A 的草稿不会套到 B。

恢复只调用现有 `applyXml`，与切版本一样清空撤回栈。

关页用 `pagehide`：先确保 IndexedDB 已是最新（可同步调度已防抖的 put），若仍脏且校验通过则用带鉴权头的 `fetch` + `keepalive` 调同一 PATCH。关页请求失败时刷新仍能从 IndexedDB 恢复。

备选：本机与服务器都脏时弹窗让用户选。推迟：单人工作台，未提交本地改动优先，避免刷新丢编辑。

### 4. 保存反馈避免刷屏

停手自动提交成功不弹 `versionUpdated`。显式保存：真正发了请求再成功提示；因无改动跳过则不提示或给「无改动」文案。可在顶栏用「未保存 / 保存中 / 已保存」轻量状态。`inspectorInvalid` 时沿用现有不可关闭检查器的行为，且不发 PATCH。

## Risks / Trade-offs

- [IndexedDB 不可用] → 降级内存；刷新仍可能丢，但无改动仍不打服务器。
- [关页 keepalive PATCH 被浏览器丢掉] → IndexedDB 已有草稿，刷新可恢复；下次停手再提交。
- [两标签页改同一草稿 last-write-wins] → 本期接受；主键按版本隔离，不做锁。
- [他处已更新服务器、本机仍有旧脏草稿] → 按规格恢复本机草稿；不做冲突合并。
- [自动保存仍走 OSS PUT] → 仅脏 + 停手才 PUT，比逐帧写可接受；草稿列进 MySQL 不在本期。

## Migration Plan

1. 纯前端：部署 admin 即可，无迁移脚本。
2. 已有草稿版本不受影响，直到该浏览器第一次编辑才出现 IndexedDB 记录。
3. 回滚：去掉草稿模块后，未提交本机草稿只留在用户浏览器，不污染服务器；用户需再手动保存。

## Open Questions

无。停手间隔（约 1.5s）与 IndexedDB 合并间隔（约 200ms）实现时可微调，不改变规格。
