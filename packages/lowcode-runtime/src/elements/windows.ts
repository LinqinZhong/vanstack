import { createElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

function windowToken(raw: string | undefined, ctx: WidgetRenderContext): string {
  const trimmed = raw?.trim() ?? '';
  return trimmed ? resolveWidgetCopy(trimmed, ctx).trim() : '';
}

export function renderWindows(
  widget: Extract<PageWidget, { type: 'windows' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const rawCurrent = widget.current?.trim() ?? '';
  const current = windowToken(rawCurrent, ctx);
  const windowChildren = widget.children.filter((child) => child.type === 'window');
  const rest = widget.children.filter((child) => child.type !== 'window');
  const matched = rawCurrent
    ? windowChildren.filter((child) => windowToken(child.value, ctx) === current)
    : windowChildren;
  const active = matched.length > 0 ? matched : windowChildren.slice(0, 1);
  const split = ctx.editing && windowChildren.length > 1;
  const activeIndex = split ? Math.max(0, windowChildren.indexOf(active[0])) : 0;
  const options = widgetCssOptions(ctx);
  const position = widget.style?.position;
  const anchor =
    split && (position == null || position === 'static') ? { position: 'relative' as const } : undefined;
  const windows = split
    ? createElement(
        'div',
        { className: 'lowcode-windows-track' },
        windowChildren.map((child, index) => {
          const offset = index - activeIndex;
          if (offset === 0) {
            return ctx.render(child);
          }
          return createElement(
            'div',
            {
              key: child.id,
              className: 'lowcode-windows-slot is-offset',
              style: { left: `${offset * 100}%`, width: '100%' },
            },
            ctx.render(child),
          );
        }),
      )
    : null;
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-windows ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'windows',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        dynamicStyleCss(widget.style, options),
        flexItemCss(widget.item, options),
        hiddenCss(widget.hidden, ctx.editing),
        presenceCss(widget, options),
        anchor,
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    windows,
    ...(split ? rest : [...active, ...rest]).map((child) => ctx.render(child)),
  );
}

export function renderWindow(
  widget: Extract<PageWidget, { type: 'window' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-window ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'window',
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
    widget.children.map((child) => ctx.render(child)),
  );
}
