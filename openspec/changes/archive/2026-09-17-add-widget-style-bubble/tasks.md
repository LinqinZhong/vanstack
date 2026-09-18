## 1. 边模式控件

- [x] 1.1 抽出 `StyleBoxEdges`：四种模式 `unified` / `sides` / `horizontal` / `vertical`，边与角按 design 表写入四值；切换模式不改现有值，切控件时四值相等则默认统一否则上下左右。用不同初始值手工切换四种模式，确认可见输入数量与 patch 结果符合表，且未编辑时原值不变
- [x] 1.2 把 `WidgetStyleFields` 的外边距、内边距、圆角、边框宽度换成 `StyleBoxEdges`，边框线型与颜色仍在边框组内。打开检查器确认不再同时出现「统一输入 + 四边网格」，四种模式可改同一套 `WidgetStyle`

## 2. 悬浮协议

- [x] 2.1 在 `lowcode-protocol` 增加 `widget-hover`（`widgetId` 可空 + iframe 矩形），并纳入 `isLowcodeMessage`。用合法/非法 payload 确认类型收窄
- [x] 2.2 `PreviewPage` 编辑态对宿主 `mousemove`/`mouseleave` 节流上报：仅当指针在 `.is-widget-selected` 或其子孙内才带上该节点矩形，禁止用 `closest` 改报子控件。在嵌套 flex 中选中父级后移入子控件，确认上报的仍是父级 id；移出选中节点或切预览后上报 `null`、预览态无消息

## 3. 气泡 overlay

- [x] 3.1 新增 `WidgetStyleBubble`：`text`/`button` 显示颜色、文字阴影、加粗/斜体/下划线/删除线；全部类型显示背景、外边距、内边距、圆角、边框（含线型颜色）；文字工具对 flex/swiper/swiper-item 隐藏。弹出层 `getPopupContainer` 挂到气泡根。在组件内改各字段，确认只 patch 现有 `WidgetStyle` 键
- [x] 3.2 在 `ProjectEditorPage` 的 `.canvas-stage` 叠气泡：选中控件后用 CSS 固定在画布右上角，不随平移缩放或控件矩形移动；去掉右侧控件信息栏，气泡增加设置图标并用 Modal 打开原检查器。验证：点击选中出现在右上角、点设置弹出完整属性、未选中可打开页面属性、平移缩放位置不变、取消选中后样式工具条消失、预览无气泡；改背景后面板与 iframe 同步，撤回一步还原

## 4. 文案与走查

- [x] 4.1 在 `frontend-admin` 的 zh/en 中为四种边模式、气泡分组与文字开关补文案；切换语言后标签正确
- [x] 4.2 走通：登录 → 打开草稿 → 选中文本/按钮/弹性盒分别悬浮编辑文字与盒样式（统一、四向、水平、竖直）→ 检查器与预览一致 → 撤回/重做 → 切预览与已发布无气泡 → 打开 H5 同一页无气泡。确认 XML 无新样式字段、无字号入口
