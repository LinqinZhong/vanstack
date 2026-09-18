## 1. XML 模型与绑定求值

- [x] 1.1 在 `PageWidget` 增加可选 `loop`（`from` / `source` / `key` / `item` / `index`），导出 `isLoopConfigured`。`parseWidgets` 读 `loop-from` / `loop-src` / `loop-key` / `loop-item` / `loop-index`，缺 key/src 或非法 from 当未配置；序列化仅在已配置时写出，缺省 `item`/`index` 省略。用 spec 中的 data-pool、literal 自定义别名、缺 key、无循环旧 XML 跑通解析→序列化→再解析
- [x] 1.2 `<_>` / `<__>` 解析忽略循环属性；改循环不写进状态 delta。用「宿主带 loop、`<_ name="active">` 只改色」确认往返后循环仍在宿主上
- [x] 1.3 把 `buildPageDataScope` / `readVariableValue` / `evaluateDataExpression` 挪到 `@vanstack/xml` 并导出，`pageData.ts` 改为引用。确认数据 tab 的 Array/Object 校验与 `$data.` 补全仍可用
- [x] 1.4 实现 `resolveCopyBinding`：整段 `$t` 不在此处理；`$(expr)`、`$data` 路径、循环别名路径按 spec 优先级；失败/未知返回 `''`；`前缀$(1)` 原样返回。用 `$(1)` / `$("1")` / `$(false)` / 三元 / `$(data.var1 + data.var2)` / `$data.var4` / `$item.id` / 未知变量 在无 DOM 下断言返回值

## 2. 运行时渲染

- [x] 2.1 `WidgetRenderContext` 增加 `evaluateBindings` 与 `BindingScope`。`renderText` / `renderButton` 先 `resolveI18nCopy`，未命中且 `evaluateBindings` 时再求值。编辑态画 `$data.var4` 原文；预览/H5 画变量值；`$t` 两种模式都出译文
- [x] 2.2 `LowcodePage` 用 `page.data` 建 data 作用域；非编辑态在 `resolveWidgetTree` 之后按层展开已配置循环（空/非数组产出 0 节点；React key 为 `id::unique`，`data-widget-id` 仍为模板 id）。用 `list=[{id:1,name:'A'},{id:2,name:'B'}]` + `$item.name` 确认预览两份文案、编辑态仍一份模板
- [x] 2.3 嵌套循环把内层 aliases 叠在外层上，`$(group.title + item.name)` 与自定义 `loop-item="row"` 的 `$row.id` 在预览中求值正确；管理后台预览与 H5 对同一 XML 份数、顺序、文案一致

## 3. 工作台写入

- [x] 3.1 `WidgetPatch` / `patchWidget` / `cloneWidget` 读写 `loop`。复制已配置循环的弹性盒再粘贴，副本循环字段相同、`id` 不同
- [x] 3.2 `BoxGroup` 增加 `loop`。全部可选中控件气泡工具栏加循环按钮；已配置时 `primary` 激活态。点开后面板含：定义值/数据池下拉、定义值代码编辑或数据池 `arr` 变量选择、必填唯一键、索引名（默认 index）、项目名（默认 item）。填完 `list`+`id` 后 XML 写出对应属性且图标激活；清空 key 后属性消失、图标熄灭。只读版本面板不可改
- [x] 3.3 循环写入走 `updateWidget`/`commitDraft`（`coalesceKey` 如 `loop:${id}`）。配置后再撤回，控件回到未循环、图标未激活。`Tab` 切兄弟时若循环分组已开则保持打开
- [x] 3.4 控件树已配置循环的行右侧显示循环图标；点击后选中、`focusWidgetById`、打开循环面板。未配置节点无该图标。admin zh/en 补循环、源数组、定义值、数据池、唯一键、索引/项目变量名等文案

## 4. 走通

- [x] 4.1 走通：编辑态文案写 `$(1)` / `$data.var4` 画原文 → 切预览分别显示 `1` 与变量值 → 给列表项弹性盒配数据池循环，子文本 `$item.name` 与混写 `$(item.name + '(' + item.id + ')')` 按数组展开 → 控件树图标能定位并打开循环面板 → 保存后再加载循环与绑定仍在 → H5 打开同一版本展开结果与预览一致
