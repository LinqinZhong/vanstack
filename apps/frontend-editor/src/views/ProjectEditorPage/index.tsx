import './styles.less';
import { Form, Spin, message } from 'antd';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import type { ProjectComponentDto, ProjectDto, ProjectPageDto, ProjectPageVersionDto, ProjectVersionDto } from '@vanstack/shared';
import {
  DEFAULT_DRAWER_PLACE,
  DEFAULT_TABLE_HEADER_HEIGHT,
  EMPTY_PAGE_DOCUMENT,
  applyTestValues,
  buildPageDataScope,
  buildPropsRecord,
  defaultPageDataValue,
  compactPageI18n,
  compactPageTestData,
  compactWidgetStyle,
  normalizeInputModelValue,
  normalizePageDocument,
  presentRuntimeData,
  propModelName,
  validateDataLiteral,
  type ComponentEmit,
  type ComponentProp,
  type PageI18n,
  type PageMethod,
  type PageStyle,
  type PageTestData,
  type PageVariable,
  type PageWidget,
  type PageXmlDocument,
  type WidgetEvents,
  type WidgetStyle,
} from '@vanstack/xml';
import { api } from '../../apis/api';
import { ProjectVersionProvider } from '../../utils/projectVersion';
import {
  putCachedVersion,
  readOwnerVersionCache,
  reconcileOwnerVersions,
  releaseProjectVersionCache,
  retainProjectVersionCache,
} from '../../utils/versionCache';
import {
  forgetComponentSelection,
  forgetPageSelection,
  getRememberedComponentId,
  getRememberedPageId,
  getRememberedVersionId,
  pickRememberedId,
  rememberComponentId,
  rememberPageId,
  rememberVersionId,
} from '../../utils/editorSelection';
import { isLowcodeMessage, LOWCODE_MESSAGE_SOURCE } from '../../utils/lowcode-protocol';
import { isBoxGroupAllowed, type BoxGroup, type TableBubbleModel, type TableCommand } from '../../components/WidgetStyleBubble';
import { drawerSizeAxis, drawerStyleFromDrag } from '../../widgets/drawer';
import {
  applyRadiusDrag,
  applySizeDrag,
  applySpacingDrag,
  applySpacingNudge,
  applySpacingValue,
  pickSpacingEdge,
  spacingDigitFromNumpad,
  spacingEdgesFromSelectKeys,
  spacingNudgeFromArrow,
  spacingSelectKey,
  isSpacingSignKey,
  syncSizeQuad,
  uniqueSizeEdges,
  SPACING_EDGES,
  SPACING_NUDGE_REPEAT_MS,
  SPACING_NUDGE_REPEAT_STEP,
  SPACING_VALUE_MAX_DIGITS,
  type BoxDragKind,
  type SpacingEdge,
} from '../../utils/spacingDrag';
import {
  applyRotateDrag,
  applyRotateNudge,
  applyRotateValue,
  isRotateDecimalKey,
  isRotateSignKey,
  rotateAxesFromSelectKeys,
  rotateDigitFromNumpad,
  rotateSelectKey,
  shortestAngleDelta,
  styleRotateTriple,
  writeRotateStyle,
  ROTATE_VALUE_MAX_CHARS,
  type RotateAxis,
  type RotateTriple,
} from '../../utils/rotateDrag';
import { previewScreenElement, previewVisualScale, setSpacingDragCursor } from '../../utils/spacingGuides';
import type { BoxQuad } from '../../components/StyleBoxEdges';
import {
  isBoxGroupShortcut,
  isEditableKeyboardTarget,
  isTextStyleShortcut,
  matchWidgetShortcut,
  modifierShortcutLabel,
  type WidgetShortcut,
} from '../../utils/widgetShortcuts';
import {
  addWidgetToTree,
  cloneWidget,
  collectExpandableKeys,
  collectTreeStateIds,
  createWidget,
  findOwningScroll,
  findOwningSwiper,
  findParentWidget,
  findWidget,
  firstChildWidgetId,
  insertWidget,
  moveWidget,
  nextExpandedKeys,
  nextSiblingWidgetId,
  nextWidgetId,
  parentWidgetId,
  patchWidget,
  removeWidget,
  toWidgetTreeData,
  updateWidgetById,
  widgetTreeLabel,
  type WidgetPatch,
} from '../../utils/widgetTree';
import {
  addTableColumn,
  addTableRow,
  cellsOf,
  columnCellIds,
  columnIndexOf,
  findOwningTable,
  headerCellIds,
  tableChromeState,
  moveTableColumn,
  moveTableRow,
  patchTableCells,
  removeTableColumn,
  removeTableRow,
  rowCellIds,
  setTableColumnWidth,
  setTableHeaderHeight,
  setTableRowHeight,
  type TableParts,
  type TableRange,
} from '../../utils/tableEdit';
import {
  collectStateTree,
  patchResolvedWidget,
  pruneViewingByOwner,
  stateLayersForWidget,
  stateOwnKeys,
  viewingAfterSelect,
  viewingListFromMap,
  widgetWithStateLayers,
  type ViewingByOwner,
} from '../../utils/widgetStates';
import { refreshIconCatalog, subscribeIconCatalog } from '../../utils/iconCatalog';
import { publishEditorI18n } from '../../utils/i18nRuntime';
import { CANVAS_RASTER_SCALE, canEditPositionInsets, clampScale, closeStyleToolbarPopups, computeFitView, dragLengthPx, edgeBoxLength, EDIT_OVERFLOW_X, EDIT_OVERFLOW_Y, ENTER_DOUBLE_MS, FOCUS_PADDING, HISTORY_LIMIT, iframePointToClient, isAutoLength, isBoxDragGroup, isSpacingNudgeGroup, liveWidgetCss, mapIframePoint, MAX_SCALE, paintCanvasView, SCREEN_HEIGHT, SCREEN_WIDTH, sizeLock, snapDevicePixel, spacingAllowsNegative, styleBoxQuad, styleFromBoxQuad, zoomViewAt, ZOOM_IDLE_MS, ZOOM_STEP, type CanvasMode, type CenterTab, type HistoryEntry, type SaveStatus, type ViewTransform } from './helpers';
import {
  AddWidgetModal,
  AliasModal,
  CanvasWorkspace,
  CreateVersionModal,
  EditorHeader,
  EditorInspector,
  EditorLibraries,
  EditorRail,
  PageFormModal,
  PageListPanel,
  ProjectMissing,
  VersionListPanel,
  WidgetTreePanel,
  type AddWidgetChoice,
  type CatalogKind,
  type EditorNav,
  type PageFormValues,
  type VersionFormValues,
} from './components';

type LoadedTarget = {
  kind: CatalogKind;
  ownerId: string;
  versionId: string;
  projectVersionId: string | null;
};

function presentCanvasDocument(
  doc: PageXmlDocument,
  useTest: boolean,
  freezeData = true,
  dataEdits?: Readonly<Record<string, string>>,
  propEdits?: Readonly<Record<string, string>>,
): PageXmlDocument {
  const hasPropEdits = Boolean(propEdits && Object.keys(propEdits).length > 0);
  if (!useTest && !dataEdits && !hasPropEdits) {
    return doc;
  }
  const props = useTest || hasPropEdits
    ? applyTestValues(doc.props, { ...doc.testData?.props, ...propEdits })
    : doc.props;
  const dataOverrides = {
    ...(useTest ? doc.testData?.data : undefined),
    ...dataEdits,
  };
  const data = freezeData
    ? presentRuntimeData(
        doc.data,
        Object.keys(dataOverrides).length > 0 ? dataOverrides : undefined,
        buildPropsRecord(doc.props),
      )
    : doc.data;
  if (props === doc.props && data === doc.data) {
    return doc;
  }
  return {
    ...doc,
    ...(props ? { props } : {}),
    ...(data ? { data } : {}),
  };
}

function asPreviewQuery(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const query: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key && item !== undefined) {
      query[key] = item;
    }
  }
  return query;
}

