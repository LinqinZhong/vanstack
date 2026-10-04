import { LOWCODE_MESSAGE_SOURCE } from '../../utils/lowcode-protocol';
import { syncWidgetChrome } from '../../utils/spacingGuides';
import type { BoxDragKind, SpacingEdge } from '../../utils/spacingDrag';
import type { RotateAxis } from '../../utils/rotateDrag';

/** paintPreviewCamera：按平移/缩放把预览相机画到正确位置。 */
export function paintPreviewCamera(
  camera: HTMLElement | null,
  viewX: number,
  viewY: number,
  viewScale: number,
  screenWidth: number,
  screenHeight: number,
  overflowX: number,
  overflowY: number,
  rasterScale: number,
) {
  if (!camera) {
    return;
  }
  const extraX = Math.max(0, overflowX);
  const extraY = Math.max(0, overflowY);
  const shiftX = extraX > 0 ? screenWidth * (extraX / 2) * viewScale : 0;
  const shiftY = extraY > 0 ? screenHeight * (extraY / 2) * viewScale : 0;
  camera.style.transform = `translate3d(${viewX - shiftX}px, ${viewY - shiftY}px, 0) scale(${viewScale / Math.max(rasterScale, 0.01)})`;
}

/** applyEditorChromeScale：编辑铬（描边、手柄）随视图缩放保持屏幕像素大小。 */
export function applyEditorChromeScale(host: HTMLElement, viewScale: number) {
  const chromeScale = Math.max(viewScale, 0.01);
  host.style.setProperty('--editor-hairline', `${1 / chromeScale}px`);
  host.style.setProperty('--editor-select', `${2 / chromeScale}px`);
  host.style.setProperty('--editor-guide-font', `${11 / chromeScale}px`);
  host.style.setProperty('--editor-handle', `${8 / chromeScale}px`);
  host.style.setProperty('--editor-handle-compact', `${16 / chromeScale}px`);
  host.style.setProperty('--editor-handle-hit', `${28 / chromeScale}px`);
}

/** applyViewport：设置预览屏尺寸、zoom 与画布溢出区。 */
export function applyViewport(
  host: HTMLElement,
  scale: number,
  width: number,
  height: number,
  overflowX: number,
  overflowY: number,
  viewScale: number,
) {
  const zoom = Math.max(scale, 0.01);
  host.style.zoom = String(zoom);
  applyEditorChromeScale(host, viewScale);
  const mount = host.querySelector<HTMLElement>('.preview-mount');
  const extraX = Math.max(0, overflowX);
  const extraY = Math.max(0, overflowY);
  host.style.width = `${width * (1 + extraX)}px`;
  host.style.height = `${height * (1 + extraY)}px`;
  host.style.overflow = extraX > 0 || extraY > 0 ? 'visible' : 'hidden';
  if (mount) {
    mount.style.width = `${width}px`;
    mount.style.height = `${height}px`;
    mount.style.margin = extraX > 0 || extraY > 0 ? `${(height * extraY) / 2}px 0 0 ${(width * extraX) / 2}px` : '0';
  }
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.height = '100%';
  document.documentElement.style.maxHeight = '100%';
  document.documentElement.style.boxSizing = 'border-box';
  document.documentElement.style.background = 'transparent';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.height = '100%';
  document.body.style.maxHeight = '100%';
  document.body.style.boxSizing = 'border-box';
  document.body.style.background = 'transparent';
}

const LIVE_STYLE_KEYS = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'borderStyle',
  'borderColor',
  'width',
  'height',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'transform',
] as const;

/** setSelectFaded：平移时淡化选中描边，避免挡视线。 */
export function setSelectFaded(host: HTMLElement | null, faded: boolean) {
  host?.classList.toggle('is-select-faded', faded);
}

