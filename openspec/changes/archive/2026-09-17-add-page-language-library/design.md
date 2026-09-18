## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`PageXmlDocument` 只有 `widgets` / `style` / `data`。`splitPageChildren` 只抽出 `<data>`，其余当控件解析，未知元素被忽略，因此今天的 `<i18n>` 会被丢掉。草稿历史 `HistoryEntry` 含 `widgets` / `pageStyle` / `pageData` / `selectedWidgetId`，`commitDraft` 未带语言库。`renderPageXml` 把 `text.value` / `button.text` 原样画出来，页面根没有 `dir`。预览协议 `LowcodePreviewMessage` 只有 XML 与画布参数。工作台顶栏返回/版本/保存是默认尺寸按钮；中间卡片 `extra` 为空。文案入口在检查器 `value`/`text` 与样式气泡内容框。H5 用应用 i18n 区域拉工程元数据，但渲染页面 XML 时不读页面语言。

请求里的「TRL」按标准 **RTL** 实现。语言库按页面版本 XML 存储，不新增工程级 API。

## Goals / Non-Goals

**Goals:**

- 把语言库做成 `PageXmlDocument` 的一等字段，解析/序列化往返，且不进入控件树。
- 工作台用弹窗编辑语言/分组/译文，用画布地球下拉切换预览语言；文案框支持 `$t("分组.键")` 与地球选择器。
- 公共渲染按 locale 解析 `$t` 并设置页面 `dir`；H5 自行从语言库选语言。
- 语言库变更走现有 `commitDraft` / 撤回 / 版本 XML；预览语言是会话态，不写 XML。

**Non-Goals:**

- 不把语言库提升为工程级共享资源，不改页面/版本 API。
- 不做 ICU、复数、插值变量、嵌套分组。
- 不把 `margin-left` 等物理边距改成逻辑属性；RTL 只改页面 `dir`。
- 不把工作台壳层 zh/en 与页面语言库混成一套。

## Decisions

### 1. 语言库落在页面 XML，而不是工程资源

与 `<data>` 相同：随版本 OSS XML 保存，自动进入草稿自动保存。跨页复用本期不做。序列化顺序：已有 `<data>`（若有）→ `<i18n>`（若有）→ 控件。

```ts
type PageI18nDir = 'ltr' | 'rtl';
type PageI18nLang = { key: string; name: string; dir: PageI18nDir };
type PageI18nEntry = { key: string; values: Record<string, string> };
type PageI18nGroup = { key: string; entries: PageI18nEntry[] };
type PageI18n = { langs: PageI18nLang[]; groups: PageI18nGroup[] };
```

空译文不写 `<v>`。删除某语言时从各 `values` 去掉对应键。

**备选**：工程级 JSON + 新 API。否决：无现成工程附件存储，也无法跟页面版本一起撤回。

### 2. `$t` 只匹配整段字面量，解析放在公共渲染

正则：去掉首尾空白后整段为 `$t("group.key")`。分组键与文案键各一段、中间一个 `.`、双引号。混合文本（`前缀$t("a.b")`）当普通字面量。解析函数放在 `@vanstack/xml`（纯数据），`@vanstack/lowcode-runtime` 在画 `text`/`button` 前替换；缺失译文渲染空串。控件树标签可继续显示表达式，便于作者辨认绑定。

**备选**：工作台预解析后再把译文塞进发给 iframe 的 XML。否决：会丢掉绑定，且 H5 无法独立解析。

### 3. 当前预览语言走协议，不写 XML

`RenderPageXmlOptions` 增加 `locale?: string`。`LowcodePreviewMessage` 增加 `locale: string | null`。工作台用组件 state 记住当前语言键；切页时若新页仍有该键则保留，否则落到第一种语言。切语言只重发 preview 消息，不 `commitDraft`。

H5：用 `parsePageXml` 取出语言库，将 `i18n.resolvedLanguage` 做精确匹配，再尝试主语言前缀（`zh-CN` → `zh`），否则第一种语言，把该 `key` 传给 `renderPageXml`。

### 4. 页面方向只用 `dir`，不改 flex XML

`.lowcode-page` 设置 `dir` 与 `direction`。`flex-start` 随文档方向走，XML 里的 `flex-direction="row"` 保持不变。物理 `margin-left` 等不镜像。

### 5. 工作台 UI 拆成独立组件，复用现有提交管道

- 顶栏按钮 `size="small"`：返回（已有左箭头）、显示版本（`UnorderedListOutlined`）、语言库（`GlobalOutlined`）、保存（`SaveOutlined`）。
- `LanguageLibraryModal`：上语言表，下分组 `Tabs` + 译文 `Table`；`commitI18n` 扩展 `commitDraft` 增加 `pageI18n`。连续改同一单元格用 `coalesceKey`：`i18n:${group}:${entry}:${lang}`。
- 画布卡片 `extra`：`Select` + 地球图标。
- `CopyI18nPicker`：检查器 `value`/`text` 与气泡内容框共用；选中后写入 `$t("group.key")`。

语言/分组/文案键校验：非空、不含 `.` `"`，语言键在页面内唯一，分组键唯一，文案键在分组内唯一；语言键允许 `zh-CN` 这类连字符。缺省新语言/分组/键用未占用名（`lang2`、`group2`、`key2`），新语言默认 `ltr`。

只读态（预览/非草稿）弹窗可看不可改；地球下拉仍可切预览语言。

### 6. 与进行中变更的衔接

`add-indexeddb-draft-autosave` 按整份 XML 落草稿：只要 `serializePageXml` 写出 `<i18n>` 即可。`add-widget-style-bubble` 把文案入口放进气泡与检查器弹窗：地球按钮必须同时出现在这两处。

## Risks / Trade-offs

- [每页一份语言库，跨页文案会重复] → 接受；工程级库留到后续。
- [物理左右边距在 RTL 下不翻转] → 规格已限定只跟 `dir`；逻辑属性另开变更。
- [缺失译文显示空白，作者可能以为控件丢了] → 工作台输入框仍显示 `$t(...)`；运行时按规格留空。
- [H5 区域与语言键对不上] → 前缀回退，再回落到第一种语言。

## Migration Plan

- 无 `<i18n>` 的旧 XML 继续合法，按字面文案与 LTR 渲染。
- 回滚：去掉解析/渲染/工作台入口后，旧客户端忽略 `<i18n>`；OSS 上已写入的节点不伤控件。
