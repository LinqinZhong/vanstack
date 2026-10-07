import {
  oppositeSpacingEdge,
  spacingCursorClass,
  spacingHandleCursor,
  type BoxDragKind,
  type SpacingEdge,
} from './spacingDrag';
import { type RotateAxis, ROTATE_AXES } from './rotateDrag';
import { drawerResizeEdge } from '../widgets/drawer';
import type { DrawerPlace } from '@vanstack/xml';

const GUIDE_ATTR = 'data-spacing-guides';
const MASK_ATTR = 'data-spacing-mask';
const EDGES = ['top', 'right', 'bottom', 'left'] as const;
const LABEL_GAP = 4;
const MASK_OUTSET = 2;
const HANDLE_OVERLAP = 8;

function compactOpposite(
  overlap: boolean,
  barEdge: SpacingEdge,
  otherEdge: SpacingEdge,
  activeEdge: SpacingEdge | null,
): SpacingEdge | null {
  if (!overlap) {
    return null;
  }
  return activeEdge === otherEdge ? barEdge : otherEdge;
}

const CORNER_CLASS: Record<SpacingEdge, string> = {
  top: 'top-left',
  right: 'top-right',
  bottom: 'bottom-right',
  left: 'bottom-left',
};

function readEdgeRaw(widget: HTMLElement, kind: 'padding' | 'margin' | 'radius' | 'position', edge: SpacingEdge) {
  const keys = {
    padding: { top: 'paddingTop', right: 'paddingRight', bottom: 'paddingBottom', left: 'paddingLeft' },
    margin: { top: 'marginTop', right: 'marginRight', bottom: 'marginBottom', left: 'marginLeft' },
    radius: {
      top: 'borderTopLeftRadius',
      right: 'borderTopRightRadius',
      bottom: 'borderBottomRightRadius',
      left: 'borderBottomLeftRadius',
    },
    position: { top: 'top', right: 'right', bottom: 'bottom', left: 'left' },
  } as const;
  return widget.style[keys[kind][edge]];
}

function readEdge(widget: HTMLElement, kind: 'padding' | 'margin' | 'radius' | 'position', edge: SpacingEdge) {
  const value = Number.parseFloat(readEdgeRaw(widget, kind, edge));
  return Number.isFinite(value) ? value : 0;
}

function edgeIsAuto(widget: HTMLElement, kind: BoxDragKind, edge: SpacingEdge) {
  if (kind === 'position' || kind === 'margin') {
    return readEdgeRaw(widget, kind, edge) === 'auto';
  }
  return false;
}

/** previewScreenElement：取预览挂载根（.preview-mount）。 */
export function previewScreenElement(root: ParentNode | null) {
  const mount = root?.querySelector('.preview-mount');
  return mount instanceof HTMLElement ? mount : null;
}

/** 分屏里旁边的窗口自己是 fixed 包含块；没这层时仍用 375 屏幕。 */
export function fixedPositionContainer(widget: HTMLElement, root: ParentNode | null): HTMLElement | null {
  const slot = widget.closest('.lowcode-windows-slot.is-offset');
  if (slot instanceof HTMLElement) {
    const transform = widget.ownerDocument.defaultView?.getComputedStyle(slot).transform ?? 'none';
    if (transform !== 'none') {
      return slot;
    }
  }
  return previewScreenElement(root);
}

