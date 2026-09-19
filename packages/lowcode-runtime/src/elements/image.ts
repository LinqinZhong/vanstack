import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { flexItemCss, mergeCss, widgetCss } from '../css';
import { resolveWidgetCopy, widgetCssOptions, type WidgetRenderContext } from '../widget-render';

export function renderImage(
  widget: Extract<PageWidget, { type: 'image' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'span',
    {
      key: ctx.instanceKey,
      className: 'lowcode-image',
      'data-widget-id': widget.id,
      'data-widget-type': 'image',
      style: mergeCss(
        widgetCss(widget.style, widgetCssOptions(ctx)),
        flexItemCss(widget.item),
        { overflow: 'hidden' },
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
