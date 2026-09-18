## 1. XML 与渲染

- [x] 1.1 在 `WidgetStyle` 增加 `rotateX` / `rotateY` / `rotateZ`（`AngleValue`），导出 `ANGLE_UNITS` 与角度换算。`compactWidgetStyle` 丢掉非有限值与 `0`；`sanitizeWidgetStyle('swiper-item')` **不**剥离旋转。用带 `45deg` / 无单位 / `1.570796rad` / `0.5turn` / 非法值 / 三轴为 `0` 的示例 XML 跑通解析→序列化→再解析
- [x] 1.2 `parseStyle` / `styleAttrs` 读写 `rotate-x` / `rotate-y` / `rotate-z`；缺省不落盘。确认无这些属性的旧 XML 仍只得到原有样式
- [x] 1.3 `widgetCss` 按 X→Y→Z 写出非空轴的 `rotateX()` / `rotateY()` / `rotateZ()`。工作台 `.preview-mount` 与 H5 页面根加 `perspective: 800px`。用只转 Z、只转 X、三轴组合、以及滑动器/item 带旋转的 XML 确认管理后台预览与 H5 符合 spec，且滑动器轨道位移仍在

## 2. 快捷键与增量

- [x] 2.1 `widgetShortcuts` 增加 `rotate`（`Mod+Shift+R`），`Mod+R` 仍为圆角；纳入 `isBoxGroupShortcut`。确认 `Ctrl+Shift+R` 不强制刷新；无选中或只读时不改分组；已打开再按不关掉
- [x] 2.2 新增 `rotateDrag.ts`：选轴 `1=Z` / `2=X` / `3=Y`（仅主键盘）；Z 用相对中心的角位移，X 用竖直位移（上为正），Y 用水平位移（右为正）；`deg`/`grad` 步进 `1`，`rad`/`turn` 步进 `0.01`；`Shift` 吸到 `15deg` 等价角。用若干指针位移与单位组合确认结果符合 spec

## 3. 气泡、检查器与画布

- [x] 3.1 气泡增加旋转分组：X/Y/Z 三行数值+单位（默认 `deg`），切换单位换算该轴；全部控件类型（含 `swiper-item`）显示入口。tooltip 带 `Ctrl+Shift+R` / `⌘+Shift+R`。中英 i18n 与帮助文案补旋转快捷键及 `1 / 2 / 3`
- [x] 3.2 检查器增加三轴旋转项，与气泡写同一套字段；切换单位保持实际角度
- [x] 3.3 协议 `spacingDrag` 增加 `'rotate'`。旋转分组打开时叠三轴操纵环、遮罩、取消/确定；拖环改对应轴，遮罩上拖改 Z，按住 `1`–`3` 时拖动与上下键只改该轴；小键盘可输入小数。打开时快照三轴，取消一并恢复。`LIVE_STYLE_KEYS` 含 `transform`。验证：`Ctrl+Shift+R` 打开、拖 Z 环、按住 `2` 上键改 X、气泡输入 `90deg`、改单位为 `turn`、`swiper-item` 可转、预览/只读无效、`Tab` 切兄弟保持分组
