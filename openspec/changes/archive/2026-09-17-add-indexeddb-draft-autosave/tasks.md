## 1. IndexedDB 草稿模块

- [x] 1.1 在 `frontend-admin` 新增 `draftStore.ts`：打开 `vanstack-lowcode` / `drafts`，主键 `projectId:pageId:versionId`，提供 get/put/delete；put 在 xml 与上次写入相同时跳过；打开或读写失败时静默降级（get 当空、put/delete 不抛）。用临时页或控制台对同一键写入、再读、再 delete，确认往返 XML 一致且失败路径不打断调用方
- [x] 1.2 给 put 加约 200ms 合并：连续多次 put 同一键只落最后一份 xml。短间隔连续调用后读库，只有最终 xml，中间值不必都在

## 2. 打开版本时恢复本机草稿

- [x] 2.1 在 `ProjectEditorPage` 加载/选中草稿版本时：记下 `lastServerXml`，读 IndexedDB；若本机 xml 与服务器不同则 `applyXml` 本机草稿（视为脏），否则用服务器 xml 并删掉相等的过期记录。切页面或切版本只读目标键。验证：改文案后刷新同一草稿，树与 iframe 是刷新前文案且撤回不可用；切到无草稿的另一版本看到服务器内容，不会带上上一份未提交 XML
- [x] 2.2 预览模式与已发布版本不写 IndexedDB，也不用本机草稿覆盖只读内容。验证：只读态改不了树；切回草稿后仍能读到该草稿自己的未提交记录（若之前有）

## 3. 无改动不提交，有改动才打版本接口

- [x] 3.1 把 `saveCurrentVersion` 改成脏检查：`xml === lastServerXml`、只读、或 `inspectorInvalid` 时直接返回且不调用 `api.updateVersion`。成功提交后更新 `lastServerXml`、删除该键 IndexedDB，在途期间又变脏则回来只再发最后一份。显式保存（按钮 / `Ctrl+S`）仅在真正发请求成功后提示；无改动跳过则不弹「版本已更新」。验证：打开未编辑草稿点保存，网络面板无 PATCH；改文案后保存有一次 PATCH；成功后再保存无第二次；检查器校验失败时不发请求且本机草稿仍在
- [x] 3.2 xml 变化且为草稿时：约 200ms 写 IndexedDB；停手约 1.5s 且脏且校验通过则自动走同一套提交（成功不弹 toast）。`pagehide` 时先冲 IndexedDB，若仍脏且可提交则 `fetch`+`keepalive` PATCH。验证：连续拖同一属性松手后 IndexedDB 为最终值且服务器只有一次保存；停手无新编辑不再请求；改完立刻刷新，若 keepalive 失败则刷新仍恢复本机草稿

## 4. 文案与走查

- [x] 4.1 在 `frontend-admin` 的 zh/en 增加未保存 / 保存中 / 已保存（及可选的无改动）文案，顶栏按脏与请求态展示；切换语言标签正确
- [x] 4.2 走通：登录 → 打开草稿 → 未改动保存不打接口 → 改文案后刷新能恢复且撤回为空 → 停手后自动保存一次 → 再保存不打接口 → 切另一版本不串草稿 → 预览/已发布不写不提交 → 检查器校验失败保留本机草稿 → 后端与 OSS 键无改动
