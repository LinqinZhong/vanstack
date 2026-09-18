## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`swiper-item` 走通用盒样式，检查器可改宽高；运行时页体默认 `width/height: fit-content`，再叠 `item.style`。编辑态槽位是 `flex: 0 0 auto`，滑动器只有 `minHeight: 150`，百分比高度无法撑满。

## Goals / Non-Goals

**Goals:**

- 滑动器页铺满滑动器，检查器不再提供宽高。
- 解析/序列化丢掉 `swiper-item` 的 `width` / `height`，其它盒样式保留。
- 未设高度的滑动器使用确定高度 150px，让子页百分比高度生效。

**Non-Goals:**

- 不改滑动器自身的宽高编辑。
- 不隐藏 item 的外边距、内边距、背景等其它盒样式。
- 不改轮播属性、插入规则或编辑态「全部展开」的语义。

## Decisions

### 1. 页铺满槽，槽铺满滑动器

编辑态每个槽 `flex: 0 0 100%`，预览态 `flex: 0 0 ${100 / perView}%`；页体强制 `width/height: 100%`，覆盖 XML 里可能残留的尺寸。滑动器改为纵向 flex，未设高度时用 `height: 150` 而不是 `minHeight: 150`。

备选：继续让页随内容收缩。否决原因：无法表达「一屏」。

### 2. 检查器隐藏宽高，XML 丢弃尺寸

`WidgetStyleFields` 在 `widgetType === 'swiper-item'` 时不渲染宽高，patch 时删掉这两项。`parse` / `serialize` 对 `swiper-item` 调用 `withoutWidgetSize`。其它盒样式仍可编辑。

### 3. 既有宽高只忽略，不视为非法

带 `width` / `height` 的旧 item XML 仍合法，打开后不进入 AST，保存后不再写出。

## Risks / Trade-offs

- 未设高度的滑动器从「可被内容撑高」变为固定 150px；需要更高时改滑动器高度。这是撑满的前提。
- 编辑态多页并排时每页都是滑动器全尺寸，画布会向右溢出；仍可用缩放/平移查看。
