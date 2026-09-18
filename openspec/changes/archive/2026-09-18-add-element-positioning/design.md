## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`WidgetStyle` 只有盒模型与文字样式，没有 `position` / `top` / `right` / `bottom` / `left`。`widgetCss` 不写定位。检查器与气泡能改 margin/padding/size，画布拖动走 `spacingDrag`（`padding` | `margin` | `radius` | `size`），选边键对边距是 `1`–`7`。`sanitizeWidgetStyle('swiper-item')` 已剥离宽高、外边距、边框与圆角。浏览器 `Ctrl+L` / `⌘+L` 默认聚焦地址栏。

## Goals / Non-Goals

**Goals:**

- 把定位方式与四边偏移做成与 margin 同构的 `WidgetStyle` 字段，解析/渲染/检查器/气泡共用。
- 定位分组复用现有 `spacingDrag` 铬：四边控制条、遮罩、确认取消、`Alt` 镜像、`Shift` 吸附、`1`–`7` 与小键盘。

**Non-Goals:**

- 不引入 `z-index`、`inset-block` 等逻辑属性。
- 不给页面根或 `swiper-item` 做定位。
- 不把 `fixed` 改写成相对 `.lowcode-page` 的 `absolute`（编辑态用屏幕盒作为 `fixed` 包含块，仍输出 `position:fixed`）。

## Decisions

### 1. 字段落在 `WidgetStyle`，XML 用 CSS 属性名

```ts
position?: 'relative' | 'absolute' | 'fixed' | 'sticky';
top?: number;
right?: number;
bottom?: number;
left?: number;
```

`static` 不占类型：缺省即静态，`compactWidgetStyle` 丢掉 `'static'` 以及静态上的四边。导出 `POSITION_MODES`（含 `static`，供检查器/气泡选项）。解析用 `parseEnum`；非法值视为未设置。偏移为 `BoxLength`（`px` / `%`）；`auto` 不作为定位单位，缺省即 CSS `auto`。四边相等时序列化为 `inset`，否则写 `top` / `right` / `bottom` / `left`；也接受 `inset` 缩写读入。`STYLE_KEYS` 纳入这些字段。`sanitizeWidgetStyle('swiper-item')` 删除 `position`、`zIndex` 与四边。非静态时可写整数 `z-index`（中文「层级」），静态时丢掉。

备选：独立 `WidgetPosition` 类型。否决原因：检查器、气泡、撤回键 `edit:${id}:style` 都按一整份 `WidgetStyle` 合并。

### 2. 渲染直接写 CSS，静态不输出偏移

`widgetCss`：有非静态 `position` 时写 `css.position`；仅在此时把已设置的边写成对应 CSS。`compactWidgetStyle` 在静态（含缺省）时丢掉四边。静态 MUST NOT 写 `top` 等。页面根始终 `position: relative`，作为未再套定位祖先的子控件的绝对定位包含块，宽度即页面宽度。编辑态 MUST NOT 让 `.preview-host` 溢出区（远宽于 375）成为这些控件的包含块。公共渲染器仍写 `position:fixed`，MUST NOT 改成相对页面盒的 `absolute`。工作台 iframe 给 `.preview-mount`（375×667 屏幕盒）加 `transform`，使其成为 `fixed` 的包含块，这样编辑态相对手机屏而不是溢出画布或 iframe 视口；H5 没有这层包装，仍相对浏览器视口。原点辅助线与未设置边的测量对 `fixed` 也用这块屏幕。

备选：编辑态把 `fixed` 变成相对手机框的 `absolute`。否决原因：会让滚动/溢出时贴边语义变成跟着页面走，且管理后台与 H5 对同一 XML 的 `position` 值不一致。

### 3. 画布拖动按外边距增量，未设置边从计算值起步

`BoxGroup` / `BoxDragKind` 增加 `'position'`。预览消息 `spacingDrag` 为 `'position'` 时画边框盒四边控制条（与 size 相同锚点，不画 margin 那种外扩虚线）。增量复用外边距公式：向外为正、可负、过 0 有约 `20px` 阻力、`Alt` 对边同值、`Shift` 先对边再邻边再 5 的倍数。选边表与 margin 相同（`1`–`4` 单边，`5`–`7` 组合），不走 size 的 `1`–`3`。

拖动开始时若该边未设置：用选中节点相对包含块的计算像素作起点（`absolute`/`relative` 相对 `offsetParent` 或页面根，`fixed` 相对 375×667 屏幕盒，`sticky` 相对其滚动包含块），再写入该边。不要从 `0` 起，以免绝对定位控件瞬间跳到包含块原点。连续拖动仍合并 `edit:${id}:style`。打开分组时快照 `position` 与四边，取消一并恢复。定位为静态时不叠控制条，拖动与选边 MUST NOT 写入偏移。定位非静态时画对齐辅助线：相对用未偏移前的静态位置盒，绝对/固定/吸附用包含块（固定为屏幕盒）；按布局真正生效的边画上/下/左/右，某一方向没有生效边则该方向两条都画；左右（或上下）都写了值但控件没被撑开（相对则对边直接被覆盖）时，被覆盖的那条不画；线铺满可见编辑区。

备选：拖动手势改成「跟控件位移」（上拖减小 `top`）。否决原因：与「和边距一样」冲突，也无法直接复用现有位移公式。

### 4. 快捷键 `Mod+L`，无选中也挡住地址栏

`widgetShortcuts` 增加 `position`（`key === 'l'`，无 Shift），纳入 `isBoxGroupShortcut`。主窗口与 iframe 捕获阶段 `preventDefault`。可编辑输入不拦截。无选中、只读或 `swiper-item` 时仍挡住浏览器默认行为，但不改分组。已打开再按不关掉。气泡面板：定位方式 `Select`；仅非静态时用 `StyleBoxEdges` 编四边。检查器增加 `position`，四边项仅非静态出现；对 `swiper-item` 与宽高一样隐藏。中英 i18n 补标签与帮助里的 `Ctrl+L`。

## Risks / Trade-offs

- [编辑态 iframe 有页面周围 overflow，原生 `fixed` 会相对画布/相机] → 用 `.preview-mount` 的 `transform` 把包含块收到 375×667 屏幕；不改写 `position` 值。
- [静态时无法微调偏移] → 接受：静态没有 CSS 位移；切到非静态后再出现四边入口。
- [绝对定位且同时写宽和对边会拉伸] → 交给 CSS 常规约束；本期不自动清对边或宽高。
- [`Ctrl+L` 被浏览器抢走] → 捕获阶段 `preventDefault`；焦点在输入框内不拦截。
- [无滚动容器时 `sticky` 看起来像 `relative`] → CSS 常态，不额外造滚动盒。

## Migration Plan

无数据库或 API 迁移。无 `position` / 偏移的旧 XML 继续可解析，视觉保持静态。带非法 `position` 的属性丢弃该字段，不使整页失败。`swiper-item` 上若已手写这些属性，解析后剥离且不再写出。
