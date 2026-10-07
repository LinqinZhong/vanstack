import {
  angleCss,
  boxLengthCss,
  compactSize,
  compactWidgetStyle,
  type BoxLength,
  type ComponentEmit,
  type ComponentProp,
  type PageMethod,
  type PageStyle,
  type PageTestData,
  type PageVariable,
  type PageWidget,
  type WidgetEvents,
  type WidgetStyle,
} from '@vanstack/xml';
import { isBoxDragKind, type BoxDragKind, type SpacingEdge } from '../../utils/spacingDrag';
import type { BoxQuad } from '../../components/StyleBoxEdges';
import type { BoxGroup } from '../../components/WidgetStyleBubble';
import { widgetTypeName } from '../../utils/widgetTree';

export function widgetCanvasLabel(widget: PageWidget, t: (key: string) => string) {
  return `${widgetTypeName(widget.type, t)}(${widget.id})`;
}

export const KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
export const SCREEN_WIDTH = 375;
export const SCREEN_HEIGHT = 667;
export const HISTORY_LIMIT = 100;

export type HistoryEntry = {
  widgets: PageWidget[];
  pageStyle?: PageStyle;
  pageData: PageVariable[];
  pageEvents?: WidgetEvents;
  pageMethods: PageMethod[];
  componentProps: ComponentProp[];
  pageQuery: ComponentProp[];
  componentEmits: ComponentEmit[];
  testData?: PageTestData;
  selectedWidgetId: string | null;
};
export type CenterTab = 'layout' | 'data' | 'events' | 'methods';
const FIT_PADDING_X = 32;
const FIT_PADDING_TOP = 24;
const FIT_PADDING_BOTTOM = 64;
export const FOCUS_PADDING = 48;
export const CANVAS_RASTER_SCALE = 2;
export const EDIT_OVERFLOW_X = 4;
export const EDIT_OVERFLOW_Y = 2;
const MIN_SCALE = 0.1;
export const MAX_SCALE = 5;
export const ZOOM_STEP = 1.15;
export const ZOOM_IDLE_MS = 80;
export const ENTER_DOUBLE_MS = 300;

export type CanvasMode = 'edit' | 'preview';
export type SaveStatus = 'saved' | 'saving' | 'unsaved';
export type ViewTransform = { x: number; y: number; scale: number };

export function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function snapDevicePixel(value: number) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

function cameraTransform(view: ViewTransform, hasEditOverflow: boolean) {
  const shiftX = hasEditOverflow ? SCREEN_WIDTH * (EDIT_OVERFLOW_X / 2) * view.scale : 0;
  const shiftY = hasEditOverflow ? SCREEN_HEIGHT * (EDIT_OVERFLOW_Y / 2) * view.scale : 0;
  return `translate3d(${view.x - shiftX}px, ${view.y - shiftY}px, 0) scale(${view.scale / CANVAS_RASTER_SCALE})`;
}

export function paintCanvasView(
  iframe: HTMLIFrameElement | null,
  frame: HTMLDivElement | null,
  view: ViewTransform,
  hasEditOverflow: boolean,
  framePin: { x: number; y: number } = { x: 0, y: 0 },
) {
  const camera = iframe?.contentDocument?.querySelector<HTMLElement>('.preview-camera');
  if (camera) {
    camera.style.transform = cameraTransform(view, hasEditOverflow);
  }
  if (frame) {
    frame.style.transform = `translate3d(${view.x + framePin.x}px, ${view.y + framePin.y}px, 0)`;
    frame.style.width = `${snapDevicePixel(SCREEN_WIDTH * view.scale)}px`;
    frame.style.height = `${snapDevicePixel(SCREEN_HEIGHT * view.scale)}px`;
  }
}

export function computeFitView(stageWidth: number, stageHeight: number, screenWidth: number): ViewTransform {
  const availableWidth = Math.max(1, stageWidth - FIT_PADDING_X * 2);
  const availableHeight = Math.max(1, stageHeight - FIT_PADDING_TOP - FIT_PADDING_BOTTOM);
  const scale = clampScale(Math.min(availableWidth / screenWidth, availableHeight / SCREEN_HEIGHT));
  return {
    scale,
    x: FIT_PADDING_X + (availableWidth - screenWidth * scale) / 2,
    y: FIT_PADDING_TOP + (availableHeight - SCREEN_HEIGHT * scale) / 2,
  };
}

export function mapIframePoint(iframe: HTMLIFrameElement | null, localX: number, localY: number) {
  if (!iframe) {
    return { x: localX, y: localY };
  }
  const rect = iframe.getBoundingClientRect();
  const width = iframe.clientWidth || 1;
  const height = iframe.clientHeight || 1;
  return {
    x: rect.left + (localX / width) * rect.width,
    y: rect.top + (localY / height) * rect.height,
  };
}

export function iframePointToClient(
  localX: number,
  localY: number,
  _view: ViewTransform,
  stageRect: DOMRect,
  _hasEditOverflow: boolean,
) {
  return {
    x: stageRect.left + localX,
    y: stageRect.top + localY,
  };
}

