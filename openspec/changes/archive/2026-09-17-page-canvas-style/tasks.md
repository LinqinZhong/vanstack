## 1. XML 页面样式

- [x] 1.1 在 `packages/xml` 增加 `PageStyle`，扩展 `PageXmlDocument` 为可选 `style`，并从包入口导出；构建后确认导出包含新类型
- [x] 1.2 让 `parsePageXml` / `serializePageXml` 读写 `page` 根的 `background` 与 padding 边（缩写与四边拆分、相等合并、缺省不落盘、非法值忽略）；无属性的旧 XML 仍只得到 `widgets`。用带背景与不等边距的示例 XML 跑通解析→序列化→再解析，并确认 `EMPTY_PAGE_XML` 仍无页面属性

## 2. 公共渲染器

- [x] 2.1 在 `@vanstack/lowcode-runtime` 把页面 `style` 应用到 `.lowcode-page`（`box-sizing: border-box`，缺省不写背景/内边距）。用无页面属性的 XML 渲染后根节点无 padding/背景；用带 `background` 与 `padding` 的 XML 渲染后对应 CSS 存在

## 3. 画布铬与预览宿主

- [x] 3.1 去掉 `.preview-host` 的 12px 内边距与白底，将预览页 `html`/`body`、`.preview-frame` 设为透明，并让 `.preview-mount` / `.lowcode-page` 铺满屏幕尺寸。打开无页面样式的草稿，确认控件可贴齐页面边缘且框内不是白底
- [x] 3.2 将 `.phone-screen` 改为透明、去掉投影，用浅蓝 `outline`（如 `#91c9f7`）勾出屏幕边界；编辑与预览模式都可见。确认网格上能看到浅蓝实线框，H5 页面没有该框

## 4. 工作台检查器与历史

- [x] 4.1 在 `ProjectEditorPage` 增加 `pageStyle` 状态，序列化/加载 XML 时往返页面样式；历史条目带上 `pageStyle`，页面字段编辑使用 coalesce key。修改内边距后撤回，页面与预览回到修改前
- [x] 4.2 未选中控件时右侧面板展示页面背景（可清除）与内边距，只读规则与控件检查器相同；选中控件后仍只显示控件属性。确认：点 iframe 空白处出现页面属性；点控件后切回控件信息；只读版本无法改页面样式
- [x] 4.3 在 admin 的 zh/en 文案中加入页面检查器标题等需要的标签；切换语言后面板文案正确

## 5. 验收

- [x] 5.1 走通：登录 → 打开工程页面 → 画布为浅蓝框且无默认白底/内边距 → 取消选中后设置背景与四边内边距 → iframe 即时更新 → 保存版本再加载属性一致 → 同一 XML 在 H5 中背景与内边距一致且无编辑铬
