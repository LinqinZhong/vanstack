import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderButton(
  widget: Extract<PageWidget, { type: 'button' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'button',
    {
      key: ctx.instanceKey,
      className: `lowcode-button ${widgetClassName(widget.id)}`,
      type: 'button',
      'data-widget-id': widget.id,
      'data-widget-type': 'button',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
        flexItemCss(widget.item, widgetCssOptions(ctx)),
        hiddenCss(widget.hidden, ctx.editing),
        presenceCss(widget, widgetCssOptions(ctx)),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    resolveWidgetCopy(widget.text, ctx),
  );
}