export function zoomViewAt(
  view: ViewTransform,
  stageLeft: number,
  stageTop: number,
  clientX: number,
  clientY: number,
  factor: number,
): ViewTransform {
  const nextScale = clampScale(view.scale * factor);
  const cx = clientX - stageLeft;
  const cy = clientY - stageTop;
  const wx = (cx - view.x) / Math.max(view.scale, 0.01);
  const wy = (cy - view.y) / Math.max(view.scale, 0.01);
  return {
    scale: nextScale,
    x: cx - wx * nextScale,
    y: cy - wy * nextScale,
  };
}

export function sizeLock(edge?: SpacingEdge | null, mirror = false): { width: boolean; height: boolean } {
  if (mirror) {
    return { width: true, height: true };
  }
  return {
    width: edge === 'left' || edge === 'right',
    height: edge === 'top' || edge === 'bottom',
  };
}

function sizeAxisValue(
  size: WidgetStyle['width'],
  measured: number | undefined,
  lock: boolean,
): number | undefined {
  if (!lock) {
    return undefined;
  }
  if (typeof size === 'object' && size.mode === 'px') {
    return size.value;
  }
  return measured ?? 0;
}

export function dragLengthPx(length?: BoxLength | string): number | undefined {
  return typeof length === 'object' && length.mode === 'px' ? length.value : undefined;
}

function pxBoxLength(value?: number | string): BoxLength | string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return value == null ? undefined : { mode: 'px', value };
}

export function styleBoxQuad(
  style: WidgetStyle | undefined,
  kind: BoxDragKind,
  measured?: { width: number; height: number } | null,
  lock?: { width?: boolean; height?: boolean },
): BoxQuad {
  if (kind === 'margin') {
    return {
      top: dragLengthPx(style?.marginTop),
      right: dragLengthPx(style?.marginRight),
      bottom: dragLengthPx(style?.marginBottom),
      left: dragLengthPx(style?.marginLeft),
    };
  }
  if (kind === 'radius') {
    return {
      top: style?.radiusTopLeft,
      right: style?.radiusTopRight,
      bottom: style?.radiusBottomRight,
      left: style?.radiusBottomLeft,
    };
  }
  if (kind === 'size') {
    const width = sizeAxisValue(style?.width, measured?.width, Boolean(lock?.width));
    const height = sizeAxisValue(style?.height, measured?.height, Boolean(lock?.height));
    return { top: height, right: width, bottom: height, left: width };
  }
  if (kind === 'position') {
    return {
      top: dragLengthPx(style?.top),
      right: dragLengthPx(style?.right),
      bottom: dragLengthPx(style?.bottom),
      left: dragLengthPx(style?.left),
    };
  }
  return {
    top: dragLengthPx(style?.paddingTop),
    right: dragLengthPx(style?.paddingRight),
    bottom: dragLengthPx(style?.paddingBottom),
    left: dragLengthPx(style?.paddingLeft),
  };
}

function keepOrPx(current: BoxLength | string | undefined, px: number | string | undefined): BoxLength | string | undefined {
  if (typeof px === 'number') {
    return { mode: 'px', value: px };
  }
  if (typeof current === 'string') {
    return current;
  }
  if (current?.mode === 'auto' || current?.mode === '%') {
    return current;
  }
  return undefined;
}

export function isAutoLength(length?: BoxLength | string) {
  return typeof length === 'object' && length.mode === 'auto';
}

export function edgeBoxLength(style: WidgetStyle | undefined, kind: BoxDragKind, edge: SpacingEdge) {
  if (kind === 'position') {
    return style?.[edge];
  }
  if (kind === 'margin') {
    const keys = {
      top: 'marginTop',
      right: 'marginRight',
      bottom: 'marginBottom',
      left: 'marginLeft',
    } as const;
    return style?.[keys[edge]];
  }
  return undefined;
}

export function styleFromBoxQuad(
  style: WidgetStyle | undefined,
  kind: BoxDragKind,
  quad: BoxQuad,
): WidgetStyle | undefined {
  if (kind === 'margin') {
    return compactWidgetStyle({
      ...style,
      marginTop: keepOrPx(style?.marginTop, quad.top),
      marginRight: keepOrPx(style?.marginRight, quad.right),
      marginBottom: keepOrPx(style?.marginBottom, quad.bottom),
      marginLeft: keepOrPx(style?.marginLeft, quad.left),
    });
  }
  if (kind === 'radius') {
    return compactWidgetStyle({
      ...style,
      radiusTopLeft: quad.top,
      radiusTopRight: quad.right,
      radiusBottomRight: quad.bottom,
      radiusBottomLeft: quad.left,
    });
  }
  if (kind === 'size') {
    const width = typeof quad.right === 'number' ? quad.right : typeof quad.left === 'number' ? quad.left : undefined;
    const height = typeof quad.top === 'number' ? quad.top : typeof quad.bottom === 'number' ? quad.bottom : undefined;
    return compactWidgetStyle({
      ...style,
      width: width != null ? compactSize({ mode: 'px', value: Math.max(0, width) }) : style?.width,
      height: height != null ? compactSize({ mode: 'px', value: Math.max(0, height) }) : style?.height,
    });
  }
  if (kind === 'position') {
    return compactWidgetStyle({
      ...style,
      top: keepOrPx(style?.top, quad.top),
      right: keepOrPx(style?.right, quad.right),
      bottom: keepOrPx(style?.bottom, quad.bottom),
      left: keepOrPx(style?.left, quad.left),
    });
  }
  return compactWidgetStyle({
    ...style,
    paddingTop: pxBoxLength(quad.top),
    paddingRight: pxBoxLength(quad.right),
    paddingBottom: pxBoxLength(quad.bottom),
    paddingLeft: pxBoxLength(quad.left),
  });
}

