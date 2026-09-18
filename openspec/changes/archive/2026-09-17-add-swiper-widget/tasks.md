## 1. XML 控件树

- [x] 1.1 在 `packages/xml` 按 `design.md` 扩展 `PageWidget`（`swiper` / `swiper-item`）、`SwiperStyle` 及相关枚举常量，并导出类型与 `compactSwiper`；构建后确认 `@vanstack/xml` 导出包含这些新符号
- [x] 1.2 把 `parsePageXml` / `serializePageXml` 改为按父级过滤递归：`swiper` 只收 `swiper-item`，页面根/`flex`/`swiper-item` 可收 `text`/`button`/`flex`/`swiper`；错位的 `swiper-item` 与 `swiper` 下的非 item 子节点被忽略；缺省属性不落盘；布尔真值写 `true`；非法枚举/非正 `interval` 被忽略且整页仍合法。用含两个 item（内嵌 text/button/flex）及全量滑动器属性的示例 XML，以及一份旧的 `text`/`button`/`flex` XML，各跑通解析再序列化再解析

## 2. 公共渲染器

- [x] 2.1 在 `@vanstack/lowcode-runtime` 把 `swiper` 渲染为 `SwiperView`（`div.lowcode-swiper` + 轨道 + `div.lowcode-swiper-item`），空滑动器与空 item 仍输出节点；`renderPageXml` 增加可选 `{ editing?: boolean }`，缺省 `false`。用含三个 item、`current=1` 的 XML 在 `editing: false` 下调用，确认 DOM 中滑动器包住三个 item 且当前屏对应第二个
- [x] 2.2 实现非编辑态轮播：`autoplay`/`interval`/`duration`/`circular`/`vertical`/`display-multiple-items`/`previous-margin`/`next-margin`/`indicator-dots` 及指示点颜色、`easing-function`；手势与自动播放不回写 XML。用 `autoplay`+`indicator-dots` 的 XML 在 `editing: false` 下确认指示点出现且轨道会切换
- [x] 2.3 实现编辑态：`editing: true` 时全部 item 沿主轴均分可见、无位移、无自动播放、无手势。用三个空 item 的水平滑动器确认三个 item 同时出现在轨道中；将 `vertical` 设为真后再渲染，确认改为纵向堆叠

## 3. 工作台编辑

- [x] 3.1 扩展 `widgetTree.ts`：凡带 `children` 的节点都可递归查找/更新/克隆；`canContain` 按 design 表格限制子类型；`addWidgetToTree` / `insertWidget` 实现选中 swiper/swiper-item/flex 的插入规则，且 `swiper-item` 不能落到页面根或 flex。用内存树断言：选中 swiper 加 item 追加到末尾；选中 item 加文本进入该 item；选中 item 再加 item 成为下一个兄弟
- [x] 3.2 在 `ProjectEditorPage` 添加入口增加滑动器与滑动器页；新增 `swiper` 预填 3 个空 item。在编辑页确认：添加滑动器后控件树出现 1 个滑动器 + 3 个 item；选中滑动器再加 item 变为 4 页；选中某一 item 再加文本出现在该页下
- [x] 3.3 扩展属性面板：选中 `swiper` 展示全部滑动器字段 + 盒样式（隐藏字体类）；选中 `swiper-item` 只展示盒样式；`swiper` 位于 flex 内时仍展示弹性项目字段。改 `autoplay`/`vertical`/`indicator-dots` 后 iframe 即时更新，且草稿 XML 中能看到对应属性
- [x] 3.4 更新 `PreviewPage`：xml 或 mode 变化时都调用 `renderPageXml(..., { editing: mode !== 'preview' })`。确认从编辑切到预览后不再并排展开全部 item，再切回编辑后 3 个 item 再次同时可见且不自动播放
- [x] 3.5 在 `frontend-admin` 与 `frontend-app` 的 zh/en 文案中加入滑动器、滑动器页、添加动作与全部滑动器属性标签；界面切换中英文时标签正确

## 4. 宿主样式与验收

- [x] 4.1 在 admin 编辑态 CSS 为 `.lowcode-swiper-item` 提供红色实线描边与空页最小高度（线宽与像素按画布微调）；H5 不画该描边。确认编辑态三个空 item 并排可见带描边，预览模式与 H5 无该描边
- [x] 4.2 走通：登录 → 打开工程页面 → 添加滑动器（见 3 个描边页框）→ 向 item 添加文本/按钮/弹性盒 → 配置全部滑动器属性 → 切预览见当前屏轮播与指示点 → 保存版本再重新加载属性一致 → 同一 XML 在 H5 嵌套结构与轮播属性一致且无编辑描边；根级不能添加或粘贴 `swiper-item`
