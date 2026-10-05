import './styles.less';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderPage } from '@vanstack/lowcode-runtime';
import { api } from '../../apis/api';
import { eventScriptJavaScript } from '../../utils/eventScript';
import type { PageI18n } from '@vanstack/xml';
import { isLowcodeMessage, type TableChromeState } from '../../utils/lowcode-protocol';
import { isBoxGroupShortcut, isTextStyleShortcut, matchWidgetShortcut } from '../../utils/widgetShortcuts';
import { previewVisualScale, setSpacingActiveEdge, setSpacingDragCursor, setSpacingHeldEdges, setSpacingMirror, setSpacingSnap, setRotateHeldAxes, spacingActionFromTarget, spacingEdgeFromTarget, rotateAxisFromTarget, rotateLayoutClientCenter, syncSpacingGuides, syncSpacingMask, widgetLayoutSize } from '../../utils/spacingGuides';
import type { BoxDragKind, SpacingEdge } from '../../utils/spacingDrag';
import { isBoxDragKind, isSpacingNudgeKey, isSpacingValueKey, SPACING_EDGES } from '../../utils/spacingDrag';
import { pointerAngleDeg, type RotateAxis } from '../../utils/rotateDrag';
import { applyEditorChromeScale, applyLiveWidgetCss, applyViewport, applyWidgetState, FOCUS_DBLCLICK_MS, focusModifier, paintPreviewCamera, paintWidgetChrome, parentWidgetId, postCanvasPointer, postToParent, postWidgetHover, setSelectFaded } from './helpers';
import { applyLiveTableTrack, readTableTrackPair, syncTableChrome, syncTableReveal, type TableChromeLabels } from './tableChrome';

