import './styles.less';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { installPageNavigation, renderPage } from '@vanstack/lowcode-runtime';
import { api } from '../../apis/api';
import { eventScriptJavaScript } from '../../utils/eventScript';
import type { PageI18n } from '@vanstack/xml';
import { isLowcodeMessage, type LowcodeWidgetBoxModel, type TableChromeState } from '../../utils/lowcode-protocol';
import { isBoxGroupShortcut, isTextStyleShortcut, matchWidgetShortcut } from '../../utils/widgetShortcuts';
import { previewVisualScale, setSpacingActiveEdge, setSpacingDragCursor, setSpacingHeldEdges, setSpacingMirror, setSpacingSnap, setRotateHeldAxes, spacingActionFromTarget, spacingEdgeFromTarget, rotateAxisFromTarget, rotateLayoutClientCenter, syncSpacingGuides, syncSpacingMask, widgetLayoutSize } from '../../utils/spacingGuides';
import type { BoxDragKind, SpacingEdge } from '../../utils/spacingDrag';
import { isBoxDragKind, isSpacingNudgeKey, isSpacingValueKey, SPACING_EDGES } from '../../utils/spacingDrag';
import { pointerAngleDeg, type RotateAxis } from '../../utils/rotateDrag';
import { applyEditorChromeScale, applyLiveWidgetCss, applyViewport, applyWidgetState, clearLiveInlineStyles, FOCUS_DBLCLICK_MS, focusModifier, paintPreviewCamera, paintWidgetChrome, parentWidgetId, postCanvasPointer, postToParent, postWidgetHover, resolveWidgetNode, setSelectFaded, toRawWidgetId } from './helpers';
import { applyLiveTableTrack, readTableTrackPair, syncTableChrome, syncTableReveal, type TableChromeLabels } from './tableChrome';
import { leafOpenEditor, paintScrollModeButton, paintSwiperModeButton, syncComponentSlotFocus, syncScrollReveal, syncSwiperReveal, type ScrollChromeLabels, type SwiperChromeLabels } from './scrollChrome';

const FONT_FACES_ID = 'vanstack-preview-fonts';

function applyFontFaces(fonts: Record<string, string>) {
  let el = document.getElementById(FONT_FACES_ID) as HTMLStyleElement | null;
  const families = Object.keys(fonts);
  if (families.length === 0) {
    if (el) {
      el.remove();
    }
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = FONT_FACES_ID;
    document.head.appendChild(el);
  }
  el.textContent = families
    .filter((family) => fonts[family])
    .map((family) => `@font-face { font-family: '${family}'; src: url('${fonts[family]}'); font-display: swap; }`)
    .join('\n');
}

