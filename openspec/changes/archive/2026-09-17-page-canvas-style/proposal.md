## Why

工作台画布上的页面目前被 CSS 强制成白底加 12px 内边距，控件无法贴齐页面边缘，网格上的页面边界也不清晰。需要把页面默认外观改成无边距、透明底加浅蓝实线框，并让未选中控件时能直接编辑页面的背景与内边距。

## What Changes

- 去掉预览宿主给页面强制加上的默认内边距与白色填充；未配置时页面贴齐画布屏幕边缘、背景透明。
- 工程编辑页画布上的页面轮廓改为浅蓝色实线框（编辑铬，不写入 XML、不出现在 H5）。
- 页面 XML 的 `page` 根增加可缺省的 `background` 与 `padding`（含四边拆分），管理后台 iframe 预览与 H5 运行时按这些属性渲染。
- 未选中任何控件时，右侧原「控件信息」位置展示页面属性：背景、内边距；选中控件后仍展示该控件属性。
- 页面属性编辑走现有草稿 XML 与撤回/重做；缺省不序列化，既有无页面属性的 XML 仍合法。
- 不改页面/版本 API、OSS 键或预览 postMessage 协议；H5 应用自身的顶栏/外壳留白不在本期范围。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 页面根可配置背景与内边距；工作台画布去掉强制白底与默认内边距，改为浅蓝实线框；未选中控件时检查器展示页面属性。

## Impact

- **共享包**：`packages/xml` 的 `PageXmlDocument` 增加页面样式；`packages/lowcode-runtime` 把背景与内边距应用到 `.lowcode-page`。
- **前端**：`apps/frontend-admin` 预览宿主与画布屏幕样式、检查器空选中态、草稿序列化与历史；`apps/frontend-app` 仅随公共渲染获得页面样式，不改 H5 外壳。
- **后端 / API**：无。页面样式只存在版本 XML 中。
- **兼容**：无 `background`/`padding` 的既有页面 XML 仍可解析；视觉上不再有默认 12px 内边距与白底。
