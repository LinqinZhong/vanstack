import { createElement, type ReactElement } from 'react';
import { resolveI18nCopy, type PageWidget } from '@vanstack/xml';
import { flexItemCss, mergeCss, widgetCss } from '../css';
import type { WidgetRenderContext } from '../widget-render';

export function renderText(
  widget: Extract<PageWidget, { type: 'text' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'span',
    {
      key: widget.id,
      className: 'lowcode-text',
      'data-widget-id': widget.id,
      'data-widget-type': 'text',
      style: mergeCss(widgetCss(widget.style, { animate: ctx.animate }), flexItemCss(widget.item)),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    resolveI18nCopy(widget.value, ctx.catalog, ctx.locale),
  );
}