/** applyLiveWidgetCss：父页推送的即时样式写到 DOM，拖拽过程中不必整页重渲。 */
export function applyLiveWidgetCss(root: HTMLElement | null, widgetId: string, css: Record<string, string>) {
  const node = root?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(widgetId)}"]`);
  if (!node) {
    return false;
  }
  const fillSlot = node.dataset.widgetType === 'swiper-item';
  const tablePart = node.dataset.widgetType === 'th' || node.dataset.widgetType === 'tr' || node.dataset.widgetType === 'td';
  const keepTrackSize = tablePart || node.dataset.widgetType === 'table';
  for (const key of LIVE_STYLE_KEYS) {
    if (keepTrackSize && (key === 'width' || key === 'height') && !css[key]) {
      continue;
    }
    if (
      tablePart &&
      (key === 'width' ||
        key === 'height' ||
        key.startsWith('margin') ||
        key === 'position' ||
        key === 'top' ||
        key === 'right' ||
        key === 'bottom' ||
        key === 'left' ||
        key === 'zIndex' ||
        key === 'transform')
    ) {
      continue;
    }
    if (fillSlot && (key === 'width' || key === 'height')) {
      node.style[key] = '100%';
      continue;
    }
    if (fillSlot && (key.startsWith('border') || key === 'position' || key === 'top' || key === 'right' || key === 'bottom' || key === 'left' || key === 'zIndex')) {
      node.style[key] = '';
      continue;
    }
    node.style[key] = css[key] ?? '';
  }
  return true;
}

/** applyWidgetState：同步选中与间距拖拽中的 DOM class。 */
export function applyWidgetState(
  root: HTMLElement | null,
  selectedId: string | null,
  spacingDrag: BoxDragKind | null,
) {
  if (!root) {
    return;
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-widget-id]')) {
    const selected = node.dataset.widgetId === selectedId;
    node.classList.toggle('is-widget-selected', selected);
    node.classList.toggle('is-spacing-drag', Boolean(spacingDrag) && selected);
  }
}

export function paintWidgetChrome(
  host: HTMLElement | null,
  root: HTMLElement | null,
  hoverTarget: EventTarget | null,
  zoom: number,
  editing: boolean,
  spacingDrag: BoxDragKind | 'border' | null,
) {
  if (!editing) {
    syncWidgetChrome(host, null, null, zoom);
    return;
  }
  const selected = spacingDrag
    ? null
    : (root?.querySelector<HTMLElement>('.is-widget-selected') ?? null);
  let hover: HTMLElement | null = null;
  if (!spacingDrag && hoverTarget instanceof Element) {
    const node = hoverTarget.closest('[data-widget-id]');
    hover = node instanceof HTMLElement ? node : null;
  }
  syncWidgetChrome(host, hover, selected, zoom);
}

/** widgetIdFromTarget：从事件目标向上找到控件 id。 */
export function widgetIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }
  const widget = target.closest('[data-widget-id]');
  return widget instanceof HTMLElement ? (widget.dataset.widgetId ?? null) : null;
}

export const FOCUS_DBLCLICK_MS = 300;

/** parentWidgetId：取控件在树中的父控件 id。 */
export function parentWidgetId(root: HTMLElement | null, id: string) {
  const node = root?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);
  const parent = node?.parentElement?.closest('[data-widget-id]');
  return parent instanceof HTMLElement ? (parent.dataset.widgetId ?? null) : null;
}

/** focusModifier：Ctrl/Cmd，用于选中上钻与双击聚焦。 */
export function focusModifier(event: MouseEvent) {
  return event.ctrlKey || event.metaKey;
}

/** postToParent：向编辑器父页发 postMessage。 */
export function postToParent(payload: Record<string, unknown>) {
  window.parent.postMessage({ source: LOWCODE_MESSAGE_SOURCE, ...payload }, window.location.origin);
}

/** postCanvasPointer：上报画布指针 down/move/up（含间距边与旋转角）。 */
export function postCanvasPointer(
  action: 'down' | 'move' | 'up',
  event: Pick<
    PointerEvent,
    'pointerId' | 'clientX' | 'clientY' | 'screenX' | 'screenY' | 'button' | 'shiftKey' | 'altKey'
  >,
  spacingEdge?: SpacingEdge,
  box?: { width: number; height: number } | null,
  rotate?: { axis?: RotateAxis; angle?: number },
) {
  postToParent({
    type: 'canvas-pointer',
    action,
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    button: event.button,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    spacingEdge,
    rotateAxis: rotate?.axis,
    rotateAngle: rotate?.angle,
    boxWidth: box?.width,
    boxHeight: box?.height,
  });
}

/** postWidgetHover：上报当前悬停控件的屏幕矩形。 */
export function postWidgetHover(widget: HTMLElement | null) {
  if (!widget) {
    postToParent({ type: 'widget-hover', widgetId: null, left: 0, top: 0, width: 0, height: 0 });
    return;
  }
  const rect = widget.getBoundingClientRect();
  postToParent({
    type: 'widget-hover',
    widgetId: widget.dataset.widgetId ?? null,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });
}
