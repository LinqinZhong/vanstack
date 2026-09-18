## Why

滑动器页目前可以单独设宽高，编辑态默认还是 `fit-content`，选中后会出现 1px / 1% 这类无意义尺寸，页面缩成一小块，无法表达「这一页就是滑动器的一屏」。

## What Changes

- 滑动器页始终撑满所属滑动器，不再由工作台设置宽高。
- 选中 `swiper-item` 时属性面板隐藏宽度与高度；页上已有的 `width` / `height` 解析时丢弃，序列化时不写出。
- 非编辑态每个 item 占满当前屏对应滑动槽（`display-multiple-items` 大于 1 时按槽均分）；编辑态每个可见 item 与滑动器同宽同高。
- 滑动器本身仍可设尺寸；未设高度时默认 150px，作为页的撑满基准。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: `swiper-item` 撑满滑动器；检查器不展示 item 宽高；解析/序列化忽略 item 的 `width` / `height`。

## Impact

- `@vanstack/xml`：解析与序列化 `swiper-item` 时去掉宽高。
- `@vanstack/lowcode-runtime`：item 槽与页体铺满滑动器；默认高度 150px。
- `frontend-admin`：选中滑动器页时隐藏宽度/高度输入。
- `frontend-app`：随公共渲染撑满，无新 UI。
- 已有带 item 宽高的 XML 仍合法，打开后忽略这些属性。
