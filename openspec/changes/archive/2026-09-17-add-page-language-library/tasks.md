## 1. XML 语言库

- [x] 1.1 在 `packages/xml` 增加 `PageI18n` 及相关类型，扩展 `PageXmlDocument` 为可选 `i18n`，导出 `resolveI18nCopy(raw, catalog, locale)`（整段 `$t("group.key")` 才解析，缺失返回空串）与 `pickPageLocale(catalog, runtimeLang)`。构建后确认包入口导出这些符号
- [x] 1.2 让 `parsePageXml` 读取页面级第一个 `<i18n>`（`<lang key name dir>`、`<group key>`、`<entry key>`、`<v lang>`），嵌套/未知节点、空键、含 `.` `"` 的键被忽略；无 `<i18n>` 的旧 XML 仍成功。用含 zh/ar 与 `common.ok` 的示例 XML 以及一份旧 XML 各跑通解析
- [x] 1.3 让 `serializePageXml` 在有语言或分组时把 `<i18n>` 写在 `<data>` 之后、控件之前；空译文不写 `<v>`；无内容时不输出 `<i18n>`。解析→序列化→再解析后语言顺序、方向与译文不变，含 `&` `"` 的名称/译文能往返

## 2. 公共渲染与宿主

- [x] 2.1 `renderPageXml` 增加 `locale` 选项：画 `text`/`button` 前用 `resolveI18nCopy`；`.lowcode-page` 按当前语言 `dir` 设置 `dir`/`direction`，无语言为 ltr。用 `$t("common.ok")` + ar/rtl 的 XML 渲染，文案为阿语译文且页面 `dir=rtl`，XML 中 `flex-direction` 仍为 `row`
- [x] 2.2 预览协议 `LowcodePreviewMessage` 增加 `locale`；`PreviewPage` 把该值传给 `renderPageXml`。工作台切地球下拉后 iframe 立即换文案与方向，且不触发版本保存
- [x] 2.3 H5 用 `pickPageLocale` 从页面语言库选语言再调用 `renderPageXml`。区域 `ar` 命中 `ar`；区域 `fr` 且库中只有 zh/en 时用第一种语言

## 3. 工作台语言库与历史

- [x] 3.1 顶栏返回、显示版本、保存改为 `size="small"` 并补图标；保存左侧加语言库按钮（地球图标）。无选中页面/版本时语言库不可用。打开编辑页可看到小号带图标按钮
- [x] 3.2 抽出 `LanguageLibraryModal`：上语言表（名称/键/LTR|RTL）、下分组 Tabs + 译文表（列为语言、行为键）；草稿可新增语言/分组/文案键并编辑译文，只读态不可改。新增 `en` 后 XML 出现对应 `<lang>`，各分组表多一列
- [x] 3.3 `HistoryEntry` / `commitDraft` / 撤回 / 加载 XML 带上 `pageI18n`；连续改同一单元格用 `coalesceKey`。新增一种语言再撤回，该语言从弹窗与 XML 消失；只切换画布语言再撤回，预览语言不变
- [x] 3.4 画布卡片 `extra` 加地球 `Select`，选项为当前语言库；切页时同键保留否则落到第一种。无语言时下拉无选项且页面 LTR

## 4. 文案选择器与验收

- [x] 4.1 抽出 `CopyI18nPicker`，挂到检查器 `value`/`text` 与样式气泡内容框后；选中 `common.ok` 写入 `$t("common.ok")`。手动输入该表达式同样解析；只读态地球按钮不可写入
- [x] 4.2 在 admin 的 zh/en 增加语言库、分组、LTR/RTL、选择文案等标签。走通：登录 → 小号顶栏 → 语言库弹窗增语言/分组/键 → 文本用地球绑定 `$t` → 画布切 RTL 语言后面向与文案变化 → 保存再加载目录仍在 → 撤回可还原语言库；H5 按区域选语言且不把 `<i18n>` 画成控件