export function isBoxDragGroup(group: BoxGroup | null): group is BoxDragKind {
  return isBoxDragKind(group);
}

export function isSpacingNudgeGroup(group: BoxGroup | null): group is BoxDragKind | 'border' {
  return isBoxDragKind(group) || group === 'border';
}

export function spacingAllowsNegative(kind: BoxDragKind | 'border') {
  return kind === 'margin' || kind === 'position';
}

export function canEditPositionInsets(style?: WidgetStyle) {
  return Boolean(style?.position);
}

function isStyleToolbarPopupOpen() {
  return Boolean(
    document.querySelector(
      '[data-toolbar-popup], .ant-popover:not(.ant-popover-hidden) .ant-color-picker-inner, .ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    ),
  );
}

export function closeStyleToolbarPopups() {
  const open = isStyleToolbarPopupOpen();
  document.querySelectorAll('[data-toolbar-popup]').forEach((node) => {
    node.dispatchEvent(new Event('vanstack-close-toolbar-popup'));
  });
  return open;
}

export function liveWidgetCss(style: WidgetStyle | undefined) {
  const px = (value: number | string | undefined) => (typeof value === 'number' ? `${value}px` : value ?? '');
  const length = (value?: BoxLength | string) => (typeof value === 'string' ? value : value ? boxLengthCss(value) : '');
  const positioned = Boolean(style?.position);
  return {
    paddingTop: length(style?.paddingTop),
    paddingRight: length(style?.paddingRight),
    paddingBottom: length(style?.paddingBottom),
    paddingLeft: length(style?.paddingLeft),
    marginTop: length(style?.marginTop),
    marginRight: length(style?.marginRight),
    marginBottom: length(style?.marginBottom),
    marginLeft: length(style?.marginLeft),
    borderTopWidth: px(style?.borderTopWidth),
    borderRightWidth: px(style?.borderRightWidth),
    borderBottomWidth: px(style?.borderBottomWidth),
    borderLeftWidth: px(style?.borderLeftWidth),
    borderTopStyle: style?.borderTopStyle ?? style?.borderStyle ?? '',
    borderRightStyle: style?.borderRightStyle ?? style?.borderStyle ?? '',
    borderBottomStyle: style?.borderBottomStyle ?? style?.borderStyle ?? '',
    borderLeftStyle: style?.borderLeftStyle ?? style?.borderStyle ?? '',
    borderTopColor: style?.borderTopColor ?? style?.borderColor ?? '',
    borderRightColor: style?.borderRightColor ?? style?.borderColor ?? '',
    borderBottomColor: style?.borderBottomColor ?? style?.borderColor ?? '',
    borderLeftColor: style?.borderLeftColor ?? style?.borderColor ?? '',
    borderStyle: '',
    borderColor: '',
    borderTopLeftRadius: px(style?.radiusTopLeft),
    borderTopRightRadius: px(style?.radiusTopRight),
    borderBottomRightRadius: px(style?.radiusBottomRight),
    borderBottomLeftRadius: px(style?.radiusBottomLeft),
    width: typeof style?.width === 'string' ? style.width : style?.width?.mode === 'px' ? `${style.width.value}px` : style?.width?.mode === '%' ? `${style.width.value}%` : '',
    height: typeof style?.height === 'string' ? style.height : style?.height?.mode === 'px' ? `${style.height.value}px` : style?.height?.mode === '%' ? `${style.height.value}%` : '',
    position: style?.position ?? '',
    top: positioned ? length(style?.top) : '',
    right: positioned ? length(style?.right) : '',
    bottom: positioned ? length(style?.bottom) : '',
    left: positioned ? length(style?.left) : '',
    zIndex: positioned && style?.zIndex != null ? String(style.zIndex) : '',
    transform: [
      style?.rotateX ? `rotateX(${typeof style.rotateX === 'string' ? style.rotateX : angleCss(style.rotateX)})` : '',
      style?.rotateY ? `rotateY(${typeof style.rotateY === 'string' ? style.rotateY : angleCss(style.rotateY)})` : '',
      style?.rotateZ ? `rotateZ(${typeof style.rotateZ === 'string' ? style.rotateZ : angleCss(style.rotateZ)})` : '',
    ]
      .filter(Boolean)
      .join(' '),
  } satisfies Record<string, string>;
}
