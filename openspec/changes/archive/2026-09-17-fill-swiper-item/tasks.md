## 1. XML 忽略页尺寸

- [x] 1.1 解析/序列化 `swiper-item` 时去掉 `width` / `height`，保留其它盒样式。用带 `width="1px" height="1%"` 与 `background` 的 item XML 跑通解析再序列化，确认宽高消失、背景仍在

## 2. 渲染撑满

- [x] 2.1 滑动器未设高度时默认 `height: 150`；编辑态每个 item 与滑动器同宽同高并排展开；预览/H5 按当前槽铺满。确认强制 `100%` 覆盖 item 上残留的宽高

## 3. 检查器

- [x] 3.1 选中 `swiper-item` 时隐藏宽度与高度；改其它盒样式时不会把宽高写回 XML
