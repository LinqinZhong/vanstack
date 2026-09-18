## Why

静态「设为默认」无法按循环项或数据池切换状态。作者需要用 `state()` 在运行时返回状态名，并保证循环展开后 hover 只命中当前实例。

## What Changes

- 去掉状态树的「设为默认」、绿色对勾，以及创建后自动选用。
- 气泡工具栏增加状态控制入口；点击后弹窗编辑 `function state(): string { ... }`，可读 `$data`、`$item`、`$index`。
- 宿主 XML `state` 改为存该函数体；旧的 `state="name"` 解析为 `return "name"`。`<__>` 不再写组默认 `state`。
- 预览与 H5 求值函数：命中已有状态名则用该状态，否则回落 `initial`。优先级 MUST 为：其它具名状态 > `hover` > `initial`。
- 循环实例的 hover MUST 按实例 key 命中，不得让同模板的其它项一起进入 `hover`。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `lowcode-runtime`: 选用状态改为 `state()`；状态树去掉默认选用；hover 按循环实例命中且不覆盖其它具名状态。

## Impact

- `@vanstack/xml`：宿主 `state` 往返函数体；解析旧裸名称；运行时求值并匹配状态名。
- `@vanstack/lowcode-runtime`：先展开循环再按实例求值；hover 用实例 key；其它状态优先于 hover。
- `frontend-admin`：去掉设为默认；气泡状态控制弹窗。中英 i18n。
- 非目标：按状态分叉子树、事件里切状态、多选批量改 `state()`。
