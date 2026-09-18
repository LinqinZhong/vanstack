## Why

工作台已有文本、按钮与弹性盒，但缺少轮播容器，无法编排多屏广告/引导内容。需要新增滑动器控件，并在编辑态把每一页都摊开显示，避免真实轮播把未激活 item 藏起来导致无法点选与排版。

## What Changes

- 页面 XML 新增容器控件 `swiper` 与子控件 `swiper-item`；`swiper` 只接受 `swiper-item`，每个 item 可嵌套已有控件（`text`、`button`、`flex` 以及嵌套 `swiper`）。未知元素仍被忽略。
- `swiper` 可配置并持久化完整滑动器属性（指示点、自动播放、循环、方向、切换时长、边距、同时显示数量等）；缺省不写入 XML，由运行时使用约定默认值。
- 工作台可添加滑动器（默认带 3 个空 item，与编辑态示意一致），选中 `swiper` 时添加 item，选中 `swiper-item` 时向该页加入子控件；控件树按嵌套展示。
- 编辑模式下，滑动器内每个 item 同时可见（水平并排或垂直堆叠，随 `vertical`），空 item 也有可见占位，便于选中与往里加控件；预览模式与 H5 才按真实轮播只展示当前屏。
- 公共渲染器渲染 `swiper` / `swiper-item`；管理后台 iframe 预览与 H5 对同一份 XML 的结构一致，仅编辑铬（item 描边、全部展开）留在工作台编辑态。
- 已有仅含 `text` / `button` / `flex` 的页面 XML 仍合法。`PageWidget` 联合类型扩展后，穷尽匹配控件类型的调用方必须处理 `swiper` 与 `swiper-item`。

## Capabilities

### New Capabilities

- 无。滑动器是现有页面控件契约的扩展，不单独成能力。

### Modified Capabilities

- `lowcode-runtime`: 页面 XML 识别并渲染 `swiper` / `swiper-item`；工作台支持添加、嵌套与配置全部滑动器属性；编辑态展开全部 item，预览与 H5 按轮播行为渲染。

## Impact

- `@vanstack/xml`：`PageWidget` 增加 `swiper` 与 `swiper-item` 及子树；解析/序列化滑动器属性。
- `@vanstack/lowcode-runtime`：递归渲染滑动器；编辑态展开全部 item，非编辑态实现轮播交互（指示点、自动播放、手势等）。
- `frontend-admin`：控件树、添加入口、属性面板、预览选中；容器判定从「仅 flex」扩展为 flex / swiper / swiper-item；编辑态 CSS 为 item 提供可见描边与占位。
- `frontend-app`：随公共渲染获得轮播行为；不出现编辑铬。
- 后端页面/版本 API 与 OSS 存储不变；`parsePageXml` 会接受含 `swiper` 的合法 XML。
- 中英 i18n 文案需覆盖滑动器/item 类型、添加动作与全部滑动器属性标签。
