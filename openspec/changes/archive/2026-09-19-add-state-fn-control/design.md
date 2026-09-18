## Context

动机见 `proposal.md` 的 Why；行为契约见 `specs/lowcode-runtime/spec.md`。

现状：宿主 `state` 存静态选用名；状态树用「设为默认」和对勾维护它；`resolveWidgetTree` 按 `ownerId`（控件 `id`）叠 hover，循环实例共用同一 `id`。文案绑定与循环已提供 `$data` / `$item` / `$index`。

## Goals / Non-Goals

**Goals:**

- 把运行选用改成每控件一份 `state()` 函数，编辑态仍用状态树查看。
- hover 按循环实例命中，且排在其它具名状态之后、`initial` 之前。

**Non-Goals:**

- 不改 `<_>` / `<__>` 的属性差异模型。
- 不把 `state()` 写进状态树行。

## Decisions

### 1. 宿主 `state` 存函数体

解析：空则无函数；裸标识符且是拥有的状态名则包成 `return "name"`；否则原样作为函数体。序列化只写非空函数体。`<__>` 不再写 `state`。

备选：另加 `state-fn` 属性。否决原因：与现有 `state` 一词冲突更小，旧 XML 还能迁移。

### 2. 先展开循环再求值

`LowcodePage`：`expandLoopTree` 之后 `resolveWidgetTree`，用实例绑定作用域求 `state()`。解析结果经 WeakMap 随控件对象复制，以免展开后再 merge 丢作用域。

### 3. 运行时自己的状态名

其它具名状态（`state()` 命中且不是 `hover`）> 当前实例正在悬停且拥有 `hover` > `initial`。悬停集合用实例 key，不用控件 `id`。

备选：继续把 hover 写进 viewing（按 `ownerId`）。否决原因：循环项会一起亮，且会盖过 `state()`。

### 4. 状态树只负责查看

去掉设为默认、对勾、创建后自动选用。气泡增加状态控制图标，弹窗编辑函数；已配置则图标激活。

## Risks / Trade-offs

- [函数体写在 XML 属性里，引号需转义] → 交给现有 XML 编解码；非法函数运行时回落 `initial`。
- [作者以为切状态树即改预览] → 预览强制求 `state()`；状态树仍只查看。

## Migration Plan

无数据库迁移。旧 `state="active"` 读成 `return "active"`，下次保存写出函数体。无 `state` 的页面仍是 `initial`。

## Open Questions

- （无）
