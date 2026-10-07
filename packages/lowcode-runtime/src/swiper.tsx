import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import {
  isCopyBinding,
  resolveCopyBinding,
  SWIPER_EASINGS,
  readPresenceFlag,
  type PageWidget,
  type SwiperEasing,
  type SwiperStyle,
  type WidgetStyle,
} from '@vanstack/xml';
import { widgetInstanceKey, widgetInstanceMeta } from './loop';
import type { WidgetRenderContext } from './widget-render';
import { chainEventProps } from './events';

const DEFAULT_INDICATOR_COLOR = 'rgba(0, 0, 0, 0.3)';
const DEFAULT_INDICATOR_ACTIVE_COLOR = '#000000';
const DEFAULT_INTERVAL = 5000;
const DEFAULT_DURATION = 500;
const SWIPE_THRESHOLD = 40;

export function resolveSwiperStyle(style: SwiperStyle | undefined, ctx: WidgetRenderContext): SwiperStyle | undefined {
  if (!style || !ctx.evaluateBindings) {
    return style;
  }
  const read = (value: string) => resolveCopyBinding(value, ctx.bindingScope);
  const num = (value: number | string | undefined) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value !== 'string' || !isCopyBinding(value)) {
      return undefined;
    }
    const parsed = Number(read(value));
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const flag = (value: boolean | string | undefined) => {
    if (value === true || value === false) {
      return value;
    }
    if (typeof value !== 'string' || !isCopyBinding(value)) {
      return undefined;
    }
    const resolved = read(value);
    if (resolved === 'true' || resolved === '1') {
      return true;
    }
    if (resolved === 'false' || resolved === '0') {
      return false;
    }
    return undefined;
  };
  const color = (value: string | undefined) => (!value || !isCopyBinding(value) ? value : read(value) || undefined);
  const easingRaw = style.easingFunction;
  let easingFunction: SwiperEasing | undefined;
  if (typeof easingRaw === 'string' && isCopyBinding(easingRaw)) {
    const resolved = read(easingRaw);
    easingFunction = (SWIPER_EASINGS as readonly string[]).includes(resolved) ? (resolved as SwiperEasing) : undefined;
  } else if (typeof easingRaw === 'string') {
    easingFunction = (SWIPER_EASINGS as readonly string[]).includes(easingRaw) ? (easingRaw as SwiperEasing) : undefined;
  }
  return {
    ...style,
    indicatorDots: flag(style.indicatorDots),
    indicatorColor: color(style.indicatorColor),
    indicatorActiveColor: color(style.indicatorActiveColor),
    autoplay: flag(style.autoplay),
    current: num(style.current),
    interval: num(style.interval),
    duration: num(style.duration),
    circular: flag(style.circular),
    vertical: flag(style.vertical),
    previousMargin: num(style.previousMargin),
    nextMargin: num(style.nextMargin),
    displayMultipleItems: num(style.displayMultipleItems),
    snapToEdge: flag(style.snapToEdge),
    easingFunction,
  };
}

function easingCss(value: string | undefined): string {
  switch (value) {
    case 'linear':
      return 'linear';
    case 'easeInCubic':
      return 'cubic-bezier(0.32, 0, 0.67, 0)';
    case 'easeOutCubic':
      return 'cubic-bezier(0.33, 1, 0.68, 1)';
    case 'easeInOutCubic':
      return 'cubic-bezier(0.65, 0, 0.35, 1)';
    default:
      return 'ease';
  }
}