/** readSlotParams：读取运行时挂到插槽占位上的、该实例解析后的插槽入参值。 */
function readSlotParams(node: HTMLElement): Record<string, unknown> | null {
  const raw = node.dataset.slotParams;
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

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
  const iconsKeyRef = useRef('{}');
  const fontsKeyRef = useRef('{}');
  const assetsKeyRef = useRef('{}');
  const animationsKeyRef = useRef('[]');
  const pageIdRef = useRef<string | null>(null);
  const queryKeyRef = useRef('{}');
  const previewEpochRef = useRef(0);
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
  const tableEditingIdRef = useRef<string | null>(null);
  const scrollEditingRef = useRef(false);
  const swiperEditingRef = useRef(false);
  const componentEditingRef = useRef(false);
  const componentEditIdRef = useRef<string | null>(null);
  /** 插槽使用编辑：正在编辑的插槽在 DOM 上的 id（`实例id__模板插槽id`），为空表示不隔离。 */
  const slotFocusIdRef = useRef<string | null>(null);
  const slotDebugIdRef = useRef<string | null>(null);
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
  const scrollLabelsRef = useRef<ScrollChromeLabels>({ editScroll: '', exitScroll: '' });
  scrollLabelsRef.current = {
    editScroll: t('lowcode.scrollEdit'),
    exitScroll: t('lowcode.tableExitEdit'),
  };
  const swiperLabelsRef = useRef<SwiperChromeLabels>({ editSwiper: '', exitSwiper: '' });
  swiperLabelsRef.current = {
    editSwiper: t('lowcode.swiperEdit'),
    exitSwiper: t('lowcode.tableExitEdit'),
  };
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [hostTableEditing, setHostTableEditing] = useState(false);
  const [hostScrollEditing, setHostScrollEditing] = useState(false);
  const [hostSwiperEditing, setHostSwiperEditing] = useState(false);
  const [hostComponentEditing, setHostComponentEditing] = useState(false);
  const editLeafIdRef = useRef<string | null | undefined>(undefined);

  /** componentEditTargetOk：插槽使用编辑下仅被聚焦插槽内的内容允许悬停/选中。 */
  function componentEditTargetOk(target: EventTarget | null): boolean {
    if (!componentEditingRef.current) {
      return true;
    }
    if (!(target instanceof Element)) {
      return false;
    }
    const host = target.closest<HTMLElement>('.lowcode-component');
    if (!host) {
      return false;
    }
    if (host === target) {
      return false;
    }
    // 不依赖 id 格式：只放行位于本次聚焦插槽内（含插槽自身及其内容）的节点；
    // 组件模板与其它插槽一律排除。
    return Boolean(target.closest<HTMLElement>('.lowcode-slot.is-slot-focus'));
  }

  /** hoverSafeTarget：所有画布 chrome 重绘入口统一走白名单，避免缩放等重绘把非插槽节点画成 hover 框。 */
  function hoverSafeTarget(target: EventTarget | null): EventTarget | null {
    return componentEditTargetOk(target) ? target : null;
  }

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

  /** readSelectedBoxModel：读取选中控件的实测盒模型（布局 px，clientWidth/getComputedStyle 均不含画布缩放）。 */
  function readSelectedBoxModel(selected: HTMLElement): LowcodeWidgetBoxModel | undefined {
    const view = selected.ownerDocument.defaultView;
    if (!view) {
      return undefined;
    }
    const css = view.getComputedStyle(selected);
    const px = (raw: string) => {
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed)) {
        return 0;
      }
      return Math.round(parsed * 10) / 10;
    };
    const padding = { top: px(css.paddingTop), right: px(css.paddingRight), bottom: px(css.paddingBottom), left: px(css.paddingLeft) };
    return {
      contentWidth: Math.max(0, Math.round((selected.clientWidth - padding.left - padding.right) * 10) / 10),
      contentHeight: Math.max(0, Math.round((selected.clientHeight - padding.top - padding.bottom) * 10) / 10),
      margin: { top: px(css.marginTop), right: px(css.marginRight), bottom: px(css.marginBottom), left: px(css.marginLeft) },
      border: { top: px(css.borderTopWidth), right: px(css.borderRightWidth), bottom: px(css.borderBottomWidth), left: px(css.borderLeftWidth) },
      padding,
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
    postToParent({ type: 'widget-box', widgetId, width: size.width, height: size.height, boxModel: readSelectedBoxModel(selected) });
  }

  function refreshTableChrome() {
    const hoverWidget = chromeTargetRef.current instanceof HTMLElement ? chromeTargetRef.current : null;
    const hasSpacingDrag = Boolean(spacingDragRef.current);
    syncTableReveal(
      hostRef.current,
      mountRef.current,
      editingRef.current,
      tableEditingRef.current,
      tableEditingIdRef.current,
    );
    syncScrollReveal(hostRef.current, mountRef.current, editingRef.current, scrollEditingRef.current);
    syncSwiperReveal(hostRef.current, mountRef.current, editingRef.current, swiperEditingRef.current);
    syncComponentSlotFocus(hostRef.current, mountRef.current, editingRef.current, componentEditingRef.current, slotFocusIdRef.current);
  paintScrollModeButton(
    hostRef.current,
    mountRef.current,
    viewScaleRef.current,
    editingRef.current,
    scrollEditingRef.current,
    scrollLabelsRef.current,
    hoverWidget,
    hasSpacingDrag,
  );
  paintSwiperModeButton(
    hostRef.current,
    mountRef.current,
    viewScaleRef.current,
    editingRef.current,
    swiperEditingRef.current,
    swiperLabelsRef.current,
    hoverWidget,
    hasSpacingDrag,
  );
    syncTableChrome(
      hostRef.current,
      mountRef.current,
      tableChromeRef.current,
      viewScaleRef.current,
      editingRef.current,
      tableDragKeyRef.current,
      chromeLabelsRef.current,
      hoverWidget,
      hasSpacingDrag,
    );
    const leaf = editingRef.current ? leafOpenEditor(mountRef.current) : null;
    const leafId = leaf?.dataset.widgetId ?? null;
    if (!leaf || !leafId) {
      if (editLeafIdRef.current !== null) {
        editLeafIdRef.current = null;
        postToParent({ type: 'edit-leaf', widgetId: null });
      }
      return;
    }
    const rect = leaf.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    if (leafId === editLeafIdRef.current) {
      return;
    }
    editLeafIdRef.current = leafId;
    postToParent({
      type: 'edit-leaf',
      widgetId: leafId,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
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
        const scroller = mountRef.current?.querySelector<HTMLElement>('.lowcode-page-scroll');
        const mark = page
          ? `${page.offsetWidth}:${page.offsetHeight}:${scroller?.scrollWidth ?? page.scrollWidth}:${scroller?.scrollHeight ?? page.scrollHeight}`
          : '';
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
            hoverSafeTarget(chromeTargetRef.current),
            viewScaleRef.current,
            editingRef.current,
            spacingDragRef.current,
            !swiperEditingRef.current,
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
        icons,
        assets,
        fonts,
        pageId,
        query,
        viewingOwnerId,
        viewingState,
        viewingStates,
        spacingDrag,
        tableLayout,
        tableChrome,
        tableEditing,
        tableEditingId,
        scrollEditing,
        swiperEditing,
        componentEditing,
        componentEditId,
        slotDebugId,
        slotFocusId,
        settle,
        components,
        centerContent,
        useComponentTestData,
        previewEpoch,
        animations,
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
      const nextIcons = icons && typeof icons === 'object' ? icons : {};
      const nextIconsKey = JSON.stringify(nextIcons);
      const nextFonts = fonts && typeof fonts === 'object' ? fonts : {};
      const nextFontsKey = JSON.stringify(nextFonts);
      const nextAssets = assets && typeof assets === 'object' ? assets : {};
      const nextAssetsKey = JSON.stringify(nextAssets);
      if (nextFontsKey !== fontsKeyRef.current) {
        fontsKeyRef.current = nextFontsKey;
        applyFontFaces(nextFonts);
      }
      const nextPageId = pageId || null;
      const nextQuery =
        query && typeof query === 'object' && !Array.isArray(query) ? query : {};
      const nextQueryKey = JSON.stringify(nextQuery);
      const nextTableLayout = Boolean(tableLayout) && nextEditing;
      const nextDocumentKey = JSON.stringify(document);
      const nextComponentsKey = JSON.stringify(components ?? null);
      const nextCenterContent = Boolean(centerContent);
      const nextUseComponentTestData = Boolean(useComponentTestData);
      const nextPreviewEpoch = typeof previewEpoch === 'number' ? previewEpoch : 0;
      const nextAnimations = Array.isArray(animations) ? animations : [];
      const nextAnimationsKey = JSON.stringify(nextAnimations);
      const nextTableEditing = nextEditing && Boolean(tableEditing);
      const nextTableEditingId = nextTableEditing && typeof tableEditingId === 'string' ? tableEditingId : null;
      const nextScrollEditing = nextEditing && Boolean(scrollEditing);
      const nextSwiperEditing = nextEditing && Boolean(swiperEditing);
      const nextComponentEditing = nextEditing && Boolean(componentEditing);
      const nextComponentEditId = nextComponentEditing ? componentEditId ?? null : null;
      const nextSlotDebugId = nextEditing ? slotDebugId ?? null : null;
      const nextSlotFocusId = nextComponentEditing ? slotFocusId ?? null : null;
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
        nextIconsKey !== iconsKeyRef.current ||
        nextAssetsKey !== assetsKeyRef.current ||
        nextPageId !== pageIdRef.current ||
        nextQueryKey !== queryKeyRef.current ||
        nextPreviewEpoch !== previewEpochRef.current ||
        nextComponentEditing !== componentEditingRef.current ||
        nextComponentEditId !== componentEditIdRef.current ||
        nextSlotFocusId !== slotFocusIdRef.current ||
        nextSlotDebugId !== slotDebugIdRef.current ||
        nextAnimationsKey !== animationsKeyRef.current;
      editingRef.current = nextEditing;
      tableEditingRef.current = nextTableEditing;
      tableEditingIdRef.current = nextTableEditingId;
      setHostTableEditing(nextTableEditing);
      scrollEditingRef.current = nextScrollEditing;
      setHostScrollEditing(nextScrollEditing);
      swiperEditingRef.current = nextSwiperEditing;
      setHostSwiperEditing(nextSwiperEditing);
      componentEditingRef.current = nextComponentEditing;
      setHostComponentEditing(nextComponentEditing);
      componentEditIdRef.current = nextComponentEditing ? componentEditId ?? null : null;
      slotDebugIdRef.current = nextSlotDebugId;
      slotFocusIdRef.current = nextSlotFocusId;
      tableChromeRef.current = nextEditing ? (tableChrome ?? null) : null;
      tableLayoutRef.current = nextTableLayout;
      localeRef.current = nextLocale;
      catalogRef.current = nextCatalogKey;
      viewingOwnerIdRef.current = nextViewingOwner;
      viewingStateRef.current = nextViewingState;
      viewingStatesRef.current = nextViewingStates;
      projectIdRef.current = nextProjectId;
      iconsKeyRef.current = nextIconsKey;
      assetsKeyRef.current = nextAssetsKey;
      pageIdRef.current = nextPageId;
      queryKeyRef.current = nextQueryKey;
      previewEpochRef.current = nextPreviewEpoch;
      animationsKeyRef.current = nextAnimationsKey;
      installPageNavigation(
        nextEditing
          ? null
          : {
              navigateTo(pageKey, next) {
                postToParent({ type: 'navigate', action: 'to', pageKey, query: next ?? {} });
              },
              navigateBack(times) {
                postToParent({ type: 'navigate', action: 'back', times: times ?? 1 });
              },
            },
      );
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
      const paintChrome = () => {
        if (shouldRender) {
          clearLiveInlineStyles(mountRef.current);
        }
        applyWidgetState(
          mountRef.current,
          selectedId,
          isBoxDragKind(spacingDragRef.current) ? spacingDragRef.current : null,
        );
        paintWidgetChrome(
          hostRef.current,
          mountRef.current,
          hoverSafeTarget(chromeTargetRef.current),
          viewScaleRef.current,
          nextEditing,
          spacingDragRef.current,
          !nextSwiperEditing,
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
      };
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
          onQueryValue: (name, value) => postToParent({ type: 'query-value', name, value }),
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
          // 组件「控件」变量通过实例调用暴露方法时，按方法 id 取方法体。
          loadFunction: nextProjectId
            ? async (id) => {
                try {
                  const saved = await api.getMethodCode(nextProjectId, id);
                  return saved.code;
                } catch {
                  return null;
                }
              }
            : undefined,
          query: nextEditing ? undefined : nextQuery,
          pageId: nextPageId ? `${nextPageId}:${nextQueryKey}` : null,
          components,
          centerContent: nextCenterContent,
          useComponentTestData: nextUseComponentTestData,
          // 仅纯组件编辑态或组件定义编辑器显示插槽占位 chrome；滚动/表格/轮播编辑态不显示。
          slotChrome:
            (componentEditingRef.current || centerContentRef.current) &&
            !scrollEditingRef.current &&
            !tableEditingRef.current &&
            !swiperEditingRef.current,
          // 组件编辑态（非组件定义编辑器）：实例内部树与数据解耦，显示只由状态栏选择驱动。
          componentEditing: componentEditingRef.current,
          componentEditId: componentEditIdRef.current,
          slotFocusId: slotFocusIdRef.current,
          slotDebugId: nextSlotDebugId,
          icons: nextIcons,
          assets: nextAssets,
          animations: nextAnimations,
          animationsKey: nextAnimationsKey,
          previewEpoch: nextPreviewEpoch,
          onCommit: () => paintChrome(),
        });
        setError(result.ok ? null : result.error);
      } else {
        paintChrome();
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
      // 组件编辑态：只允许插槽与插槽内容参与悬停/选中，其余节点一律抑制。
      if (!componentEditTargetOk(target)) {
        if (lastHoverKey !== 'null') {
          lastHoverKey = 'null';
          postWidgetHover(null);
        }
        return;
      }
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
        // 组件编辑态：非插槽节点不参与悬停绘制与上报。
        const hoverTarget = componentEditTargetOk(hit ?? target) ? hit : null;
        chromeTargetRef.current = hit ?? target;
        reportHover(hoverTarget);
        paintWidgetChrome(
          hostRef.current,
          mountRef.current,
          hoverTarget,
          viewScaleRef.current,
          editingRef.current,
          spacingDragRef.current,
          !swiperEditingRef.current,
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
        !swiperEditingRef.current,
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
      if (componentEditingRef.current) {
        // 组件编辑态：只允许在插槽与插槽内容之间上钻，超出白名单即钳制，绝不回到本体或其它节点。
        const parent = resolveWidgetNode(mountRef.current, parentId);
        if (!parent || !componentEditTargetOk(parent)) {
          return innermostId;
        }
        return parentId;
      }
      if (!tableEditingRef.current && !scrollEditingRef.current && !swiperEditingRef.current) {
        return parentId;
      }
      const from = resolveWidgetNode(mountRef.current, fromId);
      const parent = resolveWidgetNode(mountRef.current, parentId);
      if (
        (from?.dataset.widgetType === 'tr' || from?.dataset.widgetType === 'th') &&
        parent?.dataset.widgetType === 'table'
      ) {
        return innermostId;
      }
      if (scrollEditingRef.current && parent?.dataset.widgetType === 'scroll') {
        return innermostId;
      }
      if (swiperEditingRef.current && parent?.dataset.widgetType === 'swiper') {
        return innermostId;
      }
      return parentId;
    }

    /** canvasHit：未进入表格编辑时，表格内部的悬停和点击都算在表格上。 */
    function canvasHit(target: EventTarget | null) {
      if (!(target instanceof Element)) {
        return null;
      }
      // 编辑遮罩（滚动/表格/滑动器）：解析到它覆盖的控件，保证遮罩上的悬停/点击仍命中原控件。
      const mask = target.closest<HTMLElement>('[data-edit-mask-for]');
      if (mask) {
        const id = mask.dataset.editMaskFor;
        if (id) {
          const widget = mountRef.current?.querySelector<HTMLElement>(
            `[data-widget-id="${CSS.escape(id)}"]`,
          );
          if (widget) {
            return widget;
          }
        }
        return null;
      }
      const node = target.closest('[data-widget-id]');
      if (!(node instanceof HTMLElement)) {
        return null;
      }
      let hit = node;
      // 组件编辑态下不做任何向上折叠（表格/滚动/轮播）。组件实例往往嵌套在滚动容器里，
      // 若仍按页面态折叠，点击插槽/插槽内容会被折叠到外层滚动容器，随后被
      // componentEditTargetOk 白名单拒绝，导致插槽无法选中。
      if (!componentEditingRef.current) {
        if (!tableEditingRef.current) {
          const table = node.closest('.lowcode-table');
          if (table instanceof HTMLElement) {
            hit = table;
          }
        }
        // 表格编辑态下表格往往套在滚动/轮播容器里，不能把点击折叠到外层容器，
        // 否则选中的是外层的 scroll/swiper，父页会据此退出表格编辑态。
        if (!swiperEditingRef.current && !tableEditingRef.current) {
          const swiper = hit.closest('.lowcode-swiper');
          if (swiper instanceof HTMLElement) {
            hit = swiper;
          }
        }
        if (!scrollEditingRef.current && !tableEditingRef.current) {
          const scroll = hit.closest('.lowcode-scroll');
          if (scroll instanceof HTMLElement) {
            hit = scroll;
          }
        }
      }
      let host: HTMLElement | null = null;
      if (!componentEditingRef.current) {
        // 页面态点击组件实例时折叠到最外层组件外壳；组件编辑态下直接选中内部控件。
        let current: Element | null = hit;
        while (current) {
          if (current instanceof HTMLElement && current.dataset.widgetType === 'component') {
            host = current;
          }
          current = current.parentElement;
        }
      }
      return host ?? hit;
    }

    /** postSelect：通知父页选中变更，并刷新悬停框。 */
    function postSelect(widgetId: string | null) {
      lastPostedSelectRef.current = widgetId;
      postToParent({ type: 'select', widgetId });
      if (widgetId) {
        const widget = resolveWidgetNode(mountRef.current, widgetId);
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
            !swiperEditingRef.current,
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
      if (event.button !== 0) {
        return;
      }
      if (!editingRef.current) {
        // 组件定义编辑器的预览态：允许点选插槽占位（含循环展开出来的多份实例），
        // 把选中插槽及其当前实例解析后的入参回传父页，供右侧「数据」面板展示。
        if (!centerContentRef.current || !(event.target instanceof Element)) {
          return;
        }
        const slotEl = event.target.closest<HTMLElement>('[data-widget-type="slot"]');
        const slotId = slotEl?.dataset.widgetId;
        if (!slotEl || !slotId) {
          postToParent({ type: 'select', widgetId: null, slotParams: null });
          return;
        }
        event.preventDefault();
        postToParent({
          type: 'select',
          widgetId: slotId,
          slotParams: readSlotParams(slotEl),
        });
        return;
      }
      const field = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (field && !field.readOnly && field.dataset.modelName) {
        const hit = canvasHit(event.target);
        const hitFieldId = toRawWidgetId(hit?.dataset.widgetId);
        if (hitFieldId) {
          postSelect(hitFieldId);
        }
        return;
      }
      const swiperModeNode = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-swiper-mode]') : null;
      const swiperMode = swiperModeNode?.dataset.swiperMode;
      if (swiperMode === 'enter' || swiperMode === 'exit') {
        event.preventDefault();
        event.stopPropagation();
        postToParent({ type: 'swiper-mode', action: swiperMode });
        return;
      }
      const scrollModeNode = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-scroll-mode]') : null;
      const scrollMode = scrollModeNode?.dataset.scrollMode;
      if (scrollMode === 'enter' || scrollMode === 'exit') {
        event.preventDefault();
        event.stopPropagation();
        postToParent({ type: 'scroll-mode', action: scrollMode });
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
      const hitId = toRawWidgetId(hit?.dataset.widgetId);
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
        // 点空白一律通知取消节点选中；是否退出表格/容器编辑态由父页决定（编辑态保留）。
        postToParent({ type: 'dismiss-toolbar' });
        return;
      }
      if (tableEditingRef.current && hit?.dataset.widgetType === 'table') {
        return;
      }
      if (scrollEditingRef.current && hit?.dataset.widgetType === 'scroll') {
        return;
      }
      if (swiperEditingRef.current && hit?.dataset.widgetType === 'swiper') {
        return;
      }
      // 组件编辑态：只允许插槽及插槽内容进入选区（白名单），本体与其它节点一律不选。
      if (componentEditingRef.current && !componentEditTargetOk(hit)) {
        clearClimbTimer();
        climbAnchorIdRef.current = null;
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
      const widgetId = toRawWidgetId(widget?.dataset.widgetId);
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

    /** 返回滚轮命中的、还能滚动的滚动容器视图；否则返回 null。 */
    function wheelScrollView(event: WheelEvent): HTMLElement | null {
      const node = event.target;
      if (!(node instanceof Element)) {
        return null;
      }
      const view = node.closest('.lowcode-scroll-view, .lowcode-page-scroll');
      if (!(view instanceof HTMLElement) || view.closest('.lowcode-scroll')?.classList.contains('is-scroll-open')) {
        return null;
      }
      const style = window.getComputedStyle(view);
      const canAxis = (overflow: string, delta: number, pos: number, scrollSize: number, clientSize: number) => {
        if (delta === 0 || overflow === 'hidden' || overflow === 'visible' || scrollSize <= clientSize + 1) {
          return false;
        }
        return delta > 0 ? pos + clientSize < scrollSize - 1 : pos > 0;
      };
      return (
        canAxis(style.overflowY, event.deltaY, view.scrollTop, view.scrollHeight, view.clientHeight) ||
        canAxis(style.overflowX, event.deltaX, view.scrollLeft, view.scrollWidth, view.clientWidth)
      )
        ? view
        : null;
    }

    /** onWheel：按住 Ctrl/Cmd 时禁用画布缩放，命中滚动容器则滚动容器；否则普通滚轮缩放画布。预览态页面自己滚，不改画布缩放。 */
    function onWheel(event: WheelEvent) {
      if (!editingRef.current) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd + 滚轮：拦截浏览器缩放；命中滚动容器则滚动容器，否则吞掉事件，不做任何缩放。
        event.preventDefault();
        const view = wheelScrollView(event);
        if (view) {
          view.scrollTop += event.deltaY;
          view.scrollLeft += event.deltaX;
        }
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
        hostRef.current?.classList.add('is-table-track-dragging');
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
          hostRef.current?.classList.remove('is-table-track-dragging');
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
        (tableEditingRef.current || scrollEditingRef.current || swiperEditingRef.current) &&
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
          hostScrollEditing ? 'is-scroll-editing' : '',
          hostSwiperEditing ? 'is-swiper-editing' : '',
          hostComponentEditing ? 'is-component-editing' : '',
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