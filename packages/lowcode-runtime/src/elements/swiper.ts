import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { DEFAULT_SWIPER_HEIGHT, DEFAULT_SWIPER_WIDTH, sanitizeWidgetStyle } from '@vanstack/xml';
import { SwiperView } from '../swiper';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, sizeCss, widgetClassName } from '../css';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

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
    dynamicStyleCss(style, widgetCssOptions(ctx)),
    flexItemCss(widget.item),
    hiddenCss(widget.hidden, ctx.editing),
  );
  return createElement(SwiperView, {
    key: ctx.instanceKey,
    widget,
    editing: ctx.editing,
    style: shell,
    className: widgetClassName(widget.id),
    dataState: widgetStateAttr(widget, ctx),
    itemClassName: (item) => widgetClassName(item.id),
    itemDataState: (item) => widgetStateAttr(item, ctx),
    itemCss: (itemStyle) => dynamicStyleCss(sanitizeWidgetStyle('swiper-item', itemStyle), widgetCssOptions(ctx)),
    renderChild: ctx.render,
    onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
    onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    itemHover: (item) => ctx.hoverFor(item),
  });
}
