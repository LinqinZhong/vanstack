## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：气泡 `WidgetStyleBubble` 用内部 `openGroup` 切换外边距/内边距等分组，只能点图标。`widgetShortcuts` 已覆盖删除/复制/粘贴/撤回/保存，主窗口与 iframe 共用判定；`Ctrl+P` 目前会落到浏览器打印。iframe 只把中键指针转成 `canvas-pointer` 给主窗口平移。边距写入已有 `compactWidgetStyle` + `updateWidget(..., coalesceKey)`。上次样式气泡把「拖拽改边距」列为非目标。

## Goals / Non-Goals

**Goals:**

- 快捷键与拖动都只编排工作台编辑铬，继续写现有 `WidgetStyle` 的 margin/padding 字段。
- 拖动增量用纯函数计算，便于对主导方向、内边距下限做手工核对。
- 主窗口与 iframe 共用快捷键判定，点选画布后 `Ctrl+P`/`Ctrl+M` 仍有效并挡住打印。

**Non-Goals:**

- 不给圆角、边框或页面内边距做拖动。
- 不改公共渲染器或 XML schema。
- 不把气泡 `openGroup` 持久化到版本。
- 不对齐到其它控件或画布参考线。

## Decisions

### 1. 快捷键并进现有 `matchWidgetShortcut`

新增 `'padding' | 'margin'`。判定与复制等相同：`ctrlKey || metaKey`，无 `Shift`/`Alt`，键为 `p`/`m`。主窗口捕获阶段 `preventDefault`；iframe 识别后转发 `keydown`。可编辑目标不拦截（与删除/复制一致）。无选中或只读时匹配仍 `preventDefault`（避免打印），但不改状态。

`WidgetStyleBubble` 的 `openGroup` 改为受控：父组件持有，快捷键直接 `setOpenGroup('padding'|'margin')`（已打开则保持）。切选中控件时清空。气泡图标仍可切换；快捷键是「立刻选中」，不是开关。

备选：只在气泡内部听键盘。否决原因：焦点常在 iframe，气泡听不到。

### 2. 间距拖动走 iframe 左键指针，主窗口算值

预览消息增加 `spacingDrag: 'padding' | 'margin' | null`。iframe 仅在该值为内外边距且左键落在控制条上时捕获指针并上报 `canvas-pointer`。协议为每条指针带上 `button`（down）、`shiftKey` 与 `altKey`。中键路径不变。点在其他控件或空白处仍走现有 click 选中，不上报间距拖动。

指针跟踪不依赖控制条热区，也不对间距拖动调用 `setPointerCapture`（捕获出不了 iframe，滑出后事件会丢）。按下后 iframe 在 `window` 上听 move/up，并铺一层铺满视口的透明挡板接住页面周围空白；主窗口同样在 `window` 上用 `screenX/screenY` 续跟，滑出 iframe 仍跟手。主窗口用 `screenX/screenY` 差值除以 `view.scale` 得到 CSS 像素，避免 iframe `zoom` 与画布 `scale` 叠乘算错；拖动按 1px 向 0 截断成整数，不足 1px 不进位。按下时记下起始四边；move 时相对起点重算（可回拉），用现有 `edit:${id}:style` 合并撤回。

### 3. 增量规则：一次只改主导方向

抽 `applySpacingDrag({ start, dx, dy, edge, min, snap, mirror })`：

