import {
  ArrowLeftOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExpandOutlined,
  GlobalOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RedoOutlined,
  RightOutlined,
  SaveOutlined,
  SettingOutlined,
  SnippetsOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  ConfigProvider,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Radio,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Tree,
  Typography,
  message,
  theme,
} from 'antd';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import type { ProjectDto, ProjectPageDto, ProjectPageVersionDto } from '@vanstack/shared';
import {
  EMPTY_PAGE_XML,
  angleCss,
  boxLengthCss,
  compactPageI18n,
  compactSize,
  compactWidgetStyle,
  isLoopConfigured,
  ownedStateNames,
  parsePageXml,
  serializePageXml,
  type BoxLength,
  type PageI18n,
  type PageStyle,
  type PageVariable,
  type PageWidget,
  type WidgetStyle,
} from '@vanstack/xml';
import { api } from '../apis/api';
import { deleteDraft, getDraft, putDraft, putDraftNow } from '../utils/draftStore';
import {
  forgetPageSelection,
  getRememberedPageId,
  getRememberedVersionId,
  pickRememberedId,
  rememberPageId,
  rememberVersionId,
} from '../utils/editorSelection';
import { EditorHelpModal } from '../components/EditorHelpModal';
import { PageDataPanel } from '../components/PageDataPanel';
import { LanguageLibraryPanel } from '../components/LanguageLibraryModal';
import { isLowcodeMessage, LOWCODE_MESSAGE_SOURCE } from '../utils/lowcode-protocol';
import { PagePropertyInspector, WidgetPropertyInspector } from '../components/InspectorPropertyGrid';
import { WidgetStyleBubble, isBoxGroupAllowed, type BoxGroup } from '../components/WidgetStyleBubble';
import { WidgetStateList } from '../components/WidgetStateList';
import {
  applyRadiusDrag,
  applySizeDrag,
  applySpacingDrag,
  applySpacingNudge,
  applySpacingValue,
  isBoxDragKind,
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
} from '../utils/spacingDrag';
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
} from '../utils/rotateDrag';
import { previewScreenElement, previewVisualScale, setSpacingDragCursor } from '../utils/spacingGuides';
import type { BoxQuad } from '../components/StyleBoxEdges';
import {
  isBoxGroupShortcut,
  isEditableKeyboardTarget,
  isTextStyleShortcut,
  matchWidgetShortcut,
  modifierShortcutLabel,
  type WidgetShortcut,
} from '../utils/widgetShortcuts';
import {
  addWidgetToTree,
  cloneWidget,
  collectExpandableKeys,
  createSwiperWidget,
  emptySwiperItem,
  findParentWidget,
  findWidget,
  firstChildWidgetId,
  insertWidget,
  nextExpandedKeys,
  nextSiblingWidgetId,
  nextWidgetId,
  parentWidgetId,
  removeWidget,
  toWidgetTreeData,
  updateWidgetById,
  widgetTreeLabel,
  widgetTypeName,
  type WidgetPatch,
} from '../utils/widgetTree';
import {
  collectStateTree,
  createWidgetState,
  deleteWidgetState,
  patchResolvedWidget,
  pruneViewingByOwner,
  stateLayersForWidget,
  updateWidgetState,
  updateHostTransition,
  viewingAfterSelect,
  viewingListFromMap,
  widgetWithStateLayers,
  type ViewingByOwner,
} from '../utils/widgetStates';
import { writeWidgetDrag } from '../utils/pageData';

function widgetCanvasLabel(widget: PageWidget, t: (key: string) => string) {
  return `${widgetTypeName(widget.type, t)}(${widget.id})`;
}

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const SCREEN_WIDTH = 375;
const SCREEN_HEIGHT = 667;
const HISTORY_LIMIT = 100;
const LANGS_DEBOUNCE_MS = 400;

type HistoryEntry = {
  widgets: PageWidget[];
  pageStyle?: PageStyle;
  pageData: PageVariable[];
  selectedWidgetId: string | null;
};
type CenterTab = 'layout' | 'data' | 'events';
const FIT_PADDING_X = 32;
const FIT_PADDING_TOP = 24;
const FIT_PADDING_BOTTOM = 64;
const FOCUS_PADDING = 48;
const CANVAS_RASTER_SCALE = 2;
const EDIT_OVERFLOW_X = 4;
const EDIT_OVERFLOW_Y = 2;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.15;
const ZOOM_IDLE_MS = 80;
const SERVER_IDLE_MS = 1500;
const ENTER_DOUBLE_MS = 300;

type CanvasMode = 'edit' | 'preview';
type SaveStatus = 'saved' | 'saving' | 'unsaved';
type ViewTransform = { x: number; y: number; scale: number };

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function snapDevicePixel(value: number) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

function cameraTransform(view: ViewTransform, hasEditOverflow: boolean) {
  const shiftX = hasEditOverflow ? SCREEN_WIDTH * (EDIT_OVERFLOW_X / 2) * view.scale : 0;
  const shiftY = hasEditOverflow ? SCREEN_HEIGHT * (EDIT_OVERFLOW_Y / 2) * view.scale : 0;
  return `translate3d(${view.x - shiftX}px, ${view.y - shiftY}px, 0) scale(${view.scale / CANVAS_RASTER_SCALE})`;
}

function paintCanvasView(
  iframe: HTMLIFrameElement | null,
  frame: HTMLDivElement | null,
  view: ViewTransform,
  hasEditOverflow: boolean,
) {
  const camera = iframe?.contentDocument?.querySelector<HTMLElement>('.preview-camera');
  if (camera) {
    camera.style.transform = cameraTransform(view, hasEditOverflow);
  }
  if (frame) {
    frame.style.transform = `translate3d(${view.x}px, ${view.y}px, 0)`;
    frame.style.width = `${snapDevicePixel(SCREEN_WIDTH * view.scale)}px`;
    frame.style.height = `${snapDevicePixel(SCREEN_HEIGHT * view.scale)}px`;
  }
}

function computeFitView(stageWidth: number, stageHeight: number, screenWidth: number): ViewTransform {
  const availableWidth = Math.max(1, stageWidth - FIT_PADDING_X * 2);
  const availableHeight = Math.max(1, stageHeight - FIT_PADDING_TOP - FIT_PADDING_BOTTOM);
  const scale = clampScale(Math.min(availableWidth / screenWidth, availableHeight / SCREEN_HEIGHT));
  return {
    scale,
    x: FIT_PADDING_X + (availableWidth - screenWidth * scale) / 2,
    y: FIT_PADDING_TOP + (availableHeight - SCREEN_HEIGHT * scale) / 2,
  };
}