/** previewVisualScale：host zoom × 相机 scale，得到布局↔屏幕换算比例。 */
export function previewVisualScale(host: HTMLElement, fallback = 1) {
  const view = host.ownerDocument.defaultView;
  const computedZoom = view ? Number.parseFloat(view.getComputedStyle(host).zoom) : Number.NaN;
  const styleZoom = Number.parseFloat(host.style.zoom);
  const zoom =
    Number.isFinite(computedZoom) && computedZoom > 0
      ? computedZoom
      : Number.isFinite(styleZoom) && styleZoom > 0
        ? styleZoom
        : 1;
  const camera = host.closest('.preview-camera');
  let cameraScale = 1;
  if (camera instanceof HTMLElement) {
    const match = /scale\(([-+]?\d*\.?\d+)/.exec(camera.style.transform);
    if (match) {
      const parsed = Number.parseFloat(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        cameraScale = parsed;
      }
    }
  }
  const scale = zoom * cameraScale;
  return scale > 0 ? scale : Math.max(fallback, 0.01);
}

type SpacingBox = { left: number; top: number; width: number; height: number };

function layoutBox(host: HTMLElement, widget: HTMLElement, zoom: number): SpacingBox {
  const hostRect = host.getBoundingClientRect();
  const widgetRect = widget.getBoundingClientRect();
  const scale = previewVisualScale(host, zoom);
  return {
    left: (widgetRect.left - hostRect.left) / scale,
    top: (widgetRect.top - hostRect.top) / scale,
    width: widgetRect.width / scale,
    height: widgetRect.height / scale,
  };
}

function rotateLayoutBox(host: HTMLElement, widget: HTMLElement, zoom: number): SpacingBox {
  const hostRect = host.getBoundingClientRect();
  const widgetRect = widget.getBoundingClientRect();
  const scale = previewVisualScale(host, zoom);
  const width = widget.offsetWidth;
  const height = widget.offsetHeight;
  const centerX = (widgetRect.left + widgetRect.width / 2 - hostRect.left) / scale;
  const centerY = (widgetRect.top + widgetRect.height / 2 - hostRect.top) / scale;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}

function liveRotateCss(widget: HTMLElement, axis: RotateAxis) {
  const match = widget.style.transform.match(new RegExp(`rotate${axis.toUpperCase()}\\(([^)]+)\\)`));
  return match?.[1] ?? '0deg';
}

/** rotateLayoutClientCenter：旋转控件在屏幕坐标下的中心点。 */
export function rotateLayoutClientCenter(host: HTMLElement, widget: HTMLElement, zoom: number) {
  const box = rotateLayoutBox(host, widget, zoom);
  const hostRect = host.getBoundingClientRect();
  const scale = previewVisualScale(host, zoom);
  return {
    x: hostRect.left + (box.left + box.width / 2) * scale,
    y: hostRect.top + (box.top + box.height / 2) * scale,
  };
}

const DRAWER_PLACES = ['top', 'bottom', 'left', 'right'] as const;

function drawerPlaceOf(widget: HTMLElement): DrawerPlace | null {
  const place = widget.dataset.drawerPlace;
  return DRAWER_PLACES.find((item) => item === place) ?? null;
}

/** 抽屉的选中框和尺寸杆跟内容区走，遮罩留在外面。 */
export function drawerGuideNode(widget: HTMLElement): HTMLElement {
  if (widget.dataset.widgetType !== 'drawer') {
    return widget;
  }
  const panel = widget.querySelector<HTMLElement>(':scope > .lowcode-drawer-panel');
  return panel ?? widget;
}

function drawerResizeEdgeOf(widget: HTMLElement): SpacingEdge | null {
  const place = drawerPlaceOf(widget);
  return place ? drawerResizeEdge(place) : null;
}

function drawerSizeEdges(
  selected: HTMLElement,
  panel: HTMLElement,
  widgetBox: SpacingBox,
): { top: number; right: number; bottom: number; left: number } {
  const edges = {
    top: Math.round(widgetBox.height),
    right: Math.round(widgetBox.width),
    bottom: Math.round(widgetBox.height),
    left: Math.round(widgetBox.width),
  };
  const place = drawerPlaceOf(selected);
  if (!place) {
    return edges;
  }
  const axis = place === 'left' || place === 'right' ? 'width' : 'height';
  const raw = panel.style[axis] ?? '';
  if (!raw.endsWith('%')) {
    return edges;
  }
  const percent = Math.round(Number.parseFloat(raw));
  if (!Number.isFinite(percent)) {
    return edges;
  }
  if (axis === 'width') {
    edges.left = percent;
    edges.right = percent;
  } else {
    edges.top = percent;
    edges.bottom = percent;
  }
  return edges;
}

/** widgetLayoutSize：控件在布局坐标下的圆整宽高。 */
export function widgetLayoutSize(host: HTMLElement | null, widget: HTMLElement | null, zoom: number) {
  if (!host || !widget) {
    return null;
  }
  const box = layoutBox(host, drawerGuideNode(widget), zoom);
  return {
    width: Math.max(0, Math.round(box.width)),
    height: Math.max(0, Math.round(box.height)),
  };
}

function unionPaintedBox(host: HTMLElement, widget: HTMLElement, zoom: number): SpacingBox {
  const hostRect = host.getBoundingClientRect();
  const scale = previewVisualScale(host, zoom);
  const add = (el: Element, box: { left: number; top: number; right: number; bottom: number }) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      return;
    }
    box.left = Math.min(box.left, (rect.left - hostRect.left) / scale);
    box.top = Math.min(box.top, (rect.top - hostRect.top) / scale);
    box.right = Math.max(box.right, (rect.right - hostRect.left) / scale);
    box.bottom = Math.max(box.bottom, (rect.bottom - hostRect.top) / scale);
  };
  const seed = widget.getBoundingClientRect();
  const box = {
    left: (seed.left - hostRect.left) / scale,
    top: (seed.top - hostRect.top) / scale,
    right: (seed.right - hostRect.left) / scale,
    bottom: (seed.bottom - hostRect.top) / scale,
  };
  for (const node of widget.querySelectorAll('*')) {
    add(node, box);
  }
  return {
    left: box.left,
    top: box.top,
    width: Math.max(0, box.right - box.left),
    height: Math.max(0, box.bottom - box.top),
  };
}

function viewportBoxInHost(host: HTMLElement, zoom: number): SpacingBox {
  const hostRect = host.getBoundingClientRect();
  const scale = previewVisualScale(host, zoom);
  const view = host.ownerDocument.defaultView;
  const pad = 4;
  const width = view?.innerWidth ?? hostRect.width;
  const height = view?.innerHeight ?? hostRect.height;
  return {
    left: -hostRect.left / scale - pad,
    top: -hostRect.top / scale - pad,
    width: width / scale + pad * 2,
    height: height / scale + pad * 2,
  };
}

