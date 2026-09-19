import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { flexItemCss, hiddenCss, mergeCss, widgetCss } from '../css';
import { resolveWidgetCopy, widgetCssOptions, type WidgetRenderContext } from '../widget-render';

export function renderButton(
  widget: Extract<PageWidget, { type: 'button' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'button',
    {
      key: ctx.instanceKey,
      className: 'lowcode-button',
      type: 'button',
      'data-widget-id': widget.id,
      'data-widget-type': 'button',
      style: mergeCss(widgetCss(widget.style, widgetCssOptions(ctx)), flexItemCss(widget.item), hiddenCss(widget.hidden, ctx.editing)),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    resolveWidgetCopy(widget.text, ctx),
  );
}
