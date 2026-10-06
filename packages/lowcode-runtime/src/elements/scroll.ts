import { createElement, type ReactElement } from 'react';
import { DEFAULT_SCROLL_HEIGHT, DEFAULT_SCROLL_WIDTH, sanitizeWidgetStyle, type PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, sizeCss, widgetClassName } from '../css';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderScroll(
  widget: Extract<PageWidget, { type: 'scroll' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const style = sanitizeWidgetStyle('scroll', widget.style);
  const options = widgetCssOptions(ctx);
  const shell = mergeCss(
    dynamicStyleCss(style, options),
    {
      width: sizeCss(style?.width ?? DEFAULT_SCROLL_WIDTH, options),
      height: sizeCss(style?.height ?? DEFAULT_SCROLL_HEIGHT, options),
      minWidth: 0,
      minHeight: 0,
      boxSizing: 'border-box',
      overflowX: ctx.editing || widget.scrollX === false ? 'hidden' : 'auto',
      overflowY: ctx.editing || widget.scrollY === false ? 'hidden' : 'auto',
      ...(widget.item?.flexShrink == null ? { flexShrink: 0 } : {}),
    },
    flexItemCss(widget.item, options),
    hiddenCss(widget.hidden, ctx.editing),
  );
  if (shell) {
    delete shell.overflow;
  }
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: ['lowcode-scroll', widgetClassName(widget.id), ctx.editing ? 'is-editing' : ''].filter(Boolean).join(' '),
      'data-widget-id': widget.id,
      'data-widget-type': 'scroll',
      'data-state': widgetStateAttr(widget, ctx),
      style: shell,
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    widget.children.map((child) => ctx.render(child)),
  );
}
