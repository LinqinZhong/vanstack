import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { DEFAULT_SWIPER_HEIGHT, DEFAULT_SWIPER_WIDTH, sanitizeWidgetStyle } from '@vanstack/xml';
import { resolveSwiperStyle, SwiperView } from '../swiper';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, sizeCss, widgetClassName } from '../css';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderSwiper(
  widget: Extract<PageWidget, { type: 'swiper' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const style = sanitizeWidgetStyle('swiper', widget.style);
  const cssOptions = widgetCssOptions(ctx);
  const shell = mergeCss(
    {
      width: sizeCss(style?.width ?? DEFAULT_SWIPER_WIDTH, cssOptions),
      height: sizeCss(style?.height ?? DEFAULT_SWIPER_HEIGHT, cssOptions),
    },
    dynamicStyleCss(style, cssOptions),
    flexItemCss(widget.item, cssOptions),
    hiddenCss(widget.hidden, ctx.editing),
    presenceCss(widget, cssOptions),
  );
  return createElement(SwiperView, {
    key: ctx.instanceKey,
    widget: { ...widget, swiper: resolveSwiperStyle(widget.swiper, ctx) },
    editing: ctx.editing,
    resolvePresence: ctx.evaluateBindings,
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
