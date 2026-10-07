import { createElement, useEffect, useLayoutEffect, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import {
  DEFAULT_DRAWER_MASK,
  DEFAULT_DRAWER_PLACE,
  DEFAULT_DRAWER_SIZE,
  type PageVariable,
  type PageWidget,
} from '@vanstack/xml';
import { hiddenCss, mergeCss, presenceCss, sizeCss, widgetClassName } from '../css';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

function layoutRight(node: HTMLElement, page: HTMLElement): number {
  let left = 0;
  let current: HTMLElement | null = node;
  while (current && current !== page) {
    left += current.offsetLeft;
    const parent = current.offsetParent as HTMLElement | null;
    if (!parent || (parent !== page && !page.contains(parent))) {
      return 0;
    }
    if (parent === page) {
      return left + node.offsetWidth;
    }
    current = parent;
  }
  return 0;
}

/** 编辑态抽屉要让开的宽度：多窗口溢出到页面右边的距离。列宽跟页面一样。 */
export function drawerRailMetrics(page: HTMLElement): { tail: number; column: number } {
  const column = page.offsetWidth;
  if (column <= 0) {
    return { tail: 0, column: 0 };
  }
  const pageRect = page.getBoundingClientRect();
  const scale = pageRect.width > 0 ? pageRect.width / column : 1;
  let rightEdge = column;
  page.querySelectorAll<HTMLElement>('.lowcode-windows, .lowcode-windows-slot.is-offset').forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const visualRight = (rect.right - pageRect.left) / scale;
      if (visualRight > rightEdge) {
        rightEdge = visualRight;
      }
    }
    const offsetRight = layoutRight(node, page);
    if (offsetRight > rightEdge) {
      rightEdge = offsetRight;
    }
  });
  return { tail: Math.max(0, Math.ceil(rightEdge - column)), column };
}

function percent(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(100, Math.max(0, value));
}

function panelMain(widget: Extract<PageWidget, { type: 'drawer' }>): string {
  const place = widget.place ?? DEFAULT_DRAWER_PLACE;
  const axis = place === 'left' || place === 'right' ? widget.style?.width : widget.style?.height;
  const css = sizeCss(axis);
  if (css !== 'fit-content') {
    return css;
  }
  return `${percent(widget.size, DEFAULT_DRAWER_SIZE)}%`;
}

const DRAWER_MOTION = '300ms cubic-bezier(0.2, 0, 0, 1)';

function motionReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function closedShift(place: string): string {
  if (place === 'top') {
    return 'translate3d(0, -100%, 0)';
  }
  if (place === 'left') {
    return 'translate3d(-100%, 0, 0)';
  }
  if (place === 'right') {
    return 'translate3d(100%, 0, 0)';
  }
  return 'translate3d(0, 100%, 0)';
}

function DrawerMotion({
  widget,
  ctx,
  mask,
  state,
  children,
}: {
  widget: Extract<PageWidget, { type: 'drawer' }>;
  ctx: WidgetRenderContext;
  mask: number;
  state: string | undefined;
  children: ReactNode;
}) {
  const open = Boolean(ctx.drawerOpen);
  const [phase, setPhase] = useState<'off' | 'closed' | 'open'>('off');
  const place = widget.place ?? DEFAULT_DRAWER_PLACE;
  const hover = ctx.hoverFor(widget);
  const shown = phase === 'open';

  useLayoutEffect(() => {
    if (open) {
      setPhase((current) => (current === 'open' ? 'open' : 'closed'));
      return;
    }
    setPhase((current) => (current === 'off' ? 'off' : 'closed'));
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'closed') {
      return;
    }
    if (motionReduced()) {
      setPhase('open');
      return;
    }
    const frame = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(frame);
  }, [open, phase]);

  useEffect(() => {
    if (open || phase !== 'closed') {
      return;
    }
    if (motionReduced()) {
      setPhase('off');
      return;
    }
    const timer = window.setTimeout(() => setPhase('off'), 360);
    return () => window.clearTimeout(timer);
  }, [open, phase]);

  if (phase === 'off') {
    return null;
  }

  return createElement(
    'div',
    {
      className: shown ? 'lowcode-drawer is-open' : 'lowcode-drawer is-closed',
      'data-widget-id': widget.id,
      'data-widget-type': 'drawer',
      'data-state': state,
      style: mergeCss(
        { position: 'absolute', inset: 0, zIndex: 30, overflow: 'hidden' },
        hiddenCss(widget.hidden, false),
        presenceCss(widget, widgetCssOptions(ctx)),
      ),
      onMouseEnter: hover?.onMouseEnter,
      onMouseLeave: hover?.onMouseLeave,
    },
    createElement('div', {
      className: 'lowcode-drawer-mask',
      style: {
        position: 'absolute',
        inset: 0,
        background: `rgba(0, 0, 0, ${mask})`,
        opacity: shown ? 1 : 0,
        transition: motionReduced() ? 'none' : `opacity ${DRAWER_MOTION}`,
      },
      onClick: (event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        if (shown && widget.maskClose !== false) {
          ctx.hideDrawer?.();
        }
      },
    }),
    createElement(
      'div',
      {
        className: `lowcode-drawer-panel ${widgetClassName(widget.id)}`,
        'data-state': state,
        style: {
          ...panelBox(widget),
          transform: shown ? 'translate3d(0, 0, 0)' : closedShift(place),
          transition: motionReduced() ? 'none' : `transform ${DRAWER_MOTION}`,
        },
        onTransitionEnd: (event: { target: EventTarget | null; currentTarget: EventTarget | null; propertyName: string }) => {
          if (open || event.propertyName !== 'transform' || event.target !== event.currentTarget) {
            return;
          }
          setPhase('off');
        },
        onClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
      },
      children,
    ),
  );
}