function parseUsedPx(value: string | undefined) {
  if (!value || value === 'auto') {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCssAuto(value: string | undefined) {
  return !value || value === 'auto';
}

function insetSpecified(widget: HTMLElement, edge: SpacingEdge) {
  const raw = widget.style[edge];
  return Boolean(raw) && raw !== 'auto';
}

function specifiedInsetPx(widget: HTMLElement, edge: SpacingEdge, axisSize: number) {
  const raw = widget.style[edge];
  if (!raw || raw === 'auto') {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (raw.trim().endsWith('%')) {
    return (parsed / 100) * axisSize;
  }
  return parsed;
}

function writingIsRtl(widget: HTMLElement) {
  return widget.ownerDocument.defaultView?.getComputedStyle(widget).direction === 'rtl';
}

function axisStretched(usedSize: number, axisSize: number, startPx: number, endPx: number, startMargin: number, endMargin: number) {
  const expected = axisSize - startPx - endPx - startMargin - endMargin;
  return expected >= -1 && Math.abs(usedSize - expected) <= 1;
}

function insetInEffect(
  widget: HTMLElement,
  edge: SpacingEdge,
  position: string,
  box: SpacingBox,
  widgetBox: SpacingBox,
) {
  if (!insetSpecified(widget, edge)) {
    return false;
  }
  if (position === 'sticky') {
    return true;
  }
  const horizontal = edge === 'left' || edge === 'right';
  const startEdge = horizontal ? 'left' : 'top';
  const endEdge = horizontal ? 'right' : 'bottom';
  const axisSize = horizontal ? box.width : box.height;
  const startPx = specifiedInsetPx(widget, startEdge, axisSize);
  const endPx = specifiedInsetPx(widget, endEdge, axisSize);
  if (startPx == null || endPx == null) {
    return true;
  }
  const computed = widget.ownerDocument.defaultView?.getComputedStyle(widget);
  const startMargin = parseUsedPx(horizontal ? computed?.marginLeft : computed?.marginTop);
  const endMargin = parseUsedPx(horizontal ? computed?.marginRight : computed?.marginBottom);
  const usedSize = horizontal ? widgetBox.width : widgetBox.height;
  const stretched =
    position !== 'relative' && axisStretched(usedSize, axisSize, startPx, endPx, startMargin, endMargin);
  if (stretched) {
    return true;
  }
  if (horizontal && writingIsRtl(widget)) {
    return edge === 'right';
  }
  return edge === startEdge;
}

function showAxisEdges(start: boolean, end: boolean) {
  if (start === end) {
    return { start: true, end: true };
  }
  return { start, end };
}

function paddingBoxInHost(host: HTMLElement, el: HTMLElement, zoom: number): SpacingBox {
  const box = layoutBox(host, el, zoom);
  return {
    left: box.left + el.clientLeft,
    top: box.top + el.clientTop,
    width: el.clientWidth,
    height: el.clientHeight,
  };
}

function stickyScrollPort(widget: HTMLElement) {
  let node = widget.parentElement;
  while (node && !node.classList.contains('preview-mount') && !node.classList.contains('preview-host')) {
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style) {
      const scrollable = (value: string) => value === 'auto' || value === 'scroll' || value === 'overlay' || value === 'hidden';
      if (scrollable(style.overflowX) || scrollable(style.overflowY)) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

function positionContainingBox(host: HTMLElement, widget: HTMLElement, zoom: number): SpacingBox {
  const view = host.ownerDocument.defaultView;
  const position = view?.getComputedStyle(widget).position ?? '';
  if (position === 'fixed') {
    const screen = fixedPositionContainer(widget, host);
    if (screen) {
      return layoutBox(host, screen, zoom);
    }
  }
  if (position === 'sticky') {
    const port = stickyScrollPort(widget) ?? previewScreenElement(host);
    if (port) {
      return paddingBoxInHost(host, port, zoom);
    }
  }
  const parent = widget.offsetParent instanceof HTMLElement ? widget.offsetParent : widget.ownerDocument.documentElement;
  return paddingBoxInHost(host, parent, zoom);
}

function staticPositionBox(host: HTMLElement, widget: HTMLElement, zoom: number): SpacingBox {
  const box = layoutBox(host, widget, zoom);
  const computed = host.ownerDocument.defaultView?.getComputedStyle(widget);
  const usedTop = isCssAuto(computed?.top) ? -parseUsedPx(computed?.bottom) : parseUsedPx(computed?.top);
  const usedLeft = isCssAuto(computed?.left) ? -parseUsedPx(computed?.right) : parseUsedPx(computed?.left);
  return {
    left: box.left - usedLeft,
    top: box.top - usedTop,
    width: box.width,
    height: box.height,
  };
}

type OriginLine = { dir: 'h' | 'v'; pos: number };

function positionOriginLines(host: HTMLElement, widget: HTMLElement, zoom: number): OriginLine[] {
  const position = host.ownerDocument.defaultView?.getComputedStyle(widget).position ?? '';
  const widgetBox = layoutBox(host, widget, zoom);
  const box = position === 'relative' ? staticPositionBox(host, widget, zoom) : positionContainingBox(host, widget, zoom);
  const vertical = showAxisEdges(
    insetInEffect(widget, 'top', position, box, widgetBox),
    insetInEffect(widget, 'bottom', position, box, widgetBox),
  );
  const horizontal = showAxisEdges(
    insetInEffect(widget, 'left', position, box, widgetBox),
    insetInEffect(widget, 'right', position, box, widgetBox),
  );
  const lines: OriginLine[] = [];
  if (vertical.start) {
    lines.push({ dir: 'h', pos: box.top });
  }
  if (vertical.end) {
    lines.push({ dir: 'h', pos: box.top + box.height });
  }
  if (horizontal.start) {
    lines.push({ dir: 'v', pos: box.left });
  }
  if (horizontal.end) {
    lines.push({ dir: 'v', pos: box.left + box.width });
  }
  return lines;
}

function paintOriginAxes(overlay: HTMLElement, lines: OriginLine[], view: SpacingBox) {
  let svg = overlay.querySelector<SVGSVGElement>('.spacing-origin');
  if (lines.length === 0) {
    svg?.remove();
    return;
  }
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'spacing-origin');
    svg.setAttribute('aria-hidden', 'true');
    overlay.prepend(svg);
  }
  const target = svg;
  const width = Math.max(view.width, 1);
  const height = Math.max(view.height, 1);
  target.style.left = `${view.left}px`;
  target.style.top = `${view.top}px`;
  target.setAttribute('width', String(width));
  target.setAttribute('height', String(height));
  target.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const existing = [...target.querySelectorAll('line')];
  while (existing.length > lines.length) {
    existing.pop()?.remove();
  }
  lines.forEach((line, index) => {
    let el = existing[index];
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      target.append(el);
    }
    if (line.dir === 'h') {
      const y = line.pos - view.top;
      el.setAttribute('x1', '0');
      el.setAttribute('y1', String(y));
      el.setAttribute('x2', String(width));
      el.setAttribute('y2', String(y));
    } else {
      const x = line.pos - view.left;
      el.setAttribute('x1', String(x));
      el.setAttribute('y1', '0');
      el.setAttribute('x2', String(x));
      el.setAttribute('y2', String(height));
    }
  });
}

function paintSpacingMask(mask: HTMLElement, hole: SpacingBox, view: SpacingBox) {
  mask.style.inset = 'auto';
  mask.style.left = `${view.left}px`;
  mask.style.top = `${view.top}px`;
  mask.style.width = `${Math.max(view.width, 1)}px`;
  mask.style.height = `${Math.max(view.height, 1)}px`;
  const left = hole.left - MASK_OUTSET - view.left;
  const top = hole.top - MASK_OUTSET - view.top;
  const width = Math.max(hole.width + MASK_OUTSET * 2, 0);
  const height = Math.max(hole.height + MASK_OUTSET * 2, 0);
  const size = `100% 100%, ${width}px ${height}px`;
  const position = `0 0, ${left}px ${top}px`;
  mask.style.clipPath = '';
  mask.style.webkitMaskSize = size;
  mask.style.webkitMaskPosition = position;
  mask.style.maskSize = size;
  mask.style.maskPosition = position;
}

function paintSpacingFrame(
  overlay: HTMLElement,
  leftX: number,
  topY: number,
  rightX: number,
  bottomY: number,
  width: number,
  height: number,
) {
  let svg = overlay.querySelector<SVGSVGElement>('.spacing-frame');
  if (!svg) {
    overlay.prepend(makeSpacingFrame(leftX, topY, rightX, bottomY, width, height));
    return;
  }
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.querySelector('polygon')?.setAttribute(
    'points',
    `${leftX},${topY} ${rightX},${topY} ${rightX},${bottomY} ${leftX},${bottomY}`,
  );
}

function syncGuideLabel(
  overlay: HTMLElement,
  className: string,
  value: number,
  place: (label: HTMLElement) => void,
  fits: (label: HTMLElement) => boolean,
) {
  let label = overlay.querySelector<HTMLElement>(`:scope > .spacing-guide-label.is-${className}`);
  if (value === 0) {
    label?.remove();
    return;
  }
  if (!label) {
    label = document.createElement('span');
    label.className = `spacing-guide-label is-${className}`;
    label.append(makeSnapIcon(), document.createTextNode(String(value)));
    overlay.append(label);
  } else if (label.childNodes[1]) {
    label.childNodes[1].textContent = String(value);
  }
  place(label);
  if (!fits(label)) {
    label.remove();
  }
}

function insetBox(
  box: { left: number; top: number; width: number; height: number },
  edges: { top: number; right: number; bottom: number; left: number },
) {
  return {
    leftX: box.left + edges.left,
    topY: box.top + edges.top,
    rightX: box.left + box.width - edges.right,
    bottomY: box.top + box.height - edges.bottom,
  };
}

function outsetBox(
  box: { left: number; top: number; width: number; height: number },
  edges: { top: number; right: number; bottom: number; left: number },
) {
  return {
    leftX: box.left - edges.left,
    topY: box.top - edges.top,
    rightX: box.left + box.width + edges.right,
    bottomY: box.top + box.height + edges.bottom,
  };
}

/** spacingActionFromTarget：点中确认/取消按钮时返回对应动作。 */
export function spacingActionFromTarget(target: EventTarget | null): 'confirm' | 'cancel' | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const action = target.closest('[data-spacing-action]')?.getAttribute('data-spacing-action');
  return action === 'confirm' || action === 'cancel' ? action : null;
}

const DRAG_SHIELD_ATTR = 'data-spacing-drag-shield';

/** setSpacingDragCursor：拖拽间距手柄时锁定全局光标，并可盖一层透明 shield 防止误点。 */
export function setSpacingDragCursor(
  kind: BoxDragKind | null,
  edge: SpacingEdge | null,
  options?: { shield?: boolean },
) {
  const shield = document.querySelector<HTMLElement>(`[${DRAG_SHIELD_ATTR}]`);
  const cursor = kind && edge ? spacingHandleCursor(kind, edge) : null;
  if (!cursor) {
    shield?.remove();
    document.documentElement.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');
    return;
  }
  document.documentElement.style.cursor = cursor;
  document.body.style.cursor = cursor;
  if (options?.shield === false) {
    return;
  }
  const next = shield ?? document.createElement('div');
  if (!shield) {
    next.setAttribute(DRAG_SHIELD_ATTR, '');
    document.body.append(next);
  }
  next.className = `spacing-drag-shield ${spacingCursorClass(cursor)}`;
}

/** spacingEdgeFromTarget：从手柄 DOM 解析间距边。 */
export function spacingEdgeFromTarget(target: EventTarget | null): SpacingEdge | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const edge = target.closest('[data-spacing-edge]')?.getAttribute('data-spacing-edge');
  if (edge === 'top' || edge === 'right' || edge === 'bottom' || edge === 'left') {
    return edge;
  }
  return null;
}

