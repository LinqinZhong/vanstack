import { createElement, useEffect, useState, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, widgetClassName } from '../css';
import { resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

function brokenImageIcon() {
  return createElement(
    'svg',
    {
      viewBox: '0 0 48 48',
      width: '32',
      height: '32',
      fill: 'none',
      'aria-hidden': true,
    },
    createElement('rect', { x: '6', y: '8', width: '36', height: '28', rx: '3', stroke: 'currentColor', strokeWidth: '2' }),
    createElement('circle', { cx: '16', cy: '17', r: '2.5', fill: 'currentColor' }),
    createElement('path', { d: 'M8 30l9-8 6 5 5-4 12 9', stroke: 'currentColor', strokeWidth: '2', strokeLinejoin: 'round' }),
    createElement('path', { d: 'M18 6l12 36', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' }),
  );
}

function ImageFace({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) {
    return createElement(
      'span',
      {
        className: 'lowcode-image-fallback',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#f2f3f5',
          color: '#c4c6cc',
        },
      },
      brokenImageIcon(),
    );
  }
  return createElement('img', {
    src,
    alt: '',
    draggable: false,
    onError: () => setFailed(true),
  });
}

export function renderImage(
  widget: Extract<PageWidget, { type: 'image' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'span',
    {
      key: ctx.instanceKey,
      className: `lowcode-image ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'image',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
        flexItemCss(widget.item, widgetCssOptions(ctx)),
        { overflow: 'hidden' },
        hiddenCss(widget.hidden, ctx.editing),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    createElement(ImageFace, { src: resolveWidgetCopy(widget.src, ctx) }),
  );
}
