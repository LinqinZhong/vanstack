import { createElement, type CSSProperties, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexContainerCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

/** 预览页高度固定，未写高度的弹性盒不要被压到比内容更矮。 */
function flexContentLock(widget: Extract<PageWidget, { type: 'flex' }>): CSSProperties | undefined {
  const css: CSSProperties = {};
  if (widget.item?.flexShrink == null) {
    css.flexShrink = 0;
  }
  if (widget.style?.height == null) {
    css.minHeight = 'min-content';
  }
  return css;
}

export function renderFlex(
  widget: Extract<PageWidget, { type: 'flex' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-flex ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'flex',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
        flexContainerCss(widget.flex, widgetCssOptions(ctx)),
        flexItemCss(widget.item, widgetCssOptions(ctx)),
        flexContentLock(widget),
        hiddenCss(widget.hidden, ctx.editing),
        presenceCss(widget, widgetCssOptions(ctx)),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    widget.children.map((child) => ctx.render(child)),
  );
}