/** rotateAxisFromTarget：从旋转环 DOM 解析轴 x/y/z。 */
export function rotateAxisFromTarget(target: EventTarget | null): RotateAxis | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const axis = target.closest('[data-rotate-axis]')?.getAttribute('data-rotate-axis');
  if (axis === 'x' || axis === 'y' || axis === 'z') {
    return axis;
  }
  return null;
}

function makeSnapIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'spacing-snap');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const paths = [
    'm6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15',
    'm5 8 4 4',
    'm12 15 4 4',
  ];
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }
  return svg;
}

function iconPath(d: string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function rotateRingRadii(axis: RotateAxis) {
  if (axis === 'x') {
    return { rx: 18, ry: 44 };
  }
  if (axis === 'y') {
    return { rx: 44, ry: 18 };
  }
  return { rx: 44, ry: 44 };
}

function makeRotateEllipse(axis: RotateAxis, kind: 'hit' | 'draw') {
  const { rx, ry } = rotateRingRadii(axis);
  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', '50');
  ellipse.setAttribute('cy', '50');
  ellipse.setAttribute('rx', String(rx));
  ellipse.setAttribute('ry', String(ry));
  ellipse.setAttribute('fill', 'none');
  ellipse.setAttribute('class', kind === 'hit' ? 'rotate-ring-hit' : 'rotate-ring-draw');
  return ellipse;
}

function makeRotateRing(axis: RotateAxis) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = `rotate-ring is-${axis}`;
  handle.dataset.rotateAxis = axis;
  handle.setAttribute('aria-label', axis);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.append(makeRotateEllipse(axis, 'hit'), makeRotateEllipse(axis, 'draw'));
  const angle = document.createElement('span');
  angle.className = 'rotate-angle';
  angle.textContent = '0deg';
  const snap = document.createElement('span');
  snap.className = 'spacing-snap-badge';
  snap.append(makeSnapIcon());
  handle.append(svg, angle, snap);
  return handle;
}

