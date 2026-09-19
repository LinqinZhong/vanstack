import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, widgetClassName } from '../css';
import { resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderIcon(
  widget: Extract<PageWidget, { type: 'icon' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const size = widget.size ?? 24;
  const src = resolveWidgetCopy(widget.src, ctx);
  return createElement('span', {
    key: ctx.instanceKey,
    className: `lowcode-icon ${widgetClassName(widget.id)}`,
    'data-widget-id': widget.id,
    'data-widget-type': 'icon',
    'data-state': widgetStateAttr(widget, ctx),
    style: mergeCss(
      dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
      flexItemCss(widget.item),
      {
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskImage: `url(${src})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
      },
      hiddenCss(widget.hidden, ctx.editing),
    ),
    onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
    onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
  });
}