function mapIframePoint(iframe: HTMLIFrameElement | null, localX: number, localY: number) {
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

function iframePointToClient(
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

function zoomViewAt(
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

function sizeLock(edge?: SpacingEdge | null, mirror = false): { width: boolean; height: boolean } {
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
  if (size?.mode === 'px') {
    return size.value;
  }
  return measured ?? 0;
}

function dragLengthPx(length?: BoxLength): number | undefined {
  return length?.mode === 'px' ? length.value : undefined;
}

function pxBoxLength(value?: number): BoxLength | undefined {
  return value == null ? undefined : { mode: 'px', value };
}

function styleBoxQuad(
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

function keepOrPx(current: BoxLength | undefined, px: number | undefined): BoxLength | undefined {
  if (px != null) {
    return { mode: 'px', value: px };
  }
  if (current?.mode === 'auto' || current?.mode === '%') {
    return current;
  }
  return undefined;
}

function isAutoLength(length?: BoxLength) {
  return length?.mode === 'auto';
}

function edgeBoxLength(style: WidgetStyle | undefined, kind: BoxDragKind, edge: SpacingEdge) {
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

function styleFromBoxQuad(
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
    const width = quad.right ?? quad.left;
    const height = quad.top ?? quad.bottom;
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

function isBoxDragGroup(group: BoxGroup | null): group is BoxDragKind {
  return isBoxDragKind(group);
}

function isSpacingNudgeGroup(group: BoxGroup | null): group is BoxDragKind | 'border' {
  return isBoxDragKind(group) || group === 'border';
}

function spacingAllowsNegative(kind: BoxDragKind | 'border') {
  return kind === 'margin' || kind === 'position';
}

function canEditPositionInsets(style?: WidgetStyle) {
  return Boolean(style?.position);
}

function isStyleToolbarPopupOpen() {
  return Boolean(
    document.querySelector(
      '[data-toolbar-popup], .ant-popover:not(.ant-popover-hidden) .ant-color-picker-inner, .ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    ),
  );
}

function closeStyleToolbarPopups() {
  const open = isStyleToolbarPopupOpen();
  document.querySelectorAll('[data-toolbar-popup]').forEach((node) => {
    node.dispatchEvent(new Event('vanstack-close-toolbar-popup'));
  });
  return open;
}

function liveWidgetCss(style: WidgetStyle | undefined) {
  const px = (value: number | undefined) => (value != null ? `${value}px` : '');
  const length = (value?: BoxLength) => (value ? boxLengthCss(value) : '');
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
    borderTopLeftRadius: px(style?.radiusTopLeft),
    borderTopRightRadius: px(style?.radiusTopRight),
    borderBottomRightRadius: px(style?.radiusBottomRight),
    borderBottomLeftRadius: px(style?.radiusBottomLeft),
    borderStyle: style?.borderStyle ?? '',
    borderColor: style?.borderColor ?? '',
    width: style?.width?.mode === 'px' ? `${style.width.value}px` : style?.width?.mode === '%' ? `${style.width.value}%` : '',
    height: style?.height?.mode === 'px' ? `${style.height.value}px` : style?.height?.mode === '%' ? `${style.height.value}%` : '',
    position: style?.position ?? '',
    top: positioned ? length(style?.top) : '',
    right: positioned ? length(style?.right) : '',
    bottom: positioned ? length(style?.bottom) : '',
    left: positioned ? length(style?.left) : '',
    zIndex: positioned && style?.zIndex != null ? String(style.zIndex) : '',
    transform: [
      style?.rotateX ? `rotateX(${angleCss(style.rotateX)})` : '',
      style?.rotateY ? `rotateY(${angleCss(style.rotateY)})` : '',
      style?.rotateZ ? `rotateZ(${angleCss(style.rotateZ)})` : '',
    ]
      .filter(Boolean)
      .join(' '),
  } satisfies Record<string, string>;
}

export function ProjectEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [pages, setPages] = useState<ProjectPageDto[]>([]);
  const [versions, setVersions] = useState<ProjectPageVersionDto[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<PageWidget[]>([]);
  const [pageStyle, setPageStyle] = useState<PageStyle | undefined>(undefined);
  const [pageData, setPageData] = useState<PageVariable[]>([]);
  const [pageI18n, setPageI18n] = useState<PageI18n | undefined>(undefined);
  const [previewLocale, setPreviewLocale] = useState<string | null>(null);
  const [leftNav, setLeftNav] = useState<'develop' | 'i18n'>('develop');
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [viewingOwnerId, setViewingOwnerId] = useState<string | null>(null);
  const [viewingState, setViewingState] = useState<string | null>(null);
  const [viewingByOwner, setViewingByOwner] = useState<ViewingByOwner>({});
  const [openBoxGroup, setOpenBoxGroup] = useState<BoxGroup | null>(null);
  const [centerTab, setCenterTab] = useState<CenterTab>('layout');
  const [loading, setLoading] = useState(true);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<ProjectPageDto | null>(null);
  const [pageForm] = Form.useForm<{ name: string; key: string; description?: string }>();
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [versionForm] = Form.useForm<{ source: 'blank' | 'copy'; copyFromId?: string }>();
  const createVersionSource = Form.useWatch('source', versionForm);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetBoxRef = useRef<{ widgetId: string; width: number; height: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneScreenRef = useRef<HTMLDivElement>(null);
  const phoneFrameRef = useRef<HTMLDivElement>(null);
  const widgetTreeHostRef = useRef<HTMLDivElement>(null);
  const xmlRef = useRef('');
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
  const modeRef = useRef<CanvasMode>('edit');
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
  const lastServerXmlRef = useRef('');
  const persistEnabledRef = useRef(false);
  const inspectorInvalidRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langsInFlightRef = useRef(false);
  const langsAgainRef = useRef(false);
  const hydrateSeqRef = useRef(0);
  const selectedPageIdRef = useRef(selectedPageId);
  const selectedVersionIdRef = useRef(selectedVersionId);
  const saveCurrentVersionRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => undefined);

  const xml = useMemo(
    () =>
      serializePageXml({
        widgets,
        style: pageStyle,
        data: pageData.length > 0 ? pageData : undefined,
      }),
    [widgets, pageStyle, pageData],
  );
  xmlRef.current = xml;
  modeRef.current = mode;
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const previewing = mode === 'preview';
  const versionLocked = selectedVersion?.status !== 'draft';
  const readOnly = previewing || versionLocked;
  inspectorInvalidRef.current = inspectorInvalid;
  selectedPageIdRef.current = selectedPageId;
  selectedVersionIdRef.current = selectedVersionId;
  widgetsRef.current = widgets;
  pageStyleRef.current = pageStyle;
  pageDataRef.current = pageData;
  pageI18nRef.current = pageI18n;
  selectedWidgetIdRef.current = selectedWidgetId;
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
    paintCanvasView(iframeRef.current, phoneFrameRef.current, snapped, modeRef.current !== 'preview');
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
      if (langsTimerRef.current) {
        clearTimeout(langsTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    paintCanvasView(
      iframeRef.current,
      phoneFrameRef.current,
      viewRef.current,
      mode !== 'preview',
    );
  }, [mode]);

  useLayoutEffect(() => {
    if (panningRef.current || zoomingRef.current) {
      return;
    }
    paintCanvasView(iframeRef.current, phoneFrameRef.current, view, modeRef.current !== 'preview');
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

  const sendPreview = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'preview',
        xml: xmlRef.current,
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
        viewingOwnerId: mode === 'edit' && !versionLocked ? viewingOwnerId : null,
        viewingState: mode === 'edit' && !versionLocked ? viewingState : null,
        viewingStates: mode === 'edit' && !versionLocked ? viewingListFromMap(viewingByOwner) : null,
        spacingDrag:
          mode !== 'preview' &&
          centerTab === 'layout' &&
          isSpacingNudgeGroup(openBoxGroup) &&
          !readOnlyRef.current &&
          (openBoxGroup !== 'position' ||
            canEditPositionInsets(findViewed(selectedWidgetId)?.style))
            ? openBoxGroup
            : null,
      },
      window.location.origin,
    );
  }, [mode, previewLocale, pageI18n, selectedWidgetId, openBoxGroup, centerTab, viewingOwnerId, viewingState, viewingByOwner, versionLocked]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isLowcodeMessage(event.data)) {
        return;
      }
      if (event.data.type === 'ready') {
        readyRef.current = true;
        sendPreview();
        paintCanvasView(iframeRef.current, phoneFrameRef.current, viewRef.current, modeRef.current !== 'preview');
        return;
      }
      if (event.data.type === 'select') {
        if (event.data.widgetId == null && dismissStyleToolbarRef.current()) {
          return;
        }
        selectWidgetRef.current(event.data.widgetId);
        return;
      }
      if (event.data.type === 'dismiss-toolbar') {
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
      if (event.data.type === 'keydown' || event.data.type === 'keyup') {
        if (event.data.type === 'keydown' && event.data.key === 'Escape' && !event.data.ctrlKey && !event.data.metaKey) {
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
  }, [focusWidgetInView, scheduleZoom, sendPreview]);

  useEffect(() => {
    sendPreview();
  }, [sendPreview, view.scale, xml]);

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
      name: viewingStateRef.current,
    });
    setViewingOwnerId(next.ownerId);
    setViewingState(next.name);
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
    if (!isSpacingNudgeGroup(openBoxGroupRef.current)) {
      return;
    }
    const widgetId = selectedWidgetIdRef.current;
    const widget = viewedWidget(widgetId ? findWidget(widgetsRef.current, widgetId) : null);
    if (!widget) {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'widget-style',
        widgetId: widget.id,
        css: liveWidgetCss(widget.style),
      },
      window.location.origin,
    );
  }, [xml]);

  const previewLangKeys = (pageI18n?.langs ?? []).map((lang) => lang.key);
  useEffect(() => {
    if (previewLangKeys.length === 0) {
      setPreviewLocale(null);
      return;
    }
    setPreviewLocale((current) => (current && previewLangKeys.includes(current) ? current : previewLangKeys[0]));
  }, [previewLangKeys.join('\0')]);

  useEffect(() => {
    if (!id || !selectedPageId || !selectedVersionId || !persistEnabledRef.current || readOnly) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    if (xml === lastServerXmlRef.current) {
      if (!saveInFlightRef.current) {
        setSaveStatus('saved');
      }
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    setSaveStatus('unsaved');
    void putDraft(id, selectedPageId, selectedVersionId, xml);
    if (inspectorInvalid) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      void saveCurrentVersionRef.current({ silent: true });
    }, SERVER_IDLE_MS);
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [xml, id, selectedPageId, selectedVersionId, readOnly, inspectorInvalid, hydrateEpoch]);

  useEffect(() => {
    function onPageHide() {
      if (!id || !selectedPageIdRef.current || !selectedVersionIdRef.current || !persistEnabledRef.current) {
        return;
      }
      const pageId = selectedPageIdRef.current;
      const versionId = selectedVersionIdRef.current;
      void putDraftNow(id, pageId, versionId, xmlRef.current);
      if (readOnlyRef.current || inspectorInvalidRef.current || xmlRef.current === lastServerXmlRef.current) {
        return;
      }
      api.updateVersionKeepalive(id, pageId, versionId, { xml: xmlRef.current });
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
      paintCanvasView(iframeRef.current, phoneFrameRef.current, viewRef.current, modeRef.current !== 'preview');
    }
  }, [leftNav, loading, missing, fitCanvas]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    function onWheel(event: WheelEvent) {
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
        spacingOpen &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key === 'Escape'
      ) {
        event.preventDefault();
        event.stopPropagation();
        commitSpacingEditRef.current('cancel');
        return;
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
  }, []);

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
      const [nextProject, nextPages, nextLangs] = await Promise.all([
        api.getProject(id),
        api.listPages(id),
        api.getProjectLangs(id),
      ]);
      setProject(nextProject);
      setPages(nextPages);
      setPageI18n(compactPageI18n(nextLangs));
      setMissing(false);
      const rememberedPage = pickRememberedId(nextPages, getRememberedPageId(id));
      setSelectedPageId((current) =>
        nextPages.some((page) => page.id === current) ? current : (rememberedPage?.id ?? null),
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
    if (id && selectedPageId) {
      rememberPageId(id, selectedPageId);
    }
  }, [id, selectedPageId]);

  async function loadPage(pageId: string) {
    if (!id) {
      return;
    }
    persistEnabledRef.current = false;
    try {
      const [page, nextVersions] = await Promise.all([api.getPage(id, pageId), api.listVersions(id, pageId)]);
      setPages((current) => current.map((item) => (item.id === page.id ? page : item)));
      setVersions(nextVersions);
      const current =
        pickRememberedId(
          nextVersions,
          getRememberedVersionId(id, pageId),
          page.currentVersionId,
        ) ?? null;
      setSelectedVersionId(current?.id ?? null);
      if (current?.id) {
        rememberVersionId(id, pageId, current.id);
      }
      await hydrateVersion(current, pageId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
    }
  }

  async function hydrateVersion(version: ProjectPageVersionDto | null, pageId: string) {
    const seq = ++hydrateSeqRef.current;
    persistEnabledRef.current = false;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    const serverXml = version?.xml ?? EMPTY_PAGE_XML;
    let serverCanonical = serverXml;
    try {
      serverCanonical = toCanonicalXml(serverXml);
    } catch {
      serverCanonical = serverXml;
    }
    lastServerXmlRef.current = serverCanonical;
    if (!id || !version) {
      applyXml(serverXml);
      setSaveStatus('saved');
      setHydrateEpoch((epoch) => epoch + 1);
      return;
    }
    let nextXml = serverXml;
    if (version.status === 'draft') {
      const local = await getDraft(id, pageId, version.id);
      if (seq !== hydrateSeqRef.current) {
        return;
      }
      if (local) {
        let localCanonical = local;
        try {
          localCanonical = toCanonicalXml(local);
        } catch {
          localCanonical = local;
        }
        if (localCanonical !== serverCanonical) {
          nextXml = local;
        } else {
          await deleteDraft(id, pageId, version.id);
        }
      }
    }
    if (seq !== hydrateSeqRef.current) {
      return;
    }
    applyXml(nextXml);
    let appliedCanonical = nextXml;
    try {
      appliedCanonical = toCanonicalXml(nextXml);
    } catch {
      appliedCanonical = nextXml;
    }
    setSaveStatus(appliedCanonical === serverCanonical ? 'saved' : 'unsaved');
    persistEnabledRef.current = version.status === 'draft';
    setHydrateEpoch((epoch) => epoch + 1);
  }

  useEffect(() => {
    persistEnabledRef.current = false;
    clipboardRef.current = null;
    setClipboardTick((tick) => tick + 1);
    resetHistory();
    if (selectedPageId) {
      void loadPage(selectedPageId);
    } else {
      setVersions([]);
      setSelectedVersionId(null);
      lastServerXmlRef.current = '';
      setSaveStatus('saved');
      resetWidgetSession([], undefined);
    }
  }, [selectedPageId]);

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
  ) {
    const selectedId = nextSelectedId === undefined ? (nextWidgets[0]?.id ?? null) : nextSelectedId;
    widgetsRef.current = nextWidgets;
    pageStyleRef.current = nextPageStyle;
    pageDataRef.current = nextPageData;
    selectedWidgetIdRef.current = selectedId;
    setWidgets(nextWidgets);
    setPageStyle(nextPageStyle);
    setPageData(nextPageData);
    setSelectedWidgetId(selectedId);
    setExpandedKeys(collectExpandableKeys(nextWidgets));
    resetHistory();
  }

  function toCanonicalXml(nextXml: string) {
    const parsed = parsePageXml(nextXml);
    return serializePageXml({
      widgets: parsed.widgets,
      style: parsed.style,
      data: parsed.data && parsed.data.length > 0 ? parsed.data : undefined,
    });
  }

  function applyXml(nextXml: string) {
    try {
      const parsed = parsePageXml(nextXml);
      resetWidgetSession(parsed.widgets, parsed.style, parsed.data ?? []);
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
  }

  function selectWidget(id: string | null) {
    if (id !== selectedWidgetIdRef.current) {
      endCoalesce();
    }
    selectedWidgetIdRef.current = id;
    setSelectedWidgetId(id);
    setExpandedKeys((prev) => nextExpandedKeys(prev, widgetsRef.current, widgetsRef.current, id));
  }
  selectWidgetRef.current = selectWidget;

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
  ) {
    const coalescing = Boolean(coalesceKey && coalesceKey === coalesceKeyRef.current);
    if (!coalescing) {
      pastRef.current = [
        ...pastRef.current,
        {
          widgets: widgetsRef.current,
          pageStyle: pageStyleRef.current,
          pageData: pageDataRef.current,
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
    selectedWidgetIdRef.current = nextSelectedId;
    setWidgets(nextWidgets);
    setPageStyle(nextPageStyle);
    setPageData(nextPageData);
    setSelectedWidgetId(nextSelectedId);
    setExpandedKeys((prev) =>
      nextExpandedKeys(
        prev,
        previousWidgets,
        nextWidgets,
        nextSelectedId !== previousSelectedId ? nextSelectedId : null,
      ),
    );
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

  function schedulePutLangs() {
    if (langsTimerRef.current) {
      clearTimeout(langsTimerRef.current);
    }
    langsTimerRef.current = setTimeout(() => {
      langsTimerRef.current = null;
      void flushProjectLangs();
    }, LANGS_DEBOUNCE_MS);
  }

  async function flushProjectLangs() {
    if (langsTimerRef.current) {
      clearTimeout(langsTimerRef.current);
      langsTimerRef.current = null;
    }
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
      await api.putProjectLangs(id, payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    } finally {
      langsInFlightRef.current = false;
      if (langsAgainRef.current) {
        void flushProjectLangs();
      }
    }
  }

  function commitPageI18n(next: PageI18n | undefined, coalesceKey?: string) {
    pageI18nRef.current = next;
    setPageI18n(next);
    if (coalesceKey) {
      schedulePutLangs();
      return;
    }
    void flushProjectLangs();
  }

  function addWidget(type: PageWidget['type']) {
    if (readOnlyRef.current) {
      return;
    }
    const nextId = nextWidgetId();
    const widget: PageWidget =
      type === 'text'
        ? { type: 'text', id: nextId, value: t('lowcode.defaultText') }
        : type === 'button'
          ? { type: 'button', id: nextId, text: t('lowcode.defaultButton'), style: { background: '#ffffff' } }
          : type === 'flex'
            ? { type: 'flex', id: nextId, children: [] }
            : type === 'swiper-item'
              ? emptySwiperItem(nextId)
              : createSwiperWidget(nextId, nextWidgetId);
    const nextWidgets = addWidgetToTree(widgetsRef.current, selectedWidgetIdRef.current, widget);
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

  function handleOpenBoxGroupChange(group: BoxGroup | null) {
    if (group) {
      const widgetId = selectedWidgetIdRef.current;
      const widget = findViewed(widgetId);
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
      const widgetId = selectedWidgetIdRef.current;
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
    updateWidget(widget.id, { style: writeNudgeStyle(widget.style, kind, quad) }, `edit:${widget.id}:style`);
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
    return String(Math.trunc(readNudgeQuad(widget.style, kind)[edges[0]] ?? 0));
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
    updateWidget(widget.id, { style: writeNudgeStyle(widget.style, kind, quad) }, `edit:${widget.id}:style`);
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
    patchLiveWidgetStyle(spacing.widgetId, styleFromBoxQuad(widget.style, spacing.kind, quad));
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
      const widgetId = selectedWidgetIdRef.current;
      if (readOnlyRef.current || !isBoxDragGroup(kind) || !widgetId) {
        return;
      }
      const widget = findViewed(widgetId);
      if (!widget || !isBoxGroupAllowed(widget.type, kind)) {
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
    const copy = cloneWidget(clipboardRef.current);
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

  function undoWidgetEdit() {
    if (readOnlyRef.current || pastRef.current.length === 0) {
      return;
    }
    coalesceKeyRef.current = null;
    const current: HistoryEntry = {
      widgets: widgetsRef.current,
      pageStyle: pageStyleRef.current,
      pageData: pageDataRef.current,
      selectedWidgetId: selectedWidgetIdRef.current,
    };
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, current].slice(-HISTORY_LIMIT);
    const previousWidgets = widgetsRef.current;
    widgetsRef.current = previous.widgets;
    pageStyleRef.current = previous.pageStyle;
    pageDataRef.current = previous.pageData;
    selectedWidgetIdRef.current = previous.selectedWidgetId;
    setWidgets(previous.widgets);
    setPageStyle(previous.pageStyle);
    setPageData(previous.pageData);
    setSelectedWidgetId(previous.selectedWidgetId);
    setExpandedKeys((prev) => nextExpandedKeys(prev, previousWidgets, previous.widgets, previous.selectedWidgetId));
    setHistoryTick((tick) => tick + 1);
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
      selectedWidgetId: selectedWidgetIdRef.current,
    };
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, current].slice(-HISTORY_LIMIT);
    const previousWidgets = widgetsRef.current;
    widgetsRef.current = next.widgets;
    pageStyleRef.current = next.pageStyle;
    pageDataRef.current = next.pageData;
    selectedWidgetIdRef.current = next.selectedWidgetId;
    setWidgets(next.widgets);
    setPageStyle(next.pageStyle);
    setPageData(next.pageData);
    setSelectedWidgetId(next.selectedWidgetId);
    setExpandedKeys((prev) => nextExpandedKeys(prev, previousWidgets, next.widgets, next.selectedWidgetId));
    setHistoryTick((tick) => tick + 1);
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
        const widget = findViewed(selectedWidgetIdRef.current);
        if (!widget || !isBoxGroupAllowed(widget.type, shortcut)) {
          return;
        }
        handleOpenBoxGroupChange(shortcut);
        return;
      }
    if (isTextStyleShortcut(shortcut)) {
      const widgetId = selectedWidgetIdRef.current;
      const widget = findViewed(widgetId);
      if (readOnlyRef.current || !widget || (widget.type !== 'text' && widget.type !== 'button')) {
        return;
      }
      const style = widget.style;
      if (shortcut === 'fontSizeUp' || shortcut === 'fontSizeDown') {
        const from = style?.fontSize && style.fontSize > 0 ? style.fontSize : (measuredFontSize(widget.id) ?? 16);
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
      if (editingPage) {
        const updated = await api.updatePage(id, editingPage.id, values);
        setPages((current) => current.map((page) => (page.id === updated.id ? updated : page)));
      } else {
        const created = await api.createPage(id, values);
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
      await api.deletePage(id, page.id);
      forgetPageSelection(id, page.id);
      setPages((current) => current.filter((item) => item.id !== page.id));
      if (selectedPageId === page.id) {
        setSelectedPageId(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.deleteFailed'));
    }
  }

  function openCreateVersion() {
    versionForm.setFieldsValue({
      source: 'blank',
      copyFromId: selectedVersionId ?? versions[0]?.id,
    });
    setVersionModalOpen(true);
  }

  async function submitCreateVersion() {
    if (!id || !selectedPageId) {
      return;
    }
    const values = await versionForm.validateFields();
    const nextXml =
      values.source === 'copy'
        ? (versions.find((version) => version.id === values.copyFromId)?.xml ?? EMPTY_PAGE_XML)
        : EMPTY_PAGE_XML;
    try {
      const created = await api.createVersion(id, selectedPageId, { xml: nextXml, description: '' });
      setVersions((current) => [...current, created]);
      setSelectedVersionId(created.id);
      rememberVersionId(id, selectedPageId, created.id);
      await hydrateVersion(created, selectedPageId);
      setVersionModalOpen(false);
      message.success(t('lowcode.versionCreated'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

  async function saveCurrentVersion(options?: { silent?: boolean }) {
    if (!id || !selectedPageIdRef.current || !selectedVersionIdRef.current) {
      return;
    }
    if (readOnlyRef.current || inspectorInvalidRef.current) {
      return;
    }
    if (xmlRef.current === lastServerXmlRef.current) {
      return;
    }
    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      return;
    }
    const pageId = selectedPageIdRef.current;
    const versionId = selectedVersionIdRef.current;
    const xmlToSave = xmlRef.current;
    saveInFlightRef.current = true;
    setSaveStatus('saving');
    try {
      const updated = await api.updateVersion(id, pageId, versionId, { xml: xmlToSave });
      lastServerXmlRef.current = xmlToSave;
      await deleteDraft(id, pageId, versionId);
      setVersions((current) =>
        current.map((version) => (version.id === updated.id ? { ...updated, xml: xmlToSave } : version)),
      );
      if (!options?.silent) {
        message.success(t('lowcode.versionUpdated'));
      }
      setSaveStatus(xmlRef.current === lastServerXmlRef.current ? 'saved' : 'unsaved');
    } catch (error) {
      setSaveStatus('unsaved');
      if (!options?.silent) {
        message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
      }
    } finally {
      saveInFlightRef.current = false;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        void saveCurrentVersion(options);
      }
    }
  }
  saveCurrentVersionRef.current = saveCurrentVersion;

  async function removeVersion(version: ProjectPageVersionDto) {
    if (!id || !selectedPageId) {
      return;
    }
    try {
      await api.deleteVersion(id, selectedPageId, version.id);
      setVersions((current) => current.filter((item) => item.id !== version.id));
      if (selectedVersionId === version.id) {
        setSelectedVersionId(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.deleteFailed'));
    }
  }

  async function publishVersion(version: ProjectPageVersionDto) {
    if (!id || !selectedPageId) {
      return;
    }
    try {
      if (version.id === selectedVersionIdRef.current && version.status === 'draft') {
        await saveCurrentVersion({ silent: true });
      }
      const updated = await api.publishVersion(id, selectedPageId, version.id);
      if (version.id === selectedVersionIdRef.current) {
        persistEnabledRef.current = false;
      }
      setVersions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      message.success(t('lowcode.versionPublished'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

  async function activateVersion(version: ProjectPageVersionDto) {
    if (!id || !selectedPageId) {
      return;
    }
    try {
      const page = await api.activateVersion(id, selectedPageId, version.id);
      setPages((current) => current.map((item) => (item.id === page.id ? page : item)));
      const nextVersions = await api.listVersions(id, selectedPageId);
      setVersions(nextVersions);
      message.success(t('lowcode.versionUsed'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

  function selectVersion(version: ProjectPageVersionDto) {
    persistEnabledRef.current = false;
    setSelectedVersionId(version.id);
    if (id && selectedPageId) {
      rememberVersionId(id, selectedPageId, version.id);
      void hydrateVersion(version, selectedPageId);
      return;
    }
    applyXml(version.xml ?? EMPTY_PAGE_XML);
  }

  if (loading) {
    return <Spin />;
  }

  if (missing || !project) {
    return (
      <Card>
        <Typography.Paragraph>{t('lowcode.projectMissing')}</Typography.Paragraph>
        <Link to="/">{t('lowcode.backHome')}</Link>
      </Card>
    );
  }

  const selectedWidget = findWidget(widgets, selectedWidgetId);
  const selectedParent = findParentWidget(widgets, selectedWidgetId);
  const visibleStates = collectStateTree(widgets, selectedWidgetId);
  const selectedDisplayWidget = selectedWidget
    ? widgetWithStateLayers(selectedWidget, stateLayersForWidget(widgets, selectedWidget.id, viewingByOwner))
    : null;
  const selectedCanvasLabel = selectedWidget ? widgetCanvasLabel(selectedWidget, t) : null;
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
    <div className="editor-shell">
      <div className="editor-header">
        <Space>
          <Link to="/">
            <Button size="small" icon={<ArrowLeftOutlined />}>
              {t('lowcode.backHome')}
            </Button>
          </Link>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {project.name}
          </Typography.Title>
          <Typography.Text type="secondary">{project.key}</Typography.Text>
        </Space>
        <Space align="center">
          {versionsOpen ? null : (
            <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setVersionsOpen(true)}>
              {t('lowcode.showVersions')}
            </Button>
          )}
          <Button size="small" icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>
            {t('lowcode.help')}
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            title={`${t('lowcode.updateVersion')} (${modifier}+S)`}
            disabled={!selectedVersion || versionLocked}
            onClick={() => void saveCurrentVersion()}
          >
            {t('lowcode.updateVersion')}
          </Button>
        </Space>
      </div>
      <div className="editor-body">
        <nav className="editor-rail" aria-label={`${t('lowcode.i18nDevelop')} / ${t('lowcode.i18nLibrary')}`}>
          <Tooltip title={t('lowcode.i18nDevelop')} placement="right">
            <button
              type="button"
              className={['editor-rail-btn', leftNav === 'develop' ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setLeftNav('develop')}
            >
              <CodeOutlined />
            </button>
          </Tooltip>
          <Tooltip title={t('lowcode.i18nLibrary')} placement="right">
            <button
              type="button"
              className={['editor-rail-btn', leftNav === 'i18n' ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setLeftNav('i18n')}
            >
              <GlobalOutlined />
            </button>
          </Tooltip>
        </nav>
        <div className="editor-main">
        <div
          className={[
            versionsOpen ? 'editor-grid' : 'editor-grid is-versions-collapsed',
            leftNav === 'i18n' ? 'is-covered' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="editor-left">
          <Card
            size="small"
            className="editor-panel"
            title={t('lowcode.pages')}
            extra={
              <Button size="small" icon={<PlusOutlined />} onClick={openCreatePage}>
                {t('lowcode.createPage')}
              </Button>
            }
          >
            {pages.length === 0 ? (
              <Empty description={t('lowcode.emptyPages')} />
            ) : (
              <List
                dataSource={pages}
                renderItem={(page) => (
                  <List.Item
                    className={page.id === selectedPageId ? 'is-selected' : undefined}
                    actions={[
                      <Button key="edit" type="link" onClick={() => openEditPage(page)}>
                        {t('lowcode.edit')}
                      </Button>,
                      <Popconfirm
                        key="del"
                        title={t('lowcode.confirmDelete')}
                        onConfirm={() => void removePage(page)}
                      >
                        <Button type="link" danger>
                          {t('lowcode.delete')}
                        </Button>
                      </Popconfirm>,
                    ]}
                    onClick={() => setSelectedPageId(page.id)}
                  >
                    <List.Item.Meta title={page.name} description={page.key} />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card
            size="small"
            className="editor-panel"
            title={t('lowcode.widgetTree')}
            extra={
              <div className="widget-tree-actions">
                <TreeActionButton
                  title={`${t('lowcode.undo')} (${modifier}+Z)`}
                  icon={<UndoOutlined />}
                  disabled={!canUndo}
                  onClick={undoWidgetEdit}
                />
                <TreeActionButton
                  title={`${t('lowcode.redo')} (${modifier}+Shift+Z)`}
                  icon={<RedoOutlined />}
                  disabled={!canRedo}
                  onClick={redoWidgetEdit}
                />
                <TreeActionButton
                  title={`${t('lowcode.copyWidget')} (${modifier}+C)`}
                  icon={<CopyOutlined />}
                  disabled={!canCopy}
                  onClick={copySelectedWidget}
                />
                <TreeActionButton
                  title={`${t('lowcode.pasteWidget')} (${modifier}+V)`}
                  icon={<SnippetsOutlined />}
                  disabled={!canPaste}
                  onClick={pasteClipboard}
                />
                <TreeActionButton
                  title={`${t('lowcode.deleteWidget')} (Del)`}
                  icon={<DeleteOutlined />}
                  disabled={!canDelete}
                  danger
                  onClick={deleteSelectedWidget}
                />
                <Tooltip title={t('lowcode.addWidget')}>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    disabled={!selectedPage || readOnly}
                    onClick={() => setWidgetModalOpen(true)}
                  />
                </Tooltip>
              </div>
            }
          >
            {widgets.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.emptyWidgets')} />
            ) : (
              <div ref={widgetTreeHostRef}>
                <Tree
                className="widget-tree"
                blockNode
                autoExpandParent={false}
                expandedKeys={expandedKeys}
                selectedKeys={selectedWidgetId ? [selectedWidgetId] : []}
                treeData={widgetTreeData}
                titleRender={(node) => {
                  const widgetId = String(node.key);
                  const looped = isLoopConfigured(findWidget(widgets, widgetId)?.loop);
                  return (
                    <span className="widget-tree-title">
                      <span
                        className={canDragWidgetToData ? 'widget-tree-drag-title' : 'widget-tree-title-label'}
                        draggable={canDragWidgetToData}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = 'copy';
                          writeWidgetDrag(event.dataTransfer, widgetId);
                        }}
                      >
                        {typeof node.title === 'string' ? node.title : widgetId}
                      </span>
                      {looped ? (
                        <button
                          type="button"
                          className="widget-tree-loop"
                          title={t('lowcode.styleLoop')}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            openWidgetLoopPanel(widgetId);
                          }}
                        >
                          <UnorderedListOutlined />
                        </button>
                      ) : null}
                    </span>
                  );
                }}
                onExpand={(keys) => setExpandedKeys(keys.map(String))}
                onSelect={(keys) => {
                  if (keys[0]) {
                    selectWidget(String(keys[0]));
                  }
                }}
                onDoubleClick={(_event, node) => {
                  const widgetId = String(node.key);
                  if (widgetId) {
                    focusWidgetById(widgetId);
                  }
                }}
              />
              </div>
            )}
          </Card>
        </div>

        <Card
          size="small"
          className="editor-canvas-card"
          tabList={[
            { key: 'layout', tab: t('lowcode.tabLayout') },
            { key: 'data', tab: t('lowcode.tabData') },
            { key: 'events', tab: t('lowcode.tabEvents') },
          ]}
          activeTabKey={centerTab}
          onTabChange={(key) => {
            const next = key as CenterTab;
            setCenterTab(next);
            if (next === 'layout' && !userAdjustedRef.current) {
              window.requestAnimationFrame(() => fitCanvas(false));
            }
          }}
          tabBarExtraContent={
            <Select
              size="small"
              className="canvas-locale-select"
              placeholder={t('lowcode.i18nLibrary')}
              suffixIcon={<GlobalOutlined />}
              value={previewLocale ?? undefined}
              options={(pageI18n?.langs ?? []).map((lang) => ({
                value: lang.key,
                label: lang.name || lang.key,
              }))}
              onChange={(value: string) => setPreviewLocale(value)}
              disabled={(pageI18n?.langs ?? []).length === 0}
            />
          }
        >
          <div className="canvas-card-body">
            <div
              className={['canvas-wrap', centerTab === 'layout' ? '' : 'is-hidden'].filter(Boolean).join(' ')}
              onPointerDownCapture={onCanvasPanPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerUp}
              onMouseDownCapture={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                }
              }}
              onAuxClick={(event) => event.preventDefault()}
            >
              <div
                ref={stageRef}
                className={[
                  'canvas-stage',
                  panning || panningRef.current ? 'is-panning' : '',
                  previewing ? 'is-preview' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onPointerDown={onCanvasPointerDown}
                onMouseDown={onCanvasMouseDown}
              >
                <div ref={phoneScreenRef} className="phone-screen">
                  <iframe
                    ref={iframeRef}
                    className="preview-frame"
                    title={t('lowcode.preview')}
                    src="/preview"
                    scrolling="no"
                    onLoad={() => {
                      window.setTimeout(() => {
                        if (!readyRef.current) {
                          sendPreview();
                        }
                      }, 300);
                    }}
                  />
                </div>
                <div ref={phoneFrameRef} className="phone-page-frame" />
                {showStyleChrome && selectedCanvasLabel ? (
                  <div className="canvas-selection-label" title={selectedCanvasLabel}>
                    {selectedCanvasLabel}
                  </div>
                ) : null}
                {showStyleChrome ? (
                  <div
                    className="widget-style-bubble-host"
                    onPointerDown={(event) => {
                      // Stop a canvas spacing drag from flushing measured insets over bubble edits.
                      if (spacingDragRef.current) {
                        spacingDragRef.current = null;
                        setSpacingDragCursor(null, null);
                        syncSelectChrome();
                      }
                      event.stopPropagation();
                    }}
                  >
                    {selectedDisplayWidget ? (
                      <WidgetStyleBubble
                        widget={selectedDisplayWidget}
                        style={selectedDisplayWidget.style}
                        i18nCatalog={pageI18n}
                        variables={pageData}
                        disabled={readOnly}
                        openGroup={openBoxGroup}
                        onOpenGroupChange={handleOpenBoxGroupChange}
                        onChange={(nextStyle) =>
                          updateWidget(
                            selectedDisplayWidget.id,
                            { style: nextStyle },
                            `edit:${selectedDisplayWidget.id}:style`,
                          )
                        }
                        onTextChange={
                          selectedDisplayWidget.type === 'text' || selectedDisplayWidget.type === 'button'
                            ? (text) =>
                                updateWidget(
                                  selectedDisplayWidget.id,
                                  selectedDisplayWidget.type === 'text' ? { value: text } : { text },
                                  `edit:${selectedDisplayWidget.id}:${selectedDisplayWidget.type === 'text' ? 'value' : 'text'}`,
                                )
                            : undefined
                        }
                        onLoopChange={(loop) =>
                          updateWidget(selectedDisplayWidget.id, { loop }, `loop:${selectedDisplayWidget.id}`)
                        }
                        onStateFnChange={(stateFn) =>
                          updateWidget(
                            selectedDisplayWidget.id,
                            { stateFn },
                            `stateFn:${selectedDisplayWidget.id}`,
                          )
                        }
                        onOpenInspector={() => setInspectorOpen(true)}
                        onToolbarPopupChange={(open) => {
                          toolbarPopupOpenRef.current = open;
                          if (!open) {
                            iframeRef.current?.classList.remove('is-color-picking');
                          }
                        }}
                      />
                    ) : (
                      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
                        <div className="widget-style-bubble">
                          <Tooltip
                            title={selectedWidget ? t('lowcode.widgetInspector') : t('lowcode.pageInspector')}
                          >
                            <Button
                              size="small"
                              type="text"
                              icon={<SettingOutlined />}
                              onClick={() => setInspectorOpen(true)}
                            />
                          </Tooltip>
                        </div>
                      </ConfigProvider>
                    )}
                  </div>
                ) : null}
              </div>
              {showStyleChrome && selectedWidget && !readOnly ? (
                <WidgetStateList
                  items={visibleStates}
                  viewingOwnerId={viewingOwnerId}
                  viewingState={viewingState}
                  ownedNames={ownedStateNames(selectedWidget)}
                  onSelect={(row) => {
                    if (!row.owned && row.name) {
                      const inheritedName = row.name;
                      setViewingOwnerId(row.ownerId);
                      setViewingState(inheritedName);
                      setViewingByOwner((prev) => ({
                        ...prev,
                        [row.ownerId]: inheritedName,
                        [selectedWidget.id]: null,
                      }));
                      return;
                    }
                    const scopeOwnerId = row.scopeOwnerId;
                    const scopeName = row.scopeName;
                    if (scopeName && scopeOwnerId) {
                      setViewingOwnerId(row.name ? row.ownerId : scopeOwnerId);
                      setViewingState(row.name ?? scopeName);
                      setViewingByOwner((prev) => ({
                        ...prev,
                        [scopeOwnerId]: scopeName,
                        [row.ownerId]: row.name ?? null,
                      }));
                      return;
                    }
                    setViewingOwnerId(row.ownerId);
                    setViewingState(row.name);
                    setViewingByOwner((prev) => {
                      const next: ViewingByOwner = { ...prev, [row.ownerId]: row.name };
                      if (row.name == null) {
                        for (const key of Object.keys(next)) {
                          if (key !== row.ownerId) {
                            next[key] = null;
                          }
                        }
                      }
                      return next;
                    });
                  }}
                  onCreate={(name, from, transition) => {
                    const scopeName = from.scopeName ?? (!from.owned ? from.name : null);
                    const scopeOwnerId = from.scopeOwnerId ?? (!from.owned ? from.ownerId : undefined);
                    const created = createWidgetState(
                      widgets,
                      selectedWidget.id,
                      name,
                      from.name,
                      from.owned && !from.scopeName,
                      transition,
                      scopeName,
                    );
                    commitWidgets(created, selectedWidgetId);
                    setViewingOwnerId(selectedWidget.id);
                    setViewingState(name);
                    setViewingByOwner((prev) => {
                      const next: ViewingByOwner = { ...prev, [selectedWidget.id]: name };
                      if (scopeName && scopeOwnerId) {
                        next[scopeOwnerId] = scopeName;
                      }
                      return next;
                    });
                  }}
                  onEdit={(from, name, transition) => {
                    if (from.name == null) {
                      commitWidgets(updateHostTransition(widgets, selectedWidget.id, transition), selectedWidgetId);
                      return;
                    }
                    if (!name) {
                      return;
                    }
                    commitWidgets(
                      updateWidgetState(widgets, selectedWidget.id, from.name, name, transition, from.scopeName),
                      selectedWidgetId,
                    );
                    if (viewingOwnerId === selectedWidget.id && viewingState === from.name) {
                      setViewingState(name);
                    }
                    setViewingByOwner((prev) => {
                      if (prev[selectedWidget.id] !== from.name) {
                        return prev;
                      }
                      return { ...prev, [selectedWidget.id]: name };
                    });
                  }}
                  onDelete={(row) => {
                    if (!row.name) {
                      return;
                    }
                    commitWidgets(deleteWidgetState(widgets, selectedWidget.id, row.name, row.scopeName), selectedWidgetId);
                    if (viewingOwnerId === selectedWidget.id && viewingState === row.name) {
                      setViewingOwnerId(row.scopeOwnerId ?? selectedWidget.id);
                      setViewingState(row.scopeName ?? null);
                    }
                    setViewingByOwner((prev) => {
                      if (prev[selectedWidget.id] !== row.name) {
                        return prev;
                      }
                      return { ...prev, [selectedWidget.id]: null };
                    });
                  }}
                />
              ) : null}
              <div className="canvas-toolbar">
                <Button size="small" icon={<ZoomOutOutlined />} onClick={() => zoomBy(1 / ZOOM_STEP)} />
                <Typography.Text ref={zoomLabelRef} className="canvas-zoom">
                  {Math.round(view.scale * 100)}%
                </Typography.Text>
                <Button size="small" icon={<ZoomInOutlined />} onClick={() => zoomBy(ZOOM_STEP)} />
                <Button size="small" icon={<ExpandOutlined />} onClick={() => fitCanvas(false)}>
                  {t('lowcode.canvasReset')}
                </Button>
                <Segmented
                  size="small"
                  value={mode}
                  onChange={(value) => setMode(value as CanvasMode)}
                  options={[
                    { label: t('lowcode.modeEdit'), value: 'edit' },
                    { label: t('lowcode.modePreview'), value: 'preview' },
                  ]}
                />
              </div>
            </div>
            {centerTab === 'data' ? (
              <PageDataPanel
                variables={pageData}
                widgets={widgets}
                disabled={readOnly}
                onChange={commitPageData}
                onEndCoalesce={endCoalesce}
              />
            ) : null}
            {centerTab === 'events' ? (
              <div className="page-events-panel">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.eventsEmpty')} />
              </div>
            ) : null}
          </div>
        </Card>

        {versionsOpen ? (
          <div className="editor-versions">
            <button
              type="button"
              className="versions-collapse"
              aria-label={t('lowcode.collapseVersions')}
              title={t('lowcode.collapseVersions')}
              onClick={() => setVersionsOpen(false)}
            >
              <RightOutlined />
            </button>
            <Card
              size="small"
              className="editor-panel"
              title={t('lowcode.versions')}
              extra={
                <Button size="small" disabled={!selectedPage} onClick={openCreateVersion}>
                  {t('lowcode.createVersion')}
                </Button>
              }
            >
              {versions.length === 0 ? (
                <Empty description={t('lowcode.emptyVersions')} />
              ) : (
                <Radio.Group
                  value={selectedVersionId}
                  onChange={(event) => {
                    const version = versions.find((item) => item.id === event.target.value);
                    if (version) {
                      selectVersion(version);
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <List
                    className="version-list"
                    dataSource={versions}
                    renderItem={(version) => (
                      <List.Item>
                        <div className="version-item">
                          <Radio value={version.id}>
                            <Space size={6}>
                              <span>v{version.versionNo}</span>
                              <Tag
                                color={
                                  version.status === 'in_use'
                                    ? 'success'
                                    : version.status === 'published'
                                      ? 'blue'
                                      : 'default'
                                }
                              >
                                {t(`lowcode.versionStatus.${version.status}`)}
                              </Tag>
                            </Space>
                          </Radio>
                          <div className="version-item-actions">
                            {version.status === 'draft' ? (
                              <Button type="link" onClick={() => void publishVersion(version)}>
                                {t('lowcode.publishVersion')}
                              </Button>
                            ) : null}
                            {version.status === 'published' ? (
                              <Button type="link" onClick={() => void activateVersion(version)}>
                                {t('lowcode.useVersion')}
                              </Button>
                            ) : null}
                            {version.status === 'in_use' ? null : (
                              <Popconfirm
                                title={t('lowcode.confirmDelete')}
                                onConfirm={() => void removeVersion(version)}
                              >
                                <Button type="link" danger>
                                  {t('lowcode.delete')}
                                </Button>
                              </Popconfirm>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </Radio.Group>
              )}
            </Card>
          </div>
        ) : null}
        </div>
        {leftNav === 'i18n' ? (
          <Card size="small" className="editor-panel language-library-card" title={t('lowcode.i18nLibrary')}>
            <LanguageLibraryPanel catalog={pageI18n} onChange={commitPageI18n} />
          </Card>
        ) : null}
        </div>
      </div>

      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#3dba9a',
            colorBgContainer: '#33404c',
            colorBgContainerDisabled: '#2a333c',
            colorBgElevated: '#171e25',
            colorError: '#ff4d4f',
            colorBorder: 'rgba(255, 255, 255, 0.26)',
            colorText: 'rgba(255, 255, 255, 0.92)',
            colorTextHeading: 'rgba(255, 255, 255, 0.95)',
            colorTextLabel: 'rgba(255, 255, 255, 0.84)',
            colorTextPlaceholder: 'rgba(255, 255, 255, 0.48)',
            colorFillTertiary: 'rgba(255, 255, 255, 0.12)',
          },
        }}
      >
      <EditorHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Modal
        className="inspector-modal"
        open={inspectorOpen}
        title={
          selectedWidget
            ? t('lowcode.widgetInspectorTitle', {
                type:
                  selectedWidget.type === 'text'
                    ? t('lowcode.defaultText')
                    : selectedWidget.type === 'button'
                      ? t('lowcode.defaultButton')
                      : selectedWidget.type === 'swiper'
                        ? t('lowcode.defaultSwiper')
                        : selectedWidget.type === 'swiper-item'
                          ? t('lowcode.defaultSwiperItem')
                          : t('lowcode.defaultFlex'),
                id: selectedWidget.id,
              })
            : t('lowcode.pageInspector')
        }
        footer={null}
        width={920}
        maskClosable={!inspectorInvalid}
        keyboard={!inspectorInvalid}
        styles={{ body: { maxHeight: 'none', overflow: 'visible' } }}
        onCancel={() => {
          if (inspectorInvalid) {
            message.warning(t('lowcode.propInvalidClose'));
            return;
          }
          setInspectorOpen(false);
        }}
        destroyOnHidden
      >
        {selectedDisplayWidget ? (
          <CoalesceField onLeave={endCoalesce}>
            <WidgetPropertyInspector
              widget={selectedDisplayWidget}
              parentType={selectedParent?.type}
              disabled={readOnly}
              i18nCatalog={pageI18n}
              onPatch={(patch, coalesceKey) => updateWidget(selectedDisplayWidget.id, patch, coalesceKey)}
              onInvalidChange={setInspectorInvalid}
            />
          </CoalesceField>
        ) : (
          <CoalesceField onLeave={endCoalesce}>
            <PagePropertyInspector
              style={pageStyle}
              disabled={readOnly}
              onChange={(style, field) => updatePageStyle(style, `edit:page:${field}`)}
              onInvalidChange={setInspectorInvalid}
            />
          </CoalesceField>
        )}
      </Modal>
      </ConfigProvider>

      <Modal
        open={widgetModalOpen}
        title={t('lowcode.addWidget')}
        footer={null}
        onCancel={() => setWidgetModalOpen(false)}
        destroyOnHidden
      >
        <div className="widget-type-picker">
          {(['text', 'button', 'flex', 'swiper', 'swiper-item'] as const).map((type) => (
            <Button
              key={type}
              block
              onClick={() => {
                addWidget(type);
                setWidgetModalOpen(false);
              }}
            >
              {type === 'text'
                ? t('lowcode.defaultText')
                : type === 'button'
                  ? t('lowcode.defaultButton')
                  : type === 'flex'
                    ? t('lowcode.defaultFlex')
                    : type === 'swiper'
                      ? t('lowcode.defaultSwiper')
                      : t('lowcode.defaultSwiperItem')}
            </Button>
          ))}
        </div>
      </Modal>

      <Modal
        open={pageModalOpen}
        title={editingPage ? t('lowcode.editPage') : t('lowcode.createPage')}
        onOk={() => void submitPage()}
        onCancel={() => setPageModalOpen(false)}
        destroyOnHidden
      >
        <Form form={pageForm} layout="vertical">
          <Form.Item name="name" label={t('lowcode.pageName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="key"
            label={t('lowcode.key')}
            rules={[{ required: true }, { pattern: KEY_PATTERN, message: t('lowcode.keyHint') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('lowcode.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="version-create-modal"
        open={versionModalOpen}
        title={t('lowcode.createVersion')}
        onOk={() => void submitCreateVersion()}
        onCancel={() => setVersionModalOpen(false)}
        destroyOnHidden
      >
        <Form
          className="version-create-form"
          form={versionForm}
          layout="horizontal"
          labelAlign="left"
          colon={false}
          initialValues={{ source: 'blank' }}
        >
          <Form.Item name="source" label={t('lowcode.createVersionSource')} rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="blank">{t('lowcode.createVersionBlank')}</Radio>
              <Radio value="copy" disabled={versions.length === 0}>
                {t('lowcode.createVersionCopy')}
              </Radio>
            </Radio.Group>
          </Form.Item>
          {createVersionSource === 'copy' ? (
            <Form.Item
              name="copyFromId"
              label={t('lowcode.createVersionFrom')}
              rules={[{ required: true, message: t('lowcode.createVersionFromRequired') }]}
            >
              <Select
                placeholder={t('lowcode.createVersionFrom')}
                options={versions.map((version) => ({
                  value: version.id,
                  label: `v${version.versionNo} · ${t(`lowcode.versionStatus.${version.status}`)}`,
                }))}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}

function TreeActionButton({
  title,
  icon,
  disabled,
  danger,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={title}>
      <span>
        <Button size="small" icon={icon} disabled={disabled} danger={danger} onClick={onClick} />
      </span>
    </Tooltip>
  );
}

function CoalesceField({ onLeave, children }: { onLeave: () => void; children: ReactNode }) {
  return (
    <div
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
          return;
        }
        onLeave();
      }}
    >
      {children}
    </div>
  );
}
