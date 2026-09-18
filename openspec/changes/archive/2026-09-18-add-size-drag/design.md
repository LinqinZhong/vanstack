## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`WidgetStyle` 已有 `width` / `height`（`px` 或 `%`，缺省为自适应）。检查器与 `WidgetStyleFields` 可改这两维，气泡操纵栏没有尺寸分组。内外边距与圆角已共用 `spacingDrag`、四边控制条、遮罩、`1`–`7`、小键盘与确认取消。`swiper-item` 的宽高被解析与渲染忽略。浏览器 `Ctrl+T` / `⌘+T` 默认开新标签。

## Goals / Non-Goals

**Goals:**

- 气泡增加尺寸分组；`Mod+T` 打开后在画布四边拖动，写现有像素宽高。
- 复用内外边距的 iframe 指针、遮罩、确认/取消、选边与吸附铬。

**Non-Goals:**

- 不在画布上编辑 `%` 或 `fit-content`；这两种只留在气泡/检查器。
- 不给页面根或 `swiper-item` 做尺寸拖动。
- 不改 XML schema 或公共渲染器的尺寸语义。

## Decisions

### 1. 尺寸走同一套 `spacingDrag` 协议

预览消息 `spacingDrag` 增加 `'size'`。`BoxGroup` / `BoxDragKind` 纳入 `size`。iframe 在该值为尺寸且左键落在边控制条上时上报 `canvas-pointer`，`spacingEdge` 仍为 `top|right|bottom|left`。左右边映射宽度，上下边映射高度。遮罩、取消/确定、Shift/Alt 共用。尺寸选维不复用边距的 `1`–`7`：`1` 宽、`2` 高、`3` 宽高。

备选：单独一套 size 协议。否决原因：跟手、挡板、确认取消都已打通。

### 2. 四边两维，写入像素

内部可用 `BoxQuad`（`left`/`right`→宽，`top`/`bottom`→高），写出时合并为 `width` / `height` 的 `{ mode: 'px', value }`。同一维被两条边同时选中时只加一次。向外为正（上 `-dy`、下 `+dy`、左 `-dx`、右 `+dx`），`min=0`，无越过 0 的负值阻力。

拖动开始时若该维未设置或 `mode !== 'px'`，用选中节点当时的计算像素作起点，再写成 px。气泡面板仍提供 px / % / 自适应，与检查器同一套字段。

备选：画布保留百分比。否决原因：位移是 CSS 像素，百分比没有稳定分母。

### 3. `Alt` 写成正方形，`Shift` 先吸另一维

按住 `Alt` 时宽高写成当前拖动维的值（按下即对齐）。`Shift` 吸附：先另一维当前像素（阈值 10px；`Alt` 时跳过），否则 5 的倍数。

备选：`Alt` 锁宽高比。否决原因：边距的 `Alt` 是对边同值；尺寸只有两维，同值即正方形，实现与心智更直接。

### 4. 快捷键挡住新标签页

`widgetShortcuts` 增加 `size`（`Mod+T`），无 Shift。主窗口与 iframe 捕获阶段 `preventDefault`。可编辑输入不拦截。无选中、只读或 `swiper-item` 时仍挡住浏览器默认行为，但不改分组。已打开再按不关掉。

## Risks / Trade-offs

- [流式布局里拖左边只改宽度、控件左缘可能不动] → 接受：XML 没有单独的 x/y，与 CSS `width` 语义一致。
- [`Ctrl+T` 被系统或浏览器抢走] → 捕获阶段 `preventDefault`；焦点在输入框内不拦截。
- [百分比宽被拖成 px] → 规格写明；气泡仍可改回 `%`。