function makeRotatePlane() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'rotate-plane');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.append(path);
  return svg;
}

function placeRotateRing(
  handle: HTMLElement,
  box: { left: number; top: number; width: number; height: number },
) {
  const pad = 20;
  const min = 80;
  handle.style.left = `${box.left + box.width / 2}px`;
  handle.style.top = `${box.top + box.height / 2}px`;
  handle.style.width = `${Math.max(min, box.width + pad * 2)}px`;
  handle.style.height = `${Math.max(min, box.height + pad * 2)}px`;
}

function paintRotatePlane(
  svg: SVGElement,
  view: SpacingBox,
  hole: SpacingBox,
) {
  svg.style.left = `${view.left}px`;
  svg.style.top = `${view.top}px`;
  svg.style.width = `${view.width}px`;
  svg.style.height = `${view.height}px`;
  svg.setAttribute('viewBox', `${view.left} ${view.top} ${view.width} ${view.height}`);
  const path = svg.querySelector('path');
  if (!path) {
    return;
  }
  path.setAttribute(
    'd',
    `M${view.left},${view.top}h${view.width}v${view.height}h${-view.width}zM${hole.left},${hole.top}h${hole.width}v${hole.height}h${-hole.width}z`,
  );
  path.setAttribute('fill-rule', 'evenodd');
}

/** setRotateHeldAxes：高亮旋转环上已按住的轴，以及当前拖拽轴。 */
export function setRotateHeldAxes(host: HTMLElement | null, axes: RotateAxis[], dragAxis: RotateAxis | null = null) {
  const overlay = host?.querySelector<HTMLElement>(`[${GUIDE_ATTR}]`);
  if (!overlay) {
    return;
  }
  const keyed = new Set(axes);
  for (const node of overlay.querySelectorAll<HTMLElement>('[data-rotate-axis]')) {
    const axis = node.dataset.rotateAxis;
    const isAxis = axis === 'x' || axis === 'y' || axis === 'z';
    node.classList.toggle('is-keyed', isAxis && keyed.has(axis));
    node.classList.toggle('is-active', isAxis && axis === dragAxis);
  }
}

function makeSpacingHandle(edge: SpacingEdge, kind: BoxDragKind = 'padding') {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className =
    kind === 'radius'
      ? `spacing-handle is-corner is-${CORNER_CLASS[edge]} ${spacingCursorClass(spacingHandleCursor(kind, edge))}`
      : `spacing-handle is-${edge} ${spacingCursorClass(spacingHandleCursor(kind, edge))}`;
  handle.dataset.spacingEdge = edge;
  handle.setAttribute('aria-label', kind === 'radius' ? CORNER_CLASS[edge] : edge);
  const bar = document.createElement('span');
  bar.className = 'spacing-handle-bar';
  const axis = document.createElement('span');
  axis.className = 'spacing-axis';
  const snap = document.createElement('span');
  snap.className = 'spacing-snap-badge';
  snap.append(makeSnapIcon());
  handle.append(bar, axis, snap);
  return handle;
}

function placeSpacingHandle(
  handle: HTMLElement,
  edge: SpacingEdge,
  leftX: number,
  topY: number,
  rightX: number,
  bottomY: number,
  compact: boolean,
) {
  handle.classList.toggle('is-compact', compact);
  if (compact) {
    if (edge === 'top' || edge === 'bottom') {
      handle.style.left = `${(leftX + rightX) / 2}px`;
      handle.style.top = `${edge === 'top' ? topY : bottomY}px`;
    } else {
      handle.style.left = `${edge === 'left' ? leftX : rightX}px`;
      handle.style.top = `${(topY + bottomY) / 2}px`;
    }
    handle.style.width = '';
    handle.style.height = '';
    return;
  }
  const x1 = Math.min(leftX, rightX);
  const x2 = Math.max(leftX, rightX);
  const y1 = Math.min(topY, bottomY);
  const y2 = Math.max(topY, bottomY);
  const spanX = Math.max(x2 - x1, 24);
  const spanY = Math.max(y2 - y1, 24);
  if (edge === 'top' || edge === 'bottom') {
    handle.style.left = `${x1}px`;
    handle.style.top = `${edge === 'top' ? topY : bottomY}px`;
    handle.style.width = `${spanX}px`;
    handle.style.height = '';
    return;
  }
  handle.style.left = `${edge === 'left' ? leftX : rightX}px`;
  handle.style.top = `${y1}px`;
  handle.style.width = '';
  handle.style.height = `${spanY}px`;
}