function swiperNumber(value: number | string | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function perViewOf(style: SwiperStyle | undefined, count: number): number {
  const requested = swiperNumber(style?.displayMultipleItems, 1);
  if (count <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(requested, count));
}

export function clampSwiperIndex(
  index: number,
  count: number,
  perView: number,
  circular: boolean,
  snapToEdge: boolean,
): number {
  if (count <= 0) {
    return 0;
  }
  if (circular && count >= 2) {
    return ((index % count) + count) % count;
  }
  const maxIndex = snapToEdge ? Math.max(0, count - perView) : count - 1;
  return Math.min(Math.max(index, 0), maxIndex);
}

function isSwiperItem(widget: PageWidget): widget is Extract<PageWidget, { type: 'swiper-item' }> {
  return widget.type === 'swiper-item';
}

function itemPresenceStyle(item: Extract<PageWidget, { type: 'swiper-item' }>, active: boolean): CSSProperties | undefined {
  if (!active) {
    return undefined;
  }
  const scope = widgetInstanceMeta(item)?.scope ?? { data: Object.create(null) as Record<string, unknown> };
  const css: CSSProperties = {};
  if (!readPresenceFlag(item.displayFn, scope)) {
    css.display = 'none';
  }
  if (!readPresenceFlag(item.visibleFn, scope)) {
    css.visibility = 'hidden';
  }
  return Object.keys(css).length > 0 ? css : undefined;
}

export function SwiperView({
  widget,
  editing,
  resolvePresence = !editing,
  style,
  className,
  dataState,
  itemClassName,
  itemDataState,
  itemCss,
  renderChild,
  onMouseEnter,
  onMouseLeave,
  itemHover,
  eventHandlers,
  onIndexChange,
}: {
  widget: Extract<PageWidget, { type: 'swiper' }>;
  editing: boolean;
  resolvePresence?: boolean;
  style?: CSSProperties;
  className?: string;
  dataState?: string;
  itemClassName?: (item: Extract<PageWidget, { type: 'swiper-item' }>) => string;
  itemDataState?: (item: Extract<PageWidget, { type: 'swiper-item' }>) => string | undefined;
  itemCss: (style: WidgetStyle | undefined) => CSSProperties | undefined;
  renderChild: (child: PageWidget) => ReactElement | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  itemHover?: (item: Extract<PageWidget, { type: 'swiper-item' }>) =>
    | { onMouseEnter: () => void; onMouseLeave: () => void }
    | undefined;
  eventHandlers?: Record<string, (...args: unknown[]) => void>;
  onIndexChange?: (index: number, oldIndex: number) => void;
}): ReactElement {
  const items = widget.children.filter(isSwiperItem).filter((item) => {
    if (!resolvePresence) {
      return true;
    }
    const scope = widgetInstanceMeta(item)?.scope ?? { data: Object.create(null) as Record<string, unknown> };
    return readPresenceFlag(item.existsFn, scope);
  });
  const swiper = widget.swiper;
  const count = items.length;
  const vertical = swiper?.vertical === true;
  const circular = swiper?.circular === true;
  const snapToEdge = swiper?.snapToEdge === true;
  const perView = perViewOf(swiper, count);
  const duration = swiperNumber(swiper?.duration, DEFAULT_DURATION);
  const interval = swiperNumber(swiper?.interval, DEFAULT_INTERVAL);
  const previousMargin = swiperNumber(swiper?.previousMargin, 0);
  const nextMargin = swiperNumber(swiper?.nextMargin, 0);

  const [index, setIndex] = useState(() =>
    clampSwiperIndex(swiperNumber(swiper?.current, 0), count, perView, circular, snapToEdge),
  );
  const [drag, setDrag] = useState(0);
  const [animating, setAnimating] = useState(true);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(clampSwiperIndex(swiperNumber(swiper?.current, 0), count, perView, circular, snapToEdge));
    setDrag(0);
  }, [swiper?.current, count, perView, circular, snapToEdge]);

  useEffect(() => {
    if (editing || swiper?.autoplay !== true || count < 2) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setAnimating(true);
      setIndex((current) => {
        const next = clampSwiperIndex(current + 1, count, perView, circular, snapToEdge);
        if (!editing && next !== current) {
          onIndexChangeRef.current?.(next, current);
        }
        return next;
      });
    }, interval);
    return () => window.clearInterval(timer);
  }, [editing, swiper?.autoplay, count, perView, circular, snapToEdge, interval]);

  function goTo(next: number, withAnimation = true) {
    setAnimating(withAnimation);
    setDrag(0);
    const clamped = clampSwiperIndex(next, count, perView, circular, snapToEdge);
    setIndex((current) => {
      if (!editing && clamped !== current) {
        onIndexChangeRef.current?.(clamped, current);
      }
      return clamped;
    });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (editing || event.button !== 0 || count < 2) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = { x: event.clientX, y: event.clientY };
    setAnimating(false);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) {
      return;
    }
    const delta = vertical ? event.clientY - startRef.current.y : event.clientX - startRef.current.x;
    setDrag(delta);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) {
      return;
    }
    const delta = vertical ? event.clientY - startRef.current.y : event.clientX - startRef.current.x;
    startRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      goTo(index + (delta < 0 ? 1 : -1));
      return;
    }
    goTo(index);
  }

  const percent = count === 0 ? 0 : (100 / perView) * index;
  const translate = vertical
    ? `translate3d(0, calc(${-percent}% + ${drag}px), 0)`
    : `translate3d(calc(${-percent}% + ${drag}px), 0, 0)`;

  const viewportStyle: CSSProperties = {
    overflow: editing ? 'visible' : 'hidden',
    flex: 1,
    minHeight: 0,
    width: '100%',
    height: '100%',
    ...(editing
      ? {}
      : {
          boxSizing: 'border-box',
          ...(vertical
            ? { paddingTop: previousMargin, paddingBottom: nextMargin }
            : { paddingLeft: previousMargin, paddingRight: nextMargin }),
        }),
  };

  const trackStyle: CSSProperties = {
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    transform: editing ? 'none' : translate,
    transition: editing || !animating ? 'none' : `transform ${duration}ms ${easingCss(swiper?.easingFunction)}`,
  };

  const slotStyle: CSSProperties = {
    flex: `0 0 ${editing ? 100 : 100 / perView}%`,
    boxSizing: 'border-box',
    minWidth: editing ? undefined : 0,
    minHeight: editing ? undefined : 0,
    width: vertical ? '100%' : undefined,
    height: '100%',
    overflow: editing ? 'visible' : 'hidden',
  };

  const showDots = !editing && swiper?.indicatorDots === true && count > 0;
  const hasExplicitHeight = Boolean(style?.height) && style?.height !== 'fit-content';

  return createElement(
    'div',
    {
      ref: rootRef,
      className: ['lowcode-swiper', className, editing ? 'is-editing' : undefined].filter(Boolean).join(' '),
      'data-widget-id': widget.id,
      'data-widget-type': 'swiper',
      'data-swiper-index': String(index),
      'data-swiper-vertical': vertical ? 'true' : 'false',
      'data-state': dataState,
      ...chainEventProps(
        {
          onMouseEnter,
          onMouseLeave,
        },
        eventHandlers,
      ),
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        width: '100%',
        ...(hasExplicitHeight ? {} : { height: 150 }),
        ...style,
        overflow: editing ? 'visible' : 'hidden',
      },
    },
    createElement(
      'div',
      {
        ref: viewportRef,
        className: 'lowcode-swiper-viewport',
        style: viewportStyle,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
      },
      createElement(
        'div',
        { className: 'lowcode-swiper-track', style: trackStyle },
        items.map((item) =>
          createElement(
            'div',
            {
              key: widgetInstanceKey(item),
              className: 'lowcode-swiper-item',
              style: { ...slotStyle, ...itemPresenceStyle(item, resolvePresence) },
            },
            createElement(
              'div',
              {
                className: ['lowcode-swiper-item-body', itemClassName?.(item)].filter(Boolean).join(' '),
                'data-widget-id': item.id,
                'data-widget-type': 'swiper-item',
                'data-state': itemDataState?.(item),
                onMouseEnter: itemHover?.(item)?.onMouseEnter,
                onMouseLeave: itemHover?.(item)?.onMouseLeave,
                style: {
                  boxSizing: 'border-box',
                  ...itemCss(item.style),
                  width: '100%',
                  height: '100%',
                  overflow: editing ? 'visible' : 'hidden',
                  ...(editing && item.hidden ? { visibility: 'hidden' as const } : {}),
                },
              },
              item.children.map((child) => renderChild(child)),
            ),
          ),
        ),
      ),
    ),
    showDots
      ? createElement(
          'div',
          {
            className: 'lowcode-swiper-dots',
            style: {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: vertical ? undefined : 8,
              top: vertical ? 8 : undefined,
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              pointerEvents: 'none',
            },
          },
          items.map((item, dotIndex) =>
            createElement('span', {
              key: widgetInstanceKey(item),
              className: 'lowcode-swiper-dot',
              'data-active': dotIndex === index ? 'true' : 'false',
              style: {
                width: 6,
                height: 6,
                borderRadius: '50%',
                background:
                  dotIndex === index
                    ? (swiper?.indicatorActiveColor ?? DEFAULT_INDICATOR_ACTIVE_COLOR)
                    : (swiper?.indicatorColor ?? DEFAULT_INDICATOR_COLOR),
              },
            }),
          ),
        )
      : null,
  );
}
