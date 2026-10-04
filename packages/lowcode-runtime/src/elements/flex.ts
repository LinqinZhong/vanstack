import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexContainerCss, flexItemCss, hiddenCss, mergeCss, widgetClassName } from '../css';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

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
        hiddenCss(widget.hidden, ctx.editing),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    widget.children.map((child) => ctx.render(child)),
  );
}
