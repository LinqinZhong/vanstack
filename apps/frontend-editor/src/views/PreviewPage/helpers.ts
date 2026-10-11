import { LOWCODE_MESSAGE_SOURCE } from '../../utils/lowcode-protocol';
import { syncWidgetChrome } from '../../utils/spacingGuides';
import type { BoxDragKind, SpacingEdge } from '../../utils/spacingDrag';
import type { RotateAxis } from '../../utils/rotateDrag';

/**
 * 组件实例插槽内容的运行时节点会被加前缀：`组件id__slot-插槽id__真实id`，
 * 编辑器（控件树/选中/数据）只认控件自身的真实 id，这里在画布边界做双向桥接。
 * 注意：模板虚拟节点是 `组件id__模板id`，不含 `slot-` 段，不会被剥离。
 */
const SLOT_CONTENT_ID_RE = /^.+?__slot-[A-Za-z0-9]+__(.+)$/;

/** 把运行时带前缀的插槽内容节点 id 还原成真实控件 id；其他 id 原样返回。 */
export function toRawWidgetId(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  const matched = SLOT_CONTENT_ID_RE.exec(id);
  return matched ? matched[1] : id;
}

/** 判断运行时节点 id 与编辑器使用的真实 id 是否指向同一控件。 */
export function widgetIdEquals(domId: string | null | undefined, rawId: string | null | undefined): boolean {
  if (!domId || !rawId) {
    return false;
  }
  return domId === rawId || toRawWidgetId(domId) === rawId;
}

/** 按真实 id 查找画布节点；插槽内容节点带前缀时用 `__真实id` 后缀兜底。 */
export function resolveWidgetNode(
  root: ParentNode | null | undefined,
  widgetId: string | null | undefined,
): HTMLElement | null {
  if (!root || !widgetId) {
    return null;
  }
  const exact = root.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(widgetId)}"]`);
  if (exact) {
    return exact;
  }
  return root.querySelector<HTMLElement>(`[data-widget-id$="__${CSS.escape(widgetId)}"]`);
}

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

/** 清掉拖拽时写上的行内样式，让样式表里的字号、边距重新生效。 */
export function clearLiveInlineStyles(root: HTMLElement | null) {
  if (!root) {
    return;
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-live-style]')) {
    delete node.dataset.liveStyle;
    if (node.dataset.widgetType === 'drawer') {
      // 抽屉的即时样式只写在面板上，且只写盒模型/边框/圆角；面板的定位与尺寸是
      // React 舞台布局（panelBox），React 不会重写未变化的行内值，清了就丢了。
      const panel = node.querySelector<HTMLElement>(':scope > .lowcode-drawer-panel');
      if (!panel) {
        continue;
      }
      for (const key of LIVE_STYLE_KEYS) {
        if (
          key === 'width' ||
          key === 'height' ||
          key === 'position' ||
          key === 'top' ||
          key === 'right' ||
          key === 'bottom' ||
          key === 'left' ||
          key === 'zIndex' ||
          key === 'transform'
        ) {
          continue;
        }
        panel.style[key] = '';
      }
      continue;
    }
    for (const key of LIVE_STYLE_KEYS) {
      node.style[key] = '';
    }
  }
}

/** applyLiveWidgetCss：父页推送的即时样式写到 DOM，拖拽过程中不必整页重渲。 */
export function applyLiveWidgetCss(root: HTMLElement | null, widgetId: string, css: Record<string, string>) {
  const node = resolveWidgetNode(root, widgetId);
  if (!node) {
    return false;
  }
  node.dataset.liveStyle = '';
  if (node.dataset.widgetType === 'drawer') {
    const panel = node.querySelector<HTMLElement>(':scope > .lowcode-drawer-panel');
    const place = node.dataset.drawerPlace ?? 'bottom';
    const axis = place === 'left' || place === 'right' ? 'width' : 'height';
    if (panel) {
      for (const key of LIVE_STYLE_KEYS) {
        if (key === 'width' || key === 'height') {
          if (key !== axis) {
            panel.style[key] = '100%';
          } else if (css[key]) {
            panel.style[key] = css[key];
          }
          continue;
        }
        if (
          key === 'position' ||
          key === 'top' ||
          key === 'right' ||
          key === 'bottom' ||
          key === 'left' ||
          key === 'zIndex' ||
          key === 'transform' ||
          key.startsWith('margin')
        ) {
          continue;
        }
        panel.style[key] = css[key] ?? '';
      }
    }
    return true;
  }
  const fillSlot = node.dataset.widgetType === 'swiper-item';
  const frameLocked = node.dataset.widgetType === 'windows' || node.dataset.widgetType === 'window';
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
    if (node.dataset.widgetType === 'windows' && (key === 'width' || key === 'height')) {
      node.style.position = 'fixed';
      node.style.top = '0';
      node.style.right = '0';
      node.style.bottom = '0';
      node.style.left = '0';
      node.style.width = 'auto';
      node.style.height = 'auto';
      continue;
    }
    if (node.dataset.widgetType === 'window' && (key === 'width' || key === 'height')) {
      continue;
    }
    if (
      frameLocked &&
      (key.startsWith('margin') ||
        key.startsWith('padding') ||
        key.startsWith('border') ||
        key === 'position' ||
        key === 'top' ||
        key === 'right' ||
        key === 'bottom' ||
        key === 'left' ||
        key === 'zIndex' ||
        key === 'transform')
    ) {
      if (node.dataset.widgetType === 'windows') {
        node.style.position = 'fixed';
        node.style.top = '0';
        node.style.right = '0';
        node.style.bottom = '0';
        node.style.left = '0';
        node.style.zIndex = '1';
        node.style.margin = '0';
      }
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
    const selected = widgetIdEquals(node.dataset.widgetId, selectedId);
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
  showHover = true,
) {
  if (!editing) {
    syncWidgetChrome(host, null, null, zoom);
    return;
  }
  const selected = spacingDrag
    ? null
    : (root?.querySelector<HTMLElement>('.is-widget-selected') ?? null);
  let hover: HTMLElement | null = null;
  if (showHover && !spacingDrag && hoverTarget instanceof Element) {
    const node = hoverTarget.closest('[data-widget-id]');
    hover = node instanceof HTMLElement ? node : null;
  }
  syncWidgetChrome(host, hover, selected, zoom);
}

/** widgetIdFromTarget：从事件目标向上找到控件 id（插槽内容还原为真实 id）。 */
export function widgetIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }
  const widget = target.closest('[data-widget-id]');
  return widget instanceof HTMLElement ? toRawWidgetId(widget.dataset.widgetId) : null;
}

export const FOCUS_DBLCLICK_MS = 300;

/** parentWidgetId：取控件在树中的父控件 id。 */
export function parentWidgetId(root: HTMLElement | null, id: string) {
  const node = resolveWidgetNode(root, id);
  const parent = node?.parentElement?.closest('[data-widget-id]');
  return parent instanceof HTMLElement ? toRawWidgetId(parent.dataset.widgetId) : null;
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
