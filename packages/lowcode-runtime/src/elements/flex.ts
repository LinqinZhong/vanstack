import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { flexContainerCss, flexItemCss, mergeCss, widgetCss } from '../css';
import { widgetCssOptions, type WidgetRenderContext } from '../widget-render';

export function renderFlex(
  widget: Extract<PageWidget, { type: 'flex' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: 'lowcode-flex',
      'data-widget-id': widget.id,
      'data-widget-type': 'flex',
      style: mergeCss(widgetCss(widget.style, widgetCssOptions(ctx)), flexContainerCss(widget.flex), flexItemCss(widget.item)),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    widget.children.map((child) => ctx.render(child)),
  );
}
