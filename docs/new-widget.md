# 定义新控件

新增一种控件要走完四层：XML 类型、解析与序列化、运行时渲染、编辑器 helper。`PageWidget['type']` 和 `widgetHelpers` 用 `satisfies` 绑在一起，类型加了但 helper 没登记，`frontend-admin` 的类型检查会失败。

下面用 `badge` 举例。标签名用 kebab-case，和 XML 标签一致。

## 1. 声明类型

在 `packages/xml/src/page.ts` 的 `PageWidget` 上增加一个分支。公共字段已经在 `WidgetCommon` 里：`states`、`stateOverrides`、`loop`、`hidden`、`alias` 等。能放进弹性盒的控件再带上 `item?: FlexItemStyle`。容器再带 `children: PageWidget[]`。

```ts
| ({ type: 'badge'; id: string; value: string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
```

控件自己的内容字段（如文本的 `value`、图标的 `src` / `size`）写在这一支上。这些字段如果还要进状态差分，同步加到同文件的 `WidgetContentProps`，并在 `applyResolvedProps` 里按类型写回。

## 2. 解析和序列化

仍在 `packages/xml/src/page.ts`。

`parseWidgets` 里按标签读入。页面根、`flex`、`swiper-item` 走 `allowContent`；只有 `swiper` 的直接子节点走 `allowSwiperItem`。新控件若和文本一样可以出现在内容区，就放在 `allowContent` 分支里。父级是 `flex` 时用 `parseItem` 读弹性项目字段。状态、循环、隐藏、别名沿用现有的 `widgetStateSpread`、`parseWidgetLoop`、`parseWidgetHidden`、`parseWidgetAlias`。

`serializeWidgets` 里按 `widget.type` 写回同一标签。公共属性用 `widgetHostAttrs`，盒样式用已经算好的 `style`，弹性项目用 `item`。容器的子节点在 `serializeStateChildren` 的结果里，不要自己再遍历一遍 `children`。

`swiper-item` 这种不能出现在页面根或 `flex` 里的控件，解析时不要放进 `allowContent`。

## 3. 运行时渲染

在 `packages/lowcode-runtime/src/elements/` 下新增一个文件，例如 `badge.ts`，导出 `renderBadge`。节点上带上：

- `data-widget-id`
- `data-widget-type`
- `className` 里的 `widgetClassName(widget.id)`，页面样式表靠这个类名生效
- `widgetStateAttr`、`hiddenCss`、`ctx.hoverFor`

然后在 `elements/index.ts` 的 `widgetElement` 里加一条 `case`。

编辑模式和预览模式共用这一份 DOM。轮播那种「编辑态铺开、预览态只显示当前页」的差异，放在组件内部用 `ctx.editing` 分支，不要拆两套渲染。

## 4. 编辑器 helper

在 `apps/frontend-admin/src/widgets/` 下新增 `badge.ts`，实现 `WidgetHelperInterface`。

```ts
export const badgeHelper = {
  type: 'badge',
  nameKey: 'lowcode.defaultBadge',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return { type: 'badge', id: ctx.id, value: ctx.t('lowcode.defaultBadge') };
  },
  clone(widget, ctx) {
    return {
      type: 'badge',
      id: ctx.nextId(),
      value: widget.value,
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.value != null) {
      next.value = patch.value;
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.value;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'badge' }>>;
```

| 字段 | 作用 |
| --- | --- |
| `nameKey` | 添加弹窗和控件树里的类型名，对应 i18n |
| `container` | 有 `children` 时为 `true`，控件树才能展开 |
| `allowRoot` | `false` 时不能放在页面根或弹性盒里（现在只有 `swiper-item`） |
| `accepts` | `none` 不能装子控件；`content` 能装除 `swiper-item` 以外的控件；`swiper-item` 只能装滑动器页 |
| `create` | 从添加弹窗新建时的默认值。需要子 id 时用 `ctx.nextId()` |
| `clone` | 复制。公共样式、状态、循环、隐藏、别名用 `cloneShared`；弹性项目用 `cloneItemField`；子树用 `cloneChildren` |
| `patch` | 属性修改。公共字段先走 `applyCommon`，再写本控件自己的字段 |
| `treeSuffix` | 可选。控件树里类型名后面的内容，例如文本的 `value` |

在 `widgets/index.ts` 的 `widgetHelpers` 里登记。要出现在添加弹窗里，再放进 `ADDABLE_WIDGET_TYPES`，顺序就是弹窗按钮顺序。

`nameKey` 要在 `apps/frontend-admin/src/locales/zh.json` 和 `en.json` 的 `lowcode` 下各加一条。

本控件如果有专属字段，把字段加到 `widgets/types.ts` 的 `WidgetPatch`。状态视图下改这些字段时，还要在 `apps/frontend-admin/src/utils/widgetStates.ts` 的 `applyPropsToWidget` 里写回。

## 5. 检查器

工作台属性网格在 `apps/frontend-admin/src/components/InspectorPropertyGrid.tsx`。盒模型、定位、循环、状态是公共的。只有文本、图片、图标这类多出来的字段，才在这里按 `widget.type` 加一行，并通过 `onPatch` 交给 helper 的 `patch`。

样式气泡 `WidgetStyleFields.tsx`、`WidgetStyleBubble.tsx` 里也有按类型隐藏某一组样式的判断（例如图标不编辑宽高、滑动器页去掉一部分盒属性）。新控件如果要少显示一组，加在 `isBoxGroupAllowed`。默认宽高、默认背景这类例外在 `sanitizeWidgetStyle`（`packages/xml/src/page.ts`）。

## 容器控件

容器把 `container` 设为 `true`，`accepts` 按上面的表填。`create` 给 `children: []`。`clone` 用 `cloneChildren(widget, ctx)`。

它如果是一种新的父级，解析时还要扩展 `WidgetParent`，并在 `parseWidgets` 里决定子节点走 `allowContent` 还是别的过滤。序列化子节点时，`serializeStateChildren` 用的父级字符串要和这个类型一致。

滑动器是现成的例子：`accepts: 'swiper-item'`，`allowRoot: true`；滑动器页则是 `accepts: 'content'`，`allowRoot: false`。
