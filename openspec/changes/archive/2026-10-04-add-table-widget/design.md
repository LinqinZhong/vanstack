## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`PageWidget` 是 `image` / `icon` / `text` / `button` / `flex` / `swiper` / `swiper-item` 的联合。`parseWidgets` 按父级过滤，只有 `swiper` 接收 `swiper-item`。`serializeWidgets` 的最后一支默认写成 `swiper-item`。编辑器 `widgetHelpers` 用 `satisfies` 穷尽 `PageWidget['type']`。气泡是否展示某一组样式由 `isBoxGroupAllowed` 决定，快捷键走同一判断。公共渲染用 `ctx.editing` 区分编辑态与预览/H5，滑动器已经用这一支把「编辑铺开 / 预览轮播」放在同一份 DOM 上。

## Goals / Non-Goals

**Goals:**

- 用现有 XML 管道增加 `table` / `th` / `tr` / `td`，缺省属性不落盘，错位子节点被忽略且不让整页非法。
- 编辑态与预览态共用一套表格 DOM：编辑态按内容尺寸铺开，预览与 H5 用视口加溢出策略。
- 行列结构、列宽行高和单元格样式都走现有控件树、撤回与气泡写回，不另建一份表格文档。

**Non-Goals:**

- 不合并单元格，不做 `colspan` / `rowspan`。
- 单元格不装子控件，也不做按数组自动生成行。
- 不冻结首列，不引入 `thead` / `tbody` / `col`。
- 不改页面/版本 API 与 OSS。
- 不把结构/布局模式、网格线和行列手柄写进 XML。

## Decisions

### 1. 四个节点，表头不包进行

```xml
<table id="..." header-height="36" freeze-header="true">
  <th id="..." width="80" value="" align="start" valign="middle" />
  <tr id="..." height="36">
    <td id="..." value="" />
  </tr>
</table>
```

`th` 与 `tr` 都是 `table` 的直接子节点。列数等于 `th` 个数，`td` 按下标对齐。这样和用户指定的标签一致，也和 `swiper` / `swiper-item` 的「父级决定能出现谁」同一套解析。

备选是标准 HTML：`tr` 里再放 `th`。那会多一个表头行节点，和指定结构不一致，所以不用。

`WidgetParent` 增加 `table` 与 `tr`。`table` 只收 `th` 和 `tr`，`tr` 只收 `td`，`th` / `td` 没有子控件。页面根、`flex`、`swiper-item` 把 `table` 当作普通内容；`swiper` 的直接子节点仍只认 `swiper-item`。序列化必须按类型分支，不能再落到 `swiper-item` 默认支。写出时先全部 `th`，再全部 `tr`。

### 2. 几何和单元格样式分开存

| 数据 | 落点 | 默认 |
| --- | --- | --- |
| 视口宽高 | `table.style.width` / `height` | `240px` / `120px`，新建时写入 |
| 溢出 | `table.style.overflow` | 未写时预览按 `auto` |
| 表头冻结 | `table.freezeHeader` → `freeze-header` | `false`，不写 |
| 表头行高 | `table.headerHeight` → `header-height` | `36`，不写 |
| 列宽 | `th.width` | `80`，小于 `24` 视为未设置 |
| 数据行高 | `tr.height` | `36`，小于 `24` 视为未设置 |
| 文案 | `th.value` / `td.value` | 空字符串 |
| 对齐 | `align` / `valign` | `start` / `middle`，不写 |
| 背景、边框、文字、内边距、圆角 | 现有 `WidgetStyle` | 与其他控件相同 |

列宽和行高不进 `WidgetStyle`，避免和通用尺寸拖拽、`sanitizeWidgetStyle` 抢同一字段。`th` / `tr` / `td` 上的样式宽高、外边距、定位、溢出、旋转在 `sanitizeWidgetStyle` 里丢掉。

`WidgetAccepts` 增加 `table-section`（`th` | `tr`）和 `table-cell`（`td`）。`table` 的 `allowRoot` 为真，另外三个为假，且不放进 `ADDABLE_WIDGET_TYPES`。

### 3. 同一份 DOM，编辑态不滚动

渲染使用 CSS grid，而不是 HTML `<table>`。AST 里 `th` 不是 `tr` 的子节点，grid 可以直接用 `th.width` 做列模板，每一行一个 grid 行。节点仍带 `data-widget-id`、`data-widget-type` 和 `widgetClassName`。

