import { createElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { DEFAULT_SCROLL_HEIGHT, DEFAULT_SCROLL_WIDTH, sanitizeWidgetStyle, type PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, sizeCss, widgetClassName } from '../css';
import { bindOverlayScrollbar } from '../overlay-scrollbar';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

function ScrollPort({
  overflowX,
  overflowY,
  children,
}: {
  overflowX: 'auto' | 'hidden';
  overflowY: 'auto' | 'hidden';
  children?: ReactNode;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const yRef = useRef<HTMLDivElement>(null);
  const xRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const view = viewRef.current;
    const yThumb = yRef.current;
    const xThumb = xRef.current;
    if (!view || !yThumb || !xThumb) {
      return undefined;
    }
    return bindOverlayScrollbar(view, yThumb, xThumb);
  }, []);
  return createElement(
    'div',
    { className: 'lowcode-scroll-port' },
    createElement(
      'div',
      {
        ref: viewRef,
        className: 'lowcode-scroll-view',
        style: {
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 0,
          overflowX,
          overflowY,
          scrollbarWidth: 'none',
        },
      },
      children,
    ),
    createElement('div', { ref: yRef, className: 'lowcode-scroll-thumb is-y' }),
    createElement('div', { ref: xRef, className: 'lowcode-scroll-thumb is-x' }),
  );
}

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
      overflow: 'hidden',
      ...(widget.item?.flexShrink == null ? { flexShrink: 0 } : {}),
    },
    flexItemCss(widget.item, options),
    hiddenCss(widget.hidden, ctx.editing),
    presenceCss(widget, options),
  );
  if (shell && (!shell.position || shell.position === 'static')) {
    shell.position = 'relative';
  }
  if (shell) {
    shell.overflow = 'hidden';
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
    createElement(
      ScrollPort,
      {
        overflowX: widget.scrollX === false ? 'hidden' : 'auto',
        overflowY: widget.scrollY === false ? 'hidden' : 'auto',
      },
      widget.children.map((child) => ctx.render(child)),
    ),
  );
}
