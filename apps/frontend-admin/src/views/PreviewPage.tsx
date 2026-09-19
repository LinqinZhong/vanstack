import { useEffect, useRef, useState } from 'react';
import { renderPageXml } from '@vanstack/lowcode-runtime';
import type { PageI18n } from '@vanstack/xml';
import { isLowcodeMessage, LOWCODE_MESSAGE_SOURCE } from '../utils/lowcode-protocol';
import { isBoxGroupShortcut, isTextStyleShortcut, matchWidgetShortcut } from '../utils/widgetShortcuts';
import { previewVisualScale, setSpacingActiveEdge, setSpacingDragCursor, setSpacingHeldEdges, setSpacingMirror, setSpacingSnap, setRotateHeldAxes, spacingActionFromTarget, spacingEdgeFromTarget, rotateAxisFromTarget, rotateLayoutClientCenter, syncSpacingGuides, syncSpacingMask, syncWidgetChrome, widgetLayoutSize } from '../utils/spacingGuides';
import type { BoxDragKind, SpacingEdge } from '../utils/spacingDrag';
import { isBoxDragKind, isSpacingNudgeKey, isSpacingValueKey, SPACING_EDGES } from '../utils/spacingDrag';
import { pointerAngleDeg, type RotateAxis } from '../utils/rotateDrag';

