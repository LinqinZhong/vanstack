import { createElement, type CSSProperties, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, gridContainerCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

/** 预览页高度固定，未写高度的宫格布局不要被压到比内容更矮。 */
function gridContentLock(widget: Extract<PageWidget, { type: 'grid' }>): CSSProperties | undefined {
  const css: CSSProperties = {};
  if (widget.item?.flexShrink == null) {
    css.flexShrink = 0;
  }
  if (widget.style?.height == null) {
    css.minHeight = 'min-content';
  }
  return css;
}

export function renderGrid(
  widget: Extract<PageWidget, { type: 'grid' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-grid ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'grid',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
        gridContainerCss(widget.grid, widgetCssOptions(ctx)),
        flexItemCss(widget.item, widgetCssOptions(ctx)),
        gridContentLock(widget),
        hiddenCss(widget.hidden, ctx.editing),
        presenceCss(widget, widgetCssOptions(ctx)),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    widget.children.map((child) => ctx.render(child)),
  );
}