function usedCornerRadii(
  box: { width: number; height: number },
  radii: { top: number; right: number; bottom: number; left: number },
) {
  const tl = Math.max(0, radii.top);
  const tr = Math.max(0, radii.right);
  const br = Math.max(0, radii.bottom);
  const bl = Math.max(0, radii.left);
  const factor = (len: number, a: number, b: number) => (a + b > 0 ? len / (a + b) : 1);
  const scale = Math.min(
    1,
    factor(Math.max(box.width, 0), tl, tr),
    factor(Math.max(box.height, 0), tr, br),
    factor(Math.max(box.width, 0), br, bl),
    factor(Math.max(box.height, 0), bl, tl),
  );
  return { top: tl * scale, right: tr * scale, bottom: br * scale, left: bl * scale };
}

function placeRadiusHandle(
  handle: HTMLElement,
  edge: SpacingEdge,
  box: { left: number; top: number; width: number; height: number },
  radius: number,
) {
  const inset = Math.max(0, radius) * (1 - Math.SQRT1_2);
  const fromLeft = edge === 'top' || edge === 'left';
  const fromTop = edge === 'top' || edge === 'right';
  handle.style.left = `${(fromLeft ? box.left : box.left + box.width) + (fromLeft ? inset : -inset)}px`;
  handle.style.top = `${(fromTop ? box.top : box.top + box.height) + (fromTop ? inset : -inset)}px`;
  handle.style.width = '';
  handle.style.height = '';
}

function placeRadiusLabel(
  label: HTMLElement,
  edge: SpacingEdge,
  box: { left: number; top: number; width: number; height: number },
  radius: number,
) {
  placeRadiusHandle(label, edge, box, radius);
}

function placeSpacingLabel(
  label: HTMLElement,
  edge: SpacingEdge,
  leftX: number,
  topY: number,
  rightX: number,
  bottomY: number,
) {
  if (edge === 'top' || edge === 'bottom') {
    label.style.left = `${(leftX + rightX) / 2}px`;
    label.style.top = `${edge === 'top' ? topY : bottomY}px`;
    return;
  }
  label.style.left = `${edge === 'left' ? leftX : rightX}px`;
  label.style.top = `${(topY + bottomY) / 2}px`;
}

function makeSpacingAction(kind: 'cancel' | 'confirm') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `spacing-action is-${kind}`;
  button.dataset.spacingAction = kind;
  button.setAttribute('aria-label', kind);
  button.title = kind === 'cancel' ? 'Esc' : 'Enter';
  button.append(
    iconPath(
      kind === 'cancel' ? 'M4 4 L12 12 M12 4 L4 12' : 'M3.2 8.4 L6.6 11.6 L12.8 4.4',
    ),
  );
  return button;
}

function makeSpacingFrame(
  leftX: number,
  topY: number,
  rightX: number,
  bottomY: number,
  width: number,
  height: number,
) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'spacing-frame');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', `${leftX},${topY} ${rightX},${topY} ${rightX},${bottomY} ${leftX},${bottomY}`);
  svg.append(polygon);
  return svg;
}

/** setSpacingSnap：切换间距辅助线的吸附（Shift）高亮态。 */
export function setSpacingSnap(host: HTMLElement | null, snap: boolean) {
  host?.querySelector<HTMLElement>(`[${GUIDE_ATTR}]`)?.classList.toggle('is-snap', snap);
}

/** setSpacingMirror：切换镜像拖拽（Alt）态，并同步手柄高亮。 */
export function setSpacingMirror(host: HTMLElement | null, mirror: boolean) {
  const overlay = host?.querySelector<HTMLElement>(`[${GUIDE_ATTR}]`);
  if (!overlay) {
    return;
  }
  overlay.classList.toggle('is-mirror', mirror);
  const held = (overlay.dataset.heldEdges ?? '')
    .split(',')
    .filter((edge): edge is SpacingEdge => edge === 'top' || edge === 'right' || edge === 'bottom' || edge === 'left');
  const drag = overlay.dataset.activeEdge;
  const dragEdge =
    drag === 'top' || drag === 'right' || drag === 'bottom' || drag === 'left' ? drag : null;
  setSpacingHeldEdges(host, held, mirror, dragEdge);
}

/** setSpacingActiveEdge：标记当前正在拖的边，并按镜像规则点亮对边。 */
export function setSpacingActiveEdge(host: HTMLElement | null, edge: SpacingEdge | null, mirror = false) {
  const overlay = host?.querySelector<HTMLElement>(`[${GUIDE_ATTR}]`);
  const held = (overlay?.dataset.heldEdges ?? '')
    .split(',')
    .filter((item): item is SpacingEdge => item === 'top' || item === 'right' || item === 'bottom' || item === 'left');
  setSpacingHeldEdges(host, held, mirror, edge);
}

/** setSpacingHeldEdges：同步已选边（键盘多选）与当前拖拽边的手柄高亮。 */
export function setSpacingHeldEdges(
  host: HTMLElement | null,
  edges: SpacingEdge[],
  mirror = false,
  dragEdge: SpacingEdge | null = null,
) {
  const overlay = host?.querySelector<HTMLElement>(`[${GUIDE_ATTR}]`);
  if (!overlay) {
    return;
  }
  overlay.classList.toggle('is-mirror', mirror);
  overlay.dataset.activeEdge = dragEdge ?? '';
  overlay.dataset.heldEdges = edges.join(',');
  const radiusMirror = overlay.classList.contains('is-radius') && mirror;
  const sizeMirror = overlay.classList.contains('is-size') && mirror;
  const keyed = new Set(edges);
  const dragged = new Set<SpacingEdge>();
  if (dragEdge) {
    dragged.add(dragEdge);
    if (sizeMirror) {
      dragged.add('top');
      dragged.add('right');
      dragged.add('bottom');
      dragged.add('left');
    } else if (!radiusMirror && mirror) {
      dragged.add(oppositeSpacingEdge(dragEdge));
    }
  }
  for (const node of overlay.querySelectorAll<HTMLElement>('.spacing-handle')) {
    const edge = node.dataset.spacingEdge;
    const isEdge = edge === 'top' || edge === 'right' || edge === 'bottom' || edge === 'left';
    node.classList.toggle('is-keyed', isEdge && keyed.has(edge));
    node.classList.toggle(
      'is-active',
      radiusMirror || sizeMirror || (isEdge && dragged.has(edge)),
    );
  }
}

