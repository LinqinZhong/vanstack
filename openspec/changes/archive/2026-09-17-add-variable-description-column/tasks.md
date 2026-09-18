## 1. XML 描述字段

- [x] 1.1 在 `packages/xml` 的 `PageVariable` 增加可选 `desc`；`parsePageData` 读取 `desc`（trim 后非空才保留），`serializePageData` 仅在有内容时写 `'@_desc'`。用 `<num n="count" desc="计数">1</num>` 做解析→序列化→再解析，确认描述仍为「计数」；无 `desc` 或空描述的变量序列化结果不含该属性；含 `&` / `"` 的描述能往返

## 2. 数据列表描述列

- [x] 2.1 在 `PageDataPanel` 于类型列和初始值列之间插入描述列：行内 `Input`，`coalesceKey` 为 `data:${name}:desc`，清空时去掉 `desc`。新增变量不带 `desc`；`rename` / `changeType` 保留原描述。编辑草稿时改描述「用户信息」后 XML 出现 `desc="用户信息"`；改类型后描述仍在；新增行描述为空且 XML 无 `desc`
- [x] 2.2 在 admin 的 zh/en 增加列标题（「描述」/「Description」）。预览模式或非草稿时描述输入只读。切换语言后列名正确；只读态无法改描述
- [x] 2.3 确认描述编辑走现有 `commitDraft`：把描述从「计数」改成「总额」并失焦后撤回，列表与 XML 回到「计数」

## 3. 验收

- [x] 3.1 走通：登录 → 打开工程页面数据 tab → 列表在类型与初始值之间有描述列 → 给已有变量写描述并保存版本再加载仍在 → 新增变量描述为空 → 改类型不丢描述 → 清空描述后 XML 无 `desc` → 撤回可还原描述；H5/预览仍不把变量画成控件
