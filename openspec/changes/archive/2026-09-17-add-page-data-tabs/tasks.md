## 1. XML 页面变量

- [x] 1.1 在 `packages/xml` 增加 `PageVariable` / `PageDataType`，扩展 `PageXmlDocument` 为可选 `data`，并从包入口导出；构建后确认 `@vanstack/xml` 导出包含这些新符号
- [x] 1.2 让 `parsePageXml` 读取页面级第一个 `<data>`（`num`/`str`/`bool`/`arr`/`obj` 按顺序，`n` 为名，文本为 `value`，`bool` 保留 `watch`），其余页面子节点仍走控件解析；嵌套/多余 `data`、未知子元素、空名被忽略。用含五种类型（含 `watch` 与空 `str`）以及一份无 `<data>` 的旧 XML 各跑通解析
- [x] 1.3 让 `serializePageXml` 在有变量时把 `<data>` 写在控件之前，无变量时不输出 `<data>`；空 `str` 仍写出元素；文本节点 XML 转义往返。用 `{a:1,b:2}` 与 `["1","2"]` 做解析→序列化→再解析，确认值文本不被改成 JSON

## 2. 工作台 Tabs 与历史

- [x] 2.1 去掉预览卡片的屏幕宽度输入与 `screenWidth` 状态，画布固定 375×667；标题改为「布局 / 数据 / 事件」Tabs。打开编辑页确认不再出现可改的「375 px × 667px」，布局 tab 画布尺寸仍为 375×667
- [x] 2.2 三个面板共存：布局显示画布，数据为变量区，事件为 Empty；切走布局时隐藏而非卸载 iframe。新增一个变量后切回布局，预览不整页重载且该变量仍在草稿中
- [x] 2.3 增加 `pageData` 状态，序列化/加载 XML 时往返变量；`HistoryEntry` 与 `commitDraft` / 撤回 / 重做带上 `pageData`。删除一个变量再撤回，列表与 XML 回到删除前

## 3. 数据列表与代码编辑器

- [x] 3.1 抽出 `PageDataPanel`：表格展示变量名、类型、初始值，支持新增（`varN` + Number/`0`）、删除、HTML5 拖动排序、改名（IdentifierName + 唯一）、改类型（重置缺省值）。编辑草稿时拖动第二行到第一行，序列化后 `<data>` 子元素顺序一致；重复名被拒绝
- [x] 3.2 Number/String/Boolean 在行内编辑（Boolean 只写 `0`/`1`）；Array/Object 点开 Modal，首行 `function 变量名(){` 与末行 `}` 只读，中间 CodeMirror 编辑 `return` 表达式，确认后写入原文字面量。非法表达式不改 XML 并提示失败；Number 行不打开该编辑器
- [x] 3.3 预览模式或非草稿时列表只读（不能增删改拖）。在 admin 的 zh/en 加入布局/数据/事件、列名、新增删除、空事件、非法表达式等文案；切换语言后标签正确

## 4. 验收

- [x] 4.1 走通：登录 → 打开工程页面 → 中间为三个 tab 且无屏幕宽度输入 → 数据 tab 新增 Number/String/Boolean/Array/Object（Array/Object 用代码编辑器写入字面量）→ 拖动排序 → 保存版本再加载列表与 XML 一致 → 切回布局预览仍只渲染控件 → 撤回可还原变量变更；含 `<data>` 的 XML 在 H5 中不把变量画成控件