/** syncSpacingMask：按选中控件重画遮罩挖空区域（拖拽时压暗四周）。 */
export function syncSpacingMask(
  host: HTMLElement | null,
  root: HTMLElement | null,
  kind: BoxDragKind | null,
  zoom: number,
) {
  if (!host || !root || !kind) {
    return;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  const mask = host.querySelector<HTMLElement>(`[${MASK_ATTR}]`);
  if (!selected || !mask) {
    return;
  }
  const hole = unionPaintedBox(host, drawerGuideNode(selected), zoom);
  const view = viewportBoxInHost(host, zoom);
  const holeKey = `${view.left},${view.top},${view.width},${view.height},${hole.left},${hole.top},${hole.width},${hole.height}`;
  if (mask.dataset.holeKey === holeKey) {
    return;
  }
  mask.dataset.holeKey = holeKey;
  paintSpacingMask(mask, hole, view);
}

/** syncSpacingGuides：按拖拽类型重建/更新间距或旋转辅助线叠层。 */
export function syncSpacingGuides(
  host: HTMLElement | null,
  root: HTMLElement | null,
  kind: BoxDragKind | null,
  zoom: number,
  activeEdge: SpacingEdge | null = null,
  snap = false,
  mirror = false,
  heldEdges: SpacingEdge[] = [],
) {
  if (!host || !root || !kind) {
    host?.querySelector(`[${GUIDE_ATTR}]`)?.remove();
    host?.querySelector(`[${MASK_ATTR}]`)?.remove();
    return;
  }
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  if (!selected) {
    host.querySelector(`[${GUIDE_ATTR}]`)?.remove();
    host.querySelector(`[${MASK_ATTR}]`)?.remove();
    return;
  }

  const guideNode = drawerGuideNode(selected);
  const widgetBox = kind === 'rotate' ? rotateLayoutBox(host, selected, zoom) : layoutBox(host, guideNode, zoom);
  const coverW = Math.max(host.offsetWidth, 1);
  const coverH = Math.max(host.offsetHeight, 1);
  const edges =
    kind === 'rotate'
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : kind === 'size'
      ? drawerSizeEdges(selected, guideNode, widgetBox)
      : kind === 'position'
        ? {
            top: readEdge(selected, 'position', 'top'),
            right: readEdge(selected, 'position', 'right'),
            bottom: readEdge(selected, 'position', 'bottom'),
            left: readEdge(selected, 'position', 'left'),
          }
        : {
            top: readEdge(selected, kind, 'top'),
            right: readEdge(selected, kind, 'right'),
            bottom: readEdge(selected, kind, 'bottom'),
            left: readEdge(selected, kind, 'left'),
          };

  let mask = host.querySelector<HTMLElement>(`[${MASK_ATTR}]`);
  let overlay = host.querySelector<HTMLElement>(`[${GUIDE_ATTR}]`);
  const reuse = Boolean(mask && overlay && overlay.getAttribute(GUIDE_ATTR) === kind);
  if (!reuse) {
    mask?.remove();
    overlay?.remove();
    mask = document.createElement('div');
    mask.setAttribute(MASK_ATTR, '');
    mask.className = 'spacing-mask';
    overlay = document.createElement('div');
    overlay.setAttribute(GUIDE_ATTR, kind);
    overlay.className = `spacing-guides is-${kind}`;
    if (kind === 'rotate') {
      overlay.append(makeRotatePlane());
      for (const axis of ROTATE_AXES) {
        overlay.append(makeRotateRing(axis));
      }
    } else if (kind === 'radius') {
      for (const edge of EDGES) {
        overlay.append(makeSpacingHandle(edge, kind));
      }
    } else {
      overlay.append(makeSpacingFrame(0, 0, 0, 0, coverW, coverH));
      for (const edge of EDGES) {
        overlay.append(makeSpacingHandle(edge, kind));
      }
    }
    const actions = document.createElement('div');
    actions.className = 'spacing-actions';
    actions.append(makeSpacingAction('cancel'), makeSpacingAction('confirm'));
    overlay.append(actions);
    host.append(mask, overlay);
  }
  if (!mask || !overlay) {
    return;
  }

  const hole = unionPaintedBox(host, drawerGuideNode(selected), zoom);
  const view = viewportBoxInHost(host, zoom);
  const holeKey = `${view.left},${view.top},${view.width},${view.height},${hole.left},${hole.top},${hole.width},${hole.height}`;
  if (mask.dataset.holeKey !== holeKey) {
    mask.dataset.holeKey = holeKey;
    paintSpacingMask(mask, hole, view);
  }

  const actions = overlay.querySelector<HTMLElement>('.spacing-actions');

  if (kind === 'rotate') {
    const plane = overlay.querySelector<SVGElement>('.rotate-plane');
    if (plane) {
      paintRotatePlane(plane, view, widgetBox);
    }
    for (const axis of ROTATE_AXES) {
      const ring = overlay.querySelector<HTMLElement>(`.rotate-ring[data-rotate-axis="${axis}"]`);
      if (ring) {
        placeRotateRing(ring, widgetBox);
        let angle = ring.querySelector('.rotate-angle');
        if (!angle) {
          angle = document.createElement('span');
          angle.className = 'rotate-angle';
          ring.append(angle);
        }
        angle.textContent = liveRotateCss(selected, axis);
      }
    }
    if (actions) {
      actions.style.left = `${widgetBox.left + widgetBox.width}px`;
      actions.style.top = `${widgetBox.top + widgetBox.height}px`;
    }
    setSpacingSnap(host, snap);
    return;
  }

  if (kind === 'radius') {
    const painted = usedCornerRadii(widgetBox, edges);
    for (const edge of EDGES) {
      const handle = overlay.querySelector<HTMLElement>(`.spacing-handle[data-spacing-edge="${edge}"]`);
      if (handle) {
        placeRadiusHandle(handle, edge, widgetBox, painted[edge]);
      }
      syncGuideLabel(
        overlay,
        CORNER_CLASS[edge],
        edges[edge],
        (label) => placeRadiusLabel(label, edge, widgetBox, painted[edge]),
        () => true,
      );
    }
    if (actions) {
      actions.style.left = `${widgetBox.left + widgetBox.width}px`;
      actions.style.top = `${widgetBox.top + widgetBox.height}px`;
    }
  } else {
    const frame =
      kind === 'margin'
        ? outsetBox(widgetBox, edges)
        : kind === 'size' || kind === 'position'
          ? insetBox(widgetBox, { top: 0, right: 0, bottom: 0, left: 0 })
          : insetBox(widgetBox, edges);
    const { leftX, topY, rightX, bottomY } = frame;
    paintSpacingFrame(overlay, leftX, topY, rightX, bottomY, coverW, coverH);
    if (kind === 'position') {
      const position = selected.ownerDocument.defaultView?.getComputedStyle(selected).position ?? '';
      if (position === 'static' || position === '') {
        overlay.querySelector('.spacing-origin')?.remove();
      } else {
        paintOriginAxes(overlay, positionOriginLines(host, selected, zoom), view);
      }
    } else {
      overlay.querySelector('.spacing-origin')?.remove();
    }
    if (actions) {
      actions.style.left = `${Math.max(leftX, rightX)}px`;
      actions.style.top = `${Math.max(topY, bottomY)}px`;
    }
    const compactY = compactOpposite(
      Math.abs(bottomY - topY) < HANDLE_OVERLAP,
      'bottom',
      'top',
      activeEdge,
    );
    const compactX = compactOpposite(
      Math.abs(rightX - leftX) < HANDLE_OVERLAP,
      'left',
      'right',
      activeEdge,
    );
    const spanX = Math.abs(rightX - leftX);
    const spanY = Math.abs(bottomY - topY);
    const resizeEdge = kind === 'size' ? drawerResizeEdgeOf(selected) : null;
    for (const edge of EDGES) {
      const handle = overlay.querySelector<HTMLElement>(`.spacing-handle[data-spacing-edge="${edge}"]`);
      if (handle) {
        const auto = edgeIsAuto(selected, kind, edge);
        handle.hidden = auto || (resizeEdge != null && edge !== resizeEdge);
        if (!auto) {
          placeSpacingHandle(
            handle,
            edge,
            leftX,
            topY,
            rightX,
            bottomY,
            edge === compactY || edge === compactX,
          );
        }
      }
      syncGuideLabel(
        overlay,
        edge,
        edgeIsAuto(selected, kind, edge) ? 0 : edges[edge],
        (label) => placeSpacingLabel(label, edge, leftX, topY, rightX, bottomY),
        (label) =>
          (resizeEdge == null || edge === resizeEdge) &&
          (edge === 'top' || edge === 'bottom'
            ? spanX >= label.offsetWidth + LABEL_GAP
            : spanY >= label.offsetHeight + LABEL_GAP),
      );
    }
  }

  setSpacingHeldEdges(host, heldEdges, mirror, activeEdge);
  setSpacingSnap(host, snap);
}

const CHROME_ATTR = 'data-widget-chrome';

function paintChromeFrame(frame: HTMLElement, host: HTMLElement, widget: HTMLElement, zoom: number) {
  const box = rotateLayoutBox(host, widget, zoom);
  const computed = widget.ownerDocument.defaultView?.getComputedStyle(widget);
  frame.style.left = `${box.left}px`;
  frame.style.top = `${box.top}px`;
  frame.style.width = `${box.width}px`;
  frame.style.height = `${box.height}px`;
  frame.style.borderRadius = computed?.borderRadius ?? '';
  frame.style.transform = computed && computed.transform !== 'none' ? computed.transform : '';
  frame.style.transformOrigin = 'center center';
}

/** syncWidgetChrome：把悬停粉框和选中彩虹框画在预览叠层上，避免 overflow:hidden 裁切。 */
export function syncWidgetChrome(
  host: HTMLElement | null,
  hover: HTMLElement | null,
  selected: HTMLElement | null,
  zoom: number,
) {
  if (!host || (!hover && !selected)) {
    host?.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  let overlay = host.querySelector<HTMLElement>(`[${CHROME_ATTR}]`);
  if (!overlay) {
    overlay = host.ownerDocument.createElement('div');
    overlay.setAttribute(CHROME_ATTR, '');
    overlay.className = 'widget-chrome';
    overlay.innerHTML =
      '<div class="widget-chrome-frame is-hover" hidden></div><div class="widget-chrome-frame is-selected" hidden></div>';
    host.append(overlay);
  }
  const hoverFrame = overlay.querySelector<HTMLElement>('.widget-chrome-frame.is-hover');
  const selectedFrame = overlay.querySelector<HTMLElement>('.widget-chrome-frame.is-selected');
  const showHover = Boolean(hover && hover !== selected);
  if (hoverFrame) {
    hoverFrame.hidden = !showHover;
    if (showHover && hover) {
      paintChromeFrame(hoverFrame, host, drawerGuideNode(hover), zoom);
    }
  }
  if (selectedFrame) {
    selectedFrame.hidden = !selected;
    if (selected) {
      paintChromeFrame(selectedFrame, host, drawerGuideNode(selected), zoom);
    }
  }
}