/** paintPreviewCamera：按平移/缩放把预览相机画到正确位置。 */
function paintPreviewCamera(
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
function applyEditorChromeScale(host: HTMLElement, viewScale: number) {
  const chromeScale = Math.max(viewScale, 0.01);
  host.style.setProperty('--editor-hairline', `${1 / chromeScale}px`);
  host.style.setProperty('--editor-select', `${2 / chromeScale}px`);
  host.style.setProperty('--editor-guide-font', `${11 / chromeScale}px`);
  host.style.setProperty('--editor-handle', `${8 / chromeScale}px`);
  host.style.setProperty('--editor-handle-compact', `${16 / chromeScale}px`);
  host.style.setProperty('--editor-handle-hit', `${28 / chromeScale}px`);
}

/** applyViewport：设置预览屏尺寸、zoom 与画布溢出区。 */
function applyViewport(
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
function setSelectFaded(host: HTMLElement | null, faded: boolean) {
  host?.classList.toggle('is-select-faded', faded);
}

/** applyLiveWidgetCss：父页推送的即时样式写到 DOM，拖拽过程中不必整页重渲。 */
function applyLiveWidgetCss(root: HTMLElement | null, widgetId: string, css: Record<string, string>) {
  const node = root?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(widgetId)}"]`);
  if (!node) {
    return false;
  }
  const fillSlot = node.dataset.widgetType === 'swiper-item';
  for (const key of LIVE_STYLE_KEYS) {
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
function applyWidgetState(
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

function paintWidgetChrome(
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
function widgetIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }
  const widget = target.closest('[data-widget-id]');
  return widget instanceof HTMLElement ? (widget.dataset.widgetId ?? null) : null;
}

const FOCUS_DBLCLICK_MS = 300;

/** parentWidgetId：取控件在树中的父控件 id。 */
function parentWidgetId(root: HTMLElement | null, id: string) {
  const node = root?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);
  const parent = node?.parentElement?.closest('[data-widget-id]');
  return parent instanceof HTMLElement ? (parent.dataset.widgetId ?? null) : null;
}

/** focusModifier：Ctrl/Cmd，用于选中上钻与双击聚焦。 */
function focusModifier(event: MouseEvent) {
  return event.ctrlKey || event.metaKey;
}

/** postToParent：向编辑器父页发 postMessage。 */
function postToParent(payload: Record<string, unknown>) {
  window.parent.postMessage({ source: LOWCODE_MESSAGE_SOURCE, ...payload }, window.location.origin);
}

/** postCanvasPointer：上报画布指针 down/move/up（含间距边与旋转角）。 */
function postCanvasPointer(
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
function postWidgetHover(widget: HTMLElement | null) {
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

export function PreviewPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const xmlRef = useRef('');
  const editingRef = useRef(true);
  const localeRef = useRef<string | undefined>(undefined);
  const catalogRef = useRef<string>('null');
  const viewingOwnerIdRef = useRef<string | null>(null);
  const viewingStateRef = useRef<string | null>(null);
  const viewingStatesRef = useRef('');
  const spacingDragRef = useRef<BoxDragKind | 'border' | null>(null);
  const rasterScaleRef = useRef(1);
  const viewScaleRef = useRef(1);
  const activeSpacingEdgeRef = useRef<SpacingEdge | null>(null);
  const activeRotateAxisRef = useRef<RotateAxis | null>(null);
  const heldEdgesRef = useRef<SpacingEdge[]>([]);
  const heldAxesRef = useRef<RotateAxis[]>([]);
  const allSelectedRef = useRef(false);
  const snapRef = useRef(false);
  const mirrorRef = useRef(false);
  const climbAnchorIdRef = useRef<string | null>(null);
  const lastPostedSelectRef = useRef<string | null | undefined>(undefined);
  const climbTimerRef = useRef(0);
  const selectClickAtRef = useRef(0);
  const chromeTargetRef = useRef<EventTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);

  /** readSelectedLayoutSize：当前选中控件的布局宽高（布局坐标）。 */
  function readSelectedLayoutSize() {
    const selected = mountRef.current?.querySelector<HTMLElement>('.is-widget-selected');
    return widgetLayoutSize(hostRef.current, selected ?? null, viewScaleRef.current);
  }

  /** readRotatePayload：旋转拖拽时根据指针算当前轴与角度。 */
  function readRotatePayload(
    event: Pick<PointerEvent, 'clientX' | 'clientY'>,
    axis?: RotateAxis | null,
  ) {
    if (spacingDragRef.current !== 'rotate') {
      return undefined;
    }
    const selected = mountRef.current?.querySelector<HTMLElement>('.is-widget-selected');
    const host = hostRef.current;
    if (!selected || !host) {
      return { axis: axis ?? 'z', angle: 0 };
    }
    const center = rotateLayoutClientCenter(host, selected, viewScaleRef.current);
    return {
      axis: axis ?? activeRotateAxisRef.current ?? 'z',
      angle: pointerAngleDeg(event.clientX, event.clientY, center.x, center.y),
    };
  }

  /** postSelectedLayoutSize：把选中控件尺寸回传父页（widget-box）。 */
  function postSelectedLayoutSize() {
    const selected = mountRef.current?.querySelector<HTMLElement>('.is-widget-selected');
    const size = widgetLayoutSize(hostRef.current, selected ?? null, viewScaleRef.current);
    const widgetId = selected?.dataset.widgetId;
    if (!widgetId || !size) {
      return;
    }
    postToParent({ type: 'widget-box', widgetId, width: size.width, height: size.height });
  }

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isLowcodeMessage(event.data)) {
        return;
      }
      if (event.data.type === 'spacing-snap') {
        // setSpacingSnap：Shift 吸附开关 → 辅助线 is-snap
        snapRef.current = event.data.snap;
        setSpacingSnap(hostRef.current, event.data.snap);
        return;
      }
      if (event.data.type === 'spacing-mirror') {
        // setSpacingMirror：Alt 镜像开关 → 辅助线 is-mirror
        mirrorRef.current = event.data.mirror;
        setSpacingMirror(hostRef.current, event.data.mirror);
        return;
      }
      if (event.data.type === 'spacing-active') {
        // setSpacingHeldEdges / setRotateHeldAxes：父页同步多选边与旋转轴高亮
        heldEdgesRef.current = event.data.edges;
        heldAxesRef.current = event.data.axes ?? [];
        allSelectedRef.current = event.data.edges.length === SPACING_EDGES.length;
        setSpacingHeldEdges(
          hostRef.current,
          heldEdgesRef.current,
          mirrorRef.current,
          activeSpacingEdgeRef.current,
        );
        setRotateHeldAxes(hostRef.current, heldAxesRef.current, activeRotateAxisRef.current);
        return;
      }
      if (event.data.type === 'select-chrome') {
        // setSelectFaded：平移中淡化选中框
        setSelectFaded(hostRef.current, event.data.faded);
        return;
      }
      if (event.data.type === 'widget-style') {
        // applyLiveWidgetCss + syncSpacingGuides：拖拽过程中父页推送的局部 CSS
        if (applyLiveWidgetCss(mountRef.current, event.data.widgetId, event.data.css)) {
          syncSpacingGuides(
            hostRef.current,
            mountRef.current,
            isBoxDragKind(spacingDragRef.current) ? spacingDragRef.current : null,
            viewScaleRef.current,
            activeSpacingEdgeRef.current,
            snapRef.current,
            mirrorRef.current,
            heldEdgesRef.current,
          );
          paintWidgetChrome(
            hostRef.current,
            mountRef.current,
            chromeTargetRef.current,
            viewScaleRef.current,
            editingRef.current,
            spacingDragRef.current,
          );
          postSelectedLayoutSize();
        }
        return;
      }
      if (event.data.type !== 'preview' || !mountRef.current) {
        return;
      }
      const {
        xml,
        mode,
        selectedId,
        scale,
        viewScale,
        viewX,
        viewY,
        screenWidth,
        screenHeight,
        overflowX,
        overflowY,
        locale,
        catalog,
        viewingOwnerId,
        viewingState,
        viewingStates,
        spacingDrag,
      } = event.data;
      const nextEditing = mode !== 'preview';
      const nextLocale = locale || undefined;
      const nextCatalog = catalog as PageI18n | undefined;
      const nextCatalogKey = JSON.stringify(nextCatalog ?? null);
      const nextSpacing = spacingDrag ?? null;
      const nextViewingOwner = viewingOwnerId ?? null;
      const nextViewingState = viewingState ?? null;
      const nextViewingStates = JSON.stringify(viewingStates ?? null);
      const shouldRender =
        xml !== xmlRef.current ||
        nextEditing !== editingRef.current ||
        nextLocale !== localeRef.current ||
        nextCatalogKey !== catalogRef.current ||
        nextViewingOwner !== viewingOwnerIdRef.current ||
        nextViewingState !== viewingStateRef.current ||
        nextViewingStates !== viewingStatesRef.current;
      editingRef.current = nextEditing;
      localeRef.current = nextLocale;
      catalogRef.current = nextCatalogKey;
      viewingOwnerIdRef.current = nextViewingOwner;
      viewingStateRef.current = nextViewingState;
      viewingStatesRef.current = nextViewingStates;
      spacingDragRef.current = nextEditing ? nextSpacing : null;
      if (!spacingDragRef.current) {
        activeSpacingEdgeRef.current = null;
        heldEdgesRef.current = [];
        allSelectedRef.current = false;
      }
      rasterScaleRef.current = scale;
      viewScaleRef.current = typeof viewScale === 'number' ? viewScale : 1;
      if (selectedId !== lastPostedSelectRef.current) {
        climbAnchorIdRef.current = null;
      }
      lastPostedSelectRef.current = selectedId;
      setEditing(nextEditing);
      if (hostRef.current) {
        applyViewport(
          hostRef.current,
          scale,
          screenWidth,
          screenHeight,
          typeof overflowX === 'number' ? overflowX : nextEditing ? 4 : 0,
          typeof overflowY === 'number' ? overflowY : nextEditing ? 2 : 0,
          typeof viewScale === 'number' ? viewScale : 1,
        );
      }
      paintPreviewCamera(
        cameraRef.current,
        typeof viewX === 'number' ? viewX : 0,
        typeof viewY === 'number' ? viewY : 0,
        typeof viewScale === 'number' ? viewScale : 1,
        screenWidth,
        screenHeight,
        typeof overflowX === 'number' ? overflowX : nextEditing ? 4 : 0,
        typeof overflowY === 'number' ? overflowY : nextEditing ? 2 : 0,
        scale,
      );
      if (shouldRender) {
        xmlRef.current = xml;
        const result = renderPageXml(mountRef.current, xml, {
          editing: nextEditing,
          locale: nextLocale,
          catalog: nextCatalog,
          viewingOwnerId: nextViewingOwner,
          viewingState: nextViewingState,
          viewingStates: viewingStates ?? null,
        });
        setError(result.ok ? null : result.error);
      }
      applyWidgetState(
        mountRef.current,
        selectedId,
        isBoxDragKind(spacingDragRef.current) ? spacingDragRef.current : null,
      );
      paintWidgetChrome(
        hostRef.current,
        mountRef.current,
        chromeTargetRef.current,
        viewScaleRef.current,
        nextEditing,
        spacingDragRef.current,
      );
      syncSpacingGuides(
        hostRef.current,
        mountRef.current,
        isBoxDragKind(spacingDragRef.current) ? spacingDragRef.current : null,
        viewScaleRef.current,
        activeSpacingEdgeRef.current,
        snapRef.current,
        mirrorRef.current,
        heldEdgesRef.current,
      );
      postSelectedLayoutSize();
      if (!nextEditing) {
        postWidgetHover(null);
      }
    }

    window.addEventListener('message', onMessage);
    postToParent({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    const observer = new MutationObserver(() => {
      const host = hostRef.current;
      if (!host || !isBoxDragKind(spacingDragRef.current)) {
        return;
      }
      const scale = previewVisualScale(host, viewScaleRef.current);
      viewScaleRef.current = scale;
      applyEditorChromeScale(host, scale);
      syncSpacingMask(host, mountRef.current, spacingDragRef.current, scale);
    });
    observer.observe(camera, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) {
      return;
    }
    const root: HTMLDivElement = node;
    let hoverFrame = 0;
    let lastHoverKey = '';
    let panFrame = 0;
    let panning = false;
    let captureKind: 'pan' | 'spacing' | null = null;
    let activePointerId: number | null = null;
    let captureTarget: Element | null = null;
    let suppressClick = false;
    let flushMoveImmediately = false;
    let pendingPan: {
      pointerId: number;
      clientX: number;
      clientY: number;
      screenX: number;
      screenY: number;
      button: number;
      shiftKey: boolean;
      altKey: boolean;
      spacingEdge?: SpacingEdge;
    } | null = null;
    let lastPointer: {
      pointerId: number;
      clientX: number;
      clientY: number;
      screenX: number;
      screenY: number;
      button: number;
    } | null = null;

    /** postSpacingMove：间距/旋转拖拽中把最近指针位置回传父页。 */
    function postSpacingMove() {
      if (captureKind === 'spacing' && lastPointer) {
        postCanvasPointer(
          'move',
          { ...lastPointer, shiftKey: snapRef.current, altKey: mirrorRef.current },
          activeSpacingEdgeRef.current ?? undefined,
          readSelectedLayoutSize(),
          readRotatePayload(lastPointer, activeRotateAxisRef.current),
        );
      }
    }

    /** applySnap：本地按住/松开 Shift 时同步吸附高亮。 */
    function applySnap(next: boolean) {
      if (snapRef.current === next) {
        return;
      }
      snapRef.current = next;
      setSpacingSnap(root, next);
      postSpacingMove();
    }

    /** applyMirror：本地按住/松开 Alt 时同步镜像高亮。 */
    function applyMirror(next: boolean) {
      if (mirrorRef.current === next) {
        return;
      }
      mirrorRef.current = next;
      setSpacingMirror(root, next);
      setSpacingActiveEdge(root, activeSpacingEdgeRef.current, next);
      postSpacingMove();
    }

    /** selectedWidgetUnder：仅当指针在当前选中控件内时返回该控件。 */
    function selectedWidgetUnder(target: EventTarget | null) {
      if (!editingRef.current || !(target instanceof Node)) {
        return null;
      }
      const selected = mountRef.current?.querySelector<HTMLElement>('.is-widget-selected');
      if (!selected || !selected.contains(target)) {
        return null;
      }
      return selected;
    }

    /** reportHover：去重后上报悬停控件矩形。 */
    function reportHover(target: EventTarget | null) {
      const selected =
        spacingDragRef.current && spacingEdgeFromTarget(target)
          ? mountRef.current?.querySelector<HTMLElement>('.is-widget-selected')
          : selectedWidgetUnder(target);
      if (!selected) {
        if (lastHoverKey !== 'null') {
          lastHoverKey = 'null';
          postWidgetHover(null);
        }
        return;
      }
      const rect = selected.getBoundingClientRect();
      const key = `${selected.dataset.widgetId}:${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}`;
      if (key === lastHoverKey) {
        return;
      }
      lastHoverKey = key;
      postWidgetHover(selected);
    }

    /** onMouseMove：同步 Shift/Alt 修饰键，并节流上报悬停。 */
    function onMouseMove(event: MouseEvent) {
      applySnap(event.shiftKey);
      applyMirror(event.altKey);
      if (!editingRef.current || panning || captureKind) {
        return;
      }
      const target = event.target;
      if (hoverFrame) {
        return;
      }
      hoverFrame = window.requestAnimationFrame(() => {
        hoverFrame = 0;
        chromeTargetRef.current = target;
        reportHover(target);
        paintWidgetChrome(
          hostRef.current,
          mountRef.current,
          target,
          viewScaleRef.current,
          editingRef.current,
          spacingDragRef.current,
        );
      });
    }

    /** onMouseLeave：指针离开预览区时清空悬停。 */
    function onMouseLeave() {
      if (hoverFrame) {
        window.cancelAnimationFrame(hoverFrame);
        hoverFrame = 0;
      }
      if (lastHoverKey !== 'null') {
        lastHoverKey = 'null';
        postWidgetHover(null);
      }
      chromeTargetRef.current = null;
      paintWidgetChrome(
        hostRef.current,
        mountRef.current,
        null,
        viewScaleRef.current,
        editingRef.current,
        spacingDragRef.current,
      );
    }

    /** clearClimbTimer：取消 Ctrl 单击上钻的延时。 */
    function clearClimbTimer() {
      if (climbTimerRef.current) {
        window.clearTimeout(climbTimerRef.current);
        climbTimerRef.current = 0;
      }
    }

    /** postSelect：通知父页选中变更，并刷新悬停框。 */
    function postSelect(widgetId: string | null) {
      lastPostedSelectRef.current = widgetId;
      postToParent({ type: 'select', widgetId });
      if (widgetId) {
        const widget = mountRef.current?.querySelector<HTMLElement>(
          `[data-widget-id="${CSS.escape(widgetId)}"]`,
        );
        if (widget) {
          lastHoverKey = '';
          chromeTargetRef.current = widget;
          postWidgetHover(widget);
          paintWidgetChrome(
            hostRef.current,
            mountRef.current,
            widget,
            viewScaleRef.current,
            editingRef.current,
            spacingDragRef.current,
          );
          return;
        }
      }
      lastHoverKey = 'null';
      postWidgetHover(null);
    }

    /** onClick：单击选中；同锚点再点上钻父级（Ctrl 时延时，避免挡双击）。 */
    function onClick(event: MouseEvent) {
      if (!editingRef.current || event.button !== 0) {
        return;
      }
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      if (event.detail > 1 && focusModifier(event)) {
        return;
      }
      selectClickAtRef.current = event.timeStamp;
      const hitId = widgetIdFromTarget(event.target);
      const overlayOpen = Boolean(spacingDragRef.current);
      const onOverlayHandle = Boolean(
        spacingEdgeFromTarget(event.target) || rotateAxisFromTarget(event.target),
      );
      if (overlayOpen && !onOverlayHandle && hitId !== lastPostedSelectRef.current) {
        clearClimbTimer();
        climbAnchorIdRef.current = null;
        postToParent({ type: 'dismiss-toolbar' });
        return;
      }
      if (!hitId) {
        clearClimbTimer();
        climbAnchorIdRef.current = null;
        postToParent({ type: 'dismiss-toolbar' });
        return;
      }
      if (hitId !== climbAnchorIdRef.current) {
        clearClimbTimer();
        climbAnchorIdRef.current = hitId;
        postSelect(hitId);
        return;
      }
      const current = lastPostedSelectRef.current ?? null;
      const next =
        !current || current === hitId
          ? (parentWidgetId(mountRef.current, hitId) ?? hitId)
          : (parentWidgetId(mountRef.current, current) ?? hitId);
      clearClimbTimer();
      if (focusModifier(event)) {
        climbTimerRef.current = window.setTimeout(() => {
          climbTimerRef.current = 0;
          postSelect(next);
        }, FOCUS_DBLCLICK_MS);
        return;
      }
      postSelect(next);
    }

    /** onDoubleClick：Ctrl/Cmd 双击通知父页聚焦该控件。 */
    function onDoubleClick(event: MouseEvent) {
      if (!editingRef.current || event.button !== 0 || !focusModifier(event)) {
        return;
      }
      if (event.timeStamp - selectClickAtRef.current > FOCUS_DBLCLICK_MS) {
        return;
      }
      clearClimbTimer();
      const widgetId = widgetIdFromTarget(event.target);
      if (!widgetId || !(event.target instanceof Element)) {
        return;
      }
      const widget = event.target.closest('[data-widget-id]');
      if (!(widget instanceof HTMLElement)) {
        return;
      }
      event.preventDefault();
      const rect = widget.getBoundingClientRect();
      postToParent({
        type: 'focus-widget',
        widgetId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }

    /** onWheel：滚轮缩放，回传父页。 */
    function onWheel(event: WheelEvent) {
      if (!editingRef.current) {
        return;
      }
      event.preventDefault();
      setSelectFaded(root, true);
      postToParent({
        type: 'canvas-wheel',
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      });
    }

    /** capturePointer：开始平移/拖拽时捕获指针。 */
    function capturePointer(event: PointerEvent, target: Element) {
      activePointerId = event.pointerId;
      captureTarget = target;
      if (target.hasPointerCapture(event.pointerId)) {
        return;
      }
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        captureTarget = null;
      }
    }

    /** setDragShield：开关间距拖拽光标 shield。 */
    function setDragShield(on: boolean, edge?: SpacingEdge | null) {
      setSpacingDragCursor(
        on && isBoxDragKind(spacingDragRef.current) ? spacingDragRef.current : null,
        on ? edge ?? null : null,
      );
    }

    /** rememberPointer：缓存最近指针，供 rAF 合并 move。 */
    function rememberPointer(
      event: Pick<
        PointerEvent,
        'pointerId' | 'clientX' | 'clientY' | 'screenX' | 'screenY' | 'button' | 'shiftKey' | 'altKey'
      >,
    ) {
      pendingPan = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        button: event.button,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        spacingEdge: activeSpacingEdgeRef.current ?? undefined,
      };
      lastPointer = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        button: event.button,
      };
    }

    /** flushPendingMove：立即发出尚未上报的指针 move。 */
    function flushPendingMove() {
      if (panFrame) {
        window.cancelAnimationFrame(panFrame);
        panFrame = 0;
      }
      if (pendingPan) {
        postCanvasPointer('move', pendingPan, pendingPan.spacingEdge, readSelectedLayoutSize(), readRotatePayload(pendingPan, activeRotateAxisRef.current));
        pendingPan = null;
      }
    }

    /** endPointer：结束平移或间距拖拽，复位高亮并上报 up。 */
    function endPointer(event: PointerEvent) {
      if (activePointerId !== event.pointerId) {
        return;
      }
      flushPendingMove();
      panning = false;
      const wasSpacing = captureKind === 'spacing';
      captureKind = null;
      activePointerId = null;
      lastPointer = null;
      flushMoveImmediately = false;
      setDragShield(false);
      if (captureTarget?.hasPointerCapture(event.pointerId)) {
        captureTarget.releasePointerCapture(event.pointerId);
      }
      captureTarget = null;
      postCanvasPointer(
        'up',
        event,
        activeSpacingEdgeRef.current ?? undefined,
        readSelectedLayoutSize(),
        readRotatePayload(event, activeRotateAxisRef.current),
      );
      if (wasSpacing) {
        activeSpacingEdgeRef.current = spacingEdgeFromTarget(
          document.elementFromPoint(event.clientX, event.clientY),
        );
        activeRotateAxisRef.current = rotateAxisFromTarget(
          document.elementFromPoint(event.clientX, event.clientY),
        );
        setSpacingActiveEdge(root, null, mirrorRef.current);
        setRotateHeldAxes(root, heldAxesRef.current, null);
      }
    }

    /** onPointerDown：中键平移，或开始间距/旋转手柄拖拽。 */
    function onPointerDown(event: PointerEvent) {
      if (event.button === 1) {
        event.preventDefault();
        panning = true;
        captureKind = 'pan';
        flushMoveImmediately = true;
        setSelectFaded(root, true);
        capturePointer(event, document.documentElement);
        postCanvasPointer('down', event);
        return;
      }
      if (!editingRef.current) {
        return;
      }
      const spacingAction = spacingActionFromTarget(event.target);
      if (spacingAction) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = true;
        postToParent({ type: 'spacing-commit', action: spacingAction });
        return;
      }
      if (event.button !== 0 || !spacingDragRef.current) {
        return;
      }
      if (spacingDragRef.current === 'rotate') {
        const axis = rotateAxisFromTarget(event.target);
        if (!axis) {
          return;
        }
        event.preventDefault();
        suppressClick = true;
        activeRotateAxisRef.current = axis;
        rememberPointer(event);
        applySnap(event.shiftKey);
        captureKind = 'spacing';
        setRotateHeldAxes(root, heldAxesRef.current, axis);
        capturePointer(event, document.documentElement);
        activePointerId = event.pointerId;
        flushMoveImmediately = true;
        setSelectFaded(root, true);
        postCanvasPointer('down', event, undefined, readSelectedLayoutSize(), readRotatePayload(event, axis));
        return;
      }
      const edge = spacingEdgeFromTarget(event.target);
      if (!edge) {
        return;
      }
      event.preventDefault();
      suppressClick = true;
      activeSpacingEdgeRef.current = edge;
      rememberPointer(event);
      applySnap(event.shiftKey);
      applyMirror(event.altKey);
      captureKind = 'spacing';
      setSpacingActiveEdge(root, edge, event.altKey);
      capturePointer(event, document.documentElement);
      activePointerId = event.pointerId;
      flushMoveImmediately = true;
      setSelectFaded(root, true);
      setSpacingDragCursor(
        isBoxDragKind(spacingDragRef.current) ? spacingDragRef.current : null,
        edge,
        { shield: false },
      );
      postCanvasPointer('down', event, edge, readSelectedLayoutSize());
      window.requestAnimationFrame(() => {
        if (captureKind === 'spacing') {
          setDragShield(true, edge);
        }
      });
    }

    /** onPointerMove：平移/拖拽中合并上报 move。 */
    function onPointerMove(event: PointerEvent) {
      if (activePointerId !== event.pointerId || !captureKind) {
        return;
      }
      if (event.buttons === 0) {
        endPointer(event);
        return;
      }
      rememberPointer(event);
      applySnap(event.shiftKey);
      applyMirror(event.altKey);
      if (flushMoveImmediately) {
        flushMoveImmediately = false;
        flushPendingMove();
        return;
      }
      if (panFrame) {
        return;
      }
      panFrame = window.requestAnimationFrame(() => {
        panFrame = 0;
        const next = pendingPan;
        pendingPan = null;
        if (next) {
          postCanvasPointer('move', next, next.spacingEdge, readSelectedLayoutSize(), readRotatePayload(next, activeRotateAxisRef.current));
        }
      });
    }

    /** onPointerUp：指针抬起结束捕获。 */
    function onPointerUp(event: PointerEvent) {
      endPointer(event);
    }

    /** onAuxClick：阻止中键默认行为（如自动滚动）。 */
    function onAuxClick(event: MouseEvent) {
      if (event.button === 1) {
        event.preventDefault();
      }
    }

    /** onMouseDown：中键按下时 preventDefault，配合平移。 */
    function onMouseDown(event: MouseEvent) {
      if (event.button === 1) {
        event.preventDefault();
      }
    }

    /** postKey：把快捷键/修饰键事件回传父页。 */
    function postKey(type: 'keydown' | 'keyup', event: KeyboardEvent) {
      postToParent({
        type,
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
    }

    /** onKeyDown：Shift/Alt 吸附镜像、间距微调与编辑快捷键。 */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Shift' && !event.repeat) {
        applySnap(true);
      }
      if (event.key === 'Alt' && !event.repeat) {
        if (captureKind === 'spacing' || spacingDragRef.current) {
          event.preventDefault();
        }
        applyMirror(true);
      }
      if (
        spacingDragRef.current &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key === 'Escape' || event.key === 'Enter')
      ) {
        event.preventDefault();
        event.stopPropagation();
        postKey('keydown', event);
        return;
      }
      if (
        editingRef.current &&
        spacingDragRef.current &&
        !event.ctrlKey &&
        !event.metaKey &&
        isSpacingNudgeKey(event.key, event.code, spacingDragRef.current) &&
        (spacingDragRef.current === 'rotate'
          ? heldAxesRef.current.length > 0 || ['1', '2', '3', 'ArrowUp', 'ArrowDown'].includes(event.key)
          : !isSpacingValueKey(event.key, event.code) ||
            allSelectedRef.current ||
            heldEdgesRef.current.length > 0)
      ) {
        event.preventDefault();
        event.stopPropagation();
        postKey('keydown', event);
        return;
      }
      if (
        editingRef.current &&
        lastPostedSelectRef.current &&
        event.key === 'Enter' &&
        !event.altKey &&
        !event.repeat
      ) {
        event.preventDefault();
        event.stopPropagation();
        postKey('keydown', event);
        return;
      }
      if (
        editingRef.current &&
        lastPostedSelectRef.current &&
        event.key === 'Tab' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.repeat
      ) {
        event.preventDefault();
        event.stopPropagation();
        postKey('keydown', event);
        return;
      }
      const shortcut = matchWidgetShortcut(event);
      if (!shortcut) {
        return;
      }
      const boxGroup = isBoxGroupShortcut(shortcut);
      const textStyle = isTextStyleShortcut(shortcut);
      if (!editingRef.current && shortcut !== 'save' && !boxGroup && !textStyle) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!editingRef.current && (boxGroup || textStyle)) {
        return;
      }
      postKey('keydown', event);
    }

    /** onKeyUp：松开 Shift/Alt，以及间距微调键抬起。 */
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === 'Shift') {
        applySnap(false);
      }
      if (event.key === 'Alt') {
        applyMirror(false);
      }
      if (
        editingRef.current &&
        spacingDragRef.current &&
        !event.ctrlKey &&
        !event.metaKey &&
        isSpacingNudgeKey(event.key, event.code, spacingDragRef.current) &&
        (spacingDragRef.current === 'rotate'
          ? heldAxesRef.current.length > 0 || ['1', '2', '3', 'ArrowUp', 'ArrowDown'].includes(event.key)
          : !isSpacingValueKey(event.key, event.code) ||
            allSelectedRef.current ||
            heldEdgesRef.current.length > 0)
      ) {
        event.preventDefault();
        event.stopPropagation();
        postKey('keyup', event);
      }
    }

    function onBlur() {
      applySnap(false);
      applyMirror(false);
    }

    const surface = document;
    surface.addEventListener('click', onClick);
    surface.addEventListener('dblclick', onDoubleClick);
    surface.addEventListener('mousemove', onMouseMove);
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('pointerdown', onPointerDown, true);
    surface.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    surface.addEventListener('auxclick', onAuxClick, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      if (hoverFrame) {
        window.cancelAnimationFrame(hoverFrame);
      }
      if (panFrame) {
        window.cancelAnimationFrame(panFrame);
      }
      clearClimbTimer();
      setDragShield(false);
      surface.removeEventListener('click', onClick);
      surface.removeEventListener('dblclick', onDoubleClick);
      surface.removeEventListener('mousemove', onMouseMove);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      surface.removeEventListener('wheel', onWheel);
      surface.removeEventListener('pointerdown', onPointerDown, true);
      surface.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      surface.removeEventListener('auxclick', onAuxClick, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return (
    <div className="preview-camera" ref={cameraRef}>
      <div
        ref={hostRef}
        className={[
          'preview-host',
          editing ? 'is-editing' : '',
          hostRef.current?.classList.contains('is-select-faded') ? 'is-select-faded' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {error ? <p className="preview-error">{error}</p> : null}
        <div ref={mountRef} className="preview-mount" />
      </div>
    </div>
  );
}
