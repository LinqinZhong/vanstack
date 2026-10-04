import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, widgetClassName } from '../css';
import { resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderImage(
  widget: Extract<PageWidget, { type: 'image' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'span',
    {
      key: ctx.instanceKey,
      className: `lowcode-image ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'image',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
        flexItemCss(widget.item, widgetCssOptions(ctx)),
        { overflow: 'hidden' },
        hiddenCss(widget.hidden, ctx.editing),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    createElement('img', {
      src: resolveWidgetCopy(widget.src, ctx),
      alt: '',
      draggable: false,
    }),
  );
}
