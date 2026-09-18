# 画布拖动卡顿

## 问题

中键拖动画布能跟手，但不丝滑。根因不是手势写错，而是每一帧都在拖一块超大 iframe，并且还把整个编辑页重绘一遍。

```
pointermove
    |
    +-- 空白画布：直接 setView
    +-- iframe 内：postMessage → 父窗口 getBoundingClientRect
    |
    v
React 整页 render（树 / 检查器 / 工具条）
    |
    v
改 9375×10005 的 iframe transform
改蓝框 left/top（触发布局）
```

| 问题 | 具体表现 |
| --- | --- |
| 图层太大 | `CANVAS_RASTER_SCALE = 5`，再加溢出区，iframe 约 **9375×10005**。内部还有 `zoom: 5`，再被外层 `scale` 缩小。为了 500% 放大时文字清晰，平时平移也要合成这块巨图层。 |
| 每帧写 React state | `applyView` 每次 `setView`，`ProjectEditorPage` 整页 reconcile。 |
| iframe 路径更卡 | 每次 move 都 `postMessage`，父窗口再 `getBoundingClientRect`，等于在刚改过 transform 的大 iframe 上强制读布局。 |
| 蓝框走布局 | `.phone-page-frame` 用 `left/top`，不能和预览层一起做 compositor 平移。 |
| 没有帧合并 | `pointermove` 一来就更新，一帧里可能打多次。 |

## 方案

改动在 `ProjectEditorPage`、`PreviewPage`、`lowcode-protocol`、`index.css`。行为不变：中键拖、滚轮缩放、松手后位置仍写入视图。

### 1. 平移只改 DOM，松手再进 React

拖动中用 `paintCanvasView` 写 `translate3d`，`schedulePan` 用 `requestAnimationFrame` 合并；`commit = false` 不 `setView`。松手 `finishPan` 才同步 state。

### 2. iframe 用屏幕坐标，并节流消息

协议加 `screenX/screenY`。位移用屏幕差，不再每帧映射 iframe 矩形。预览页把 move 按动画帧发出去。

### 3. 缩小栅格

`CANVAS_RASTER_SCALE`：`5 → 2`。编辑态大约 **3750×4002**，面积降到原来的约 1/6。溢出区没砍，swiper 铺开展开的 item 仍能点到。代价：放大到 500% 时文字会略虚，200% 以内仍是 1:1。

### 4. 蓝框改 transform

`.phone-page-frame` 改为 `translate3d`，和手机层同一条合成路径。平移时加 `will-change: transform`。

## 对照

| 改前 | 改后 |
| --- | --- |
| 每像素 `setView` | rAF + 直接改 transform |
| 整页 React 重绘 | 松手才 `setView` |
| iframe 每帧 `getBoundingClientRect` | `screenX/Y` 算 delta |
| 9375 × 10005 图层 | 3750 × 4002 图层 |
| 蓝框 `left/top` | 蓝框 `translate3d` |

## 未做 / 可再做

- 这次性能改动没有单独建 OpenSpec change。
- CSS `zoom` 还在预览宿主里，只是从 5 降到 2。若仍觉得肉，可改成内部 `transform: scale`，让 iframe 接近可视尺寸。
- 溢出区仍是 `EDIT_OVERFLOW_X = 4`。若 swiper 不需要那么宽，还可以再缩。

## 验证

在画布空白处和预览内容上各中键拖一次，确认两处手感都顺；滚轮缩放与松手后的位置应与改前一致。
