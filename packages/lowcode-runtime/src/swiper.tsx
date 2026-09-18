import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import type { PageWidget, SwiperEasing, SwiperStyle, WidgetStyle } from '@vanstack/xml';

const DEFAULT_INDICATOR_COLOR = 'rgba(0, 0, 0, 0.3)';
const DEFAULT_INDICATOR_ACTIVE_COLOR = '#000000';
const DEFAULT_INTERVAL = 5000;
const DEFAULT_DURATION = 500;
const SWIPE_THRESHOLD = 40;

function easingCss(value: SwiperEasing | undefined): string {
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

function perViewOf(style: SwiperStyle | undefined, count: number): number {
  const requested = style?.displayMultipleItems ?? 1;
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

export function SwiperView({
  widget,
  editing,
  style,
  itemCss,
  renderChild,
  onMouseEnter,
  onMouseLeave,
  itemHover,
}: {
  widget: Extract<PageWidget, { type: 'swiper' }>;
  editing: boolean;
  style?: CSSProperties;
  itemCss: (style: WidgetStyle | undefined) => CSSProperties | undefined;
  renderChild: (child: PageWidget) => ReactElement;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  itemHover?: (item: Extract<PageWidget, { type: 'swiper-item' }>) =>
    | { onMouseEnter: () => void; onMouseLeave: () => void }
    | undefined;
}): ReactElement {
  const items = widget.children.filter(isSwiperItem);
  const swiper = widget.swiper;
  const count = items.length;
  const vertical = Boolean(swiper?.vertical);
  const circular = Boolean(swiper?.circular);
  const snapToEdge = Boolean(swiper?.snapToEdge);
  const perView = perViewOf(swiper, count);
  const duration = swiper?.duration ?? DEFAULT_DURATION;
  const interval = swiper?.interval ?? DEFAULT_INTERVAL;
  const previousMargin = swiper?.previousMargin ?? 0;
  const nextMargin = swiper?.nextMargin ?? 0;

  const [index, setIndex] = useState(() =>
    clampSwiperIndex(swiper?.current ?? 0, count, perView, circular, snapToEdge),
  );
  const [drag, setDrag] = useState(0);
  const [animating, setAnimating] = useState(true);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(clampSwiperIndex(swiper?.current ?? 0, count, perView, circular, snapToEdge));
    setDrag(0);
  }, [swiper?.current, count, perView, circular, snapToEdge]);

  useEffect(() => {
    if (editing || !swiper?.autoplay || count < 2) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setAnimating(true);
      setIndex((current) => clampSwiperIndex(current + 1, count, perView, circular, snapToEdge));
    }, interval);
    return () => window.clearInterval(timer);
  }, [editing, swiper?.autoplay, count, perView, circular, snapToEdge, interval]);

  function goTo(next: number, withAnimation = true) {
    setAnimating(withAnimation);
    setDrag(0);
    setIndex(clampSwiperIndex(next, count, perView, circular, snapToEdge));
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

  const viewportStyle: CSSProperties = editing
    ? { overflow: 'visible', flex: 1, minHeight: 0, width: '100%', height: '100%' }
    : {
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        ...(vertical
          ? { paddingTop: previousMargin, paddingBottom: nextMargin }
          : { paddingLeft: previousMargin, paddingRight: nextMargin }),
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
    minWidth: 0,
    minHeight: 0,
    width: vertical ? '100%' : undefined,
    height: '100%',
  };

  const showDots = !editing && Boolean(swiper?.indicatorDots) && count > 0;
  const hasExplicitHeight = Boolean(style?.height) && style?.height !== 'fit-content';

  return createElement(
    'div',
    {
      ref: rootRef,
      className: ['lowcode-swiper', editing ? 'is-editing' : undefined].filter(Boolean).join(' '),
      'data-widget-id': widget.id,
      'data-widget-type': 'swiper',
      'data-swiper-index': String(index),
      'data-swiper-vertical': vertical ? 'true' : 'false',
      onMouseEnter,
      onMouseLeave,
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: editing ? 'visible' : 'hidden',
        width: '100%',
        ...(hasExplicitHeight ? {} : { height: 150 }),
        ...style,
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
              key: item.id,
              className: 'lowcode-swiper-item',
              style: slotStyle,
            },
            createElement(
              'div',
              {
                className: 'lowcode-swiper-item-body',
                'data-widget-id': item.id,
                'data-widget-type': 'swiper-item',
                onMouseEnter: itemHover?.(item)?.onMouseEnter,
                onMouseLeave: itemHover?.(item)?.onMouseLeave,
                style: {
                  boxSizing: 'border-box',
                  ...itemCss(item.style),
                  width: '100%',
                  height: '100%',
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
              key: item.id,
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