- 首次 `|round(dx)|` 或 `|round(dy)|` 非 0 时锁定边：`|dx| >= |dy|` 则 `dx >= 0` 为右否则左；否则 `dy >= 0` 为下否则上。实际拖动只从控制条开始，按下时已锁定该边。
- 增量：外边距向外为正：上 `-dy`、下 `+dy`、左 `-dx`、右 `+dx`。内边距控制条在内容区上，向内为正（相对外边距四边符号取反）。未按 `Alt` 时其余边保持起点值。
- 按住 `Alt` 时镜像对边：左右成对、上下成对，对边写成与当前边相同的值（按住期间上下/左右 MUST 相等）。可与 `Shift` 同时按。松开或按下 `Alt` 时以当前四边为新起点（指针位置也重定）；按下 `Alt` 的瞬间对边即对齐到当前边。松开后对边保持该值，MUST NOT 跳回按下 `Alt` 前的数；之后未按 `Alt` 则只改正在拖的那一边。
- `min`：内边距 `0`，外边距不设下限。从非负拖进负数时先停在 `0`，指针再越过约 20px 才写出负数（已为负则 1:1 跟手）。气泡输入不套这段阻力。
- 吸附仅在按住 `Shift` 时生效（画布拖动，气泡输入不吸附）：先对边（左右互吸、上下互吸，阈值 10px；镜像时跳过对边吸附，因为对边也在动），再其余两边的值（同阈值），否则落到最近的 5 的倍数（`0, ±5, ±10…`）。内边距仍钳在 `≥0`。按住 `Shift` 时在边距数值旁显示磁铁图标。

备选：无修饰键时四边同步、`Shift` 锁单边。否决原因：作者要求默认一次只能拖一个方向，`Alt` 才成对。

备选：在气泡数字框上拖。否决原因：作者是选中节点后在画布操作。

### 4. 辅助线叠在 iframe 宿主上，不进 React 控件树

`PreviewPage` 在 `spacingDrag` 为内外边距时，读取选中节点的 `getComputedStyle` 四边，把红色虚线框叠到 `.preview-host`（不插入控件 DOM）。内边距框住内容区（边框盒向内缩进四边 padding），外边距框向外扩出四边。辅助层铺满宿主，四边坐标独立计算（`leftX/topY/rightX/bottomY`），不把框的宽高校成非负；对边交错时用 SVG 多边形画出反向框，控制条与数字仍落在各自边上。对边控制条重合时，默认露出的那条保持长条，被挡住的那条收成约 16px 圆钮（热区仍约 28px）叠在长条中央，MUST NOT 缩成一个点；正在拖动被挡的那条时则对调。非零值标在对应虚线旁，边长放不下则隐藏该数字。另叠一层半透明遮罩，按选中控件边框盒挖空（铺满 iframe 宿主）。编辑态宿主为 `screen * (1 + overflow)`，页面用与主窗口 `EDIT_OVERFLOW` / `paintCanvasView` shift 同源的固定边距居中，MUST NOT 用 `window.innerWidth` 现算，以免切换预览/编辑时对不齐；预览态 overflow 为 0，页面贴齐蓝框。工作台画布舞台在隔离态再盖一层，以遮住页面周围的网格。遮罩 `pointer-events: none`，以免挡住点选其他控件。四边控制条可见部分约 8px，热区约 28 视觉像素（透明命中层包着细条），悬停高亮用 CSS `:hover`，避免指针从细条漏到控件导致白线闪烁。另在选中控件右下角叠取消/确定按钮；`Esc` 取消（恢复进入分组前的 padding/margin 并关掉分组），`Enter` 确定（保留当前值并关掉）。按钮 `pointer-events: auto`。拖动或改 XML 后随 `preview` 消息重绘。预览模式 `spacingDrag` 为空，不画。

备选：色块作为控件子节点。否决原因：flex/button 子树由 React 管理，插入会乱布局或被下一帧清掉。

## Risks / Trade-offs

- [`Ctrl+P` 仍弹出打印] → 主窗口与 iframe 都在捕获阶段匹配并 `preventDefault`。
- [拖动时 XML 重绘导致丢指针] → 间距拖动不捕获指针到节点；iframe 与主窗口都按 pointerId 在 `window` 上续跟。
- [指针滑出控制条或 iframe 后卡住] → 拖动期间 iframe 铺满透明挡板接收空白区事件；主窗口用 `screenX/screenY` 在 iframe 外续跟。
- [点选子控件被当成父级边距拖] → 仅当按下目标在当前选中节点内才拖；按下其他 `data-widget-id` 仍选中该控件。
- [Mac `⌘+M` 可能被系统最小化] → 与其它工作台快捷键一样用 `metaKey`；文档与 tooltip 写 `Ctrl`/`⌘`；若系统先吃掉则仍可用气泡图标。

## Migration Plan

无需数据迁移。无该快捷键的旧工作台行为保持：点图标仍可打开分组。
