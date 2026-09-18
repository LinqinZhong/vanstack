## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`PageXmlDocument` 只有 `widgets`，`serializePageXml` 写出无属性的 `<page>`。预览宿主 `.preview-host` 写死 `padding: 12px` 与 `background: #fff`；画布 `.phone-screen` / `.preview-frame` 以及 `body:has(.preview-host)` 同样白底，并带投影。未选中控件时右侧检查器是 Empty。点击 iframe 空白处已经会 `select(null)`，但面板没有页面属性可编辑。历史栈 `HistoryEntry` 只存 `widgets` 与 `selectedWidgetId`。

## Goals / Non-Goals

**Goals:**

- 把页面背景与内边距放进现有 XML 属性管道（kebab-case、缺省不序列化），两端运行时都吃同一份 AST。
- 工作台画布用编辑铬标出页面边界，并去掉强制白底与默认内边距。
- 空选中态复用右侧检查器编辑页面样式，并纳入现有 coalesce 撤回。

**Non-Goals:**

- 不把页面做成控件树节点，不做页面级边框/圆角/阴影检查器。
- 不改 postMessage、页面/版本 API、H5 顶栏与 `.h5-body` 外壳留白。
- 不改变加载页面时默认选中第一个控件的行为。

## Decisions

### 1. 页面样式是 `page` 根属性，不是伪控件

```ts
type PageStyle = {
  background?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
};

type PageXmlDocument = {
  widgets: PageWidget[];
  style?: PageStyle;
};
```

解析时从 `page` 节点的 `:@` 读 `background` 与 padding 边；序列化写回同一套 `writeEdges` 规则。不复用完整 `styleAttrs`，以免把宽高、margin、边框写到 `page` 上。缺省 `compact` 后 `style` 为 `undefined`，`<page>` 仍无属性。非法值丢弃该字段，不抛整页错误。

`parsePageXml` / `serializePageXml` 必须同时读写子节点与根属性；`EMPTY_PAGE_XML` 仍是无属性空页。

备选：在控件树塞一个不可删除的 `page` 根控件。否决原因：现有添加/删除/粘贴/选中都按控件 id 工作，伪根会污染这些路径。

备选：背景只存在 CSS、不进 XML。否决原因：规格要求预览与 H5 都能还原管理员设置的页面背景与内边距。

### 2. 运行时把页面样式打在 `.lowcode-page`，宿主不再垫白底和内边距

`renderPageXml` 给根 `div.lowcode-page` 设置 `background` 与四边 `padding`，并 `box-sizing: border-box`。未设置时不写这些 CSS，视觉即为透明 + 0 内边距。

管理后台预览：

- `.preview-host` 去掉 `padding: 12px` 与白底；`html` / `body` / `.preview-frame` 背景改为透明。
- `.preview-mount` 与 `.lowcode-page` 铺满宿主（屏幕宽高由现有 `applyViewport` 决定），这样内边距从页面边缘向内吃，而不是宿主再套一层。

H5 只通过公共渲染获得页面样式；`.h5-frame` / `.h5-body` 外壳不动。

备选：继续把 padding 放在 `.preview-host`，用消息把数值传进 iframe。否决原因：H5 没有该协议，且会让「页面内边距」变成宿主私货。

### 3. 浅蓝实线框画在 `.phone-screen` 上，用 outline 避免吃尺寸

画布屏幕容器改为透明、去掉投影，使用 `outline: 1px solid #91c9f7`（或同色系浅蓝）勾边。`outline` 不计入宽高，375×667 内容区不变。编辑/预览模式都保留。iframe 本身 `background: transparent`，避免子文档透明后仍露出白底。

该框只存在 `frontend-admin` 画布 CSS，不进 XML，H5 无对应规则。

备选：把边框写进页面 `border-*` 属性。否决原因：规格明确这是工作台铬，H5 不得出现。

备选：`border` + `box-sizing: border-box`。否决原因：会让可视内容区少 2px，与屏幕尺寸输入不一致。

### 4. 检查器空选中态编辑 `pageStyle`，历史条目带上它

工作台增加 `pageStyle` 状态；`xml` 改为 `serializePageXml({ widgets, style: pageStyle })`。`applyXml` / `resetWidgetSession` 同时恢复页面样式。

未选中控件时右侧卡片展示背景 ColorPicker（可清除）与现有四边 padding 控件（可抽与 `WidgetStyleFields` 共用的边距/背景片段，避免复制一套交互）。只读规则与控件检查器相同（`readOnly`）。选中控件后仍只渲染控件表单。

`HistoryEntry` 增加 `pageStyle`。`commitWidgets` 推广为同时可提交页面样式的 `commitDraft`（或等价），coalesce key 用 `edit:page:background` / `edit:page:padding`。撤回/重做恢复 `pageStyle`。加载版本时仍可默认选中第一个控件；只有空选中才露出页面面板。

备选：每次改页面样式直接改 XML 字符串。否决原因：与现有 AST 编辑、coalesce 撤回不一致。

## Risks / Trade-offs

- [部分浏览器 iframe 默认白底] → 同时把父级 iframe、`.phone-screen`、子文档 `html`/`body`/`.preview-host` 设为透明。
- [既有草稿视觉变化] → 去掉 12px 垫白是规格要求的默认；用户可在页面检查器加回内边距与背景。
- [padding `0` 与缺省] → 与控件一致：显式 0 会序列化；缺省不写属性，渲染都是 0。
- [画布 outline 在缩放后可能发虚] → 画在未 scale 的 `.phone-screen` 上（尺寸已含 `view.scale`），不放进 iframe 内再缩放。

## Migration Plan

- 无数据库或 API 迁移。无 `background`/`padding` 的旧 XML 继续可解析。
- 部署后工作台立即呈现透明页 + 浅蓝框；若需旧视觉，在检查器里设置背景与内边距并保存版本。
- 回滚：还原本变更即可；已写入页面属性的 XML 在旧解析器上会被忽略（当前解析只读已知属性），控件树不受影响。
