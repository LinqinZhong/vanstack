## 1. XML 控件树

- [x] 1.1 在 `packages/xml` 按 `design.md` 扩展 `PageWidget`、`FlexContainerStyle`、`FlexItemStyle`，并导出这些类型；构建后确认 `packages/xml` 的导出包含新类型
- [x] 1.2 把 `parsePageXml` / `serializePageXml` 改为递归处理 `flex` 子树：嵌套 `text`/`button`/`flex` 可往返；相等的 `rowGap`/`columnGap` 序列化为 `gap`，不相等则分别写出；缺省属性不落盘；非法枚举/数字被忽略且整页仍合法；未知子元素被忽略。用一段嵌套示例 XML 与一份旧的扁平 `text`/`button` XML 各跑通解析再序列化再解析

## 2. 公共渲染器

- [x] 2.1 在 `@vanstack/lowcode-runtime` 递归渲染 `flex` 为 `div.lowcode-flex`（默认 `display: flex`），子控件按声明顺序成为弹性项目，并映射容器 CSS 与项目 CSS；空弹性盒仍输出该节点。用含「左」文本与「右」按钮、`flex-direction=row` 的 XML 调用 `renderPageXml`，确认 DOM 中弹性容器包住二者且顺序正确

## 3. 工作台编辑

- [x] 3.1 在 `ProjectEditorPage` 增加树查找/不可变更新 helper，把添加、选中、改属性改为走控件树；选中 `flex` 时新控件追加到其 `children`，否则追加到页面根。在编辑页确认：添加弹性盒出现在树中；选中后再加文本成为其子节点；未选中弹性盒时新按钮仍在根级
- [x] 3.2 将控件列表改为 Ant Design `Tree` 展示嵌套层级，空弹性盒仍为可选节点；点击树节点与预览选中同步。确认控件树缩进反映嵌套，且点击 iframe 内子控件仍能选中最内层
- [x] 3.3 扩展属性面板：为 `flex` 提供全部容器属性（含 `gap` 同时写两侧间距），父级为 `flex` 时展示全部项目属性，根级控件不展示也不写入项目属性；`flex` 保留盒样式、隐藏字体类字段。改 `display`/`flex-direction`/`justify-content`/`align-items`/`gap` 以及子项 `flex-grow` 后，iframe 即时按新布局渲染，且 XML 中能看到对应属性
- [x] 3.4 在 `frontend-admin` 与 `frontend-app` 的 zh/en 文案中加入弹性盒类型、添加按钮与全部 Flexbox 属性标签；界面切换中英文时标签正确

## 4. 宿主样式与验收

- [x] 4.1 在 admin 与 H5 样式中复位 `.lowcode-flex` 直接子级文本/按钮的横向 margin；编辑态为空弹性盒提供可见最小高度（具体像素按画布观感）。确认弹性盒内项目不再被旧间距撑开，且根级文本/按钮外观不变
- [x] 4.2 走通：登录 → 打开工程页面 → 添加弹性盒并配置全部容器属性 → 向其中添加文本、按钮与嵌套弹性盒并配置项目属性 → iframe 布局正确 → 保存版本再重新加载属性一致 → 同一 XML 在 H5 独立宿主嵌套结构与弹性布局一致；根级控件检查器无项目属性
