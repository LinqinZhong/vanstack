import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { DEFAULT_SWIPER_HEIGHT, DEFAULT_SWIPER_WIDTH, sanitizeWidgetStyle } from '@vanstack/xml';
import { SwiperView } from '../swiper';
import { boxCss, flexItemCss, mergeCss, sizeCss } from '../css';
import type { WidgetRenderContext } from '../widget-render';

export function renderSwiper(
  widget: Extract<PageWidget, { type: 'swiper' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const style = sanitizeWidgetStyle('swiper', widget.style);
  const shell = mergeCss(
    {
      width: sizeCss(style?.width ?? DEFAULT_SWIPER_WIDTH),
      height: sizeCss(style?.height ?? DEFAULT_SWIPER_HEIGHT),
    },
    boxCss(style, { animate: ctx.animate }),
    flexItemCss(widget.item),
  );
  return createElement(SwiperView, {
    key: widget.id,
    widget,
    editing: ctx.editing,
    style: shell,
    itemCss: (itemStyle) => boxCss(sanitizeWidgetStyle('swiper-item', itemStyle), { animate: ctx.animate }),
    renderChild: ctx.render,
    onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
    onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    itemHover: (item) => ctx.hoverFor(item),
  });
}