- `editing === true`：外壳尺寸等于内容（列宽之和、表头行高加各行行高），`overflow: visible`，不创建滚动口，不启用吸顶。空格子画只存在于编辑态的网格线。
- `editing === false`：外壳使用视口宽高。`visible` / `hidden` / `scroll` / `auto` 按字面作用在滚动口上。仅当 `freezeHeader` 为真且滚动口会纵向滚动（`scroll`，或 `auto` 且内容更高）时，表头行 `position: sticky; top: 0`。横向滚动时表头格子跟着列走。

视口尺寸仍然可以用表格选中时的通用尺寸分组编辑，但它只影响预览滚动口，不改列宽行高。

### 4. 选中范围放在编辑器状态里

现有 `selectedWidgetId` 继续表示控件树上的一个节点。另外在工作台保存不进 XML 的范围：

- `column`：`tableId` + 列下标
- `row`：`tableId` + `tr.id`
- `header`：`tableId`

列/行/表头手柄只在编辑态画。点击格子选中该 `th` 或 `td` 并清掉范围。点控件树同样只选中那个节点。

范围选中时，气泡改的是单元格样式：写回该列的 `th` 和各行对应 `td`、该行全部 `td`，或全部 `th`。一次修改合成一步撤回。各格当前值不一致时气泡显示未设置，用户写下新值后整段一起改。文案只在单格选中时编辑。

结构/布局模式是工作台的 `tableTool: 'structure' | 'layout'`，第一次选进某张表时为 `structure`。开关放在气泡工具栏，不放进画布底部的编辑/预览切换。

结构操作改树：插入列时给每个 `tr` 补一个 `td`；移动列时同步移动各行同一下标的 `td`；短行在这些操作里补齐到列数。禁止删到 0 列或 0 行数据，禁止删除或挪走表头行。

### 5. 布局拖拽不走通用尺寸分组

布局模式在列右边界、数据行下边界和表头行下边界放手柄。拖拽沿用预览 iframe 的指针事件，把结果写到 `th.width`、`tr.height` 或 `table.headerHeight`，按画布缩放取整，最小 `24`，一次拖拽一步撤回。

通用尺寸分组仍然只改 `table` 的视口，并且对 `th` / `tr` / `td` 关闭。`isBoxGroupAllowed` 对这三个类型关闭 `size`、`margin`、`position`、`rotate`；`tr` 再关闭 `padding`、`border`、`radius`、`overflow` 和文字样式。`th` / `td` 打开文字样式、背景、边框、圆角、内边距，并加上对齐控件。`table` 打开 `overflow`，并在气泡上提供表头冻结和表头行高。快捷键已经先问 `isBoxGroupAllowed`，因此 `Ctrl+T` / `Ctrl+M` / `Ctrl+L` / `Ctrl+Shift+R` 在这些节点上自然失效。

### 6. 助手与文案

`apps/frontend-admin/src/widgets/` 为四个类型各加一个 helper，并登记进 `widgetHelpers`。`create` 造 3 列 × 3 行，视口 `240×120`。`clone` 复制列宽、行高、冻结、表头行高、文案、对齐和子树。`patch` 先 `applyCommon`，再写本类型字段。中英 `lowcode` 文案覆盖类型名、结构、布局、表头冻结和对齐。

## Risks / Trade-offs

- [编辑态表格跟着内容变高，和预览视口不是同一个盒子] → 视口只在选中 `table` 的尺寸分组里改；布局手柄只改列宽行高。验收时要分别看编辑铺开和预览滚动。
- [外层 `flex` 或页面若把溢出裁掉，编辑态仍可能看不到表格超出部分] → 表格自身不裁切、不滚动。不改祖先的溢出。
- [范围选中要一次改多个节点] → 用一次树提交包住整列或整行，避免撤回只恢复一半。
- [手写的短行不会在解析时被补齐] → 只有结构操作才把每行补成矩形；渲染缺位留空。避免打开旧 XML 就改写它。
- [`serializeWidgets` 今天用默认支写 `swiper-item`] → 实现时先补上四个类型分支，否则新节点会存成滑动器页。

## Migration Plan

没有数据迁移。不含 `table` 的既有页面 XML 保持合法。回滚就是撤回这次代码；已保存的表格 XML 在旧版本里会当作未识别节点忽略，不会把整页判非法。

## Open Questions

无。单元格是否容纳子控件、表头是否单独成行、冻结是否包含首列，都已在规格里定死。