function panelBox(widget: Extract<PageWidget, { type: 'drawer' }>): CSSProperties {
  const place = widget.place ?? DEFAULT_DRAWER_PLACE;
  const main = panelMain(widget);
  const box: CSSProperties = {
    position: 'absolute',
    zIndex: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    overflow: 'auto',
  };
  if (place === 'left' || place === 'right') {
    return { ...box, top: 0, bottom: 0, height: '100%', width: main, [place]: 0 };
  }
  return { ...box, left: 0, right: 0, width: '100%', height: main, [place]: 0 };
}

function walkWidgets(widgets: PageWidget[], visit: (widget: PageWidget) => void) {
  for (const widget of widgets) {
    visit(widget);
    if ('children' in widget) {
      walkWidgets(widget.children, visit);
    }
  }
}

/** 数据池里指向抽屉的控件变量，变成带 show / hide 的实例。 */
export function bindDrawerHandles(
  data: Record<string, unknown>,
  variables: PageVariable[] | undefined,
  widgets: PageWidget[],
  call: (id: string, method: 'show' | 'hide') => void,
) {
  const drawers = new Set<string>();
  walkWidgets(widgets, (widget) => {
    if (widget.type === 'drawer') {
      drawers.add(widget.id);
    }
  });
  for (const variable of variables ?? []) {
    if (variable.type !== 'widget' || !variable.name) {
      continue;
    }
    const current = data[variable.name];
    const id = typeof current === 'string' && current ? current : variable.value.trim();
    if (!id || !drawers.has(id)) {
      continue;
    }
    data[variable.name] = {
      show() {
        call(id, 'show');
      },
      hide() {
        call(id, 'hide');
      },
    };
  }
}

export function renderDrawer(
  widget: Extract<PageWidget, { type: 'drawer' }>,
  ctx: WidgetRenderContext,
): ReactElement | null {
  const mask = percent(widget.mask, DEFAULT_DRAWER_MASK) / 100;
  const options = widgetCssOptions(ctx);
  const children = widget.children.map((child) => ctx.render(child));
  const state = widgetStateAttr(widget, ctx);
  const hover = ctx.hoverFor(widget);

  if (ctx.editing) {
    const place = widget.place ?? DEFAULT_DRAWER_PLACE;
    const index = ctx.drawerBoardIndex;
    const column = ctx.drawerBoardColumn ?? 0;
    const stage =
      index == null
        ? { position: 'relative' as const, width: '100%', minHeight: 120 }
        : {
            position: 'relative' as const,
            left: 'auto',
            top: 'auto',
            right: 'auto',
            bottom: 'auto',
            flex: '0 0 auto',
            width: column > 0 ? column : '100%',
            maxWidth: 'none',
            height: '100%',
            boxSizing: 'border-box' as const,
            overflow: 'hidden' as const,
            pointerEvents: 'auto' as const,
            zIndex: 1,
          };
    return createElement(
      'div',
      {
        key: ctx.instanceKey,
        className: 'lowcode-drawer-board',
        'data-widget-id': widget.id,
        'data-widget-type': 'drawer',
        'data-drawer-place': place,
        'data-state': state,
        style: mergeCss(stage, hiddenCss(widget.hidden, true), presenceCss(widget, options)),
        onMouseEnter: hover?.onMouseEnter,
        onMouseLeave: hover?.onMouseLeave,
      },
      createElement('div', {
        className: 'lowcode-drawer-mask',
        style: {
          position: 'absolute',
          inset: 0,
          background: `rgba(0, 0, 0, ${mask})`,
          pointerEvents: 'none',
        },
      }),
      createElement(
        'div',
        {
          className: `lowcode-drawer-panel ${widgetClassName(widget.id)}`,
          'data-drawer-panel': '',
          style: panelBox(widget),
        },
        children,
      ),
    );
  }

  return createElement(DrawerMotion, {
    key: ctx.instanceKey,
    widget,
    ctx,
    mask,
    state,
    children,
  });
}
