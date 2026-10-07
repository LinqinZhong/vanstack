import { createElement, type CSSProperties, type ReactElement } from 'react';
import { isCopyBinding, resolveCopyBinding, type PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

function emptyIconMark(): ReactElement {
  const cell = (x: number, y: number) =>
    createElement('rect', {
      x,
      y,
      width: 7.4,
      height: 7.4,
      rx: 1.5,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.65,
    });
  return createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: '100%',
      height: '100%',
      'aria-hidden': true,
      style: { display: 'block' },
    },
    cell(3.1, 3.1),
    cell(13.5, 3.1),
    cell(3.1, 13.5),
    cell(13.5, 13.5),
  );
}

function iconAssetUrl(src: string, icons: Readonly<Record<string, string>> | undefined): string {
  const trimmed = src.trim();
  if (!trimmed || /^(https?:|data:|\/)/i.test(trimmed)) {
    return trimmed;
  }
  return icons?.[trimmed] ?? trimmed;
}

function iconFaceStyle(src: string, color?: string): CSSProperties {
  if (src.trim()) {
    return {
      display: 'inline-block',
      backgroundColor: 'currentColor',
      WebkitMaskImage: `url(${src})`,
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskImage: `url(${src})`,
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      maskSize: 'contain',
    };
  }
  return {
    display: 'inline-block',
    ...(color ? {} : { color: '#2a2a2a' }),
  };
}

export function renderIcon(
  widget: Extract<PageWidget, { type: 'icon' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const resolvedSize =
    typeof widget.size === 'string'
      ? ctx.evaluateBindings && isCopyBinding(widget.size)
        ? Number(resolveCopyBinding(widget.size, ctx.bindingScope))
        : Number(widget.size)
      : widget.size;
  const size = resolvedSize != null && Number.isFinite(resolvedSize) && resolvedSize > 0 ? resolvedSize : 24;
  const src = iconAssetUrl(resolveWidgetCopy(widget.src, ctx), ctx.icons);
  const blank = !src.trim();
  return createElement(
    'span',
    {
      key: ctx.instanceKey,
      className: `lowcode-icon ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'icon',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
        flexItemCss(widget.item, widgetCssOptions(ctx)),
        {
          width: size,
          height: size,
          ...iconFaceStyle(src, typeof widget.style?.color === 'string' ? widget.style.color : undefined),
        },
        hiddenCss(widget.hidden, ctx.editing),
        presenceCss(widget, widgetCssOptions(ctx)),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    blank ? emptyIconMark() : null,
  );
}