export function PreviewPage() {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const documentKeyRef = useRef('');
  const componentsKeyRef = useRef('');
  const editingRef = useRef(true);
  const localeRef = useRef<string | undefined>(undefined);
  const catalogRef = useRef<string>('null');
  const viewingOwnerIdRef = useRef<string | null>(null);
  const viewingStateRef = useRef<string | null>(null);
  const viewingStatesRef = useRef('');
  const projectIdRef = useRef<string | null>(null);
  const pageIdRef = useRef<string | null>(null);
  const tableLayoutRef = useRef(false);
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
  const tableChromeRef = useRef<TableChromeState | null>(null);
  const tableDragKeyRef = useRef<string | null>(null);
  const tableEditingRef = useRef(false);
  const centerContentRef = useRef(false);
  const useComponentTestDataRef = useRef(false);
  const chromeLabelsRef = useRef<TableChromeLabels>({
    moveLeft: '',
    moveRight: '',
    moveUp: '',
    moveDown: '',
    addColumn: '',
    removeColumn: '',
    addRow: '',
    removeRow: '',
    freezeHeader: '',
    freezeFooter: '',
    editTable: '',
    exitTable: '',
  });
  chromeLabelsRef.current = {
    moveLeft: t('lowcode.tableMoveColumnLeft'),
    moveRight: t('lowcode.tableMoveColumnRight'),
    moveUp: t('lowcode.tableMoveRowUp'),
    moveDown: t('lowcode.tableMoveRowDown'),
    addColumn: t('lowcode.tableAddColumn'),
    removeColumn: t('lowcode.tableRemoveColumn'),
    addRow: t('lowcode.tableAddRow'),
    removeRow: t('lowcode.tableRemoveRow'),
    freezeHeader: t('lowcode.tableFreezeHeader'),
    freezeFooter: t('lowcode.tableFreezeFooter'),
    editTable: t('lowcode.tableEdit'),
    exitTable: t('lowcode.tableExitEdit'),
  };
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [hostTableEditing, setHostTableEditing] = useState(false);

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

  function refreshTableChrome() {
    syncTableReveal(hostRef.current, mountRef.current, editingRef.current, tableEditingRef.current);
    syncTableChrome(
      hostRef.current,
      mountRef.current,
      tableChromeRef.current,
      viewScaleRef.current,
      editingRef.current,
      tableDragKeyRef.current,
      chromeLabelsRef.current,
    );
  }

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    let settleJob = 0;
    /** 模式切换后等页面尺寸连续两帧不变，再通知父页揭开画布。 */
    function scheduleCanvasSettle(token: number) {
      settleJob += 1;
      const job = settleJob;
      const started = performance.now();
      const root = mountRef.current;
      const images = root ? [...root.querySelectorAll('img')].filter((img) => !img.complete) : [];
      let imagesReady = images.length === 0;
      if (!imagesReady) {
        let left = images.length;
        const markImage = () => {
          left -= 1;
          if (left <= 0) {
            imagesReady = true;
          }
        };
        for (const img of images) {
          img.addEventListener('load', markImage, { once: true });
          img.addEventListener('error', markImage, { once: true });
        }
      }
      let last = '';
      let stable = 0;
      const tick = () => {
        if (job !== settleJob) {
          return;
        }
        const page = mountRef.current?.querySelector<HTMLElement>('.lowcode-page');
        const mark = page ? `${page.offsetWidth}:${page.offsetHeight}:${page.scrollWidth}:${page.scrollHeight}` : '';
        if (imagesReady && mark === last) {
          stable += 1;
        } else {
          last = mark;
          stable = 0;
        }
        if ((imagesReady && stable >= 2) || performance.now() - started > 800) {
          postToParent({ type: 'canvas-settled', settle: token });
          return;
        }
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    }

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
            !tableEditingRef.current,
          );
          refreshTableChrome();
          postSelectedLayoutSize();
        }
        return;
      }
      if (event.data.type !== 'preview' || !mountRef.current) {
        return;
      }
      const {
        document,
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
        projectId,
        pageId,
        viewingOwnerId,
        viewingState,
        viewingStates,
        spacingDrag,
        tableLayout,
        tableChrome,
        tableEditing,
        settle,
        components,
        centerContent,
        useComponentTestData,
      } = event.data;
      const nextEditing = mode !== 'preview';
      const nextLocale = locale || undefined;
      const nextCatalog = catalog as PageI18n | undefined;
      const nextCatalogKey = JSON.stringify(nextCatalog ?? null);
      const nextSpacing = spacingDrag ?? null;
      const nextViewingOwner = viewingOwnerId ?? null;
      const nextViewingState = viewingState ?? null;
      const nextViewingStates = JSON.stringify(viewingStates ?? null);
      const nextProjectId = projectId || null;
      const nextPageId = pageId || null;
      const nextTableLayout = Boolean(tableLayout) && nextEditing;
      const nextDocumentKey = JSON.stringify(document);
      const nextComponentsKey = JSON.stringify(components ?? null);
      const nextCenterContent = Boolean(centerContent);
      const nextUseComponentTestData = Boolean(useComponentTestData);
      const shouldRender =
        nextDocumentKey !== documentKeyRef.current ||
        nextComponentsKey !== componentsKeyRef.current ||
        nextCenterContent !== centerContentRef.current ||
        nextUseComponentTestData !== useComponentTestDataRef.current ||
        nextEditing !== editingRef.current ||
        nextTableLayout !== tableLayoutRef.current ||
        nextLocale !== localeRef.current ||
        nextCatalogKey !== catalogRef.current ||
        nextViewingOwner !== viewingOwnerIdRef.current ||
        nextViewingState !== viewingStateRef.current ||
        nextViewingStates !== viewingStatesRef.current ||
        nextProjectId !== projectIdRef.current ||
        nextPageId !== pageIdRef.current;
      editingRef.current = nextEditing;
      const nextTableEditing = nextEditing && Boolean(tableEditing);
      tableEditingRef.current = nextTableEditing;
      setHostTableEditing(nextTableEditing);
      tableChromeRef.current = nextEditing ? (tableChrome ?? null) : null;
      tableLayoutRef.current = nextTableLayout;
      localeRef.current = nextLocale;
      catalogRef.current = nextCatalogKey;
      viewingOwnerIdRef.current = nextViewingOwner;
      viewingStateRef.current = nextViewingState;
      viewingStatesRef.current = nextViewingStates;
      projectIdRef.current = nextProjectId;
      pageIdRef.current = nextPageId;
      centerContentRef.current = nextCenterContent;
      useComponentTestDataRef.current = nextUseComponentTestData;
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
        documentKeyRef.current = nextDocumentKey;
        componentsKeyRef.current = nextComponentsKey;
        const result = renderPage(mountRef.current, document, {
          editing: nextEditing,
          tableLayout: nextTableLayout,
          locale: nextLocale,
          catalog: nextCatalog,
          viewingOwnerId: nextViewingOwner,
          viewingState: nextViewingState,
          viewingStates: viewingStates ?? null,
          onModelValue: (name, value, done) => postToParent({ type: 'model-value', name, value, done }),
          loadWidgetEvent: nextProjectId
            ? async (id) => {
                try {
                  const script = await api.getWidgetEvent(nextProjectId, id);
                  return eventScriptJavaScript(script.source);
                } catch {
                  return null;
                }
              }
            : undefined,
          pageId: nextPageId,
          components,
          centerContent: nextCenterContent,
          useComponentTestData: nextUseComponentTestData,
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
        !nextTableEditing,
      );
      refreshTableChrome();
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
      if (typeof settle === 'number') {
        scheduleCanvasSettle(settle);
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
        const hit = canvasHit(target);
        chromeTargetRef.current = hit ?? target;
        reportHover(hit ?? target);
        paintWidgetChrome(
          hostRef.current,
          mountRef.current,
          hit ?? target,
          viewScaleRef.current,
          editingRef.current,
          spacingDragRef.current,
          !tableEditingRef.current,
        );
        refreshTableChrome();
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
        !tableEditingRef.current,
      );
      refreshTableChrome();
    }

    /** clearClimbTimer：取消 Ctrl 单击上钻的延时。 */
    function clearClimbTimer() {
      if (climbTimerRef.current) {
        window.clearTimeout(climbTimerRef.current);
        climbTimerRef.current = 0;
      }
    }

    /** climbSelection：再次点击时上选父级。到最外层后再点一次，回到这次点击的最里层。表格编辑中到行后同样回到最里层。 */
    function climbSelection(fromId: string, innermostId: string): string {
      const parentId = parentWidgetId(mountRef.current, fromId);
      if (!parentId) {
        return innermostId;
      }
      if (!tableEditingRef.current) {
        return parentId;
      }
      const from = mountRef.current?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(fromId)}"]`);
      const parent = mountRef.current?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(parentId)}"]`);
      if (
        (from?.dataset.widgetType === 'tr' || from?.dataset.widgetType === 'th') &&
        parent?.dataset.widgetType === 'table'
      ) {
        return innermostId;
      }
      return parentId;
    }

    /** canvasHit：未进入表格编辑时，表格内部的悬停和点击都算在表格上。 */
    function canvasHit(target: EventTarget | null) {
      if (!(target instanceof Element)) {
        return null;
      }
      const node = target.closest('[data-widget-id]');
      if (!(node instanceof HTMLElement)) {
        return null;
      }
      let hit = node;
      if (!tableEditingRef.current) {
        const table = node.closest('.lowcode-table');
        if (table instanceof HTMLElement) {
          hit = table;
        }
      }
      let host: HTMLElement | null = null;
      let current: Element | null = hit;
      while (current) {
        if (current instanceof HTMLElement && current.dataset.widgetType === 'component') {
          host = current;
        }
        current = current.parentElement;
      }
      return host ?? hit;
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
            !tableEditingRef.current,
          );
          refreshTableChrome();
          return;
        }
      }
      lastHoverKey = 'null';
      postWidgetHover(null);
    }

    function tableSelectFromTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) {
        return null;
      }
      const node = target.closest<HTMLElement>('[data-table-select]');
      if (!node?.dataset.tableId) {
        return null;
      }
      const kind = node.dataset.tableSelect;
      if (kind !== 'column' && kind !== 'row' && kind !== 'header') {
        return null;
      }
      return {
        tableId: node.dataset.tableId,
        target: kind,
        index: node.dataset.tableIndex != null ? Number(node.dataset.tableIndex) : undefined,
        rowId: node.dataset.tableRow,
      };
    }

    function tableResizeFromTarget(target: EventTarget | null): {
      tableId: string;
      target: 'column' | 'row' | 'header';
      index: number | undefined;
      rowId: string | undefined;
      value: number;
    } | null {
      if (!(target instanceof Element)) {
        return null;
      }
      const node = target.closest<HTMLElement>('[data-table-resize]');
      if (!node?.dataset.tableId) {
        return null;
      }
      const kind = node.dataset.tableResize;
      if (kind !== 'column' && kind !== 'row' && kind !== 'header') {
        return null;
      }
      const value = Number(node.dataset.tableValue);
      if (!Number.isFinite(value)) {
        return null;
      }
      return {
        tableId: node.dataset.tableId,
        target: kind,
        index: node.dataset.tableIndex != null ? Number(node.dataset.tableIndex) : undefined,
        rowId: node.dataset.tableRow,
        value,
      };
    }

    /** onClick：单击选中；同锚点再点上钻父级（Ctrl 时延时，避免挡双击）。 */
    function onClick(event: MouseEvent) {
      if (!editingRef.current || event.button !== 0) {
        return;
      }
      const field = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (field && !field.readOnly && field.dataset.modelName) {
        const hit = canvasHit(event.target);
        if (hit?.dataset.widgetId) {
          postSelect(hit.dataset.widgetId);
        }
        return;
      }
      const modeNode = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-table-mode]') : null;
      const tableMode = modeNode?.dataset.tableMode;
      if (tableMode === 'enter' || tableMode === 'exit') {
        event.preventDefault();
        event.stopPropagation();
        postToParent({ type: 'table-mode', action: tableMode });
        return;
      }
      const commandNode = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-table-command]') : null;
      const command = commandNode?.dataset.tableCommand;
      if (
        command === 'add-column' ||
        command === 'remove-column' ||
        command === 'move-column-left' ||
        command === 'move-column-right' ||
        command === 'add-row' ||
        command === 'remove-row' ||
        command === 'move-row-up' ||
        command === 'move-row-down'
      ) {
        event.preventDefault();
        event.stopPropagation();
        postToParent({ type: 'table-command', command });
        return;
      }
      const freezeNode = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-table-freeze]') : null;
      const freeze = freezeNode?.dataset.tableFreeze;
      if (freeze === 'header' || freeze === 'footer') {
        event.preventDefault();
        event.stopPropagation();
        postToParent({ type: 'table-freeze', target: freeze });
        return;
      }
      const tablePick = tableSelectFromTarget(event.target);
      if (tablePick) {
        event.preventDefault();
        event.stopPropagation();
        postToParent({ type: 'table-select', ...tablePick });
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
      const hit = canvasHit(event.target);
      const hitId = hit?.dataset.widgetId ?? null;
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
        if (!tableEditingRef.current) {
          postToParent({ type: 'dismiss-toolbar' });
        }
        return;
      }
      if (tableEditingRef.current && hit?.dataset.widgetType === 'table') {
        return;
      }
      if (hitId !== climbAnchorIdRef.current) {
        clearClimbTimer();
        climbAnchorIdRef.current = hitId;
        postSelect(hitId);
        return;
      }
      const current = lastPostedSelectRef.current ?? null;
      const next = climbSelection(!current || current === hitId ? hitId : current, hitId);
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
      const widget = canvasHit(event.target);
      const widgetId = widget?.dataset.widgetId ?? null;
      if (!widgetId || !widget) {
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

    /** onWheel：滚轮缩放，回传父页。编辑时表格不滚动。 */
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
      const tableResize = tableResizeFromTarget(event.target);
      if (editingRef.current && event.button === 0 && tableResize) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = true;
        const dragKey =
          tableResize.target === 'header'
            ? 'header:header'
            : tableResize.target === 'column'
              ? `column:${tableResize.index ?? ''}`
              : `row:${tableResize.rowId ?? ''}`;
        tableDragKeyRef.current = dragKey;
        refreshTableChrome();
        const previousCursor = document.documentElement.style.cursor;
        document.documentElement.style.cursor = tableResize.target === 'column' ? 'col-resize' : 'row-resize';
        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        const host = hostRef.current;
        const pair = readTableTrackPair(
          mountRef.current,
          tableResize.tableId,
          tableResize.target,
          tableResize.index,
          tableResize.rowId,
        );
        let latest = pair?.start ?? tableResize.value;
        let latestNext: number | undefined;
        let dragFrame = 0;
        const paintTrack = (clientX: number, clientY: number) => {
          const scale = host ? previewVisualScale(host, viewScaleRef.current || 1) : viewScaleRef.current || 1;
          const delta = tableResize.target === 'column' ? (clientX - startX) / scale : (clientY - startY) / scale;
          const requested = Math.max(24, Math.round((pair?.start ?? tableResize.value) + delta));
          const applied = applyLiveTableTrack(
            mountRef.current,
            tableResize.tableId,
            tableResize.target,
            tableResize.index,
            tableResize.rowId,
            requested,
            pair,
          );
          if (applied) {
            latest = applied.value;
            latestNext = applied.nextValue;
          }
          refreshTableChrome();
        };
        const onMove = (moveEvent: PointerEvent) => {
          if (moveEvent.pointerId !== pointerId) {
            return;
          }
          if (dragFrame) {
            window.cancelAnimationFrame(dragFrame);
          }
          const clientX = moveEvent.clientX;
          const clientY = moveEvent.clientY;
          dragFrame = window.requestAnimationFrame(() => {
            dragFrame = 0;
            paintTrack(clientX, clientY);
          });
        };
        const onUp = (upEvent: PointerEvent) => {
          if (upEvent.pointerId !== pointerId) {
            return;
          }
          window.removeEventListener('pointermove', onMove, true);
          window.removeEventListener('pointerup', onUp, true);
          window.removeEventListener('pointercancel', onUp, true);
          if (dragFrame) {
            window.cancelAnimationFrame(dragFrame);
            dragFrame = 0;
          }
          paintTrack(upEvent.clientX, upEvent.clientY);
          tableDragKeyRef.current = null;
          document.documentElement.style.cursor = previousCursor;
          refreshTableChrome();
          postToParent({
            type: 'table-resize',
            tableId: tableResize.tableId,
            target: tableResize.target,
            index: tableResize.index,
            rowId: tableResize.rowId,
            value: latest,
            ...(latestNext != null ? { nextValue: latestNext, ...(pair?.nextRowId ? { nextRowId: pair.nextRowId } : {}) } : {}),
            phase: 'up',
          });
        };
        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onUp, true);
        return;
      }
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
      const field = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (field && !field.readOnly && field.dataset.modelName) {
        return;
      }
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
        editingRef.current &&
        tableEditingRef.current &&
        event.key === 'Escape' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        postKey('keydown', event);
        return;
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
          hostTableEditing ? 'is-table-editing' : '',
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