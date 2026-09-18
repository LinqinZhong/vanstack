## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：`PageWidget` 没有循环字段；`parseWidgets` 把未知属性丢掉。`resolveI18nCopy` 只认整段 `$t("g.k")`，`renderText` / `renderButton` 在编辑态也会替换译文。页面 `<data>` 已往返，但 `LowcodePage` 只渲染 `widgets` / `style`，`evaluateDataExpression` 与 `buildPageDataScope` 留在 `frontend-admin` 的 `pageData.ts`，H5 读不到变量池。气泡 `BoxGroup` 只有内容与盒模型分组；控件树 `titleRender` 只画标签。`cloneWidget` 会拷贝样式与状态，尚无循环可拷。

## Goals / Non-Goals

**Goals:**

- 把绑定解析/求值做成 `@vanstack/xml` 的纯函数，与 `$t` 同一层；运行时与工作台共用。
- 循环作为宿主元素属性往返，不进 `<_>` / `<__>`，复制控件时一起带走。
- 预览与 H5 先合并状态再按数组展开；编辑态只画模板、只展示绑定原文。
- 气泡循环分组与控件树右侧图标共用同一套「已配置」判断。

**Non-Goals:**

- 不把 `new Function` 换成沙箱或表达式 AST 库。
- 不为循环实例单独做 hover 作用域或虚拟列表。
- 不把数据 tab 的代码编辑器换成新组件；定义值复用现有 Array 编辑模式。

## Decisions

### 1. 绑定求值放在 `@vanstack/xml`，运行时只决定何时调用

新增：

```ts
type BindingScope = {
  data: Record<string, unknown>;
  aliases: Record<string, unknown>; // 循环项目/索引，键为所配变量名
};

function resolveCopyBinding(raw: string, scope: BindingScope): string
```

匹配顺序与 spec 相同，整段 trim 后走 `$t` → `$(expr)` → `$data` 路径 → 别名路径。路径用标识符加点号（`$data.var4`、`$item.id`）。`$(expr)` 用 `new Function('data', ...aliasNames, '"use strict"; return (${expr});')`，与现有 `evaluateDataExpression` 相同信任模型（页面作者即管理员）。把 `buildPageDataScope` / `readVariableValue` 从 `pageData.ts` 挪到 xml（或 xml 导出、admin 改 import），避免 H5 依赖 admin。

`renderText` / `renderButton`：先 `resolveI18nCopy`；若未吃掉 `$t` 且 `ctx.evaluateBindings` 为真，再 `resolveCopyBinding`。编辑态 `evaluateBindings=false`，画原文。失败一律 `''`。

**备选**：求值放在 `lowcode-runtime`。否决：工作台以后若要做绑定高亮/校验，应与渲染共用同一解析。

**备选**：允许字面量内嵌多段 `$()`。否决：与现行 `$t` 整段规则不一致，spec 已排除。

### 2. 循环是宿主属性，不是子元素

```ts
type WidgetLoop = {
  from: 'data' | 'literal';
  source: string;
  key: string;
  item?: string;  // 缺省 item，等于缺省则不写
  index?: string; // 缺省 index
};
```

XML：`loop-from` / `loop-src` / `loop-key` / `loop-item` / `loop-index`。三者（from/src/key）去空白后都有值才算已配置，否则解析当未配置、序列化不写。`from` 非法视为未配置。定义值的数组表达式放在属性里，交给现有 XML 转义；不新增 `<loop>` 子节点，以免和 `_` / `__` 抢子元素。

`PageWidget` 各变体加可选 `loop`。`WidgetStateDelta` 不含循环。`cloneWidget` / `WidgetPatch` 拷贝或写入 `loop`。

**备选**：`<loop>` 子元素。否决：`text`/`button` 子节点已被状态占用，再加一种非控件子节点会让 `splitStateNodes` 更脆。

### 3. 渲染：合并状态 → 按层展开 → 再画

`LowcodePage` 用 `page.data` 建一次 `data` 作用域。`resolveWidgetTree` 之后、`widgetElement` 之前：若非编辑且节点已配置循环，求源数组（`data` 则 `scope.data[source]`，`literal` 则对 `source` 求值），非数组或空则产出零个节点；否则按项浅克隆模板（保留原 `id`、状态与子树），把该项的项目/索引写入 `aliases` 后递归子树。React `key` 用 `${id}::${unique}`；`data-widget-id` 仍用模板 `id`。唯一键按项上的点路径取值，缺省用下标。

编辑态跳过展开，也不往文案里塞循环别名。嵌套循环内层 `aliases` 覆盖同名外层键，`data` 始终在。

Hover 仍按模板 `id` 记入 `hoverOwnerIds`，同一模板的各实例会一起进入 `hover`。接受：hover 声明在模板上，本期不为实例分配新的状态 owner。

**备选**：给每个实例生成新 `id`。否决：会与状态合并、检查器、选中协议脱节，编辑态又只有一份模板。

### 4. 气泡循环分组与树图标共用 `isLoopConfigured`

`BoxGroup` 增加 `'loop'`。全部可选中类型都画循环按钮（`SyncOutlined` 一类环绕图标）；`isLoopConfigured(widget)` 时 `type="primary"`，与加粗 `ToggleButton` 相同。面板：`Select` 切换定义值/数据池；数据池为当前页 `arr` 变量列表（运行时若值不是数组则展开为零）；定义值打开与数据 tab 相同的 Array 代码编辑器，只编 `return` 表达式。唯一键、项目名、索引名为输入框；项目/索引非法时回落缺省名。

控件树 `titleRender` 做成标签 + 右侧图标；仅已配置时显示。点击 `stopPropagation` 后 `selectWidget` + `focusWidgetById` + `onOpenGroupChange('loop')`。

循环写入走现有 `updateWidget` / `commitDraft`，`coalesceKey` 如 `loop:${id}`。只读版本面板可看不可改。

**备选**：循环只放检查器。否决：需求明确要工具栏激活态与树图标定位。

## Risks / Trade-offs

- [`new Function` 执行页面表达式] → 与数据 tab 相同，仅管理员编写的 XML；`use strict` 且只注入 `data` 与循环别名，不传 `window`。
- [超大数组成千上万份 DOM] → spec 不做虚拟滚动；作者控制数组长度。
- [循环实例共享 hover] → 按模板 id 命中；独立实例悬停留后续。
- [定义值写在 XML 属性里，复杂字面量需转义] → 走现有 builder 转义；往返测带引号与 `[]` 的例子。

## Migration Plan

无存量迁移。无 `loop-*`、无 `$()` 的 XML 行为与现在一致（编辑态仍解析 `$t`）。发布含循环/绑定的版本后，旧 H5 在升级 runtime 前会把表达式当原文、忽略未知属性；因此管理后台与 H5 的 `@vanstack/lowcode-runtime` 必须同发。回滚 runtime 后循环属性会被解析丢掉，页面退回单份模板 + 原文案。
