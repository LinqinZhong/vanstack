## ADDED Requirements

### Requirement: Swiper item fills swiper
滑动器页 `swiper-item` SHALL 始终撑满所属滑动器的展示区域，MUST NOT 由工作台单独设置宽高。选中 `swiper-item` 时，属性面板 MUST NOT 展示宽度与高度。渲染时 item 上的 `width` / `height` MUST 被忽略。非编辑态下，每个 item MUST 占满当前屏对应的滑动槽（`display-multiple-items` 大于 1 时按槽均分）；编辑态下每个可见 item MUST 与滑动器同宽同高。

#### Scenario: Inspector hides item size
- **WHEN** 已登录管理员选中一个 `swiper-item`
- **THEN** 右侧属性面板不展示宽度与高度输入

#### Scenario: Preview item fills the swiper
- **WHEN** 工作台处于预览模式或 H5 渲染一个带有 `swiper-item` 的滑动器
- **THEN** 该 item 铺满滑动器当前屏的展示区域，不按其 XML 中可能存在的宽高收缩

#### Scenario: Edit mode item fills the swiper
- **WHEN** 已登录管理员处于编辑模式并查看一个水平滑动器的多个 `swiper-item`
- **THEN** 每个可见 item 都与滑动器同宽同高，并排展开但不需要单独设置尺寸

## MODIFIED Requirements

### Requirement: Swiper item widget in page xml
页面 XML SHALL 识别 `swiper-item` 为滑动器页。`swiper-item` MUST 仅作为 `swiper` 的直接子元素被识别；出现在页面根或 `flex` 下的 `swiper-item` MUST 被忽略。每个被识别的 `swiper-item` MUST 具有 `id`，MUST 允许子元素为 `text`、`button`、`flex` 或 `swiper`。空 `swiper-item` MUST 仍合法。item 内未识别的元素 MUST 被忽略且 MUST NOT 阻止其余已识别控件渲染。

#### Scenario: Item with nested widgets is accepted
- **WHEN** 系统解析一份 `swiper` 内含一个 `swiper-item`，且该 item 内依次含有 `text`、`button` 与 `flex` 的合法 XML
- **THEN** 解析结果包含该 item 及其子控件树，且各控件 `id` 与文案与 XML 一致

#### Scenario: Empty item is accepted
- **WHEN** 系统解析包含一个没有子元素的 `swiper-item` 的合法 `swiper`
- **THEN** 解析结果包含该 item，且其没有可渲染子控件

#### Scenario: Root swiper-item is ignored
- **WHEN** 页面 XML 在 `page` 根下直接包含一个 `swiper-item`
- **THEN** 系统不把该元素当作可渲染控件，且其余已识别控件仍成功解析

#### Scenario: Item width and height are ignored
- **WHEN** 页面 XML 中某个 `swiper-item` 带有 `width` 或 `height`
- **THEN** 解析结果不包含该 item 的宽高，序列化后的 XML 也不再写出这两项属性
