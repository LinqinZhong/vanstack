import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { flexItemCss, mergeCss, widgetCss } from '../css';
import { resolveWidgetCopy, widgetCssOptions, type WidgetRenderContext } from '../widget-render';

export function renderText(
  widget: Extract<PageWidget, { type: 'text' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'span',
    {
      key: ctx.instanceKey,
      className: 'lowcode-text',
      'data-widget-id': widget.id,
      'data-widget-type': 'text',
      style: mergeCss(widgetCss(widget.style, widgetCssOptions(ctx)), flexItemCss(widget.item)),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    resolveWidgetCopy(widget.value, ctx),
  );
}
