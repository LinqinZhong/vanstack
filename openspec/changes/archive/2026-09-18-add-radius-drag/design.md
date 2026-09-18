## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：气泡圆角分组已能用 `StyleBoxEdges` 写四角；内外边距拖动已有控制条、遮罩、吸附、镜像与确认取消。`add-spacing-drag` 把圆角拖动列为非目标。圆角四角映射到现有 `BoxQuad`：`top`→左上、`right`→右上、`bottom`→右下、`left`→左下。

## Goals / Non-Goals

**Goals:**

- 圆角分组打开后，在画布四角拖动写现有 `WidgetStyle` 圆角字段。
- 复用内外边距的 iframe 指针、遮罩、确认/取消与 Shift 吸附铬。

**Non-Goals:**

- 不给边框宽度或页面圆角做拖动。
- 不改公共渲染器或 XML schema。

## Decisions

### 1. 圆角走同一套 `spacingDrag` 协议

预览消息 `spacingDrag` 增加 `'radius'`。iframe 在该值为圆角且左键落在角控制条上时上报 `canvas-pointer`，`spacingEdge` 仍用 `top|right|bottom|left` 对应四角。遮罩、取消/确定、Shift/Alt 修饰键与内外边距共用。

备选：单独一套 radius 协议。否决原因：指针跟手、挡板、确认取消都已打通，分协议只会重复。

### 2. 增量：沿角平分线向内为正

`applyRadiusDrag`：位移投影到该角向内 45°（左上 `+x+y`，右上 `-x+y`，右下 `-x-y`，左下 `+x-y`），再除以 `√2` 后向 0 截成整数。圆角 `min=0`，无越过 0 的负值阻力。未按 `Alt` 时只改按住的那一角。

按住 `Alt` 时四角写成与当前角相同的值（与气泡「总」一致），按下 `Alt` 或按住 `Alt` 抓住控制条时立刻对齐全部角。松开或按下 `Alt` 时以当前四角为新起点。按住 `Shift` 时吸附：先其它三角的值（阈值 10px；镜像时跳过角吸附），否则 5 的倍数。

备选：`Alt` 只镜像对角。否决原因：作者画的是四角独立条，镜像更常用于四角同值。

### 3. 控制条叠在边框盒四角

辅助层不画内外边距那种矩形虚线框。四角各一条红色切线条（沿圆角切线，相对原先角平分线旋转 90°），热区大于可见条，悬停显示沿同一方向的白色虚线。非零值标在角外侧。遮罩仍按选中控件边框盒挖空。

### 4. 快捷键与内外边距同一套判定

`widgetShortcuts` 增加 `radius`（`Mod+R`，无 Shift）与 `border`（`Mod+Shift+B`）。主窗口与 iframe 捕获阶段 `preventDefault`，以免刷新或切换书签栏。可编辑输入不拦截。无选中或只读时仍挡住浏览器默认行为，但不改分组。圆角快捷键打开分组并进入与点图标相同的画布拖动会话；边框只打开气泡分组，不画控制条。已打开时再按 MUST NOT 关掉。

## Risks / Trade-offs

- [圆角很大时几何角落在填充外] → 手柄仍锚在边框盒角，与 CSS `border-radius` 参考盒一致。
- [指针滑出 iframe] → 沿用内外边距的 window 续跟与透明挡板。