export function ProjectEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [pages, setPages] = useState<ProjectPageDto[]>([]);
  const [components, setComponents] = useState<ProjectComponentDto[]>([]);
  const [catalogKind, setCatalogKind] = useState<CatalogKind>('page');
  const [versions, setVersions] = useState<ProjectPageVersionDto[]>([]);
  const [projectVersions, setProjectVersions] = useState<ProjectVersionDto[]>([]);
  const [projectVersionId, setProjectVersionId] = useState<string | null>(null);
  const [pageSnapshotId, setPageSnapshotId] = useState<string | null>(null);
  const [pageLoadToken, setPageLoadToken] = useState(0);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [componentProps, setComponentProps] = useState<ComponentProp[]>([]);
  const [pageQuery, setPageQuery] = useState<ComponentProp[]>([]);
  const [componentEmits, setComponentEmits] = useState<ComponentEmit[]>([]);
  const [componentDocsKey, setComponentDocsKey] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<PageWidget[]>([]);
  const [pageStyle, setPageStyle] = useState<PageStyle | undefined>(undefined);
  const [pageData, setPageData] = useState<PageVariable[]>([]);
  const [testData, setTestData] = useState<PageTestData | undefined>(undefined);
  const [pageEvents, setPageEvents] = useState<WidgetEvents | undefined>(undefined);
  const [pageMethods, setPageMethods] = useState<PageMethod[]>([]);
  const [pageI18n, setPageI18n] = useState<PageI18n | undefined>(undefined);
  const [iconCatalog, setIconCatalog] = useState<Record<string, string>>({});
  const [previewLocale, setPreviewLocale] = useState<string | null>(null);
  const [leftNav, setLeftNav] = useState<EditorNav>('develop');
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [tableRange, setTableRange] = useState<TableRange | null>(null);
  const [tableEditId, setTableEditId] = useState<string | null>(null);
  const [scrollEditId, setScrollEditId] = useState<string | null>(null);
  const [swiperEditId, setSwiperEditId] = useState<string | null>(null);
  const [viewingOwnerId, setViewingOwnerId] = useState<string | null>(null);
  const [viewingState, setViewingState] = useState<string | null>(null);
  const [viewingByOwner, setViewingByOwner] = useState<ViewingByOwner>({});
  const [openBoxGroup, setOpenBoxGroup] = useState<BoxGroup | null>(null);
  const [centerTab, setCenterTab] = useState<CenterTab>('layout');
  const [loading, setLoading] = useState(true);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<ProjectPageDto | null>(null);
  const [pageForm] = Form.useForm<PageFormValues>();
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [aliasModalId, setAliasModalId] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [versionForm] = Form.useForm<VersionFormValues>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetBoxRef = useRef<{ widgetId: string; width: number; height: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneScreenRef = useRef<HTMLDivElement>(null);
  const phoneFrameRef = useRef<HTMLDivElement>(null);
  const widgetTreeHostRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<PageXmlDocument>(EMPTY_PAGE_DOCUMENT);
  const documentKeyRef = useRef('');
  const readyRef = useRef(false);
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  const userAdjustedRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const panningRef = useRef(false);
  const panRafRef = useRef(0);
  const pendingPanRef = useRef<ViewTransform | null>(null);
  const zoomRafRef = useRef(0);
  const pendingZoomRef = useRef<{ clientX: number; clientY: number; factor: number } | null>(null);
  const zoomIdleTimerRef = useRef(0);
  const zoomingRef = useRef(false);
  const zoomLabelRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<CanvasMode>('edit');
  const [canvasSettling, setCanvasSettling] = useState(false);
  const [settleArm, setSettleArm] = useState(0);
  const modeRef = useRef<CanvasMode>('edit');
  const previewNavRef = useRef<Array<{ pageId: string; query: Record<string, unknown> }>>([]);
  const previewQueryRef = useRef<Record<string, unknown>>({});
  const previewEpochRef = useRef(0);
  const pagesRef = useRef<ProjectPageDto[]>([]);
  const navigatePreviewRef = useRef<
    (message: { action: 'to' | 'back'; pageKey?: string; query?: Record<string, unknown>; times?: number }) => void
  >(() => {});
  const [previewQuery, setPreviewQuery] = useState<Record<string, unknown>>({});
  const canvasSettlingRef = useRef(false);
  const settleGenRef = useRef(0);
  const ownerSwitchRef = useRef(false);
  const sawOwnerRef = useRef(false);
  const [versionsOpen, setVersionsOpen] = useState(true);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const spacingDragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    widgetId: string;
    kind: BoxDragKind;
    mirror: boolean;
    start: BoxQuad;
    edge: SpacingEdge | null;
    rotateStart?: RotateTriple;
    axis?: RotateAxis | null;
    startAngle?: number;
    lastRotateAngle?: number;
  } | null>(null);
  const spacingSessionRef = useRef<{
    widgetId: string;
    style?: WidgetStyle;
    pastLength: number;
  } | null>(null);
  const spacingCancelRef = useRef(false);
  const widgetsRef = useRef(widgets);
  const pageStyleRef = useRef(pageStyle);
  const pageDataRef = useRef(pageData);
  const testDataRef = useRef(testData);
  const previewDataEditsRef = useRef<Record<string, string>>({});
  const [previewDataEdits, setPreviewDataEdits] = useState<Record<string, string>>({});
  const previewPropEditsRef = useRef<Record<string, string>>({});
  const [previewPropEdits, setPreviewPropEdits] = useState<Record<string, string>>({});
  const previewQueryEditsRef = useRef<Record<string, string>>({});
  const [previewQueryEdits, setPreviewQueryEdits] = useState<Record<string, string>>({});
  const pageEventsRef = useRef(pageEvents);
  const pageMethodsRef = useRef(pageMethods);
  const commitModelRef = useRef<(name: string, value: string, done?: boolean) => void>(() => {});
  const pageI18nRef = useRef(pageI18n);
  const selectedWidgetIdRef = useRef(selectedWidgetId);
  const viewingOwnerIdRef = useRef(viewingOwnerId);
  const viewingStateRef = useRef(viewingState);
  const viewingByOwnerRef = useRef(viewingByOwner);
  const centerTabRef = useRef(centerTab);
  const openBoxGroupRef = useRef(openBoxGroup);
  const toolbarPopupOpenRef = useRef(false);
  const readOnlyRef = useRef(false);
  const clipboardRef = useRef<PageWidget | null>(null);
  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const coalesceKeyRef = useRef<string | null>(null);
  const selectWidgetRef = useRef<(id: string | null) => void>(() => undefined);
  const tableRangeRef = useRef<TableRange | null>(null);
  const tableEditIdRef = useRef<string | null>(null);
  const scrollEditIdRef = useRef<string | null>(null);
  const swiperEditIdRef = useRef<string | null>(null);
  const editOriginViewRef = useRef<ViewTransform | null>(null);
  const centeredEditIdRef = useRef<string | null>(null);
  const exitOneEditRef = useRef<() => boolean>(() => false);
  const tableContentPinRef = useRef({ x: 0, y: 0 });
  const enterTableEditRef = useRef<() => void>(() => undefined);
  const exitTableEditRef = useRef<() => boolean>(() => false);
  const enterScrollEditRef = useRef<() => void>(() => undefined);
  const exitScrollEditRef = useRef<() => boolean>(() => false);
  const enterSwiperEditRef = useRef<() => void>(() => undefined);
  const exitSwiperEditRef = useRef<() => boolean>(() => false);
  const selectTableRangeRef = useRef<(message: { tableId: string; target: 'column' | 'row' | 'header'; index?: number; rowId?: string }) => void>(() => undefined);
  const runTableCommandRef = useRef<(command: TableCommand) => void>(() => undefined);
  const freezeTableRef = useRef<(target: 'header' | 'footer') => void>(() => undefined);
  const resizeTableRef = useRef<(message: { tableId: string; target: 'column' | 'row' | 'header'; index?: number; rowId?: string; value: number; phase: 'move' | 'up' }) => void>(() => undefined);
  const selectNextSiblingRef = useRef<() => boolean>(() => false);
  const handleWidgetEnterRef = useRef<
    (event: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey?: boolean; repeat?: boolean }) => boolean
  >(() => false);
  const keepBoxGroupForIdRef = useRef<string | null>(null);
  const preFocusViewRef = useRef<ViewTransform | null>(null);
  const enterTapAtRef = useRef(0);
  const enterConfirmTimerRef = useRef(0);
  const dispatchShortcutRef = useRef<(shortcut: WidgetShortcut) => void>(() => undefined);
  const handleCanvasPointerRef = useRef<(data: {
    action: 'down' | 'move' | 'up';
    pointerId: number;
    clientX?: number;
    clientY?: number;
    screenX: number;
    screenY: number;
    button: number;
    shiftKey: boolean;
    altKey?: boolean;
    spacingEdge?: SpacingEdge;
    rotateAxis?: RotateAxis;
    rotateAngle?: number;
    boxWidth?: number;
    boxHeight?: number;
  }) => void>(() => undefined);
  const applySpacingDragMoveRef = useRef<
    (
      screenX: number,
      screenY: number,
      shiftKey: boolean,
      spacingEdge?: SpacingEdge,
      altKey?: boolean,
      rotateAngle?: number,
    ) => void
  >(() => undefined);
  const commitSpacingEditRef = useRef<(action: 'confirm' | 'cancel') => void>(() => undefined);
  const dismissStyleToolbarRef = useRef<() => boolean>(() => false);
  const syncSelectChromeRef = useRef<() => void>(() => undefined);
  const handleSpacingNudgeRef = useRef<
    (
      event: {
        key: string;
        code?: string;
        repeat?: boolean;
        ctrlKey: boolean;
        metaKey: boolean;
        altKey: boolean;
      },
      phase: 'down' | 'up',
    ) => boolean
  >(() => false);
  const heldSpacingKeysRef = useRef<Set<string>>(new Set());
  const heldSpacingEdgesRef = useRef<Set<SpacingEdge>>(new Set());
  const spacingValueBufferRef = useRef('');
  const spacingNudgeRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spacingNudgeRepeatKeyRef = useRef<string | null>(null);
  const spacingNudgeAllRef = useRef(false);
  const [clipboardTick, setClipboardTick] = useState(0);
  const [historyTick, setHistoryTick] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [inspectorInvalid, setInspectorInvalid] = useState(false);
  const [, setSaveStatus] = useState<SaveStatus>('saved');
  const [hydrateEpoch, setHydrateEpoch] = useState(0);
  const lastServerKeyRef = useRef('');
  const persistEnabledRef = useRef(false);
  /** 当前画布已经按这个页面或组件加载完。保存只能写回这里，不能写到后来选中的另一个。 */
  const loadedOwnerRef = useRef<LoadedTarget | null>(null);
  /** 这次打开页面后，用户改过草稿。没改过时，不能用空画布覆盖已有控件。 */
  const editedRef = useRef(false);
  const inspectorInvalidRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);
  const langsInFlightRef = useRef(false);
  const langsAgainRef = useRef(false);
  const hydrateSeqRef = useRef(0);
  const ownerLoadSeqRef = useRef(0);
  const selectedPageIdRef = useRef(selectedPageId);
  const selectedComponentIdRef = useRef(selectedComponentId);
  const catalogKindRef = useRef(catalogKind);
  const componentPropsRef = useRef(componentProps);
  const pageQueryRef = useRef(pageQuery);
  const componentEmitsRef = useRef(componentEmits);
  const componentDocsRef = useRef<Record<string, PageXmlDocument>>({});
  const liveComponentDocsRef = useRef<Record<string, PageXmlDocument>>({});
  const liveComponentPropsRef = useRef<Record<string, ComponentProp[]>>({});
  const selectedVersionIdRef = useRef(selectedVersionId);
  const projectVersionIdRef = useRef(projectVersionId);
  const pageSnapshotIdRef = useRef(pageSnapshotId);
  const pagesVersionRef = useRef<string | null>(null);
  const saveCurrentVersionRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => undefined);

  const pageDocument = useMemo(
    () =>
      normalizePageDocument({
        widgets,
        style: pageStyle,
        data: pageData.length > 0 ? pageData : undefined,
        events: pageEvents,
        methods: pageMethods.length > 0 ? pageMethods : undefined,
        props: componentProps.length > 0 ? componentProps : undefined,
        query: pageQuery.length > 0 ? pageQuery : undefined,
        emits: componentEmits.length > 0 ? componentEmits : undefined,
        testData: compactPageTestData(testData, componentProps, pageData, pageQuery),
      }),
    [widgets, pageStyle, pageData, pageEvents, pageMethods, componentProps, pageQuery, componentEmits, testData],
  );
  const documentKey = JSON.stringify(pageDocument);
  documentRef.current = pageDocument;
  documentKeyRef.current = documentKey;
  if (modeRef.current === 'preview' && mode !== 'preview') {
    modeRef.current = mode;
    previewEpochRef.current += 1;
    previewNavRef.current = [];
    if (Object.keys(previewQueryRef.current).length > 0) {
      previewQueryRef.current = {};
      setPreviewQuery({});
    }
    if (Object.keys(previewDataEditsRef.current).length > 0) {
      previewDataEditsRef.current = {};
      setPreviewDataEdits({});
    }
    if (Object.keys(previewPropEditsRef.current).length > 0) {
      previewPropEditsRef.current = {};
      setPreviewPropEdits({});
    }
    if (Object.keys(previewQueryEditsRef.current).length > 0) {
      previewQueryEditsRef.current = {};
      setPreviewQueryEdits({});
    }
  }
  modeRef.current = mode;
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;
  const selectedComponent = components.find((item) => item.id === selectedComponentId) ?? null;
  const activeOwnerId = catalogKind === 'component' ? selectedComponentId : selectedPageId;
  const selectedOwner = catalogKind === 'component' ? selectedComponent : selectedPage;
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const previewing = mode === 'preview';
  const readOnly = previewing;
  inspectorInvalidRef.current = inspectorInvalid;
  selectedPageIdRef.current = selectedPageId;
  pagesRef.current = pages;
  navigatePreviewRef.current = (message) => {
    if (modeRef.current !== 'preview' || catalogKindRef.current !== 'page') {
      return;
    }
    if (message.action === 'back') {
      const requested = message.times == null ? 1 : Math.floor(message.times);
      if (!Number.isFinite(requested) || requested < 1) {
        return;
      }
      const stack = previewNavRef.current;
      const steps = Math.min(requested, stack.length);
      if (steps < 1) {
        return;
      }
      const entry = stack[stack.length - steps];
      previewNavRef.current = stack.slice(0, -steps);
      previewQueryRef.current = entry.query;
      setPreviewQuery(entry.query);
      setSelectedWidgetId(null);
      if (entry.pageId !== selectedPageIdRef.current) {
        setSelectedPageId(entry.pageId);
      }
      return;
    }
    const key = message.pageKey?.trim() ?? '';
    const page = pagesRef.current.find((item) => item.key === key);
    const currentId = selectedPageIdRef.current;
    if (!page || !currentId) {
      return;
    }
    const nextQuery = asPreviewQuery(message.query);
    if (page.id === currentId && JSON.stringify(previewQueryRef.current) === JSON.stringify(nextQuery)) {
      return;
    }
    previewNavRef.current.push({ pageId: currentId, query: previewQueryRef.current });
    previewQueryRef.current = nextQuery;
    setPreviewQuery(nextQuery);
    setSelectedWidgetId(null);
    if (page.id !== currentId) {
      setSelectedPageId(page.id);
    }
  };
  selectedComponentIdRef.current = selectedComponentId;
  catalogKindRef.current = catalogKind;
  componentPropsRef.current = componentProps;
  pageQueryRef.current = pageQuery;
  if (catalogKind === 'component' && selectedComponentId) {
    liveComponentPropsRef.current[selectedComponentId] = componentProps;
    liveComponentDocsRef.current[selectedComponentId] = pageDocument;
  }
  componentEmitsRef.current = componentEmits;
  selectedVersionIdRef.current = selectedVersionId;
  projectVersionIdRef.current = projectVersionId;
  pageSnapshotIdRef.current = pageSnapshotId;
  widgetsRef.current = widgets;
  pageStyleRef.current = pageStyle;
  pageDataRef.current = pageData;
  testDataRef.current = pageDocument.testData;
  pageEventsRef.current = pageEvents;
  pageMethodsRef.current = pageMethods;
  pageI18nRef.current = pageI18n;
  selectedWidgetIdRef.current = selectedWidgetId;
  tableEditIdRef.current = tableEditId;
  scrollEditIdRef.current = scrollEditId;
  swiperEditIdRef.current = swiperEditId;
  viewingOwnerIdRef.current = viewingOwnerId;
  viewingStateRef.current = viewingState;
  viewingByOwnerRef.current = viewingByOwner;
  centerTabRef.current = centerTab;
  openBoxGroupRef.current = openBoxGroup;
  readOnlyRef.current = readOnly;

  function viewedWidget(widget: PageWidget | null | undefined) {
    if (!widget) {
      return null;
    }
    return widgetWithStateLayers(
      widget,
      stateLayersForWidget(widgetsRef.current, widget.id, viewingByOwnerRef.current),
    );
  }

  function findViewed(widgetId: string | null | undefined) {
    return viewedWidget(findWidget(widgetsRef.current, widgetId));
  }

  function patchViewingWidget(widget: PageWidget, patch: WidgetPatch) {
    return patchResolvedWidget(
      widget,
      patch,
      stateLayersForWidget(widgetsRef.current, widget.id, viewingByOwnerRef.current),
    );
  }

  const applyView = useCallback((next: ViewTransform, fromUser = true, commit = true) => {
    const snapped = {
      scale: next.scale,
      x: snapDevicePixel(next.x),
      y: snapDevicePixel(next.y),
    };
    viewRef.current = snapped;
    paintCanvasView(iframeRef.current, phoneFrameRef.current, snapped, modeRef.current !== 'preview', tableContentPinRef.current);
    if (fromUser) {
      userAdjustedRef.current = true;
    }
    if (commit) {
      setView(snapped);
    }
  }, []);

  const schedulePan = useCallback(
    (x: number, y: number) => {
      pendingPanRef.current = { scale: viewRef.current.scale, x, y };
      if (panRafRef.current) {
        return;
      }
      panRafRef.current = window.requestAnimationFrame(() => {
        panRafRef.current = 0;
        const next = pendingPanRef.current;
        pendingPanRef.current = null;
        if (next) {
          applyView(next, true, false);
        }
      });
    },
    [applyView],
  );

  const syncSelectChrome = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'select-chrome',
        faded: panningRef.current || zoomingRef.current || Boolean(spacingDragRef.current),
      },
      window.location.origin,
    );
  }, []);
  syncSelectChromeRef.current = syncSelectChrome;

  const finishPan = useCallback(() => {
    if (panRafRef.current) {
      window.cancelAnimationFrame(panRafRef.current);
      panRafRef.current = 0;
    }
    const pending = pendingPanRef.current;
    pendingPanRef.current = null;
    if (pending) {
      applyView(pending, true, true);
    } else {
      setView((current) => {
        const next = viewRef.current;
        return current.x === next.x && current.y === next.y && current.scale === next.scale ? current : { ...next };
      });
    }
    dragRef.current = null;
    panningRef.current = false;
    stageRef.current?.classList.remove('is-panning');
    setPanning(false);
    syncSelectChrome();
  }, [applyView, syncSelectChrome]);

  const setCanvasZooming = useCallback(
    (on: boolean) => {
      zoomingRef.current = on;
      stageRef.current?.classList.toggle('is-zooming', on);
      syncSelectChrome();
    },
    [syncSelectChrome],
  );

  const paintZoomLabel = useCallback((scale: number) => {
    const label = zoomLabelRef.current;
    if (label) {
      label.textContent = `${Math.round(scale * 100)}%`;
    }
  }, []);

  const applyZoomAt = useCallback(
    (clientX: number, clientY: number, factor: number, commit: boolean) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const rect = stage.getBoundingClientRect();
      const next = zoomViewAt(viewRef.current, rect.left, rect.top, clientX, clientY, factor);
      applyView(next, true, commit);
      if (!commit) {
        paintZoomLabel(next.scale);
      }
    },
    [applyView, paintZoomLabel],
  );

  const finishZoom = useCallback(() => {
    if (zoomIdleTimerRef.current) {
      window.clearTimeout(zoomIdleTimerRef.current);
      zoomIdleTimerRef.current = 0;
    }
    if (zoomRafRef.current) {
      window.cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = 0;
    }
    const pending = pendingZoomRef.current;
    pendingZoomRef.current = null;
    if (pending) {
      applyZoomAt(pending.clientX, pending.clientY, pending.factor, false);
    }
    zoomingRef.current = false;
    stageRef.current?.classList.remove('is-zooming');
    applyView(viewRef.current, true, true);
    syncSelectChrome();
  }, [applyView, applyZoomAt, syncSelectChrome]);

  const scheduleZoom = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const prev = pendingZoomRef.current;
      pendingZoomRef.current = {
        clientX,
        clientY,
        factor: (prev?.factor ?? 1) * factor,
      };
      setCanvasZooming(true);
      if (zoomIdleTimerRef.current) {
        window.clearTimeout(zoomIdleTimerRef.current);
      }
      zoomIdleTimerRef.current = window.setTimeout(() => {
        zoomIdleTimerRef.current = 0;
        finishZoom();
      }, ZOOM_IDLE_MS);
      if (zoomRafRef.current) {
        return;
      }
      zoomRafRef.current = window.requestAnimationFrame(() => {
        zoomRafRef.current = 0;
        const pending = pendingZoomRef.current;
        pendingZoomRef.current = null;
        if (pending) {
          applyZoomAt(pending.clientX, pending.clientY, pending.factor, false);
        }
      });
    },
    [applyZoomAt, finishZoom, setCanvasZooming],
  );

  useEffect(() => {
    return () => {
      if (panRafRef.current) {
        window.cancelAnimationFrame(panRafRef.current);
      }
      if (zoomRafRef.current) {
        window.cancelAnimationFrame(zoomRafRef.current);
      }
      if (zoomIdleTimerRef.current) {
        window.clearTimeout(zoomIdleTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    paintCanvasView(
      iframeRef.current,
      phoneFrameRef.current,
      viewRef.current,
      mode !== 'preview',
      tableContentPinRef.current,
    );
  }, [mode]);

  useLayoutEffect(() => {
    if (panningRef.current || zoomingRef.current) {
      return;
    }
    paintCanvasView(iframeRef.current, phoneFrameRef.current, view, modeRef.current !== 'preview', tableContentPinRef.current);
  }, [view]);

  const fitCanvas = useCallback(
    (fromUser = false) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const next = computeFitView(stage.clientWidth, stage.clientHeight, SCREEN_WIDTH);
      if (!fromUser) {
        userAdjustedRef.current = false;
      }
      applyView(next, fromUser);
    },
    [applyView],
  );

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      applyZoomAt(clientX, clientY, factor, true);
    },
    [applyZoomAt],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const rect = stage.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt],
  );

  const focusWidgetInView = useCallback(
    (box: { left: number; top: number; width: number; height: number }, restoreIfMax = false) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const current = viewRef.current;
      if (restoreIfMax && current.scale >= MAX_SCALE) {
        const previous = preFocusViewRef.current;
        preFocusViewRef.current = null;
        if (previous) {
          applyView(previous);
        } else {
          fitCanvas(false);
        }
        return;
      }
      if (current.scale < MAX_SCALE) {
        preFocusViewRef.current = { scale: current.scale, x: current.x, y: current.y };
      }
      const stageRect = stage.getBoundingClientRect();
      const topLeft = mapIframePoint(iframeRef.current, box.left, box.top);
      const bottomRight = mapIframePoint(
        iframeRef.current,
        box.left + Math.max(box.width, 1),
        box.top + Math.max(box.height, 1),
      );
      const visualWidth = Math.max(bottomRight.x - topLeft.x, 1);
      const visualHeight = Math.max(bottomRight.y - topLeft.y, 1);
      const centerX = (topLeft.x + bottomRight.x) / 2 - stageRect.left;
      const centerY = (topLeft.y + bottomRight.y) / 2 - stageRect.top;
      const pageWidth = visualWidth / current.scale;
      const pageHeight = visualHeight / current.scale;
      const pageX = (centerX - current.x) / current.scale;
      const pageY = (centerY - current.y) / current.scale;
      const availableWidth = Math.max(1, stage.clientWidth - FOCUS_PADDING * 2);
      const availableHeight = Math.max(1, stage.clientHeight - FOCUS_PADDING * 2);
      const nextScale = clampScale(Math.min(availableWidth / pageWidth, availableHeight / pageHeight));
      applyView({
        scale: nextScale,
        x: stage.clientWidth / 2 - pageX * nextScale,
        y: stage.clientHeight / 2 - pageY * nextScale,
      });
    },
    [applyView, fitCanvas],
  );

  /** 进入表格 / 滚动 / 滑动器编辑时，保持当前缩放，把这一层挪到画布中心。 */
  const centerWidgetInView = useCallback(
    (box: { left: number; top: number; width: number; height: number }) => {
      const stage = stageRef.current;
      if (!stage || box.width <= 0 || box.height <= 0) {
        return;
      }
      const current = viewRef.current;
      const stageRect = stage.getBoundingClientRect();
      const topLeft = mapIframePoint(iframeRef.current, box.left, box.top);
      const bottomRight = mapIframePoint(
        iframeRef.current,
        box.left + box.width,
        box.top + box.height,
      );
      const centerX = (topLeft.x + bottomRight.x) / 2 - stageRect.left;
      const centerY = (topLeft.y + bottomRight.y) / 2 - stageRect.top;
      const pageX = (centerX - current.x) / Math.max(current.scale, 0.01);
      const pageY = (centerY - current.y) / Math.max(current.scale, 0.01);
      applyView({
        scale: current.scale,
        x: stage.clientWidth / 2 - pageX * current.scale,
        y: stage.clientHeight / 2 - pageY * current.scale,
      });
    },
    [applyView],
  );

  useEffect(() => subscribeIconCatalog(setIconCatalog), []);

  useLayoutEffect(() => {
    publishEditorI18n(pageI18n, previewLocale);
  }, [pageI18n, previewLocale]);

  useEffect(() => {
    if (!id || !projectVersionId) {
      return;
    }
    void refreshIconCatalog(id, projectVersionId).catch(() => undefined);
  }, [id, projectVersionId]);

  const sendPreview = useCallback(() => {
    publishEditorI18n(pageI18n, previewLocale);
    const depthOf = (widgetId: string) => {
      let depth = 0;
      let current = findWidget(widgetsRef.current, widgetId);
      while (current) {
        depth += 1;
        current = findParentWidget(widgetsRef.current, current.id);
      }
      return depth;
    };
    const editLayers: { kind: 'table' | 'scroll' | 'swiper'; depth: number }[] = [];
    if (
      mode !== 'preview' &&
      tableEditId != null &&
      findOwningTable(widgetsRef.current, selectedWidgetId)?.table.id === tableEditId
    ) {
      editLayers.push({ kind: 'table', depth: depthOf(tableEditId) });
    }
    if (
      mode !== 'preview' &&
      scrollEditId != null &&
      findOwningScroll(widgetsRef.current, selectedWidgetId)?.id === scrollEditId
    ) {
      editLayers.push({ kind: 'scroll', depth: depthOf(scrollEditId) });
    }
    if (
      mode !== 'preview' &&
      swiperEditId != null &&
      findOwningSwiper(widgetsRef.current, selectedWidgetId)?.id === swiperEditId
    ) {
      editLayers.push({ kind: 'swiper', depth: depthOf(swiperEditId) });
    }
    editLayers.sort((a, b) => b.depth - a.depth);
    const editLeaf = editLayers[0]?.kind ?? null;
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'preview',
        document: presentCanvasDocument(
          documentRef.current,
          mode === 'preview' && catalogKindRef.current === 'component',
          mode === 'preview',
          mode === 'preview' ? previewDataEditsRef.current : undefined,
          mode === 'preview' ? previewPropEditsRef.current : undefined,
        ),
        components: (() => {
          const library = { ...componentDocsRef.current, ...liveComponentDocsRef.current };
          if (catalogKindRef.current === 'component' && selectedComponentIdRef.current) {
            library[selectedComponentIdRef.current] = documentRef.current;
          }
          return library;
        })(),
        useComponentTestData: mode === 'edit',
        mode,
        selectedId: selectedWidgetId,
        scale: CANVAS_RASTER_SCALE,
        viewScale: viewRef.current.scale,
        viewX: viewRef.current.x,
        viewY: viewRef.current.y,
        screenWidth: SCREEN_WIDTH,
        screenHeight: SCREEN_HEIGHT,
        overflowX: mode === 'preview' ? 0 : EDIT_OVERFLOW_X,
        overflowY: mode === 'preview' ? 0 : EDIT_OVERFLOW_Y,
        locale: previewLocale,
        catalog: pageI18n,
        projectId: project?.id ?? null,
        icons: iconCatalog,
        pageId: selectedPageId,
        query: mode === 'preview'
          ? {
              ...buildPropsRecord(applyTestValues(documentRef.current.query, {
                ...documentRef.current.testData?.query,
                ...previewQueryEditsRef.current,
              })),
              ...previewQueryRef.current,
            }
          : {},
        previewEpoch: previewEpochRef.current,
        viewingOwnerId: mode === 'edit' ? viewingOwnerId : null,
        viewingState: mode === 'edit' ? viewingState : null,
        viewingStates: mode === 'edit' ? viewingListFromMap(viewingByOwner) : null,
        spacingDrag:
          mode !== 'preview' &&
            centerTab === 'layout' &&
            isSpacingNudgeGroup(openBoxGroup) &&
            !readOnlyRef.current &&
            (openBoxGroup !== 'position' ||
              canEditPositionInsets(findViewed(selectedWidgetId)?.style))
            ? openBoxGroup
            : null,
        tableEditing: editLeaf === 'table',
        scrollEditing: editLeaf === 'scroll',
        swiperEditing: editLeaf === 'swiper',
        tableChrome:
          editLeaf === 'table' && !readOnlyRef.current
            ? tableChromeState(widgetsRef.current, selectedWidgetId, tableRangeRef.current)
            : null,
        ...(canvasSettlingRef.current ? { settle: settleGenRef.current } : {}),
        centerContent: catalogKindRef.current === 'component',
      },
      window.location.origin,
    );
  }, [mode, previewLocale, previewQuery, pageI18n, project?.id, selectedPageId, selectedWidgetId, openBoxGroup, centerTab, viewingOwnerId, viewingState, viewingByOwner, tableRange, tableEditId, scrollEditId, swiperEditId, componentDocsKey, iconCatalog]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isLowcodeMessage(event.data)) {
        return;
      }
      if (event.data.type === 'canvas-settled') {
        if (event.data.settle === settleGenRef.current) {
          canvasSettlingRef.current = false;
          setCanvasSettling(false);
        }
        return;
      }
      if (event.data.type === 'model-value') {
        commitModelRef.current(event.data.name, event.data.value, event.data.done);
        return;
      }
      if (event.data.type === 'query-value') {
        if (modeRef.current !== 'preview' || !event.data.name) {
          return;
        }
        const next = { ...previewQueryRef.current, [event.data.name]: event.data.value };
        previewQueryRef.current = next;
        setPreviewQuery(next);
        return;
      }
      if (event.data.type === 'navigate') {
        navigatePreviewRef.current(event.data);
        return;
      }
      if (event.data.type === 'ready') {
        readyRef.current = true;
        sendPreview();
        paintCanvasView(iframeRef.current, phoneFrameRef.current, viewRef.current, modeRef.current !== 'preview', tableContentPinRef.current);
        return;
      }
      if (event.data.type === 'select') {
        if (event.data.widgetId == null) {
          if (tableEditIdRef.current || scrollEditIdRef.current || swiperEditIdRef.current) {
            return;
          }
          if (dismissStyleToolbarRef.current()) {
            return;
          }
        }
        selectWidgetRef.current(event.data.widgetId);
        return;
      }
      if (event.data.type === 'table-select') {
        selectTableRangeRef.current(event.data);
        return;
      }
      if (event.data.type === 'table-mode') {
        if (event.data.action === 'exit') {
          exitTableEditRef.current();
        } else {
          enterTableEditRef.current();
        }
        return;
      }
      if (event.data.type === 'scroll-mode') {
        if (event.data.action === 'exit') {
          exitScrollEditRef.current();
        } else {
          enterScrollEditRef.current();
        }
        return;
      }
      if (event.data.type === 'swiper-mode') {
        if (event.data.action === 'exit') {
          exitSwiperEditRef.current();
        } else {
          enterSwiperEditRef.current();
        }
        return;
      }
      if (event.data.type === 'table-command') {
        runTableCommandRef.current(event.data.command);
        return;
      }
      if (event.data.type === 'table-freeze') {
        freezeTableRef.current(event.data.target);
        return;
      }
      if (event.data.type === 'table-resize') {
        resizeTableRef.current(event.data);
        return;
      }
      if (event.data.type === 'dismiss-toolbar') {
        if (tableEditIdRef.current || scrollEditIdRef.current || swiperEditIdRef.current) {
          return;
        }
        if (!dismissStyleToolbarRef.current()) {
          selectWidgetRef.current(null);
        }
        return;
      }
      if (event.data.type === 'widget-box') {
        widgetBoxRef.current = {
          widgetId: event.data.widgetId,
          width: event.data.width,
          height: event.data.height,
        };
        return;
      }
        if (event.data.type === 'focus-widget') {
        if (modeRef.current !== 'edit') {
          return;
        }
        selectWidgetRef.current(event.data.widgetId);
        focusWidgetInView(event.data, true);
        return;
      }
      if (event.data.type === 'edit-leaf') {
        const leafId = event.data.widgetId;
        if (!leafId || event.data.left == null || event.data.top == null || event.data.width == null || event.data.height == null) {
          centeredEditIdRef.current = null;
          return;
        }
        if (leafId === centeredEditIdRef.current) {
          return;
        }
        if (!tableEditIdRef.current && !scrollEditIdRef.current && !swiperEditIdRef.current) {
          return;
        }
        if (event.data.width <= 0 || event.data.height <= 0) {
          return;
        }
        if (!editOriginViewRef.current) {
          const current = viewRef.current;
          editOriginViewRef.current = { scale: current.scale, x: current.x, y: current.y };
        }
        centeredEditIdRef.current = leafId;
        centerWidgetInView({
          left: event.data.left,
          top: event.data.top,
          width: event.data.width,
          height: event.data.height,
        });
        return;
      }
      if (event.data.type === 'keydown' || event.data.type === 'keyup') {
        if (event.data.type === 'keydown' && event.data.key === 'Escape' && !event.data.ctrlKey && !event.data.metaKey) {
          if (exitOneEditRef.current()) {
            return;
          }
          commitSpacingEditRef.current('cancel');
          return;
        }
        if (handleSpacingNudgeRef.current(event.data, event.data.type === 'keyup' ? 'up' : 'down')) {
          return;
        }
        if (event.data.type === 'keydown' && event.data.key === 'Tab') {
          selectNextSiblingRef.current();
          return;
        }
        if (event.data.type === 'keydown' && handleWidgetEnterRef.current(event.data)) {
          return;
        }
        if (event.data.type === 'keydown') {
          const shortcut = matchWidgetShortcut(event.data);
          if (shortcut) {
            dispatchShortcutRef.current(shortcut);
          }
        }
        return;
      }
      if (event.data.type === 'spacing-commit') {
        commitSpacingEditRef.current(event.data.action);
        return;
      }
      if (event.data.type === 'canvas-wheel') {
        if (modeRef.current !== 'edit') {
          return;
        }
        const stage = stageRef.current;
        if (!stage) {
          return;
        }
        const point = iframePointToClient(
          event.data.clientX,
          event.data.clientY,
          viewRef.current,
          stage.getBoundingClientRect(),
          true,
        );
        scheduleZoom(point.x, point.y, event.data.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP);
        return;
      }
      if (event.data.type === 'canvas-pointer') {
        handleCanvasPointerRef.current(event.data);
        return;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [centerWidgetInView, focusWidgetInView, scheduleZoom, sendPreview, enterTableEditRef, exitTableEditRef]);

  useEffect(() => {
    sendPreview();
  }, [sendPreview, view.scale, documentKey]);

  useEffect(() => {
    if (!canvasSettling || !canvasSettlingRef.current) {
      return;
    }
    const token = settleGenRef.current;
    const timer = window.setTimeout(() => {
      if (token !== settleGenRef.current) {
        return;
      }
      canvasSettlingRef.current = false;
      setCanvasSettling(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [canvasSettling, mode, settleArm]);

  useEffect(() => {
    if (!selectedWidgetId) {
      if (viewingOwnerId !== null) {
        setViewingOwnerId(null);
      }
      if (viewingState !== null) {
        setViewingState(null);
      }
      return;
    }
    const next = viewingAfterSelect(widgetsRef.current, selectedWidgetId, viewingByOwnerRef.current, {
      ownerId: viewingOwnerIdRef.current,
      id: viewingStateRef.current,
    });
    setViewingOwnerId(next.ownerId);
    setViewingState(next.id);
    setViewingByOwner(next.viewing);
  }, [selectedWidgetId]);

  useEffect(() => {
    setViewingByOwner((prev) => {
      const next = pruneViewingByOwner(prev, widgets);
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [widgets]);

  useEffect(() => {
    const widgetId = selectedWidgetIdRef.current;
    if (!widgetId) {
      return;
    }
    const widget = viewedWidget(findWidget(widgetsRef.current, widgetId));
    if (!widget) {
      return;
    }
    const nudging = isSpacingNudgeGroup(openBoxGroupRef.current);
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'widget-style',
        widgetId: widget.id,
        css: liveWidgetCss(nudging ? widget.style : undefined),
      },
      window.location.origin,
    );
  }, [documentKey, viewingOwnerId, viewingState, viewingByOwner, selectedWidgetId]);

  const previewLangKeys = (pageI18n?.langs ?? []).map((lang) => lang.key);
  useEffect(() => {
    if (previewLangKeys.length === 0) {
      setPreviewLocale(null);
      return;
    }
    setPreviewLocale((current) => (current && previewLangKeys.includes(current) ? current : previewLangKeys[0]));
  }, [previewLangKeys.join('\0')]);

  useEffect(() => {
    if (!id || !persistEnabledRef.current || !loadedOwnerRef.current) {
      return;
    }
    if (documentKey === lastServerKeyRef.current) {
      if (!saveInFlightRef.current) {
        setSaveStatus('saved');
      }
      return;
    }
    setSaveStatus('unsaved');
    void saveCurrentVersionRef.current({ silent: true });
  }, [documentKey, id, inspectorInvalid, hydrateEpoch]);

  useEffect(() => {
    function onPageHide() {
      const loaded = loadedOwnerRef.current;
      if (!id || !loaded || !persistEnabledRef.current) {
        return;
      }
      if (documentKeyRef.current === lastServerKeyRef.current || emptyCanvasWouldErase()) {
        return;
      }
      if (loaded.kind === 'component') {
        api.updateComponentVersionKeepalive(id, loaded.ownerId, loaded.versionId, { document: documentRef.current });
      } else if (loaded.projectVersionId) {
        api.updatePageDocumentKeepalive(id, loaded.projectVersionId, loaded.ownerId, { document: documentRef.current });
      }
    }
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [id]);

  useEffect(() => {
    if (previewing || centerTab !== 'layout') {
      setInspectorOpen(false);
    }
  }, [centerTab, previewing]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!userAdjustedRef.current) {
        fitCanvas(false);
      }
    });
    observer.observe(stage);
    fitCanvas(false);
    return () => observer.disconnect();
  }, [fitCanvas, loading, missing]);

  useLayoutEffect(() => {
    if (leftNav !== 'develop' || loading || missing) {
      return;
    }
    if (!userAdjustedRef.current) {
      fitCanvas(false);
    } else {
      paintCanvasView(iframeRef.current, phoneFrameRef.current, viewRef.current, modeRef.current !== 'preview', tableContentPinRef.current);
    }
  }, [leftNav, loading, missing, fitCanvas]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    function onWheel(event: WheelEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.preview-scope-card')) {
        return;
      }
      event.preventDefault();
      if (modeRef.current !== 'edit') {
        return;
      }
      scheduleZoom(event.clientX, event.clientY, event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP);
    }
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [loading, missing, scheduleZoom]);

  useEffect(() => {
    function postSpacingSnap(snap: boolean) {
      iframeRef.current?.contentWindow?.postMessage(
        { source: LOWCODE_MESSAGE_SOURCE, type: 'spacing-snap', snap },
        window.location.origin,
      );
    }

    function postSpacingMirror(mirror: boolean) {
      iframeRef.current?.contentWindow?.postMessage(
        { source: LOWCODE_MESSAGE_SOURCE, type: 'spacing-mirror', mirror },
        window.location.origin,
      );
    }

    function onSpacingModifier(event: KeyboardEvent) {
      if ((event.key !== 'Shift' && event.key !== 'Alt') || event.repeat) {
        return;
      }
      const snap = event.key === 'Shift' ? event.type === 'keydown' : event.shiftKey;
      const mirror = event.key === 'Alt' ? event.type === 'keydown' : event.altKey;
      const spacingOpen = isBoxDragGroup(openBoxGroupRef.current);
      if (spacingOpen) {
        postSpacingSnap(snap);
        postSpacingMirror(mirror);
      }
      const spacing = spacingDragRef.current;
      if (event.key === 'Alt' && spacing) {
        event.preventDefault();
      }
      if (!spacing) {
        return;
      }
      applySpacingDragMoveRef.current(
        spacing.lastX,
        spacing.lastY,
        snap,
        spacing.edge ?? undefined,
        mirror,
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Shift' || event.key === 'Alt') {
        onSpacingModifier(event);
      }
      const spacingOpen = isBoxDragGroup(openBoxGroupRef.current);
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key === 'Escape' &&
        !isEditableKeyboardTarget(event.target)
      ) {
        if (exitOneEditRef.current()) {
          event.preventDefault();
          event.stopPropagation();
          commitSpacingEditRef.current('cancel');
          return;
        }
        if (spacingOpen) {
          event.preventDefault();
          event.stopPropagation();
          commitSpacingEditRef.current('cancel');
          return;
        }
      }
      if (!isEditableKeyboardTarget(event.target) && handleSpacingNudgeRef.current(event, 'down')) {
        event.preventDefault();
        return;
      }
      if (
        event.key === 'Tab' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.repeat &&
        !isEditableKeyboardTarget(event.target) &&
        selectNextSiblingRef.current()
      ) {
        event.preventDefault();
        return;
      }
      if (!isEditableKeyboardTarget(event.target) && handleWidgetEnterRef.current(event)) {
        event.preventDefault();
        return;
      }
      const shortcut = matchWidgetShortcut(event);
      if (!shortcut) {
        return;
      }
      if (shortcut === 'save') {
        event.preventDefault();
        dispatchShortcutRef.current(shortcut);
        return;
      }
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }
      if (isBoxGroupShortcut(shortcut) || isTextStyleShortcut(shortcut)) {
        event.preventDefault();
        dispatchShortcutRef.current(shortcut);
        return;
      }
      if (readOnlyRef.current && shortcut !== 'copy') {
        return;
      }
      event.preventDefault();
      dispatchShortcutRef.current(shortcut);
    }
    function onKeyUp(event: KeyboardEvent) {
      onSpacingModifier(event);
      if (!isEditableKeyboardTarget(event.target) && handleSpacingNudgeRef.current(event, 'up')) {
        event.preventDefault();
      }
    }
    function isActiveSpacingPointer(event: globalThis.PointerEvent) {
      const spacing = spacingDragRef.current;
      if (!spacing) {
        return false;
      }
      return spacing.pointerId === event.pointerId || event.pointerType === 'mouse';
    }

    function onWindowPointerMove(event: globalThis.PointerEvent) {
      const spacing = spacingDragRef.current;
      if (!spacing || !isActiveSpacingPointer(event)) {
        return;
      }
      if (event.buttons === 0) {
        applySpacingDragMoveRef.current(
          event.screenX,
          event.screenY,
          event.shiftKey,
          spacing.edge ?? undefined,
          event.altKey,
        );
        spacingDragRef.current = null;
        setSpacingDragCursor(null, null);
        syncSelectChromeRef.current();
        return;
      }
      applySpacingDragMoveRef.current(
        event.screenX,
        event.screenY,
        event.shiftKey,
        spacing.edge ?? undefined,
        event.altKey,
      );
    }

    function onWindowPointerUp(event: globalThis.PointerEvent) {
      const spacing = spacingDragRef.current;
      if (!spacing || !isActiveSpacingPointer(event)) {
        return;
      }
      applySpacingDragMoveRef.current(
        event.screenX,
        event.screenY,
        event.shiftKey,
        spacing.edge ?? undefined,
        event.altKey,
      );
      spacingDragRef.current = null;
      setSpacingDragCursor(null, null);
      syncSelectChromeRef.current();
    }

    let colorPickerDrag = false;

    function setColorPickerDrag(active: boolean) {
      colorPickerDrag = active;
      syncPreviewPointerLock();
    }

    function syncPreviewPointerLock() {
      iframeRef.current?.classList.toggle('is-color-picking', colorPickerDrag);
    }

    function isColorPickerDragSurface(target: EventTarget | null) {
      return (
        target instanceof Element &&
        Boolean(
          target.closest(
            '.ant-color-picker-select, .ant-color-picker-slider, .ant-color-picker-gradient-slider',
          ),
        )
      );
    }

    function onColorPickerMouseDown(event: globalThis.MouseEvent) {
      if (event.button !== 0 || !isColorPickerDragSurface(event.target)) {
        return;
      }
      setColorPickerDrag(true);
    }

    function onToolbarPopupClick() {
      window.requestAnimationFrame(() => {
        if (!colorPickerDrag) {
          syncPreviewPointerLock();
        }
      });
    }

    function stopColorPickerDrag() {
      if (!colorPickerDrag) {
        return;
      }
      setColorPickerDrag(false);
    }

    function onBlur() {
      if (enterConfirmTimerRef.current) {
        window.clearTimeout(enterConfirmTimerRef.current);
        enterConfirmTimerRef.current = 0;
      }
      enterTapAtRef.current = 0;
      if (spacingNudgeRepeatRef.current != null) {
        clearInterval(spacingNudgeRepeatRef.current);
        spacingNudgeRepeatRef.current = null;
      }
      spacingNudgeRepeatKeyRef.current = null;
      heldSpacingKeysRef.current.clear();
      heldSpacingEdgesRef.current.clear();
      spacingNudgeAllRef.current = false;
      spacingValueBufferRef.current = '';
      iframeRef.current?.contentWindow?.postMessage(
        { source: LOWCODE_MESSAGE_SOURCE, type: 'spacing-active', edges: [], all: false },
        window.location.origin,
      );
      if (colorPickerDrag) {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        setColorPickerDrag(false);
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointermove', onWindowPointerMove, true);
    window.addEventListener('pointerup', onWindowPointerUp, true);
    window.addEventListener('pointercancel', onWindowPointerUp, true);
    document.addEventListener('mousedown', onColorPickerMouseDown, true);
    document.addEventListener('click', onToolbarPopupClick, true);
    window.addEventListener('mouseup', stopColorPickerDrag);
    window.addEventListener('touchend', stopColorPickerDrag);
    window.addEventListener('pointercancel', stopColorPickerDrag);
    window.addEventListener('blur', onBlur);
    return () => {
      if (enterConfirmTimerRef.current) {
        window.clearTimeout(enterConfirmTimerRef.current);
        enterConfirmTimerRef.current = 0;
      }
      if (spacingNudgeRepeatRef.current != null) {
        clearInterval(spacingNudgeRepeatRef.current);
        spacingNudgeRepeatRef.current = null;
      }
      spacingNudgeRepeatKeyRef.current = null;
      setColorPickerDrag(false);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointermove', onWindowPointerMove, true);
      window.removeEventListener('pointerup', onWindowPointerUp, true);
      window.removeEventListener('pointercancel', onWindowPointerUp, true);
      document.removeEventListener('mousedown', onColorPickerMouseDown, true);
      document.removeEventListener('click', onToolbarPopupClick, true);
      window.removeEventListener('mouseup', stopColorPickerDrag);
      window.removeEventListener('touchend', stopColorPickerDrag);
      window.removeEventListener('pointercancel', stopColorPickerDrag);
      window.removeEventListener('blur', onBlur);
    };
  }, [enterTableEditRef, exitTableEditRef]);

  function onCanvasPanPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: viewRef.current.x,
      panY: viewRef.current.y,
    };
    panningRef.current = true;
    event.currentTarget.classList.add('is-panning');
    syncSelectChrome();
  }

  function onCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || modeRef.current !== 'edit') {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (
      target.closest(
        '.widget-style-bubble-host, .ant-select-dropdown, .ant-color-picker, .ant-popover, .ant-tooltip',
      )
    ) {
      return;
    }
    if (dismissStyleToolbarRef.current()) {
      return;
    }
    if (target !== event.currentTarget) {
      return;
    }
    if (tableEditIdRef.current) {
      return;
    }
    setSelectedWidgetId(null);
  }

  function onCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }
    schedulePan(drag.panX + (event.clientX - drag.x), drag.panY + (event.clientY - drag.y));
  }

  function onCanvasPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (
      dragRef.current?.pointerId === event.pointerId &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      finishPan();
    }
  }

  function onCanvasMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button === 1) {
      event.preventDefault();
    }
  }

  async function loadProject() {
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      const [nextProject, nextVersions, nextComponents] = await Promise.all([
        api.getProject(id),
        api.listProjectVersions(id),
        api.listComponents(id),
      ]);
      setProject(nextProject);
      setProjectVersions(nextVersions);
      setComponents(nextComponents);
      setMissing(false);
      const rememberedVersion = pickRememberedId(
        nextVersions,
        getRememberedVersionId(id, 'project'),
        nextProject.currentVersionId,
      );
      setProjectVersionId(rememberedVersion?.id ?? nextVersions[nextVersions.length - 1]?.id ?? null);
      const rememberedComponent = pickRememberedId(nextComponents, getRememberedComponentId(id));
      setSelectedComponentId((current) =>
        nextComponents.some((item) => item.id === current) ? current : (rememberedComponent?.id ?? null),
      );
    } catch {
      setMissing(true);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProject();
  }, [id]);

  useEffect(() => {
    if (!id || !projectVersionId) {
      pagesVersionRef.current = null;
      setPages([]);
      return;
    }
    const projectId = id;
    const versionId = projectVersionId;
    let cancelled = false;
    void (async () => {
      try {
        const [nextPages, langs] = await Promise.all([
          api.listPages(projectId, versionId),
          api.getProjectLangs(projectId, versionId),
        ]);
        if (cancelled) {
          return;
        }
        setPages(nextPages);
        setPageI18n(compactPageI18n(langs));
        const remembered = pickRememberedId(nextPages, getRememberedPageId(projectId));
        setSelectedPageId((current) =>
          nextPages.some((page) => page.id === current) ? current : (remembered?.id ?? nextPages[0]?.id ?? null),
        );
        pagesVersionRef.current = versionId;
        setPageLoadToken((token) => token + 1);
      } catch (error) {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, projectVersionId, t]);

  useEffect(() => {
    if (!id) {
      return;
    }
    const projectId = id;
    const token = retainProjectVersionCache();
    return () => releaseProjectVersionCache(projectId, token);
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    const projectId = id;
    void (async () => {
      const cachedRows = await Promise.all(
        components.map(async (component) => {
          const cached = await readOwnerVersionCache(projectId, `component:${component.id}`);
          const current =
            cached.find((version) => version.id === component.currentVersionId) ?? cached[cached.length - 1];
          const document = await componentDocumentForCanvas(projectId, component.id, current);
          return [component.id, document] as const;
        }),
      );
      if (!cancelled && cachedRows.some(([, document]) => document)) {
        const ready = cachedRows.flatMap(([componentId, document]) => (document ? [[componentId, document] as const] : []));
        componentDocsRef.current = {
          ...componentDocsRef.current,
          ...Object.fromEntries(ready),
          ...liveComponentDocsRef.current,
        };
        setComponentDocsKey(
          Object.entries(componentDocsRef.current)
            .map(([componentId, document]) => `${componentId}:${JSON.stringify(document)}`)
            .join('\n'),
        );
      }
      const fresh = await Promise.all(
        components.map(async (component) => {
          const metas = await api.listComponentVersionMeta(projectId, component.id);
          const { versions } = await reconcileOwnerVersions(
            projectId,
            `component:${component.id}`,
            metas,
            (versionId) => api.getComponentVersion(projectId, component.id, versionId),
          );
          const current =
            versions.find((version) => version.id === component.currentVersionId) ?? versions[versions.length - 1];
          const document =
            (await componentDocumentForCanvas(projectId, component.id, current)) ?? { widgets: [] };
          return [component.id, document] as const;
        }),
      );
      if (cancelled) {
        return;
      }
      componentDocsRef.current = { ...Object.fromEntries(fresh), ...liveComponentDocsRef.current };
      setComponentDocsKey(fresh.map(([componentId, document]) => `${componentId}:${JSON.stringify(document)}`).join('\n'));
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, components, catalogKind]);

  useEffect(() => {
    if (!id) {
      return;
    }
    if (catalogKind === 'page' && selectedPageId) {
      rememberPageId(id, selectedPageId);
    }
    if (catalogKind === 'component' && selectedComponentId) {
      rememberComponentId(id, selectedComponentId);
    }
  }, [id, catalogKind, selectedPageId, selectedComponentId]);

  function beginOwnerCanvas() {
    settleGenRef.current += 1;
    ownerSwitchRef.current = true;
    canvasSettlingRef.current = false;
    setCanvasSettling(true);
  }

  function finishOwnerCanvas() {
    if (!ownerSwitchRef.current) {
      return;
    }
    ownerSwitchRef.current = false;
    canvasSettlingRef.current = true;
    setSettleArm((current) => current + 1);
  }

  function cancelOwnerCanvas() {
    if (!ownerSwitchRef.current) {
      return;
    }
    ownerSwitchRef.current = false;
    canvasSettlingRef.current = false;
    settleGenRef.current += 1;
    setCanvasSettling(false);
  }

  async function loadOwner(ownerId: string) {
    if (!id) {
      cancelOwnerCanvas();
      return;
    }
    const projectId = id;
    const loadSeq = ++ownerLoadSeqRef.current;
    const ownerKey = `component:${ownerId}`;
    const stillCurrent = () =>
      ownerLoadSeqRef.current === loadSeq &&
      catalogKindRef.current === 'component' &&
      selectedComponentIdRef.current === ownerId;
    detachLoadedDocument();
    let showedCache = false;
    let shownVersionId: string | null = null;
    try {
      const cached = await readOwnerVersionCache(projectId, ownerKey);
      if (!stillCurrent()) {
        return;
      }
      if (cached.length > 0) {
        const cachedCurrent =
          pickRememberedId(cached, getRememberedVersionId(projectId, ownerKey), cached[cached.length - 1]?.id) ?? null;
        shownVersionId = cachedCurrent?.id ?? null;
        setVersions(cached);
        setSelectedVersionId(shownVersionId);
        if (cachedCurrent?.id) {
          rememberVersionId(projectId, ownerKey, cachedCurrent.id);
        }
        await hydrateVersion(cachedCurrent, ownerKey, stillCurrent);
        showedCache = true;
      }
      const [entity, metas] = await Promise.all([
        api.getComponent(projectId, ownerId),
        api.listComponentVersionMeta(projectId, ownerId),
      ]);
      if (!stillCurrent()) {
        return;
      }
      setComponents((current) => current.map((item) => (item.id === entity.id ? entity : item)));
      const { versions, changedIds } = await reconcileOwnerVersions(projectId, ownerKey, metas, (versionId) =>
        api.getComponentVersion(projectId, ownerId, versionId),
      );
      if (!stillCurrent()) {
        return;
      }
      const current = pickRememberedId(versions, getRememberedVersionId(projectId, ownerKey), entity.currentVersionId) ?? null;
      const dirty = documentKeyRef.current !== lastServerKeyRef.current;
      const openChanged = Boolean(current && changedIds.includes(current.id));
      const switchedVersion = current?.id !== shownVersionId;
      setVersions(versions);
      if (!showedCache || switchedVersion || (openChanged && !dirty)) {
        setSelectedVersionId(current?.id ?? null);
        if (current?.id) {
          rememberVersionId(projectId, ownerKey, current.id);
        }
        await hydrateVersion(current, ownerKey, stillCurrent);
      }
    } catch (error) {
      if (!showedCache) {
        message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
        if (stillCurrent()) {
          cancelOwnerCanvas();
        }
      }
    }
  }

  function emptyCanvasWouldErase() {
    if (editedRef.current || documentRef.current.widgets.length > 0) {
      return false;
    }
    try {
      const saved = JSON.parse(lastServerKeyRef.current) as { widgets?: unknown[] };
      return Array.isArray(saved.widgets) && saved.widgets.length > 0;
    } catch {
      return false;
    }
  }

  function detachLoadedDocument() {
    const loaded = loadedOwnerRef.current;
    persistEnabledRef.current = false;
    loadedOwnerRef.current = null;
    if (!id || !loaded) {
      return;
    }
    if (readOnlyRef.current) {
      return;
    }
    if (documentKeyRef.current === lastServerKeyRef.current || emptyCanvasWouldErase()) {
      return;
    }
    void saveLoadedDocument(
      { silent: true },
      { target: loaded, document: documentRef.current, key: documentKeyRef.current },
    );
  }

  async function hydrateVersion(version: ProjectPageVersionDto | null, pageId: string, stillCurrent: () => boolean) {
    void pageId;
    if (!stillCurrent()) {
      return;
    }
    const seq = ++hydrateSeqRef.current;
    persistEnabledRef.current = false;
    loadedOwnerRef.current = null;
    editedRef.current = false;
    const serverDocument = readPageDocument(version?.document);
    const serverKey = JSON.stringify(serverDocument);
    const fresh = () => stillCurrent() && seq === hydrateSeqRef.current;
    if (!fresh()) {
      return;
    }
    if (!id || !version) {
      applyDocument(serverDocument);
      lastServerKeyRef.current = serverKey;
      setSaveStatus('saved');
      setHydrateEpoch((epoch) => epoch + 1);
      finishOwnerCanvas();
      return;
    }
    if (!fresh()) {
      return;
    }
    applyDocument(serverDocument);
    lastServerKeyRef.current = serverKey;
    const kind = catalogKindRef.current;
    const ownerId = kind === 'component' ? selectedComponentIdRef.current : selectedPageIdRef.current;
    if (ownerId) {
      loadedOwnerRef.current = {
        kind,
        ownerId,
        versionId: version.id,
        projectVersionId: projectVersionIdRef.current,
      };
      persistEnabledRef.current = true;
    }
    setSaveStatus('saved');
    setHydrateEpoch((epoch) => epoch + 1);
    finishOwnerCanvas();
  }

  useEffect(() => {
    if (catalogKind !== 'component' || loading || missing) {
      return;
    }
    fitCanvas(false);
  }, [catalogKind, activeOwnerId, fitCanvas, loading, missing]);

  async function loadPageSnapshot(pageId: string, versionId: string) {
    if (!id) {
      return;
    }
    const projectId = id;
    const loadSeq = ++ownerLoadSeqRef.current;
    const stillCurrent = () =>
      ownerLoadSeqRef.current === loadSeq &&
      catalogKindRef.current === 'page' &&
      selectedPageIdRef.current === pageId;
    try {
      const snapshot = await api.getPageDocument(projectId, versionId, pageId);
      if (!stillCurrent()) {
        return;
      }
      setPageSnapshotId(snapshot.id);
      await hydrateVersion(
        {
          id: snapshot.id,
          pageId,
          versionNo: 0,
          description: '',
          document: snapshot.document,
          createdAt: snapshot.updatedAt,
          updatedAt: snapshot.updatedAt,
          lastModified: snapshot.lastModified,
        },
        pageId,
        stillCurrent,
      );
    } catch (error) {
      if (!stillCurrent()) {
        return;
      }
      message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
      cancelOwnerCanvas();
    }
  }

  useEffect(() => {
    if (catalogKind !== 'component') {
      return;
    }
    detachLoadedDocument();
    clipboardRef.current = null;
    setClipboardTick((tick) => tick + 1);
    resetHistory();
    if (activeOwnerId) {
      if (sawOwnerRef.current && modeRef.current !== 'preview') {
        beginOwnerCanvas();
      }
      sawOwnerRef.current = true;
      void loadOwner(activeOwnerId);
    } else {
      cancelOwnerCanvas();
      setVersions([]);
      setSelectedVersionId(null);
      lastServerKeyRef.current = '';
      setSaveStatus('saved');
      resetWidgetSession([], undefined);
    }
  }, [catalogKind, activeOwnerId]);

  useEffect(() => {
    if (catalogKind !== 'page') {
      return;
    }
    if (!id || !projectVersionId || pagesVersionRef.current !== projectVersionId) {
      return;
    }
    detachLoadedDocument();
    clipboardRef.current = null;
    setClipboardTick((tick) => tick + 1);
    resetHistory();
    if (!selectedPageId) {
      cancelOwnerCanvas();
      setPageSnapshotId(null);
      lastServerKeyRef.current = '';
      setSaveStatus('saved');
      resetWidgetSession([], undefined);
      return;
    }
    if (sawOwnerRef.current && modeRef.current !== 'preview') {
      beginOwnerCanvas();
    }
    sawOwnerRef.current = true;
    void loadPageSnapshot(selectedPageId, projectVersionId);
  }, [catalogKind, selectedPageId, projectVersionId, pageLoadToken]);

  function resetHistory() {
    pastRef.current = [];
    futureRef.current = [];
    coalesceKeyRef.current = null;
    setHistoryTick((tick) => tick + 1);
  }

  function resetWidgetSession(
    nextWidgets: PageWidget[],
    nextPageStyle?: PageStyle,
    nextPageData: PageVariable[] = [],
    nextSelectedId?: string | null,
    nextPageEvents?: WidgetEvents,
    nextPageMethods: PageMethod[] = [],
    nextProps: ComponentProp[] = [],
    nextEmits: ComponentEmit[] = [],
    nextTestData?: PageTestData,
    nextQuery: ComponentProp[] = [],
  ) {
    const selectedId = nextSelectedId === undefined ? (nextWidgets[0]?.id ?? null) : nextSelectedId;
    widgetsRef.current = nextWidgets;
    pageStyleRef.current = nextPageStyle;
    pageDataRef.current = nextPageData;
    pageEventsRef.current = nextPageEvents;
    pageMethodsRef.current = nextPageMethods;
    componentPropsRef.current = nextProps;
    pageQueryRef.current = nextQuery;
    componentEmitsRef.current = nextEmits;
    testDataRef.current = nextTestData;
    previewDataEditsRef.current = {};
    previewPropEditsRef.current = {};
    previewQueryEditsRef.current = {};
    setPreviewDataEdits({});
    setPreviewPropEdits({});
    setPreviewQueryEdits({});
    selectedWidgetIdRef.current = selectedId;
    setWidgets(nextWidgets);
    setPageStyle(nextPageStyle);
    setPageData(nextPageData);
    setPageEvents(nextPageEvents);
    setPageMethods(nextPageMethods);
    setComponentProps(nextProps);
    setPageQuery(nextQuery);
    setComponentEmits(nextEmits);
    setTestData(nextTestData);
    setSelectedWidgetId(selectedId);
    setExpandedKeys(collectExpandableKeys(nextWidgets));
    resetHistory();
  }

  function readPageDocument(input: unknown): PageXmlDocument {
    try {
      return normalizePageDocument(input ?? EMPTY_PAGE_DOCUMENT);
    } catch {
      return EMPTY_PAGE_DOCUMENT;
    }
  }

  async function componentDocumentForCanvas(
    projectId: string,
    componentId: string,
    version: { id: string; document: unknown } | null | undefined,
  ): Promise<PageXmlDocument | null> {
    if (!version) {
      return null;
    }
    void projectId;
    void componentId;
    return readPageDocument(version.document);
  }

  function applyDocument(next: PageXmlDocument) {
    try {
      const parsed = normalizePageDocument(next);
      resetWidgetSession(
        parsed.widgets,
        parsed.style,
        parsed.data ?? [],
        undefined,
        parsed.events,
        parsed.methods ?? [],
        parsed.props ?? [],
        parsed.emits ?? [],
        parsed.testData,
        parsed.query ?? [],
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.invalidXml'));
    }
  }

  function endCoalesce() {
    coalesceKeyRef.current = null;
  }

  function beginLiveStyleCoalesce(widgetId: string) {
    const key = `edit:${widgetId}:style`;
    if (coalesceKeyRef.current === key) {
      return;
    }
    pastRef.current = [
      ...pastRef.current,
      {
        widgets: widgetsRef.current,
        pageStyle: pageStyleRef.current,
        pageData: pageDataRef.current,
        pageEvents: pageEventsRef.current,
        pageMethods: pageMethodsRef.current,
        componentProps: componentPropsRef.current,
        pageQuery: pageQueryRef.current,
        componentEmits: componentEmitsRef.current,
        selectedWidgetId: selectedWidgetIdRef.current,
      },
    ].slice(-HISTORY_LIMIT);
    futureRef.current = [];
    coalesceKeyRef.current = key;
  }

  function patchLiveWidgetStyle(widgetId: string, style: WidgetStyle | undefined) {
    beginLiveStyleCoalesce(widgetId);
    widgetsRef.current = updateWidgetById(widgetsRef.current, widgetId, (widget) =>
      patchViewingWidget(widget, { style }),
    );
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'widget-style',
        widgetId,
        css: liveWidgetCss(style),
      },
      window.location.origin,
    );
  }

  function flushLiveWidgets() {
    setWidgets(widgetsRef.current);
    queueDraftSave();
  }

  function clearTableRange() {
    if (tableRangeRef.current) {
      tableRangeRef.current = null;
      setTableRange(null);
    }
  }

  function selectWidget(id: string | null) {
    if (id !== selectedWidgetIdRef.current) {
      endCoalesce();
    }
    const owning = findOwningTable(widgetsRef.current, id);
    const owningScroll = findOwningScroll(widgetsRef.current, id);
    const owningSwiper = findOwningSwiper(widgetsRef.current, id);
    const selected = findWidget(widgetsRef.current, id);
    if (
      id &&
      tableEditIdRef.current &&
      selected?.type === 'table' &&
      selected.id === tableEditIdRef.current
    ) {
      exitTableEdit();
      return;
    }
    if (
      id &&
      scrollEditIdRef.current &&
      selected?.type === 'scroll' &&
      selected.id === scrollEditIdRef.current
    ) {
      exitScrollEdit();
      return;
    }
    if (
      id &&
      swiperEditIdRef.current &&
      selected?.type === 'swiper' &&
      selected.id === swiperEditIdRef.current
    ) {
      exitSwiperEdit();
      return;
    }
    if (tableEditIdRef.current && owning?.table.id !== tableEditIdRef.current) {
      tableEditIdRef.current = null;
      setTableEditId(null);
    }
    if (scrollEditIdRef.current && owningScroll?.id !== scrollEditIdRef.current) {
      scrollEditIdRef.current = null;
      setScrollEditId(null);
    }
    if (swiperEditIdRef.current && owningSwiper?.id !== swiperEditIdRef.current) {
      swiperEditIdRef.current = null;
      setSwiperEditId(null);
    }
    if (owning && selected && selected.id !== owning.table.id && tableEditIdRef.current !== owning.table.id) {
      tableEditIdRef.current = owning.table.id;
      setTableEditId(owning.table.id);
    }
    if (owningScroll && selected && selected.id !== owningScroll.id && scrollEditIdRef.current !== owningScroll.id) {
      scrollEditIdRef.current = owningScroll.id;
      setScrollEditId(owningScroll.id);
    }
    if (owningSwiper && selected && selected.id !== owningSwiper.id && swiperEditIdRef.current !== owningSwiper.id) {
      swiperEditIdRef.current = owningSwiper.id;
      setSwiperEditId(owningSwiper.id);
    }
    clearTableRange();
    selectedWidgetIdRef.current = id;
    setSelectedWidgetId(id);
    setExpandedKeys((prev) => nextExpandedKeys(prev, widgetsRef.current, widgetsRef.current, id));
    syncEditOrigin();
  }
  selectWidgetRef.current = selectWidget;

  function exitTableEdit() {
    const editingId = tableEditIdRef.current;
    if (!editingId) {
      return false;
    }
    tableEditIdRef.current = null;
    setTableEditId(null);
    selectWidgetRef.current(editingId);
    return true;
  }

  function selectTableRange(message: { tableId: string; target: 'column' | 'row' | 'header'; index?: number; rowId?: string }) {
    if (modeRef.current !== 'edit' || readOnlyRef.current) {
      return;
    }
    const parts = findOwningTable(widgetsRef.current, message.tableId);
    if (!parts) {
      return;
    }
    let range: TableRange | null = null;
    if (message.target === 'column' && message.index != null && parts.headers[message.index]) {
      range = { kind: 'column', tableId: parts.table.id, index: message.index };
    } else if (message.target === 'row' && message.rowId && parts.rows.some((row) => row.id === message.rowId)) {
      range = { kind: 'row', tableId: parts.table.id, rowId: message.rowId };
    } else if (message.target === 'header' && parts.headers.length > 0) {
      range = { kind: 'header', tableId: parts.table.id };
    }
    if (!range) {
      return;
    }
    if (selectedWidgetIdRef.current !== parts.table.id) {
      endCoalesce();
    }
    const group = openBoxGroupRef.current;
    const rangeType = range.kind === 'row' ? 'td' : 'th';
    if (group && group !== 'loop' && !isBoxGroupAllowed(rangeType, group)) {
      setOpenBoxGroup(null);
    }
    const focusId =
      range.kind === 'row'
        ? range.rowId
        : range.kind === 'column'
          ? parts.headers[range.index]?.id
          : parts.headers[0]?.id;
    tableRangeRef.current = range;
    setTableRange(range);
    if (focusId) {
      selectedWidgetIdRef.current = focusId;
      setSelectedWidgetId(focusId);
      setExpandedKeys((prev) => nextExpandedKeys(prev, widgetsRef.current, widgetsRef.current, focusId));
    }
  }
  selectTableRangeRef.current = selectTableRange;

  function applyTableResize(message: {
    tableId: string;
    target: 'column' | 'row' | 'header';
    index?: number;
    rowId?: string;
    value: number;
    nextValue?: number;
    nextRowId?: string;
    phase: 'move' | 'up';
  }) {
    if (readOnlyRef.current || modeRef.current !== 'edit') {
      return;
    }
    const parts = findOwningTable(widgetsRef.current, message.tableId);
    if (!parts) {
      return;
    }
    let next = widgetsRef.current;
    if (message.target === 'column' && message.index != null) {
      const header = parts.headers[message.index];
      if (header) {
        next = setTableColumnWidth(next, header.id, message.value);
      }
      const neighbor = message.nextValue != null ? parts.headers[message.index + 1] : undefined;
      if (neighbor && message.nextValue != null) {
        next = setTableColumnWidth(next, neighbor.id, message.nextValue);
      }
    } else if (message.target === 'row' && message.rowId) {
      next = setTableRowHeight(next, message.rowId, message.value);
      if (message.nextRowId && message.nextValue != null) {
        next = setTableRowHeight(next, message.nextRowId, message.nextValue);
      }
    } else if (message.target === 'header') {
      next = setTableHeaderHeight(next, parts.table.id, message.value);
      if (message.nextRowId && message.nextValue != null) {
        next = setTableRowHeight(next, message.nextRowId, message.nextValue);
      }
    }
    const key = `table-resize:${parts.table.id}:${message.target}:${message.index ?? message.rowId ?? 'header'}`;
    if (next !== widgetsRef.current) {
      commitWidgets(next, selectedWidgetIdRef.current, key);
    }
    if (message.phase === 'up') {
      coalesceKeyRef.current = null;
    }
  }
  resizeTableRef.current = applyTableResize;

  function activeTableParts(): TableParts | null {
    if (tableRangeRef.current) {
      return findOwningTable(widgetsRef.current, tableRangeRef.current.tableId);
    }
    return findOwningTable(widgetsRef.current, selectedWidgetIdRef.current);
  }

  function activeColumnIndex(parts: TableParts): number | null {
    const range = tableRangeRef.current;
    if (range?.tableId === parts.table.id && range.kind === 'column') {
      return range.index;
    }
    const selectedId = selectedWidgetIdRef.current;
    if (!selectedId || range) {
      return null;
    }
    const index = columnIndexOf(parts, selectedId);
    return index >= 0 ? index : null;
  }

  function activeRowId(parts: TableParts): string | null {
    const range = tableRangeRef.current;
    if (range?.tableId === parts.table.id && range.kind === 'row') {
      return range.rowId;
    }
    if (range) {
      return null;
    }
    const selected = findWidget(widgetsRef.current, selectedWidgetIdRef.current);
    if (!selected) {
      return null;
    }
    if (selected.type === 'tr' && parts.rows.some((row) => row.id === selected.id)) {
      return selected.id;
    }
    if (selected.type === 'td') {
      const parent = findParentWidget(widgetsRef.current, selected.id);
      if (parent?.type === 'tr' && parts.rows.some((row) => row.id === parent.id)) {
        return parent.id;
      }
    }
    return null;
  }

  function runTableCommand(command: TableCommand) {
    if (readOnlyRef.current) {
      return;
    }
    const parts = activeTableParts();
    if (!parts) {
      return;
    }
    const columnIndex = activeColumnIndex(parts);
    const rowId = activeRowId(parts);
    let next = widgetsRef.current;
    if (command === 'add-column') {
      next = addTableColumn(widgetsRef.current, parts.table.id, columnIndex);
    } else if (command === 'remove-column') {
      const index = columnIndex ?? parts.headers.length - 1;
      next = removeTableColumn(widgetsRef.current, parts.table.id, index);
    } else if (command === 'move-column-left' && columnIndex != null) {
      next = moveTableColumn(widgetsRef.current, parts.table.id, columnIndex, -1);
      if (next !== widgetsRef.current && tableRangeRef.current?.kind === 'column') {
        const moved = { ...tableRangeRef.current, index: columnIndex - 1 };
        tableRangeRef.current = moved;
        setTableRange(moved);
      }
    } else if (command === 'move-column-right' && columnIndex != null) {
      next = moveTableColumn(widgetsRef.current, parts.table.id, columnIndex, 1);
      if (next !== widgetsRef.current && tableRangeRef.current?.kind === 'column') {
        const moved = { ...tableRangeRef.current, index: columnIndex + 1 };
        tableRangeRef.current = moved;
        setTableRange(moved);
      }
    } else if (command === 'add-row') {
      next = addTableRow(widgetsRef.current, parts.table.id, rowId);
    } else if (command === 'remove-row') {
      if (tableRangeRef.current?.kind === 'header' || tableRangeRef.current?.kind === 'column') {
        next = widgetsRef.current;
      } else if (rowId) {
        next = removeTableRow(widgetsRef.current, parts.table.id, rowId);
      } else if (parts.rows.length > 0) {
        next = removeTableRow(widgetsRef.current, parts.table.id, parts.rows[parts.rows.length - 1].id);
      }
    } else if (command === 'move-row-up' && rowId) {
      next = moveTableRow(widgetsRef.current, parts.table.id, rowId, -1);
    } else if (command === 'move-row-down' && rowId) {
      next = moveTableRow(widgetsRef.current, parts.table.id, rowId, 1);
    }
    if (next !== widgetsRef.current) {
      commitWidgets(next, selectedWidgetIdRef.current);
    }
  }
  runTableCommandRef.current = runTableCommand;

  function freezeTableEdge(target: 'header' | 'footer') {
    if (readOnlyRef.current) {
      return;
    }
    const parts = activeTableParts();
    if (!parts) {
      return;
    }
    if (target === 'header') {
      updateWidget(parts.table.id, { freezeHeader: !parts.table.freezeHeader }, `edit:${parts.table.id}:freeze-header`);
      return;
    }
    updateWidget(parts.table.id, { freezeFooter: !parts.table.freezeFooter }, `edit:${parts.table.id}:freeze-footer`);
  }
  freezeTableRef.current = freezeTableEdge;

  function selectRelatedWidget(nextId: string | null) {
    if (modeRef.current !== 'edit' || centerTabRef.current !== 'layout' || !nextId) {
      return false;
    }
    if (nextId !== selectedWidgetIdRef.current) {
      keepBoxGroupForIdRef.current = nextId;
      if (viewRef.current.scale >= MAX_SCALE) {
        focusWidgetById(nextId);
      } else {
        selectWidget(nextId);
      }
    }
    return true;
  }

  function selectNextSiblingWidget() {
    return selectRelatedWidget(nextSiblingWidgetId(widgetsRef.current, selectedWidgetIdRef.current));
  }
  selectNextSiblingRef.current = selectNextSiblingWidget;

  function clearEnterConfirmTimer() {
    if (enterConfirmTimerRef.current) {
      window.clearTimeout(enterConfirmTimerRef.current);
      enterConfirmTimerRef.current = 0;
    }
  }

  function toggleFocusSelectedWidget() {
    const widgetId = selectedWidgetIdRef.current;
    if (!widgetId || modeRef.current !== 'edit' || centerTabRef.current !== 'layout') {
      return false;
    }
    focusWidgetById(widgetId, true);
    return true;
  }

  function syncEditOrigin() {
    const active = Boolean(tableEditIdRef.current || scrollEditIdRef.current || swiperEditIdRef.current);
    if (active) {
      if (!editOriginViewRef.current) {
        const current = viewRef.current;
        editOriginViewRef.current = { scale: current.scale, x: current.x, y: current.y };
      }
      return;
    }
    const previous = editOriginViewRef.current;
    if (!previous) {
      return;
    }
    editOriginViewRef.current = null;
    centeredEditIdRef.current = null;
    tableContentPinRef.current = { x: 0, y: 0 };
    applyView(previous);
  }

  function enterScrollEdit() {
    const selected = findWidget(widgetsRef.current, selectedWidgetIdRef.current);
    if (!selected || selected.type !== 'scroll' || modeRef.current !== 'edit' || readOnlyRef.current) {
      return;
    }
    if (scrollEditIdRef.current === selected.id) {
      return;
    }
    scrollEditIdRef.current = selected.id;
    setScrollEditId(selected.id);
    const childId = selected.children[0]?.id;
    if (childId) {
      selectWidget(childId);
    } else {
      syncEditOrigin();
    }
  }

  function enterSwiperEdit() {
    const selected = findWidget(widgetsRef.current, selectedWidgetIdRef.current);
    if (!selected || selected.type !== 'swiper' || modeRef.current !== 'edit' || readOnlyRef.current) {
      return;
    }
    if (swiperEditIdRef.current === selected.id) {
      return;
    }
    swiperEditIdRef.current = selected.id;
    setSwiperEditId(selected.id);
    const childId = selected.children[0]?.id;
    if (childId) {
      selectWidget(childId);
    } else {
      syncEditOrigin();
    }
  }

  function exitSwiperEdit() {
    const editingId = swiperEditIdRef.current;
    if (!editingId) {
      return false;
    }
    swiperEditIdRef.current = null;
    setSwiperEditId(null);
    selectWidgetRef.current(editingId);
    return true;
  }

  function exitScrollEdit() {
    const editingId = scrollEditIdRef.current;
    if (!editingId) {
      return false;
    }
    scrollEditIdRef.current = null;
    setScrollEditId(null);
    selectWidgetRef.current(editingId);
    return true;
  }

  function enterTableEdit() {
    const selected = findWidget(widgetsRef.current, selectedWidgetIdRef.current);
    if (!selected || selected.type !== 'table' || modeRef.current !== 'edit' || readOnlyRef.current) {
      return;
    }
    if (tableEditIdRef.current === selected.id) {
      return;
    }
    tableEditIdRef.current = selected.id;
    setTableEditId(selected.id);
    const headerId = findOwningTable(widgetsRef.current, selected.id)?.headers[0]?.id;
    if (headerId) {
      selectWidget(headerId);
    } else {
      syncEditOrigin();
    }
  }

  function widgetDepth(id: string) {
    let depth = 0;
    let current = findWidget(widgetsRef.current, id);
    while (current) {
      depth += 1;
      current = findParentWidget(widgetsRef.current, current.id);
    }
    return depth;
  }

  function exitOneEditLayer() {
    const layers: { depth: number; exit: () => boolean }[] = [];
    if (tableEditIdRef.current) {
      layers.push({ depth: widgetDepth(tableEditIdRef.current), exit: () => exitTableEdit() });
    }
    if (scrollEditIdRef.current) {
      layers.push({ depth: widgetDepth(scrollEditIdRef.current), exit: () => exitScrollEdit() });
    }
    if (swiperEditIdRef.current) {
      layers.push({ depth: widgetDepth(swiperEditIdRef.current), exit: () => exitSwiperEdit() });
    }
    layers.sort((a, b) => b.depth - a.depth);
    return layers[0]?.exit() ?? false;
  }

  function handleWidgetEnter(event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey?: boolean;
    repeat?: boolean;
  }) {
    if (event.key !== 'Enter' || event.repeat || event.altKey) {
      return false;
    }
    if (modeRef.current !== 'edit' || centerTabRef.current !== 'layout') {
      return false;
    }
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.shiftKey) {
      return selectRelatedWidget(parentWidgetId(widgetsRef.current, selectedWidgetIdRef.current));
    }
    if (mod) {
      return selectRelatedWidget(firstChildWidgetId(widgetsRef.current, selectedWidgetIdRef.current));
    }
    if (event.shiftKey) {
      return false;
    }
    if (!selectedWidgetIdRef.current) {
      return false;
    }
    const selected = findWidget(widgetsRef.current, selectedWidgetIdRef.current);
    if (selected?.type === 'table' && tableEditIdRef.current !== selected.id) {
      enterTapAtRef.current = 0;
      clearEnterConfirmTimer();
      enterTableEdit();
      return true;
    }
    if (selected?.type === 'scroll' && scrollEditIdRef.current !== selected.id) {
      enterTapAtRef.current = 0;
      clearEnterConfirmTimer();
      enterScrollEdit();
      return true;
    }
    if (selected?.type === 'swiper' && swiperEditIdRef.current !== selected.id) {
      enterTapAtRef.current = 0;
      clearEnterConfirmTimer();
      enterSwiperEdit();
      return true;
    }
    const now = Date.now();
    if (enterTapAtRef.current && now - enterTapAtRef.current <= ENTER_DOUBLE_MS) {
      enterTapAtRef.current = 0;
      clearEnterConfirmTimer();
      return toggleFocusSelectedWidget();
    }
    enterTapAtRef.current = now;
    if (isBoxDragGroup(openBoxGroupRef.current)) {
      clearEnterConfirmTimer();
      enterConfirmTimerRef.current = window.setTimeout(() => {
        enterConfirmTimerRef.current = 0;
        commitSpacingEditRef.current('confirm');
      }, ENTER_DOUBLE_MS);
    }
    return true;
  }
  handleWidgetEnterRef.current = handleWidgetEnter;
  enterTableEditRef.current = enterTableEdit;
  exitTableEditRef.current = exitTableEdit;
  enterScrollEditRef.current = enterScrollEdit;
  exitScrollEditRef.current = exitScrollEdit;
  enterSwiperEditRef.current = enterSwiperEdit;
  exitSwiperEditRef.current = exitSwiperEdit;
  exitOneEditRef.current = exitOneEditLayer;

  useEffect(() => {
    if (!selectedWidgetId) {
      return;
    }
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }
        widgetTreeHostRef.current
          ?.querySelector<HTMLElement>('.ant-tree-treenode-selected')
          ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [selectedWidgetId]);

  useEffect(() => {
    spacingDragRef.current = null;
    setSpacingDragCursor(null, null);
    const group = openBoxGroupRef.current;
    if (keepBoxGroupForIdRef.current === selectedWidgetId && group && selectedWidgetId) {
      const nextWidget = findWidget(widgetsRef.current, selectedWidgetId);
      if (group && nextWidget && !isBoxGroupAllowed(nextWidget.type, group)) {
        keepBoxGroupForIdRef.current = null;
        spacingSessionRef.current = null;
        setOpenBoxGroup(null);
        syncSelectChrome();
        return;
      }
      spacingValueBufferRef.current = '';
      endCoalesce();
      if (isBoxDragGroup(group)) {
        beginSpacingSession(selectedWidgetId);
      }
      syncSelectChrome();
      return;
    }
    keepBoxGroupForIdRef.current = null;
    spacingSessionRef.current = null;
    setOpenBoxGroup(null);
    syncSelectChrome();
  }, [selectedWidgetId, syncSelectChrome]);

  function focusWidgetById(widgetId: string, restoreIfMax = false) {
    selectWidget(widgetId);
    const node = iframeRef.current?.contentDocument?.querySelector(`[data-widget-id="${CSS.escape(widgetId)}"]`);
    if (!node) {
      return;
    }
    const rect = node.getBoundingClientRect();
    focusWidgetInView(
      {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      restoreIfMax,
    );
  }

  function commitDraft(
    nextWidgets: PageWidget[],
    nextPageStyle: PageStyle | undefined,
    nextPageData: PageVariable[],
    nextSelectedId: string | null,
    coalesceKey?: string,
    nextPageEvents?: WidgetEvents | null,
    nextPageMethods?: PageMethod[],
    nextProps?: ComponentProp[],
    nextEmits?: ComponentEmit[],
    nextTestData?: PageTestData | null,
    nextQuery?: ComponentProp[],
  ) {
    editedRef.current = true;
    const events = nextPageEvents === undefined ? pageEventsRef.current : nextPageEvents ?? undefined;
    const methods = nextPageMethods === undefined ? pageMethodsRef.current : nextPageMethods;
    const props = nextProps === undefined ? componentPropsRef.current : nextProps;
    const query = nextQuery === undefined ? pageQueryRef.current : nextQuery;
    const emits = nextEmits === undefined ? componentEmitsRef.current : nextEmits;
    const nextTest = nextTestData === undefined ? testDataRef.current : nextTestData ?? undefined;
    const coalescing = Boolean(coalesceKey && coalesceKey === coalesceKeyRef.current);
    if (!coalescing) {
      pastRef.current = [
        ...pastRef.current,
        {
          widgets: widgetsRef.current,
          pageStyle: pageStyleRef.current,
          pageData: pageDataRef.current,
          pageEvents: pageEventsRef.current,
          pageMethods: pageMethodsRef.current,
          componentProps: componentPropsRef.current,
          pageQuery: pageQueryRef.current,
          componentEmits: componentEmitsRef.current,
          testData: testDataRef.current,
          selectedWidgetId: selectedWidgetIdRef.current,
        },
      ].slice(-HISTORY_LIMIT);
      futureRef.current = [];
      setHistoryTick((tick) => tick + 1);
    }
    coalesceKeyRef.current = coalesceKey ?? null;
    const previousWidgets = widgetsRef.current;
    const previousSelectedId = selectedWidgetIdRef.current;
    widgetsRef.current = nextWidgets;
    pageStyleRef.current = nextPageStyle;
    pageDataRef.current = nextPageData;
    pageEventsRef.current = events;
    pageMethodsRef.current = methods;
    componentPropsRef.current = props;
    pageQueryRef.current = query;
    componentEmitsRef.current = emits;
    testDataRef.current = nextTest;
    selectedWidgetIdRef.current = nextSelectedId;
    setWidgets(nextWidgets);
    setPageStyle(nextPageStyle);
    setPageData(nextPageData);
    setPageEvents(events);
    setPageMethods(methods);
    setComponentProps(props);
    setPageQuery(query);
    setComponentEmits(emits);
    setTestData(nextTest);
    setSelectedWidgetId(nextSelectedId);
    setExpandedKeys((prev) =>
      nextExpandedKeys(
        prev,
        previousWidgets,
        nextWidgets,
        nextSelectedId !== previousSelectedId ? nextSelectedId : null,
      ),
    );
    queueDraftSave();
  }

  function queueDraftSave() {
    try {
      const next = normalizePageDocument({
        widgets: widgetsRef.current,
        style: pageStyleRef.current,
        data: pageDataRef.current.length > 0 ? pageDataRef.current : undefined,
        events: pageEventsRef.current,
        methods: pageMethodsRef.current.length > 0 ? pageMethodsRef.current : undefined,
        props: componentPropsRef.current.length > 0 ? componentPropsRef.current : undefined,
        query: pageQueryRef.current.length > 0 ? pageQueryRef.current : undefined,
        emits: componentEmitsRef.current.length > 0 ? componentEmitsRef.current : undefined,
        testData: compactPageTestData(
          testDataRef.current,
          componentPropsRef.current,
          pageDataRef.current,
          pageQueryRef.current,
        ),
      });
      documentRef.current = next;
      documentKeyRef.current = JSON.stringify(next);
    } catch {
      return;
    }
    if (!persistEnabledRef.current || readOnlyRef.current) {
      return;
    }
    void saveCurrentVersionRef.current({ silent: true });
  }

  function commitWidgets(nextWidgets: PageWidget[], nextSelectedId: string | null, coalesceKey?: string) {
    commitDraft(
      nextWidgets,
      pageStyleRef.current,
      pageDataRef.current,
      nextSelectedId,
      coalesceKey,
    );
  }

  function updatePageStyle(next: PageStyle | undefined, coalesceKey: string) {
    if (readOnlyRef.current) {
      return;
    }
    commitDraft(
      widgetsRef.current,
      next,
      pageDataRef.current,
      selectedWidgetIdRef.current,
      coalesceKey,
    );
  }

  function commitPageData(next: PageVariable[], coalesceKey?: string) {
    if (readOnlyRef.current) {
      return;
    }
    commitDraft(
      widgetsRef.current,
      pageStyleRef.current,
      next,
      selectedWidgetIdRef.current,
      coalesceKey,
    );
  }

  function commitPageEvents(next: WidgetEvents | undefined) {
    if (readOnlyRef.current) {
      return;
    }
    commitDraft(
      widgetsRef.current,
      pageStyleRef.current,
      pageDataRef.current,
      selectedWidgetIdRef.current,
      'page-events',
      next ?? null,
    );
  }

  function commitPageQuery(next: ComponentProp[], coalesceKey?: string) {
    if (readOnlyRef.current) {
      return;
    }
    commitDraft(
      widgetsRef.current,
      pageStyleRef.current,
      pageDataRef.current,
      selectedWidgetIdRef.current,
      coalesceKey,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      next,
    );
  }

  function addPageQuery() {
    const list = pageQueryRef.current;
    const used = new Set(list.map((item) => item.name));
    let index = list.length + 1;
    let name = `query${index}`;
    while (used.has(name)) {
      index += 1;
      name = `query${index}`;
    }
    commitPageQuery([...list, { type: 'str', name, value: defaultPageDataValue('str') }]);
  }

  function commitComponentProps(next: ComponentProp[], coalesceKey?: string) {
    if (readOnlyRef.current) {
      return;
    }
    commitDraft(
      widgetsRef.current,
      pageStyleRef.current,
      pageDataRef.current,
      selectedWidgetIdRef.current,
      coalesceKey,
      undefined,
      undefined,
      next,
    );
  }

  function commitComponentEmits(next: ComponentEmit[]) {
    if (readOnlyRef.current) {
      return;
    }
    commitDraft(
      widgetsRef.current,
      pageStyleRef.current,
      pageDataRef.current,
      selectedWidgetIdRef.current,
      'component-emits',
      undefined,
      undefined,
      undefined,
      next,
    );
  }

  function commitPageMethods(next: PageMethod[]) {
    if (readOnlyRef.current) {
      return;
    }
    commitDraft(
      widgetsRef.current,
      pageStyleRef.current,
      pageDataRef.current,
      selectedWidgetIdRef.current,
      'page-methods',
      undefined,
      next,
    );
  }

  function commitTestField(section: 'props' | 'data' | 'query', name: string, stored: string, coalesceKey?: string) {
    const schema =
      section === 'props'
        ? componentPropsRef.current.find((item) => item.name === name)?.value
        : section === 'query'
          ? pageQueryRef.current.find((item) => item.name === name)?.value
          : pageDataRef.current.find((item) => item.name === name)?.value;
    const current = testDataRef.current;
    const bag = { ...(current?.[section] ?? {}) };
    if (schema !== undefined && stored === schema) {
      if (!Object.prototype.hasOwnProperty.call(bag, name)) {
        return;
      }
      delete bag[name];
    } else if (bag[name] === stored) {
      return;
    } else {
      bag[name] = stored;
    }
    const props = section === 'props' ? bag : current?.props;
    const data = section === 'data' ? bag : current?.data;
    const query = section === 'query' ? bag : current?.query;
    const next = compactPageTestData(
      {
        ...(props && Object.keys(props).length > 0 ? { props } : {}),
        ...(query && Object.keys(query).length > 0 ? { query } : {}),
        ...(data && Object.keys(data).length > 0 ? { data } : {}),
      },
      componentPropsRef.current,
      pageDataRef.current,
      pageQueryRef.current,
    );
    commitDraft(
      widgetsRef.current,
      pageStyleRef.current,
      pageDataRef.current,
      selectedWidgetIdRef.current,
      coalesceKey,
      undefined,
      undefined,
      undefined,
      undefined,
      next ?? null,
    );
  }

  function rememberPreviewEdit(
    bagRef: { current: Record<string, string> },
    publish: (next: Record<string, string>) => void,
    baseline: string | undefined,
    name: string,
    stored: string,
  ) {
    const next = { ...bagRef.current };
    if (baseline !== undefined && stored === baseline) {
      delete next[name];
    } else {
      next[name] = stored;
    }
    bagRef.current = next;
    publish(next);
    sendPreview();
  }

  function rememberPreviewData(name: string, stored: string) {
    const schema = pageDataRef.current.find((item) => item.name === name)?.value;
    const saved = testDataRef.current?.data?.[name];
    rememberPreviewEdit(
      previewDataEditsRef,
      setPreviewDataEdits,
      saved !== undefined ? saved : schema,
      name,
      stored,
    );
  }

  function rememberPreviewProp(name: string, stored: string) {
    const schema = componentPropsRef.current.find((item) => item.name === name)?.value;
    const saved = testDataRef.current?.props?.[name];
    rememberPreviewEdit(
      previewPropEditsRef,
      setPreviewPropEdits,
      saved !== undefined ? saved : schema,
      name,
      stored,
    );
  }

  function rememberPreviewQuery(name: string, stored: string) {
    const schema = pageQueryRef.current.find((item) => item.name === name)?.value;
    const saved = testDataRef.current?.query?.[name];
    rememberPreviewEdit(
      previewQueryEditsRef,
      setPreviewQueryEdits,
      saved !== undefined ? saved : schema,
      name,
      stored,
    );
  }

  function commitPreviewTest(section: 'props' | 'data' | 'query', name: string, type: string, text: string) {
    const testProps = buildPropsRecord(applyTestValues(componentPropsRef.current, {
      ...testDataRef.current?.props,
      ...previewPropEditsRef.current,
    }));
    const schemaProps = buildPropsRecord(componentPropsRef.current);
    const queryScope = buildPropsRecord(applyTestValues(pageQueryRef.current, {
      ...testDataRef.current?.query,
      ...previewQueryEditsRef.current,
    }));
    const variables = pageDataRef.current;
    const index = section === 'data' ? variables.findIndex((item) => item.name === name) : -1;
    const props = section === 'data' ? schemaProps : testProps;
    const data = buildPageDataScope(variables, index < 0 ? 0 : index, props, queryScope);
    let stored: string | null = null;
    if (type === 'bool') {
      stored = text === '1' || text === 'true' ? '1' : '0';
    } else if (type === 'num') {
      stored = normalizeInputModelValue('number', text);
    } else if (type === 'str' || type === 'icon' || type === 'image' || type === 'widget') {
      stored = text;
    } else if ((type === 'arr' || type === 'obj') && validateDataLiteral(text, type, data, props, queryScope)) {
      stored = text.trim();
    }
    if (stored == null) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return false;
    }
    if (section === 'data') {
      rememberPreviewData(name, stored);
      return true;
    }
    if (section === 'props') {
      rememberPreviewProp(name, stored);
      return true;
    }
    rememberPreviewQuery(name, stored);
    return true;
  }

  commitModelRef.current = (name, value, done) => {
    const propName = propModelName(name);
    if (propName && catalogKindRef.current === 'component') {
      const list = componentPropsRef.current;
      const index = list.findIndex((prop) => prop.name === propName && prop.bind);
      if (index < 0) {
        if (done) {
          endCoalesce();
        }
        return;
      }
      const current = list[index];
      const stored =
        current.type === 'num'
          ? normalizeInputModelValue('number', value)
          : current.type === 'bool'
            ? value === '1' || value === 'true'
              ? '1'
              : '0'
            : current.type === 'str' || current.type === 'icon' || current.type === 'image'
              ? value
              : current.type === 'arr' && validateDataLiteral(value, 'arr')
                ? value
                : current.type === 'obj' && validateDataLiteral(value, 'obj')
                  ? value
                  : null;
      if (stored == null) {
        return;
      }
      if (modeRef.current === 'preview') {
        rememberPreviewProp(propName, stored);
        if (done) {
          endCoalesce();
        }
        return;
      }
      commitTestField('props', propName, stored, `test:props:${propName}`);
      if (done) {
        endCoalesce();
      }
      return;
    }
    const list = pageDataRef.current;
    const index = list.findIndex((variable) => variable.name === name);
    if (index < 0) {
      if (done) {
        endCoalesce();
      }
      return;
    }
    const current = list[index];
    const stored =
      current.type === 'num'
        ? normalizeInputModelValue('number', value)
        : current.type === 'str' || current.type === 'icon' || current.type === 'image'
          ? value
          : current.type === 'bool'
            ? value === '1' || value === 'true'
              ? '1'
              : '0'
            : current.type === 'arr' && validateDataLiteral(value, 'arr')
              ? value
              : current.type === 'obj' && validateDataLiteral(value, 'obj')
                ? value
                : null;
    if (stored == null) {
      return;
    }
    rememberPreviewData(name, stored);
    if (done) {
      endCoalesce();
    }
  };

  async function flushProjectLangs() {
    if (!id) {
      return;
    }
    if (langsInFlightRef.current) {
      langsAgainRef.current = true;
      return;
    }
    langsInFlightRef.current = true;
    langsAgainRef.current = false;
    const payload = pageI18nRef.current ?? { langs: [], groups: [] };
    try {
      const versionId = projectVersionIdRef.current;
      if (!versionId) {
        return;
      }
      await api.putProjectLangs(id, versionId, payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    } finally {
      langsInFlightRef.current = false;
      if (langsAgainRef.current) {
        void flushProjectLangs();
      }
    }
  }

  function commitPageI18n(next: PageI18n | undefined, _coalesceKey?: string) {
    pageI18nRef.current = next;
    setPageI18n(next);
    void flushProjectLangs();
  }

  function widgetInsertAnchor(): string | null {
    const range = tableRangeRef.current;
    if (!range) {
      return selectedWidgetIdRef.current;
    }
    const parts = findOwningTable(widgetsRef.current, range.tableId);
    if (!parts || range.tableId !== parts.table.id) {
      return selectedWidgetIdRef.current;
    }
    if (range.kind === 'column') {
      return parts.headers[range.index]?.id ?? parts.table.id;
    }
    if (range.kind === 'header') {
      return parts.headers[0]?.id ?? parts.table.id;
    }
    const row = parts.rows.find((item) => item.id === range.rowId);
    return (row ? cellsOf(row)[0]?.id : undefined) ?? row?.id ?? parts.table.id;
  }

  function addWidget(choice: AddWidgetChoice) {
    if (readOnlyRef.current) {
      return;
    }
    const widget =
      choice.kind === 'widget'
        ? createWidget(choice.type, { id: nextWidgetId(), t, nextId: nextWidgetId })
        : ({
            type: 'component',
            id: nextWidgetId(),
            componentId: choice.component.id,
            componentKey: choice.component.key,
            name: choice.component.name,
          } satisfies PageWidget);
    const nextWidgets = addWidgetToTree(widgetsRef.current, widgetInsertAnchor(), widget);
    const added = findWidget(nextWidgets, widget.id);
    commitWidgets(nextWidgets, added ? widget.id : selectedWidgetIdRef.current);
  }

  function updateWidget(widgetId: string, patch: WidgetPatch, coalesceKey: string) {
    if (readOnlyRef.current) {
      return;
    }
    // Bubble/inspector edits must not be overwritten by an in-flight canvas spacing drag.
    if (spacingDragRef.current?.widgetId === widgetId && 'style' in patch) {
      spacingDragRef.current = null;
      setSpacingDragCursor(null, null);
      syncSelectChrome();
    }
    if (spacingCancelRef.current && 'style' in patch) {
      return;
    }
    commitWidgets(
      updateWidgetById(widgetsRef.current, widgetId, (widget) => patchViewingWidget(widget, patch)),
      selectedWidgetIdRef.current,
      coalesceKey,
    );
  }

  function rememberWidgetBox(widgetId: string, width?: number, height?: number) {
    if (width == null || height == null) {
      return;
    }
    widgetBoxRef.current = { widgetId, width, height };
  }

  function measuredWidgetSize(widgetId: string) {
    const box = widgetBoxRef.current;
    if (box?.widgetId === widgetId) {
      return { width: box.width, height: box.height };
    }
    return null;
  }

  function measuredWidgetInsets(widgetId: string, position?: WidgetStyle['position']): BoxQuad | null {
    const doc = iframeRef.current?.contentDocument;
    const node = doc?.querySelector(`[data-widget-id="${CSS.escape(widgetId)}"]`);
    if (!(node instanceof HTMLElement) || !doc?.defaultView) {
      return null;
    }
    const view = doc.defaultView;
    const host = doc.querySelector<HTMLElement>('.preview-host');
    const scale = host ? previewVisualScale(host) : 1;
    const rect = node.getBoundingClientRect();
    let container: { top: number; right: number; bottom: number; left: number };
    if (position === 'fixed') {
      const screen = previewScreenElement(doc);
      if (screen) {
        const screenRect = screen.getBoundingClientRect();
        container = {
          top: screenRect.top,
          right: screenRect.right,
          bottom: screenRect.bottom,
          left: screenRect.left,
        };
      } else {
        container = { top: 0, right: view.innerWidth, bottom: view.innerHeight, left: 0 };
      }
    } else {
      const parent = node.offsetParent instanceof HTMLElement ? node.offsetParent : doc.documentElement;
      const parentRect = parent.getBoundingClientRect();
      container = {
        top: parentRect.top,
        right: parentRect.right,
        bottom: parentRect.bottom,
        left: parentRect.left,
      };
    }
    const fromBox = {
      top: Math.round((rect.top - container.top) / scale),
      right: Math.round((container.right - rect.right) / scale),
      bottom: Math.round((container.bottom - rect.bottom) / scale),
      left: Math.round((rect.left - container.left) / scale),
    };
    const computed = view.getComputedStyle(node);
    function pick(edge: SpacingEdge) {
      const raw = computed[edge];
      if (raw && raw !== 'auto') {
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed)) {
          return Math.round(parsed);
        }
      }
      return fromBox[edge];
    }
    return { top: pick('top'), right: pick('right'), bottom: pick('bottom'), left: pick('left') };
  }

  function seedPositionQuad(style: WidgetStyle | undefined, widgetId: string, edge?: SpacingEdge | null): BoxQuad {
    const quad: BoxQuad = {
      top: dragLengthPx(style?.top),
      right: dragLengthPx(style?.right),
      bottom: dragLengthPx(style?.bottom),
      left: dragLengthPx(style?.left),
    };
    if (!edge || quad[edge] != null || isAutoLength(style?.[edge])) {
      return quad;
    }
    const measured = measuredWidgetInsets(widgetId, style?.position);
    if (measured?.[edge] == null) {
      return quad;
    }
    return { ...quad, [edge]: measured[edge] };
  }

  function measuredFontSize(widgetId: string) {
    const node = iframeRef.current?.contentDocument?.querySelector(`[data-widget-id="${CSS.escape(widgetId)}"]`);
    if (!(node instanceof HTMLElement)) {
      return null;
    }
    const size = Number.parseFloat(getComputedStyle(node).fontSize);
    if (!Number.isFinite(size) || size <= 0) {
      return null;
    }
    return Math.min(999, Math.max(1, Math.round(size)));
  }

  function beginSpacingSession(widgetId: string) {
    if (spacingSessionRef.current?.widgetId === widgetId) {
      return;
    }
    const widget = findViewed(widgetId);
    spacingSessionRef.current = {
      widgetId,
      style: widget?.style,
      pastLength: pastRef.current.length,
    };
  }

  function confirmSpacingEdit() {
    clearEnterConfirmTimer();
    enterTapAtRef.current = 0;
    clearSpacingNudge();
    flushLiveWidgets();
    spacingSessionRef.current = null;
    spacingDragRef.current = null;
    setSpacingDragCursor(null, null);
    endCoalesce();
    setOpenBoxGroup(null);
    syncSelectChrome();
  }

  function cancelSpacingEdit() {
    clearEnterConfirmTimer();
    enterTapAtRef.current = 0;
    spacingCancelRef.current = true;
    const session = spacingSessionRef.current;
    spacingDragRef.current = null;
    setSpacingDragCursor(null, null);
    clearSpacingNudge();
    if (session) {
      const restored = updateWidgetById(widgetsRef.current, session.widgetId, (widget) => {
        const viewed = viewedWidget(widget);
        return patchViewingWidget(widget, {
          style: compactWidgetStyle({
            ...viewed?.style,
            paddingTop: session.style?.paddingTop,
            paddingRight: session.style?.paddingRight,
            paddingBottom: session.style?.paddingBottom,
            paddingLeft: session.style?.paddingLeft,
            marginTop: session.style?.marginTop,
            marginRight: session.style?.marginRight,
            marginBottom: session.style?.marginBottom,
            marginLeft: session.style?.marginLeft,
            radiusTopLeft: session.style?.radiusTopLeft,
            radiusTopRight: session.style?.radiusTopRight,
            radiusBottomRight: session.style?.radiusBottomRight,
            radiusBottomLeft: session.style?.radiusBottomLeft,
            top: session.style?.top,
            right: session.style?.right,
            bottom: session.style?.bottom,
            left: session.style?.left,
            position: session.style?.position,
            width: session.style?.width,
            height: session.style?.height,
            rotateX: session.style?.rotateX,
            rotateY: session.style?.rotateY,
            rotateZ: session.style?.rotateZ,
          }),
        });
      });
      widgetsRef.current = restored;
      setWidgets(restored);
      queueDraftSave();
      pastRef.current = pastRef.current.slice(0, session.pastLength);
      futureRef.current = [];
      coalesceKeyRef.current = null;
      setHistoryTick((tick) => tick + 1);
    }
    spacingSessionRef.current = null;
    setOpenBoxGroup(null);
    syncSelectChrome();
    window.setTimeout(() => {
      spacingCancelRef.current = false;
    }, 0);
  }

  function commitSpacingEdit(action: 'confirm' | 'cancel') {
    const spacingOpen = isBoxDragGroup(openBoxGroupRef.current);
    if (!spacingOpen) {
      return;
    }
    if (action === 'cancel') {
      cancelSpacingEdit();
      return;
    }
    confirmSpacingEdit();
  }
  commitSpacingEditRef.current = commitSpacingEdit;

  function dismissStyleToolbar() {
    if (closeStyleToolbarPopups()) {
      return true;
    }
    const group = openBoxGroupRef.current;
    if (!group) {
      return false;
    }
    if (isBoxDragGroup(group)) {
      commitSpacingEdit('confirm');
    } else {
      setOpenBoxGroup(null);
    }
    return true;
  }
  dismissStyleToolbarRef.current = dismissStyleToolbar;

  function styleTargetWidget() {
    const range = tableRangeRef.current;
    const owning = range ? findOwningTable(widgetsRef.current, range.tableId) : null;
    if (range && owning) {
      if (range.kind === 'column') {
        return owning.headers[range.index] ?? null;
      }
      if (range.kind === 'header') {
        return owning.headers[0] ?? null;
      }
      return owning.rows.find((row) => row.id === range.rowId)?.children.find((child) => child.type === 'td') ?? null;
    }
    return findViewed(selectedWidgetIdRef.current);
  }

  function handleOpenBoxGroupChange(group: BoxGroup | null) {
    if (group) {
      const widget = styleTargetWidget();
      if (!widget || !isBoxGroupAllowed(widget.type, group)) {
        return;
      }
    }
    if (group !== openBoxGroupRef.current) {
      clearSpacingNudge();
    }
    const nextSpacing = isBoxDragGroup(group);
    const wasSpacing = isBoxDragGroup(openBoxGroupRef.current);
    if (nextSpacing) {
      const widgetId = styleTargetWidget()?.id;
      if (widgetId && !readOnlyRef.current) {
        beginSpacingSession(widgetId);
      }
      openBoxGroupRef.current = group;
      setOpenBoxGroup(group);
      return;
    }
    if (wasSpacing) {
      confirmSpacingEdit();
    }
    openBoxGroupRef.current = group;
    setOpenBoxGroup(group);
  }

  function openWidgetLoopPanel(widgetId: string) {
    keepBoxGroupForIdRef.current = widgetId;
    selectWidget(widgetId);
    handleOpenBoxGroupChange('loop');
    focusWidgetById(widgetId);
  }

  function openWidgetEventsPanel(widgetId: string) {
    keepBoxGroupForIdRef.current = widgetId;
    selectWidget(widgetId);
    handleOpenBoxGroupChange('events');
    focusWidgetById(widgetId);
  }

  function syncHeldSpacingEdges() {
    const kind = openBoxGroupRef.current;
    const edges = spacingEdgesFromSelectKeys(
      heldSpacingKeysRef.current,
      isSpacingNudgeGroup(kind) ? kind : null,
    );
    heldSpacingEdgesRef.current = new Set(edges);
    spacingNudgeAllRef.current = edges.length === SPACING_EDGES.length;
    return edges;
  }

  function postSpacingActive() {
    const kind = openBoxGroupRef.current;
    const edges = kind === 'rotate' ? [] : [...heldSpacingEdgesRef.current];
    const axes = kind === 'rotate' ? rotateAxesFromSelectKeys(heldSpacingKeysRef.current) : [];
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'spacing-active',
        edges,
        axes,
        all: edges.length === SPACING_EDGES.length,
      },
      window.location.origin,
    );
  }

  function clearSpacingNudge() {
    stopSpacingNudgeRepeat();
    spacingValueBufferRef.current = '';
    if (heldSpacingKeysRef.current.size === 0 && heldSpacingEdgesRef.current.size === 0) {
      return;
    }
    heldSpacingKeysRef.current.clear();
    heldSpacingEdgesRef.current.clear();
    spacingNudgeAllRef.current = false;
    postSpacingActive();
  }

  function readNudgeQuad(style: WidgetStyle | undefined, kind: BoxDragKind | 'border'): BoxQuad {
    if (kind === 'border') {
      return {
        top: style?.borderTopWidth,
        right: style?.borderRightWidth,
        bottom: style?.borderBottomWidth,
        left: style?.borderLeftWidth,
      };
    }
    if (kind === 'size') {
      const widgetId = selectedWidgetIdRef.current;
      const edges = uniqueSizeEdges([...heldSpacingEdgesRef.current]);
      return styleBoxQuad(style, kind, widgetId ? measuredWidgetSize(widgetId) : null, {
        width: edges.includes('right'),
        height: edges.includes('top'),
      });
    }
    if (kind === 'position') {
      const widgetId = selectedWidgetIdRef.current;
      let quad = styleBoxQuad(style, kind);
      if (!widgetId) {
        return quad;
      }
      const measured = measuredWidgetInsets(widgetId, style?.position);
      if (!measured) {
        return quad;
      }
      for (const edge of heldSpacingEdgesRef.current) {
        if (isAutoLength(style?.[edge])) {
          continue;
        }
        if (quad[edge] == null && measured[edge] != null) {
          quad = { ...quad, [edge]: measured[edge] };
        }
      }
      return quad;
    }
    return styleBoxQuad(style, kind);
  }

  function writeNudgeStyle(style: WidgetStyle | undefined, kind: BoxDragKind | 'border', quad: BoxQuad) {
    if (kind === 'border') {
      const hasWidth = [quad.top, quad.right, quad.bottom, quad.left].some((value) => (value ?? 0) !== 0);
      return compactWidgetStyle({
        ...style,
        borderTopWidth: quad.top,
        borderRightWidth: quad.right,
        borderBottomWidth: quad.bottom,
        borderLeftWidth: quad.left,
        borderStyle: hasWidth ? style?.borderStyle || 'solid' : style?.borderStyle,
      });
    }
    return styleFromBoxQuad(style, kind, quad);
  }

  function writeSizedStyle(widget: PageWidget, kind: BoxDragKind | 'border', quad: BoxQuad) {
    if (kind === 'size' && widget.type === 'drawer') {
      const place = widget.place ?? DEFAULT_DRAWER_PLACE;
      const axis = drawerSizeAxis(place);
      const raw = axis === 'width' ? (quad.right ?? quad.left) : (quad.top ?? quad.bottom);
      const px = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
      const node = iframeRef.current?.contentDocument?.querySelector<HTMLElement>(
        `[data-widget-id="${CSS.escape(widget.id)}"]`,
      );
      const container = axis === 'width' ? (node?.offsetWidth ?? 0) : (node?.offsetHeight ?? 0);
      return drawerStyleFromDrag(widget.style, place, px, container);
    }
    return writeNudgeStyle(widget.style, kind, quad);
  }

  function writeHeldSpacingValue(kind: BoxDragKind | 'border', value: number) {
    const held = kind === 'size' ? uniqueSizeEdges([...heldSpacingEdgesRef.current]) : [...heldSpacingEdgesRef.current];
    const widgetId = selectedWidgetIdRef.current;
    const widget = findViewed(widgetId);
    if (!widget) {
      return;
    }
    const edges =
      kind === 'border' || kind === 'size'
        ? held
        : held.filter((edge) => !isAutoLength(edgeBoxLength(widget.style, kind, edge)));
    if (edges.length === 0) {
      return;
    }
    if (kind === 'position' && !canEditPositionInsets(widget.style)) {
      return;
    }
    const next = applySpacingValue(
      readNudgeQuad(widget.style, kind),
      edges,
      value,
      kind === 'margin' || kind === 'position' ? undefined : 0,
    );
    const quad = kind === 'size' ? syncSizeQuad(next) : next;
    updateWidget(widget.id, { style: writeSizedStyle(widget, kind, quad) }, `edit:${widget.id}:style`);
  }

  function heldSpacingValueText(kind: BoxDragKind | 'border') {
    const edges = [...heldSpacingEdgesRef.current];
    if (edges.length === 0) {
      return '';
    }
    const widgetId = selectedWidgetIdRef.current;
    const widget = findViewed(widgetId);
    if (!widget) {
      return '';
    }
    const shown = readNudgeQuad(widget.style, kind)[edges[0]];
    return String(Math.trunc(typeof shown === 'number' ? shown : 0));
  }

  function stopSpacingNudgeRepeat() {
    if (spacingNudgeRepeatRef.current != null) {
      clearInterval(spacingNudgeRepeatRef.current);
      spacingNudgeRepeatRef.current = null;
    }
    spacingNudgeRepeatKeyRef.current = null;
  }

  function applyHeldArrowNudge(key: string, step: number) {
    const kind = openBoxGroupRef.current;
    if (!isSpacingNudgeGroup(kind) || spacingDragRef.current) {
      stopSpacingNudgeRepeat();
      return;
    }
    const all = spacingNudgeAllRef.current;
    const delta = spacingNudgeFromArrow(key, all, step);
    if (delta == null) {
      stopSpacingNudgeRepeat();
      return;
    }
    const edges =
      kind === 'size'
        ? uniqueSizeEdges(all ? [...SPACING_EDGES] : [...heldSpacingEdgesRef.current])
        : all
          ? [...SPACING_EDGES]
          : [...heldSpacingEdgesRef.current];
    if (edges.length === 0) {
      stopSpacingNudgeRepeat();
      return;
    }
    const widgetId = selectedWidgetIdRef.current;
    const widget = findViewed(widgetId);
    if (!widget) {
      return;
    }
    if (kind === 'position' && !canEditPositionInsets(widget.style)) {
      stopSpacingNudgeRepeat();
      return;
    }
    const next = applySpacingNudge(readNudgeQuad(widget.style, kind), edges, delta, spacingAllowsNegative(kind) ? undefined : 0);
    const quad = kind === 'size' ? syncSizeQuad(next) : next;
    updateWidget(widget.id, { style: writeSizedStyle(widget, kind, quad) }, `edit:${widget.id}:style`);
  }

  function startSpacingNudgeRepeat(key: string) {
    stopSpacingNudgeRepeat();
    spacingNudgeRepeatKeyRef.current = key;
    spacingNudgeRepeatRef.current = setInterval(() => {
      applyHeldArrowNudge(key, SPACING_NUDGE_REPEAT_STEP);
    }, SPACING_NUDGE_REPEAT_MS);
  }

  function writeHeldRotateValue(value: number) {
    const axes = rotateAxesFromSelectKeys(heldSpacingKeysRef.current);
    const widgetId = selectedWidgetIdRef.current;
    const widget = findViewed(widgetId);
    if (!widget || axes.length === 0) {
      return;
    }
    const next = applyRotateValue(styleRotateTriple(widget.style), axes, value);
    updateWidget(widget.id, { style: compactWidgetStyle(writeRotateStyle(widget.style, next)) }, `edit:${widget.id}:style`);
  }

  function applyHeldRotateNudge(direction: 1 | -1, repeat = false) {
    const axes = rotateAxesFromSelectKeys(heldSpacingKeysRef.current);
    const widgetId = selectedWidgetIdRef.current;
    const widget = findViewed(widgetId);
    if (!widget || axes.length === 0) {
      return;
    }
    const next = applyRotateNudge(styleRotateTriple(widget.style), axes, direction, repeat);
    updateWidget(widget.id, { style: compactWidgetStyle(writeRotateStyle(widget.style, next)) }, `edit:${widget.id}:style`);
  }

  function handleRotateNudge(
    event: {
      key: string;
      code?: string;
      repeat?: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
    },
    phase: 'down' | 'up',
  ) {
    const selectKey = rotateSelectKey(event.key, event.code);
    if (selectKey) {
      if (phase === 'up') {
        heldSpacingKeysRef.current.delete(selectKey);
        if (heldSpacingKeysRef.current.size === 0) {
          spacingValueBufferRef.current = '';
        }
      } else if (!event.repeat) {
        const started = heldSpacingKeysRef.current.size === 0;
        heldSpacingKeysRef.current.add(selectKey);
        if (started) {
          spacingValueBufferRef.current = '';
        } else if (spacingValueBufferRef.current) {
          writeHeldRotateValue(Number(spacingValueBufferRef.current));
        }
      }
      postSpacingActive();
      return true;
    }
    const axes = rotateAxesFromSelectKeys(heldSpacingKeysRef.current);
    if (axes.length === 0) {
      return Boolean(selectKey);
    }
    const typed = rotateDigitFromNumpad(event.code, event.key);
    if (typed != null) {
      if (phase === 'up' || event.repeat || spacingDragRef.current) {
        return true;
      }
      if (spacingValueBufferRef.current.replace('-', '').replace('.', '').length >= ROTATE_VALUE_MAX_CHARS) {
        return true;
      }
      spacingValueBufferRef.current += typed;
      writeHeldRotateValue(Number(spacingValueBufferRef.current));
      return true;
    }
    if (isRotateDecimalKey(event.key, event.code)) {
      if (phase === 'up' || event.repeat || spacingDragRef.current) {
        return true;
      }
      if (spacingValueBufferRef.current.includes('.')) {
        return true;
      }
      spacingValueBufferRef.current = `${spacingValueBufferRef.current || '0'}.`;
      return true;
    }
    if (isRotateSignKey(event.key, event.code)) {
      if (phase === 'up' || event.repeat || spacingDragRef.current) {
        return true;
      }
      if (spacingValueBufferRef.current.startsWith('-')) {
        return true;
      }
      spacingValueBufferRef.current = `-${spacingValueBufferRef.current}`;
      if (spacingValueBufferRef.current !== '-') {
        writeHeldRotateValue(Number(spacingValueBufferRef.current));
      }
      return true;
    }
    if (event.key === 'Backspace') {
      if (phase === 'up' || spacingDragRef.current) {
        return true;
      }
      const next = spacingValueBufferRef.current.slice(0, -1);
      spacingValueBufferRef.current = next === '-' ? '' : next;
      const value = Number(spacingValueBufferRef.current);
      writeHeldRotateValue(Number.isFinite(value) ? value : 0);
      return true;
    }
    const direction = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
    if (direction === 0) {
      return false;
    }
    if (phase === 'up') {
      if (spacingNudgeRepeatKeyRef.current === event.key) {
        stopSpacingNudgeRepeat();
      }
      return true;
    }
    if (event.repeat || spacingDragRef.current) {
      return true;
    }
    applyHeldRotateNudge(direction, false);
    stopSpacingNudgeRepeat();
    spacingNudgeRepeatKeyRef.current = event.key;
    spacingNudgeRepeatRef.current = setInterval(() => {
      applyHeldRotateNudge(direction, true);
    }, SPACING_NUDGE_REPEAT_MS);
    return true;
  }

  function handleSpacingNudge(
    event: {
      key: string;
      code?: string;
      repeat?: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey: boolean;
    },
    phase: 'down' | 'up',
  ) {
    if (event.ctrlKey || event.metaKey || readOnlyRef.current) {
      return false;
    }
    const kind = openBoxGroupRef.current;
    if (kind === 'rotate') {
      return handleRotateNudge(event, phase);
    }
    if (!isSpacingNudgeGroup(kind)) {
      return false;
    }
    if (kind === 'position') {
      const widgetId = selectedWidgetIdRef.current;
      const widget = findViewed(widgetId);
      if (!canEditPositionInsets(widget?.style)) {
        return false;
      }
    }
    const selectKey = spacingSelectKey(event.key, event.code, kind);
    if (selectKey) {
      if (phase === 'up') {
        heldSpacingKeysRef.current.delete(selectKey);
        syncHeldSpacingEdges();
        if (heldSpacingKeysRef.current.size === 0) {
          spacingValueBufferRef.current = '';
        }
      } else if (!event.repeat) {
        const started = heldSpacingKeysRef.current.size === 0;
        heldSpacingKeysRef.current.add(selectKey);
        syncHeldSpacingEdges();
        if (started) {
          spacingValueBufferRef.current = '';
        } else if (spacingValueBufferRef.current) {
          writeHeldSpacingValue(kind, Number(spacingValueBufferRef.current));
        }
      }
      postSpacingActive();
      return true;
    }
    const typed = spacingDigitFromNumpad(event.code, event.key);
    if (typed != null) {
      if (heldSpacingEdgesRef.current.size === 0) {
        return false;
      }
      if (phase === 'up' || event.repeat || spacingDragRef.current) {
        return true;
      }
      const digits = spacingValueBufferRef.current.replace('-', '').length;
      if (digits >= SPACING_VALUE_MAX_DIGITS) {
        return true;
      }
      spacingValueBufferRef.current += typed;
      writeHeldSpacingValue(kind, Number(spacingValueBufferRef.current));
      return true;
    }
    if (isSpacingSignKey(event.key, event.code)) {
      if (heldSpacingEdgesRef.current.size === 0) {
        return false;
      }
      if (kind === 'size' || phase === 'up' || event.repeat || spacingDragRef.current) {
        return true;
      }
      if (spacingValueBufferRef.current.startsWith('-')) {
        return true;
      }
      spacingValueBufferRef.current = `-${spacingValueBufferRef.current}`;
      if (spacingValueBufferRef.current !== '-') {
        writeHeldSpacingValue(kind, Number(spacingValueBufferRef.current));
      }
      return true;
    }
    if (event.key === 'Backspace') {
      if (heldSpacingEdgesRef.current.size === 0) {
        return false;
      }
      if (phase === 'up' || spacingDragRef.current) {
        return true;
      }
      const current = spacingValueBufferRef.current || heldSpacingValueText(kind);
      const next = current.slice(0, -1);
      spacingValueBufferRef.current = next === '-' ? '' : next;
      const value = Number(spacingValueBufferRef.current);
      writeHeldSpacingValue(kind, Number.isFinite(value) ? value : 0);
      return true;
    }
    const all = spacingNudgeAllRef.current;
    const delta = spacingNudgeFromArrow(event.key, all);
    if (delta == null) {
      return false;
    }
    if (phase === 'up') {
      if (spacingNudgeRepeatKeyRef.current === event.key) {
        stopSpacingNudgeRepeat();
      }
      return heldSpacingEdgesRef.current.size > 0;
    }
    if (event.repeat || spacingDragRef.current) {
      return heldSpacingEdgesRef.current.size > 0;
    }
    if (heldSpacingEdgesRef.current.size === 0) {
      return false;
    }
    applyHeldArrowNudge(event.key, 1);
    startSpacingNudgeRepeat(event.key);
    return true;
  }
  handleSpacingNudgeRef.current = handleSpacingNudge;

  function applySpacingDragMove(
    screenX: number,
    screenY: number,
    shiftKey: boolean,
    spacingEdge?: SpacingEdge,
    altKey = false,
    rotateAngle?: number,
  ) {
    const spacing = spacingDragRef.current;
    if (!spacing) {
      return;
    }
    const widget = findViewed(spacing.widgetId);
    if (!widget) {
      return;
    }
    spacing.lastX = screenX;
    spacing.lastY = screenY;
    if (spacing.kind === 'rotate') {
      if (rotateAngle != null) {
        spacing.lastRotateAngle = rotateAngle;
      }
      const held = rotateAxesFromSelectKeys(heldSpacingKeysRef.current);
      const axes = held.length > 0 ? held : spacing.axis ? [spacing.axis] : [];
      if (axes.length === 0) {
        return;
      }
      const scale = Math.max(viewRef.current.scale, 0.01);
      const dx = (screenX - spacing.x) / scale;
      const dy = (screenY - spacing.y) / scale;
      const start = spacing.rotateStart ?? styleRotateTriple(widget.style);
      const currentAngle = rotateAngle ?? spacing.lastRotateAngle;
      const angleDeltaDeg = shortestAngleDelta(spacing.startAngle ?? 0, currentAngle ?? 0);
      let next = { ...start };
      for (const axis of axes) {
        const applied = applyRotateDrag({
          start,
          axis,
          dx,
          dy,
          angleDeltaDeg: axis === 'z' ? angleDeltaDeg : 0,
          snap: shiftKey,
        });
        next[axis] = applied[axis];
      }
      patchLiveWidgetStyle(spacing.widgetId, writeRotateStyle(widget.style, next));
      return;
    }
    if (spacing.mirror !== altKey) {
      spacing.start =
        spacing.kind === 'position'
          ? seedPositionQuad(widget.style, spacing.widgetId, spacing.edge)
          : styleBoxQuad(
            widget.style,
            spacing.kind,
            spacing.kind === 'size' ? measuredWidgetSize(spacing.widgetId) : null,
            spacing.kind === 'size' ? sizeLock(spacing.edge, altKey) : undefined,
          );
      spacing.x = screenX;
      spacing.y = screenY;
      spacing.mirror = altKey;
    }
    const scale = Math.max(viewRef.current.scale, 0.01);
    const dx = (screenX - spacing.x) / scale;
    const dy = (screenY - spacing.y) / scale;
    const edge = spacing.edge ?? spacingEdge ?? pickSpacingEdge(dx, dy);
    if (edge && !spacing.edge) {
      spacing.edge = edge;
    }
    if (spacing.kind === 'position' && edge && spacing.start[edge] == null) {
      spacing.start = seedPositionQuad(widget.style, spacing.widgetId, edge);
    }
    const quad =
      spacing.kind === 'radius'
        ? applyRadiusDrag({
          start: spacing.start,
          dx,
          dy,
          edge,
          snap: shiftKey,
          mirror: altKey,
        })
        : spacing.kind === 'size'
          ? applySizeDrag({
            start: spacing.start,
            dx,
            dy,
            edge,
            snap: shiftKey,
            mirror: altKey,
          })
          : applySpacingDrag({
            start: spacing.start,
            dx,
            dy,
            edge,
            min: spacing.kind === 'padding' ? 0 : undefined,
            snap: shiftKey,
            inward: spacing.kind === 'padding' || spacing.kind === 'position',
            mirror: altKey,
          });
    patchLiveWidgetStyle(spacing.widgetId, writeSizedStyle(widget, spacing.kind, quad));
  }

  function handleCanvasPointer(data: {
    action: 'down' | 'move' | 'up';
    pointerId: number;
    clientX?: number;
    clientY?: number;
    screenX: number;
    screenY: number;
    button: number;
    shiftKey: boolean;
    altKey?: boolean;
    spacingEdge?: SpacingEdge;
    rotateAxis?: RotateAxis;
    rotateAngle?: number;
    boxWidth?: number;
    boxHeight?: number;
  }) {
    if (data.action === 'down') {
      if (data.button === 1) {
        dragRef.current = {
          pointerId: data.pointerId,
          x: data.screenX,
          y: data.screenY,
          panX: viewRef.current.x,
          panY: viewRef.current.y,
        };
        panningRef.current = true;
        stageRef.current?.classList.add('is-panning');
        syncSelectChrome();
        return;
      }
      if (data.button !== 0) {
        return;
      }
      const kind = openBoxGroupRef.current;
      const widget = styleTargetWidget();
      const widgetId = widget?.id;
      if (readOnlyRef.current || !isBoxDragGroup(kind) || !widget || !widgetId || !isBoxGroupAllowed(widget.type, kind)) {
        return;
      }
      if (kind === 'rotate') {
        const held = rotateAxesFromSelectKeys(heldSpacingKeysRef.current);
        const axis = held[0] ?? data.rotateAxis;
        if (!axis) {
          return;
        }
        rememberWidgetBox(widgetId, data.boxWidth, data.boxHeight);
        beginLiveStyleCoalesce(widgetId);
        spacingDragRef.current = {
          pointerId: data.pointerId,
          x: data.screenX,
          y: data.screenY,
          lastX: data.screenX,
          lastY: data.screenY,
          widgetId,
          kind,
          start: { top: undefined, right: undefined, bottom: undefined, left: undefined },
          edge: null,
          mirror: false,
          rotateStart: styleRotateTriple(widget.style),
          axis,
          startAngle: data.rotateAngle,
          lastRotateAngle: data.rotateAngle,
        };
        syncSelectChrome();
        return;
      }
      if (!data.spacingEdge) {
        return;
      }
      if (kind === 'position' && !canEditPositionInsets(widget.style)) {
        return;
      }
      rememberWidgetBox(widgetId, data.boxWidth, data.boxHeight);
      beginLiveStyleCoalesce(widgetId);
      const origin =
        kind === 'size' && data.clientX != null && data.clientY != null
          ? { x: data.clientX, y: data.clientY }
          : { x: data.screenX, y: data.screenY };
      spacingDragRef.current = {
        pointerId: data.pointerId,
        x: origin.x,
        y: origin.y,
        lastX: origin.x,
        lastY: origin.y,
        widgetId,
        kind,
        start:
          kind === 'position'
            ? seedPositionQuad(widget.style, widgetId, data.spacingEdge)
            : styleBoxQuad(
              widget.style,
              kind,
              kind === 'size' ? measuredWidgetSize(widgetId) : null,
              kind === 'size' ? sizeLock(data.spacingEdge, Boolean(data.altKey)) : undefined,
            ),
        edge: data.spacingEdge,
        mirror: Boolean(data.altKey),
      };
      if ((kind === 'radius' || kind === 'size') && data.altKey) {
        applySpacingDragMove(origin.x, origin.y, data.shiftKey, data.spacingEdge, true);
      }
      setSpacingDragCursor(kind, data.spacingEdge, { shield: false });
      const shieldKind = kind;
      const shieldEdge = data.spacingEdge;
      window.requestAnimationFrame(() => {
        if (spacingDragRef.current) {
          setSpacingDragCursor(shieldKind, shieldEdge);
        }
      });
      syncSelectChrome();
      return;
    }
    const spacing = spacingDragRef.current;
    if (spacing && spacing.pointerId === data.pointerId) {
      if (data.action === 'move') {
        rememberWidgetBox(spacing.widgetId, data.boxWidth, data.boxHeight);
        const point =
          spacing.kind === 'size' && data.clientX != null && data.clientY != null
            ? { x: data.clientX, y: data.clientY }
            : { x: data.screenX, y: data.screenY };
        applySpacingDragMove(point.x, point.y, data.shiftKey, data.spacingEdge, data.altKey, data.rotateAngle);
        return;
      }
      spacingDragRef.current = null;
      setSpacingDragCursor(null, null);
      flushLiveWidgets();
      syncSelectChrome();
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== data.pointerId) {
      return;
    }
    if (data.action === 'move') {
      schedulePan(drag.panX + (data.screenX - drag.x), drag.panY + (data.screenY - drag.y));
      return;
    }
    finishPan();
  }
  handleCanvasPointerRef.current = handleCanvasPointer;
  applySpacingDragMoveRef.current = applySpacingDragMove;

  function copySelectedWidget() {
    const selected = findWidget(widgetsRef.current, selectedWidgetIdRef.current);
    if (!selected) {
      return;
    }
    clipboardRef.current = cloneWidget(selected);
    setClipboardTick((tick) => tick + 1);
  }

  function pasteClipboard() {
    if (readOnlyRef.current || !clipboardRef.current) {
      return;
    }
    const copy = cloneWidget(
      clipboardRef.current,
      nextWidgetId,
      collectTreeStateIds(widgetsRef.current),
    );
    const nextWidgets = insertWidget(widgetsRef.current, selectedWidgetIdRef.current, copy);
    const added = findWidget(nextWidgets, copy.id);
    commitWidgets(nextWidgets, added ? copy.id : selectedWidgetIdRef.current);
  }

  function deleteSelectedWidget() {
    if (readOnlyRef.current || !selectedWidgetIdRef.current) {
      return;
    }
    if (!findWidget(widgetsRef.current, selectedWidgetIdRef.current)) {
      return;
    }
    const result = removeWidget(widgetsRef.current, selectedWidgetIdRef.current);
    commitWidgets(result.widgets, result.nextSelectedId);
  }

  function toggleWidgetHidden(widgetId: string) {
    if (readOnlyRef.current) {
      return;
    }
    const widget = findWidget(widgetsRef.current, widgetId);
    if (!widget) {
      return;
    }
    commitWidgets(
      updateWidgetById(widgetsRef.current, widgetId, (item) => patchWidget(item, { hidden: !item.hidden })),
      selectedWidgetIdRef.current,
    );
  }

  function openAliasModal(widgetId: string) {
    if (readOnlyRef.current) {
      return;
    }
    selectWidget(widgetId);
    const widget = findWidget(widgetsRef.current, widgetId);
    setAliasInput(widget?.alias ?? '');
    setAliasModalId(widgetId);
  }

  function submitAlias() {
    if (!aliasModalId || readOnlyRef.current) {
      return;
    }
    const widget = findWidget(widgetsRef.current, aliasModalId);
    if (!widget) {
      setAliasModalId(null);
      return;
    }
    commitWidgets(
      updateWidgetById(widgetsRef.current, aliasModalId, (item) => patchWidget(item, { alias: aliasInput })),
      selectedWidgetIdRef.current,
      'edit:alias',
    );
    setAliasModalId(null);
  }

  function undoWidgetEdit() {
    if (readOnlyRef.current || pastRef.current.length === 0) {
      return;
    }
    coalesceKeyRef.current = null;
    const current: HistoryEntry = {
      widgets: widgetsRef.current,
      pageStyle: pageStyleRef.current,
      pageData: pageDataRef.current,
      pageEvents: pageEventsRef.current,
      pageMethods: pageMethodsRef.current,
      componentProps: componentPropsRef.current,
      pageQuery: pageQueryRef.current,
      componentEmits: componentEmitsRef.current,
      testData: testDataRef.current,
      selectedWidgetId: selectedWidgetIdRef.current,
    };
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, current].slice(-HISTORY_LIMIT);
    const previousWidgets = widgetsRef.current;
    widgetsRef.current = previous.widgets;
    pageStyleRef.current = previous.pageStyle;
    pageDataRef.current = previous.pageData;
    pageEventsRef.current = previous.pageEvents;
    pageMethodsRef.current = previous.pageMethods;
    componentPropsRef.current = previous.componentProps;
    pageQueryRef.current = previous.pageQuery;
    componentEmitsRef.current = previous.componentEmits;
    testDataRef.current = previous.testData;
    selectedWidgetIdRef.current = previous.selectedWidgetId;
    clearTableRange();
    setWidgets(previous.widgets);
    setPageStyle(previous.pageStyle);
    setPageData(previous.pageData);
    setPageEvents(previous.pageEvents);
    setPageMethods(previous.pageMethods);
    setComponentProps(previous.componentProps);
    setPageQuery(previous.pageQuery);
    setComponentEmits(previous.componentEmits);
    setTestData(previous.testData);
    setSelectedWidgetId(previous.selectedWidgetId);
    setExpandedKeys((prev) => nextExpandedKeys(prev, previousWidgets, previous.widgets, previous.selectedWidgetId));
    setHistoryTick((tick) => tick + 1);
    queueDraftSave();
  }

  function redoWidgetEdit() {
    if (readOnlyRef.current || futureRef.current.length === 0) {
      return;
    }
    coalesceKeyRef.current = null;
    const current: HistoryEntry = {
      widgets: widgetsRef.current,
      pageStyle: pageStyleRef.current,
      pageData: pageDataRef.current,
      pageEvents: pageEventsRef.current,
      pageMethods: pageMethodsRef.current,
      componentProps: componentPropsRef.current,
      pageQuery: pageQueryRef.current,
      componentEmits: componentEmitsRef.current,
      testData: testDataRef.current,
      selectedWidgetId: selectedWidgetIdRef.current,
    };
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, current].slice(-HISTORY_LIMIT);
    const previousWidgets = widgetsRef.current;
    widgetsRef.current = next.widgets;
    pageStyleRef.current = next.pageStyle;
    pageDataRef.current = next.pageData;
    pageEventsRef.current = next.pageEvents;
    pageMethodsRef.current = next.pageMethods;
    componentPropsRef.current = next.componentProps;
    pageQueryRef.current = next.pageQuery;
    componentEmitsRef.current = next.componentEmits;
    testDataRef.current = next.testData;
    selectedWidgetIdRef.current = next.selectedWidgetId;
    clearTableRange();
    setWidgets(next.widgets);
    setPageStyle(next.pageStyle);
    setPageData(next.pageData);
    setPageEvents(next.pageEvents);
    setPageMethods(next.pageMethods);
    setComponentProps(next.componentProps);
    setPageQuery(next.pageQuery);
    setComponentEmits(next.componentEmits);
    setTestData(next.testData);
    setSelectedWidgetId(next.selectedWidgetId);
    setExpandedKeys((prev) => nextExpandedKeys(prev, previousWidgets, next.widgets, next.selectedWidgetId));
    setHistoryTick((tick) => tick + 1);
    queueDraftSave();
  }

  function dispatchShortcut(shortcut: WidgetShortcut) {
    if (shortcut === 'save') {
      void saveCurrentVersion();
      return;
    }
    if (isBoxGroupShortcut(shortcut)) {
      if (readOnlyRef.current || !selectedWidgetIdRef.current) {
        return;
      }
      const widget = styleTargetWidget();
      if (!widget || !isBoxGroupAllowed(widget.type, shortcut)) {
        return;
      }
      handleOpenBoxGroupChange(shortcut);
      return;
    }
    if (isTextStyleShortcut(shortcut)) {
      const widgetId = selectedWidgetIdRef.current;
      const widget = findViewed(widgetId);
      if (readOnlyRef.current || !widget || (widget.type !== 'text' && widget.type !== 'button' && widget.type !== 'checkbox' && widget.type !== 'input')) {
        return;
      }
      const style = widget.style;
      if (shortcut === 'fontSizeUp' || shortcut === 'fontSizeDown') {
        const from = typeof style?.fontSize === 'number' && style.fontSize > 0 ? style.fontSize : (measuredFontSize(widget.id) ?? 14);
        const nextSize = Math.min(999, Math.max(1, from + (shortcut === 'fontSizeUp' ? 1 : -1)));
        if (nextSize === style?.fontSize) {
          return;
        }
        updateWidget(
          widget.id,
          { style: compactWidgetStyle({ ...style, fontSize: nextSize }) },
          `edit:${widget.id}:style`,
        );
        return;
      }
      const next =
        shortcut === 'bold'
          ? compactWidgetStyle({ ...style, fontWeight: style?.fontWeight === '700' ? undefined : '700' })
          : shortcut === 'italic'
            ? compactWidgetStyle({ ...style, italic: style?.italic ? undefined : true })
            : shortcut === 'underline'
              ? compactWidgetStyle({ ...style, underline: style?.underline ? undefined : true })
              : compactWidgetStyle({ ...style, lineThrough: style?.lineThrough ? undefined : true });
      updateWidget(widget.id, { style: next }, `edit:${widget.id}:style`);
      return;
    }
    if (readOnlyRef.current && shortcut !== 'copy') {
      return;
    }
    if (shortcut === 'copy') {
      copySelectedWidget();
      return;
    }
    if (shortcut === 'paste') {
      pasteClipboard();
      return;
    }
    if (shortcut === 'delete') {
      deleteSelectedWidget();
      return;
    }
    if (shortcut === 'undo') {
      undoWidgetEdit();
      return;
    }
    redoWidgetEdit();
  }
  dispatchShortcutRef.current = dispatchShortcut;

  function openCreatePage() {
    setEditingPage(null);
    pageForm.resetFields();
    setPageModalOpen(true);
  }

  function openEditPage(page: ProjectPageDto) {
    setEditingPage(page);
    pageForm.setFieldsValue({
      name: page.name,
      key: page.key,
      description: page.description,
    });
    setPageModalOpen(true);
  }

  async function submitPage() {
    if (!id) {
      return;
    }
    const values = await pageForm.validateFields();
    try {
      if (catalogKindRef.current === 'component') {
        if (editingPage) {
          const updated = await api.updateComponent(id, editingPage.id, values);
          setComponents((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        } else {
          const created = await api.createComponent(id, values);
          setComponents((current) => [...current, created]);
          setSelectedComponentId(created.id);
        }
      } else if (editingPage && projectVersionId) {
        const updated = await api.updatePage(id, projectVersionId, editingPage.id, values);
        setPages((current) => current.map((page) => (page.id === updated.id ? updated : page)));
      } else if (projectVersionId) {
        const created = await api.createPage(id, projectVersionId, values);
        setPages((current) => [...current, created]);
        setSelectedPageId(created.id);
      }
      setPageModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

  async function removePage(page: ProjectPageDto) {
    if (!id) {
      return;
    }
    try {
      if (catalogKindRef.current === 'component') {
        await api.deleteComponent(id, page.id);
        forgetComponentSelection(id, page.id);
        setComponents((current) => current.filter((item) => item.id !== page.id));
        if (selectedComponentId === page.id) {
          setSelectedComponentId(null);
        }
      } else {
        if (!projectVersionId) {
          return;
        }
        await api.deletePage(id, projectVersionId, page.id);
        forgetPageSelection(id, page.id);
        setPages((current) => current.filter((item) => item.id !== page.id));
        if (selectedPageId === page.id) {
          setSelectedPageId(null);
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.deleteFailed'));
    }
  }

  function openCreateVersion() {
    versionForm.setFieldsValue({
      source: 'blank',
      copyFromId: projectVersionId ?? projectVersions[0]?.id,
    });
    setVersionModalOpen(true);
  }

  async function submitCreateVersion() {
    if (!id) {
      return;
    }
    const values = await versionForm.validateFields();
    try {
      const created = await api.createProjectVersion(id, {
        source: values.source,
        copyFromId: values.source === 'copy' ? values.copyFromId : undefined,
      });
      setProjectVersions((current) => [...current, created]);
      setProjectVersionId(created.id);
      rememberVersionId(id, 'project', created.id);
      setVersionModalOpen(false);
      message.success(t('lowcode.versionCreated'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

  function sameLoaded(target: LoadedTarget) {
    const loaded = loadedOwnerRef.current;
    return (
      loaded != null &&
      loaded.kind === target.kind &&
      loaded.ownerId === target.ownerId &&
      loaded.versionId === target.versionId
    );
  }

  async function saveLoadedDocument(
    options?: { silent?: boolean },
    forced?: { target: LoadedTarget; document: PageXmlDocument; key: string },
  ) {
    const target = forced?.target ?? loadedOwnerRef.current;
    const documentToSave = forced?.document ?? documentRef.current;
    const keyToSave = forced?.key ?? documentKeyRef.current;
    if (!id || !target) {
      return;
    }
    if (!forced) {
      if (!persistEnabledRef.current || !sameLoaded(target)) {
        return;
      }
    }
    if (target.kind === 'page' && !target.projectVersionId) {
      return;
    }
    if (readOnlyRef.current) {
      return;
    }
    if (keyToSave === lastServerKeyRef.current || emptyCanvasWouldErase()) {
      return;
    }
    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      return;
    }
    const projectId = id;
    saveInFlightRef.current = true;
    if (!forced) {
      setSaveStatus('saving');
    }
    try {
      if (target.kind === 'component') {
        const updated = await api.updateComponentVersion(projectId, target.ownerId, target.versionId, {
          document: documentToSave,
        });
        void putCachedVersion(projectId, target.ownerId, { ...updated, document: documentToSave });
        if (sameLoaded(target) && documentKeyRef.current === keyToSave) {
          lastServerKeyRef.current = keyToSave;
          setVersions((current) =>
            current.map((version) => (version.id === updated.id ? { ...updated, document: documentToSave } : version)),
          );
        }
      } else if (target.projectVersionId) {
        const updated = await api.updatePageDocument(projectId, target.projectVersionId, target.ownerId, {
          document: documentToSave,
        });
        if (updated.id !== target.versionId) {
          setPages((current) =>
            current.map((page) => (page.id === target.ownerId ? { ...page, currentVersionId: updated.id } : page)),
          );
          if (sameLoaded(target)) {
            loadedOwnerRef.current = { ...target, versionId: updated.id };
            pageSnapshotIdRef.current = updated.id;
            setPageSnapshotId(updated.id);
          }
        }
        if (sameLoaded(target) && documentKeyRef.current === keyToSave) {
          lastServerKeyRef.current = keyToSave;
        }
      }
      if (sameLoaded(target)) {
        if (!options?.silent) {
          message.success(t('lowcode.versionUpdated'));
        }
        setSaveStatus(documentKeyRef.current === lastServerKeyRef.current ? 'saved' : 'unsaved');
      }
    } catch (error) {
      if (sameLoaded(target) || forced) {
        setSaveStatus('unsaved');
        message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
      }
    } finally {
      saveInFlightRef.current = false;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        void saveLoadedDocument(options);
      }
    }
  }

  function saveCurrentVersion(options?: { silent?: boolean }) {
    return saveLoadedDocument(options);
  }
  saveCurrentVersionRef.current = saveCurrentVersion;

  async function removeVersion(version: { id: string }) {
    if (!id) {
      return;
    }
    try {
      await api.deleteProjectVersion(id, version.id);
      const rest = projectVersions.filter((item) => item.id !== version.id);
      setProjectVersions(rest);
      if (projectVersionId === version.id) {
        setProjectVersionId(rest[rest.length - 1]?.id ?? null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.deleteFailed'));
    }
  }

  function selectVersion(version: { id: string }) {
    if (id) {
      rememberVersionId(id, 'project', version.id);
    }
    setProjectVersionId(version.id);
  }

  if (loading) {
    return <Spin />;
  }

  if (missing || !project) {
    return <ProjectMissing />;
  }

  const selectedWidget = findWidget(widgets, selectedWidgetId);
  const selectedParent = findParentWidget(widgets, selectedWidgetId);
  const visibleStates = collectStateTree(widgets, selectedWidgetId);
  const selectedDisplayWidget = selectedWidget
    ? widgetWithStateLayers(selectedWidget, stateLayersForWidget(widgets, selectedWidget.id, viewingByOwner))
    : null;
  const selectedComponentProps =
    selectedDisplayWidget?.type === 'component'
      ? liveComponentPropsRef.current[selectedDisplayWidget.componentId] ??
        componentDocsRef.current[selectedDisplayWidget.componentId]?.props
      : undefined;
  const selectedOwnKeys = selectedWidget
    ? stateOwnKeys(selectedWidget, stateLayersForWidget(widgets, selectedWidget.id, viewingByOwner))
    : null;
  const owningTable = findOwningTable(widgets, tableRange?.tableId ?? selectedWidgetId);
  const activeRange = tableRange && owningTable && tableRange.tableId === owningTable.table.id ? tableRange : null;
  const rangeWidget = activeRange
    ? activeRange.kind === 'column'
      ? (owningTable?.headers[activeRange.index] ?? null)
      : activeRange.kind === 'header'
        ? (owningTable?.headers[0] ?? null)
        : (owningTable?.rows.find((row) => row.id === activeRange.rowId)?.children.find((child) => child.type === 'td') ?? null)
    : null;
  const bubbleWidget = rangeWidget ?? selectedDisplayWidget;
  const showHeaderHeight =
    Boolean(owningTable) &&
    (activeRange?.kind === 'header' ||
      (!activeRange && (selectedWidget?.type === 'th' || selectedWidget?.type === 'table')));
  const tableHeaderHeight = showHeaderHeight ? (owningTable?.table.headerHeight ?? DEFAULT_TABLE_HEADER_HEIGHT) : null;
  const tableStyleIds = owningTable && activeRange
    ? activeRange.kind === 'column'
      ? columnCellIds(owningTable, activeRange.index)
      : activeRange.kind === 'row'
        ? rowCellIds(owningTable, activeRange.rowId)
        : headerCellIds(owningTable)
    : [];
  const tableBubble: TableBubbleModel | undefined = owningTable
    ? {
        headerHeight: tableHeaderHeight,
        onHeaderHeight:
          tableHeaderHeight != null
            ? (value) => {
                const next = setTableHeaderHeight(widgetsRef.current, owningTable.table.id, value);
                if (next !== widgetsRef.current) {
                  commitWidgets(next, selectedWidgetIdRef.current, `table-header-height:${owningTable.table.id}`);
                }
              }
            : undefined,
        hideCopy: Boolean(rangeWidget),
        align: bubbleWidget && (bubbleWidget.type === 'th' || bubbleWidget.type === 'td') ? bubbleWidget.align : undefined,
        valign: bubbleWidget && (bubbleWidget.type === 'th' || bubbleWidget.type === 'td') ? bubbleWidget.valign : undefined,
        onAlign:
          bubbleWidget && (bubbleWidget.type === 'th' || bubbleWidget.type === 'td')
            ? (align) => {
                if (rangeWidget) {
                  const next = patchTableCells(widgetsRef.current, tableStyleIds, { align });
                  if (next !== widgetsRef.current) {
                    commitWidgets(next, selectedWidgetIdRef.current, `table-align:${owningTable.table.id}`);
                  }
                  return;
                }
                updateWidget(bubbleWidget.id, { align }, `edit:${bubbleWidget.id}:align`);
              }
            : undefined,
        onValign:
          bubbleWidget && (bubbleWidget.type === 'th' || bubbleWidget.type === 'td')
            ? (valign) => {
                if (rangeWidget) {
                  const next = patchTableCells(widgetsRef.current, tableStyleIds, { valign });
                  if (next !== widgetsRef.current) {
                    commitWidgets(next, selectedWidgetIdRef.current, `table-valign:${owningTable.table.id}`);
                  }
                  return;
                }
                updateWidget(bubbleWidget.id, { valign }, `edit:${bubbleWidget.id}:valign`);
              }
            : undefined,
      }
    : undefined;
  const widgetTreeData = toWidgetTreeData(widgets, (widget) => widgetTreeLabel(widget, t));
  const canDragWidgetToData = centerTab === 'data' && !readOnly;
  const modifier = modifierShortcutLabel();
  const canUndo = historyTick >= 0 && !readOnly && pastRef.current.length > 0;
  const canRedo = historyTick >= 0 && !readOnly && futureRef.current.length > 0;
  const canDelete = !readOnly && Boolean(selectedWidget);
  const canCopy = Boolean(selectedWidget);
  const canPaste = clipboardTick >= 0 && !readOnly && Boolean(clipboardRef.current);
  const showStyleChrome = !previewing && centerTab === 'layout';

  return (
    <ProjectVersionProvider versionId={projectVersionId}>
    <div className="editor-shell">
      <EditorHeader
        project={project}
        versionsOpen={versionsOpen}
        modifier={modifier}
        saveDisabled={catalogKind === 'component' ? !selectedVersion : !pageSnapshotId}
        onShowVersions={() => setVersionsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onSave={() => void saveCurrentVersion()}
      />
      <div className="editor-body">
        <EditorRail value={leftNav} onChange={setLeftNav} />
        <div className="editor-main">
          <div className={versionsOpen ? 'editor-workspace' : 'editor-workspace is-versions-collapsed'}>
          <div className="editor-work">
          <div className={['editor-grid', leftNav !== 'develop' ? 'is-covered' : ''].filter(Boolean).join(' ')}>
            <div className="editor-left">
              <PageListPanel
                kind={catalogKind}
                items={catalogKind === 'component' ? components : pages}
                selectedId={activeOwnerId}
                onKindChange={(kind) => {
                  if (kind === catalogKind) {
                    return;
                  }
                  beginOwnerCanvas();
                  setCatalogKind(kind);
                }}
                onCreate={openCreatePage}
                onEdit={openEditPage}
                onDelete={removePage}
                onSelect={(nextId) => {
                  if (nextId === activeOwnerId) {
                    return;
                  }
                  if (modeRef.current !== 'preview') {
                    beginOwnerCanvas();
                  }
                  if (catalogKind === 'component') {
                    setSelectedComponentId(nextId);
                    return;
                  }
                  previewNavRef.current = [];
                  if (Object.keys(previewQueryRef.current).length > 0) {
                    previewQueryRef.current = {};
                    setPreviewQuery({});
                  }
                  setSelectedPageId(nextId);
                }}
              />
              <WidgetTreePanel
                widgets={widgets}
                treeData={widgetTreeData}
                readOnly={readOnly}
                canDragWidgetToData={canDragWidgetToData}
                expandedKeys={expandedKeys}
                selectedWidgetId={selectedWidgetId}
                treeHostRef={widgetTreeHostRef}
                modifier={modifier}
                canUndo={canUndo}
                canRedo={canRedo}
                canCopy={canCopy}
                canPaste={canPaste}
                canDelete={canDelete}
                addDisabled={!selectedOwner || readOnly}
                onUndo={undoWidgetEdit}
                onRedo={redoWidgetEdit}
                onCopy={copySelectedWidget}
                onPaste={pasteClipboard}
                onDelete={deleteSelectedWidget}
                onAdd={() => setWidgetModalOpen(true)}
                onOpenAlias={openAliasModal}
                onOpenLoop={openWidgetLoopPanel}
                onOpenEvents={openWidgetEventsPanel}
                onToggleHidden={toggleWidgetHidden}
                onExpand={setExpandedKeys}
                onSelect={selectWidget}
                onFocus={focusWidgetById}
                onMove={(dragId, dropId, placement) => {
                  const nextWidgets = moveWidget(widgetsRef.current, dragId, dropId, placement);
                  if (!nextWidgets) {
                    return;
                  }
                  if (placement === 'inside') {
                    setExpandedKeys((prev) => (prev.includes(dropId) ? prev : [...prev, dropId]));
                  }
                  commitWidgets(nextWidgets, dragId);
                }}
              />
            </div>
            <CanvasWorkspace
              centerTab={centerTab}
              setCenterTab={setCenterTab}
              userAdjustedRef={userAdjustedRef}
              fitCanvas={fitCanvas}
              pageI18n={pageI18n}
              previewLocale={previewLocale}
              setPreviewLocale={setPreviewLocale}
              onCanvasPanPointerDown={onCanvasPanPointerDown}
              onCanvasPointerMove={onCanvasPointerMove}
              onCanvasPointerUp={onCanvasPointerUp}
              onCanvasPointerDown={onCanvasPointerDown}
              onCanvasMouseDown={onCanvasMouseDown}
              stageRef={stageRef}
              phoneScreenRef={phoneScreenRef}
              phoneFrameRef={phoneFrameRef}
              iframeRef={iframeRef}
              readyRef={readyRef}
              zoomLabelRef={zoomLabelRef}
              panning={panning}
              panningRef={panningRef}
              previewing={previewing}
              canvasSettling={canvasSettling}
              tableEditId={tableEditId}
              scrollEditId={scrollEditId}
              swiperEditId={swiperEditId}
              sendPreview={sendPreview}
              showStyleChrome={showStyleChrome}
              selectedWidget={selectedWidget}
              selectedWidgetId={selectedWidgetId}
              bubbleWidget={bubbleWidget}
              rangeWidget={rangeWidget}
              selectedOwnKeys={selectedOwnKeys}
              pageData={pageData}
              testData={pageDocument.testData}
              previewDataEdits={previewDataEdits}
              previewPropEdits={previewPropEdits}
              previewQueryEdits={previewQueryEdits}
              commitPreviewTest={commitPreviewTest}
              componentMode={catalogKind === 'component'}
              pageQuery={pageQuery}
              addPageQuery={addPageQuery}
              commitPageQuery={commitPageQuery}
              componentProps={componentProps}
              componentEmits={componentEmits}
              commitComponentProps={commitComponentProps}
              commitComponentEmits={commitComponentEmits}
              pageEvents={pageEvents}
              commitPageEvents={commitPageEvents}
              pageMethods={pageMethods}
              commitPageMethods={commitPageMethods}
              pageScopeId={selectedPageId ?? project.id}
              readOnly={readOnly}
              openBoxGroup={openBoxGroup}
              handleOpenBoxGroupChange={handleOpenBoxGroupChange}
              tableBubble={tableBubble}
              projectId={project.id}
              updateWidget={updateWidget}
              commitWidgets={commitWidgets}
              widgetsRef={widgetsRef}
              selectedWidgetIdRef={selectedWidgetIdRef}
              tableStyleIds={tableStyleIds}
              activeRange={activeRange}
              spacingDragRef={spacingDragRef}
              syncSelectChrome={syncSelectChrome}
              toolbarPopupOpenRef={toolbarPopupOpenRef}
              setInspectorOpen={setInspectorOpen}
              widgets={widgets}
              visibleStates={visibleStates}
              viewingOwnerId={viewingOwnerId}
              viewingState={viewingState}
              setViewingOwnerId={setViewingOwnerId}
              setViewingState={setViewingState}
              setViewingByOwner={setViewingByOwner}
              view={view}
              zoomBy={zoomBy}
              mode={mode}
              modeRef={modeRef}
              settleGenRef={settleGenRef}
              canvasSettlingRef={canvasSettlingRef}
              setCanvasSettling={setCanvasSettling}
              setMode={setMode}
              commitPageData={commitPageData}
              endCoalesce={endCoalesce}
            />
          </div>
          <EditorLibraries
            leftNav={leftNav}
            projectId={project.id}
            catalog={pageI18n}
            onI18nChange={commitPageI18n}
          />
          </div>
            {versionsOpen ? (
              <VersionListPanel
                versions={projectVersions}
                selectedVersionId={projectVersionId}
                createDisabled={false}
                onCollapse={() => setVersionsOpen(false)}
                onCreate={openCreateVersion}
                onSelect={selectVersion}
                onDelete={removeVersion}
              />
            ) : null}
          </div>
        </div>
      </div>
      <EditorInspector
        helpOpen={helpOpen}
        onHelpClose={() => setHelpOpen(false)}
        open={inspectorOpen}
        widget={selectedDisplayWidget}
        parentType={selectedParent?.type}
        readOnly={readOnly}
        pageI18n={pageI18n}
        variables={pageData}
        componentProps={selectedComponentProps}
        bindableProps={catalogKind === 'component' ? componentProps : undefined}
        projectId={project.id}
        ownKeys={selectedOwnKeys}
        pageStyle={pageStyle}
        invalid={inspectorInvalid}
        onInvalidChange={setInspectorInvalid}
        onClose={() => setInspectorOpen(false)}
        onPatch={updateWidget}
        onPageStyle={(style, field) => updatePageStyle(style, `edit:page:${field}`)}
        onLeave={endCoalesce}
      />
      <AddWidgetModal
        open={widgetModalOpen}
        components={components.filter((item) => catalogKind !== 'component' || item.id !== selectedComponentId)}
        onClose={() => setWidgetModalOpen(false)}
        onAdd={addWidget}
      />
      <AliasModal
        open={aliasModalId !== null}
        value={aliasInput}
        onChange={setAliasInput}
        onOk={submitAlias}
        onCancel={() => setAliasModalId(null)}
      />
      <PageFormModal
        open={pageModalOpen}
        editing={Boolean(editingPage)}
        kind={catalogKind}
        form={pageForm}
        onOk={() => void submitPage()}
        onCancel={() => setPageModalOpen(false)}
      />
      <CreateVersionModal
        open={versionModalOpen}
        form={versionForm}
        versions={projectVersions}
        onOk={() => void submitCreateVersion()}
        onCancel={() => setVersionModalOpen(false)}
      />
    </div>
    </ProjectVersionProvider>
  );
}
