import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { sanitizeWidgetStyle } from '@vanstack/xml';
import { boxCss, mergeCss } from '../css';
import { widgetCssOptions, type WidgetRenderContext } from '../widget-render';

export function renderSwiperItem(
  widget: Extract<PageWidget, { type: 'swiper-item' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: 'lowcode-swiper-item',
      'data-widget-id': widget.id,
      'data-widget-type': 'swiper-item',
      style: mergeCss(
        { boxSizing: 'border-box' },
        boxCss(sanitizeWidgetStyle('swiper-item', widget.style), widgetCssOptions(ctx)),
        {
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        },
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    widget.children.map((child) => ctx.render(child)),
  );
}
