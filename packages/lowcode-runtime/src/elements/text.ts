import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { displayWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderText(
  widget: Extract<PageWidget, { type: 'text' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'span',
    {
      key: ctx.instanceKey,
      className: `lowcode-text ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'text',
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
    displayWidgetCopy(widget.value, ctx, Boolean(ctx.summarizeCopy) || (ctx.editing && !ctx.evaluateBindings)),
  );
}
