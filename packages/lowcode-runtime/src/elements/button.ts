import { createElement, type ReactElement } from 'react';
import { resolveI18nCopy, type PageWidget } from '@vanstack/xml';
import { flexItemCss, mergeCss, widgetCss } from '../css';
import type { WidgetRenderContext } from '../widget-render';

export function renderButton(
  widget: Extract<PageWidget, { type: 'button' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'button',
    {
      key: widget.id,
      className: 'lowcode-button',
      type: 'button',
      'data-widget-id': widget.id,
      'data-widget-type': 'button',
      style: mergeCss(widgetCss(widget.style, { animate: ctx.animate }), flexItemCss(widget.item)),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    resolveI18nCopy(widget.text, ctx.catalog, ctx.locale),
  );
}
