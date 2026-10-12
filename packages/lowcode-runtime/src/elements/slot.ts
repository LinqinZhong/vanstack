import { createElement, type ReactElement } from 'react';
import { resolveWidgetTree, type PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { resolveRuntimeOwnState } from '../hover';
import { expandLoopTree, slotOverrideMeta, widgetInstanceKey } from '../loop';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderSlot(
  widget: Extract<PageWidget, { type: 'slot' }>,
  ctx: WidgetRenderContext,
): ReactElement | null {
  const options = widgetCssOptions(ctx);
  const override = slotOverrideMeta(widget);
  let children: Array<ReactElement | null>;
  if (override) {
    // 外层页面覆盖了插槽内容：用外层作用域（叠加插槽参数）展开并渲染。
    const expanded = expandLoopTree(override.content, override.scope, false, widgetInstanceKey(widget));
    const resolved = resolveWidgetTree(expanded, ctx.viewing ?? null, {
      appliedStateFor: (child) => resolveRuntimeOwnState(child, ctx.editing ? [] : (ctx.hoverInstanceKeys ?? [])),
      stateLayersSink: ctx.stateLayers,
      locale: ctx.locale,
    });
    children = resolved.map((child) =>
      ctx.render(child, {
        componentStack: ctx.componentStack,
        commitModelValue: override.outer.commitModelValue,
        assignScope: override.outer.assignScope,
        instantiate: true,
        emit: override.outer.emit,
      }),
    );
  } else {
    children = widget.children.map((child) => ctx.render(child));
  }
  // 非组件编辑态不显示插槽 chrome，只渲染子内容；仅组件编辑态显示占位/名称。
  const showChrome = Boolean(ctx.editing && ctx.slotChrome);
  const hasContent = children.some((child) => child != null);
  // 非组件编辑态下，空插槽仅用于占位，不应产生任何 DOM（不占空间、不显示）。
  if (!showChrome && !hasContent) {
    return null;
  }
  const isEmpty = showChrome && !hasContent;
  // 占位符语义：插槽不是容器，只是占位符。组件定义里给插槽设置的尺寸只有一个作用——
  // 标示占位符的大小（仅组件编辑态的空插槽使用）。插槽被添加元素后占位符即被内容
  // 直接替换：插槽盒子 display:contents 完全消失，子元素直接成为插槽父级的子项参与
  // 布局（flex item / 普通流），元素大小只由元素自身决定，与插槽定义无关。
  // 插槽 DOM 仍保留 data-state / class 等结构属性：状态 CSS 用后代选择器级联，
  // display:contents 不影响后代匹配；visibility 可经它继承，display:none 仍移除整棵子树。
  const ownStyleCss = isEmpty ? dynamicStyleCss(widget.style, options) : undefined;
  const itemCss = isEmpty ? flexItemCss(widget.item, options) : undefined;
  const slotName = showChrome && isEmpty ? widget.name?.trim() : '';
  const plugIcon = showChrome && isEmpty
    ? createElement('svg', { key: 'slot-plug', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        createElement('path', { d: 'M9 2v6' }),
        createElement('path', { d: 'M15 2v6' }),
        createElement('path', { d: 'M6 8h12v3a6 6 0 0 1-12 0V8z' }),
        createElement('path', { d: 'M12 17v5' }),
      )
    : null;
  // 名称标签只服务于空占位符（跟在插头图标下方）；插槽被内容替换后不再渲染，
  // 否则 display:contents 下它会变成插槽父级的一个布局子项。
  const nameTag = slotName
    ? createElement(
        'span',
        { key: 'slot-name', className: 'lowcode-slot-name is-empty' },
        slotName,
      )
    : null;
  const body: Array<ReactElement | null> = isEmpty
    ? ([plugIcon, nameTag].filter(Boolean) as ReactElement[])
    : children;
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-slot ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'slot',
      'data-slot-id': widget.slotId,
      'data-state': widgetStateAttr(widget, ctx),
      style: isEmpty
        ? mergeCss(
            {
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              maxWidth: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            },
            ownStyleCss,
            itemCss,
            widget.item?.flexShrink == null ? { flexShrink: 0 } : undefined,
            widget.style?.height == null ? { minHeight: 'min-content' } : undefined,
            hiddenCss(widget.hidden, ctx.editing),
            presenceCss(widget, options),
            // 空插槽仅显示插头图标（16px），尺寸过小无法点选；仅在组件编辑态（此时才 isEmpty）出现。
            // 给最小可点击尺寸，参照 component.ts 空组件 minHeight: '72px' 的模式。
            { background: 'rgba(0, 0, 0, 0.06)', minHeight: '72px', minWidth: '72px' },
          )
        : mergeCss(
            // 占位符已被内容替换：插槽不生成盒子，只做状态/隐藏语义的透传节点。
            { display: 'contents' },
            hiddenCss(widget.hidden, ctx.editing),
            presenceCss(widget, options),
          ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    body,
  );
}
