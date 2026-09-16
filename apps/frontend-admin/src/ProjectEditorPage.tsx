import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExpandOutlined,
  PlusOutlined,
  RedoOutlined,
  RightOutlined,
  SnippetsOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
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
} from 'antd';
import {
  useCallback,
  useEffect,
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
import { EMPTY_PAGE_XML, parsePageXml, serializePageXml, type PageWidget } from '@vanstack/xml';
import { api } from './api';
import { FlexContainerFields, FlexItemFields } from './FlexStyleFields';
import { isLowcodeMessage, LOWCODE_MESSAGE_SOURCE } from './lowcode-protocol';
import { WidgetStyleFields } from './WidgetStyleFields';
import {
  isEditableKeyboardTarget,
  matchWidgetShortcut,
  modifierShortcutLabel,
  type WidgetShortcut,
} from './widgetShortcuts';
import {
  addWidgetToTree,
  cloneWidget,
  collectExpandableKeys,
  findParentWidget,
  findWidget,
  insertWidget,
  nextWidgetId,
  patchWidget,
  removeWidget,
  toWidgetTreeData,
  updateWidgetById,
  type WidgetPatch,
} from './widgetTree';

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const SCREEN_HEIGHT = 667;
const HISTORY_LIMIT = 100;

type HistoryEntry = { widgets: PageWidget[]; selectedWidgetId: string | null };
const FIT_PADDING_X = 32;
const FIT_PADDING_TOP = 24;
const FIT_PADDING_BOTTOM = 64;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.15;

type CanvasMode = 'edit' | 'preview';
type ViewTransform = { x: number; y: number; scale: number };

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
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
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<ProjectPageDto | null>(null);
  const [pageForm] = Form.useForm<{ name: string; key: string; description?: string }>();
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [widgetModalOpen, setWidgetModalOpen] = useState(false);
  const [versionForm] = Form.useForm<{ source: 'blank' | 'copy'; copyFromId?: string }>();
  const createVersionSource = Form.useWatch('source', versionForm);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const xmlRef = useRef('');
  const readyRef = useRef(false);
  const [screenWidth, setScreenWidth] = useState(375);
  const screenHeight = SCREEN_HEIGHT;
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  const userAdjustedRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const [mode, setMode] = useState<CanvasMode>('edit');
  const modeRef = useRef<CanvasMode>('edit');
  const [versionsOpen, setVersionsOpen] = useState(true);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const widgetsRef = useRef(widgets);
  const selectedWidgetIdRef = useRef(selectedWidgetId);
  const readOnlyRef = useRef(false);
  const clipboardRef = useRef<PageWidget | null>(null);
  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const coalesceKeyRef = useRef<string | null>(null);
  const selectWidgetRef = useRef<(id: string | null) => void>(() => undefined);
  const dispatchShortcutRef = useRef<(shortcut: WidgetShortcut) => void>(() => undefined);
  const [clipboardTick, setClipboardTick] = useState(0);
  const [historyTick, setHistoryTick] = useState(0);

  const xml = useMemo(() => serializePageXml({ widgets }), [widgets]);
  xmlRef.current = xml;
  viewRef.current = view;
  modeRef.current = mode;
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const previewing = mode === 'preview';
  const versionLocked = selectedVersion?.status !== 'draft';
  const readOnly = previewing || versionLocked;
  widgetsRef.current = widgets;
  selectedWidgetIdRef.current = selectedWidgetId;
  readOnlyRef.current = readOnly;

  const applyView = useCallback((next: ViewTransform, fromUser = true) => {
    viewRef.current = next;
    setView(next);
    if (fromUser) {
      userAdjustedRef.current = true;
    }
  }, []);

  const fitCanvas = useCallback(
    (fromUser = false) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const next = computeFitView(stage.clientWidth, stage.clientHeight, screenWidth);
      if (!fromUser) {
        userAdjustedRef.current = false;
      }
      applyView(next, fromUser);
    },
    [applyView, screenWidth],
  );

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const rect = stage.getBoundingClientRect();
      const current = viewRef.current;
      const nextScale = clampScale(current.scale * factor);
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const wx = (cx - current.x) / current.scale;
      const wy = (cy - current.y) / current.scale;
      applyView({
        scale: nextScale,
        x: cx - wx * nextScale,
        y: cy - wy * nextScale,
      });
    },
    [applyView],
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

  const sendPreview = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: LOWCODE_MESSAGE_SOURCE,
        type: 'preview',
        xml: xmlRef.current,
        mode,
        selectedId: selectedWidgetId,
        scale: viewRef.current.scale,
        screenWidth,
        screenHeight: SCREEN_HEIGHT,
      },
      window.location.origin,
    );
  }, [mode, selectedWidgetId, screenWidth]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isLowcodeMessage(event.data)) {
        return;
      }
      if (event.data.type === 'ready') {
        readyRef.current = true;
        sendPreview();
        return;
      }
      if (event.data.type === 'select') {
        selectWidgetRef.current(event.data.widgetId);
        return;
      }
      if (event.data.type === 'keydown') {
        const shortcut = matchWidgetShortcut(event.data);
        if (shortcut) {
          dispatchShortcutRef.current(shortcut);
        }
        return;
      }
      if (event.data.type === 'canvas-wheel') {
        if (modeRef.current !== 'edit') {
          return;
        }
        const point = mapIframePoint(iframeRef.current, event.data.clientX, event.data.clientY);
        zoomAt(point.x, point.y, event.data.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP);
        return;
      }
      if (event.data.type === 'canvas-pointer') {
        const point = mapIframePoint(iframeRef.current, event.data.clientX, event.data.clientY);
        if (event.data.action === 'down') {
          dragRef.current = {
            pointerId: event.data.pointerId,
            x: point.x,
            y: point.y,
            panX: viewRef.current.x,
            panY: viewRef.current.y,
          };
          setPanning(true);
          return;
        }
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.data.pointerId) {
          return;
        }
        if (event.data.action === 'move') {
          applyView({
            scale: viewRef.current.scale,
            x: drag.panX + (point.x - drag.x),
            y: drag.panY + (point.y - drag.y),
          });
          return;
        }
        dragRef.current = null;
        setPanning(false);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [applyView, sendPreview, zoomAt]);

  useEffect(() => {
    sendPreview();
  }, [xml, sendPreview, view.scale]);

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
      zoomAt(event.clientX, event.clientY, event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP);
    }
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [loading, missing, zoomAt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }
      const shortcut = matchWidgetShortcut(event);
      if (!shortcut) {
        return;
      }
      if (readOnlyRef.current && shortcut !== 'copy') {
        return;
      }
      event.preventDefault();
      dispatchShortcutRef.current(shortcut);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  function onCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button === 1) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: viewRef.current.x,
        panY: viewRef.current.y,
      };
      setPanning(true);
      return;
    }
    if (event.button === 0 && modeRef.current === 'edit' && event.target === event.currentTarget) {
      setSelectedWidgetId(null);
    }
  }

  function onCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    applyView({
      scale: viewRef.current.scale,
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    });
  }

  function onCanvasPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setPanning(false);
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
      const nextProject = await api.getProject(id);
      const nextPages = await api.listPages(id);
      setProject(nextProject);
      setPages(nextPages);
      setMissing(false);
      setSelectedPageId((current) => current ?? nextPages[0]?.id ?? null);
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

  async function loadPage(pageId: string) {
    if (!id) {
      return;
    }
    try {
      const [page, nextVersions] = await Promise.all([api.getPage(id, pageId), api.listVersions(id, pageId)]);
      setPages((current) => current.map((item) => (item.id === page.id ? page : item)));
      setVersions(nextVersions);
      const current = nextVersions.find((version) => version.id === page.currentVersionId) ?? nextVersions[0];
      setSelectedVersionId(current?.id ?? null);
      applyXml(current?.xml ?? page.xml ?? '<page></page>');
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
    }
  }

  useEffect(() => {
    clipboardRef.current = null;
    setClipboardTick((tick) => tick + 1);
    resetHistory();
    if (selectedPageId) {
      void loadPage(selectedPageId);
    } else {
      setVersions([]);
      setSelectedVersionId(null);
      resetWidgetSession([]);
    }
  }, [selectedPageId]);

  function resetHistory() {
    pastRef.current = [];
    futureRef.current = [];
    coalesceKeyRef.current = null;
    setHistoryTick((tick) => tick + 1);
  }

  function resetWidgetSession(nextWidgets: PageWidget[], nextSelectedId?: string | null) {
    const selectedId = nextSelectedId === undefined ? (nextWidgets[0]?.id ?? null) : nextSelectedId;
    widgetsRef.current = nextWidgets;
    selectedWidgetIdRef.current = selectedId;
    setWidgets(nextWidgets);
    setSelectedWidgetId(selectedId);
    resetHistory();
  }

  function applyXml(nextXml: string) {
    try {
      const parsed = parsePageXml(nextXml);
      resetWidgetSession(parsed.widgets);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.invalidXml'));
    }
  }

  function endCoalesce() {
    coalesceKeyRef.current = null;
  }

  function selectWidget(id: string | null) {
    if (id !== selectedWidgetIdRef.current) {
      endCoalesce();
    }
    selectedWidgetIdRef.current = id;
    setSelectedWidgetId(id);
  }
  selectWidgetRef.current = selectWidget;

  function commitWidgets(nextWidgets: PageWidget[], nextSelectedId: string | null, coalesceKey?: string) {
    const coalescing = Boolean(coalesceKey && coalesceKey === coalesceKeyRef.current);
    if (!coalescing) {
      pastRef.current = [
        ...pastRef.current,
        { widgets: widgetsRef.current, selectedWidgetId: selectedWidgetIdRef.current },
      ].slice(-HISTORY_LIMIT);
      futureRef.current = [];
      setHistoryTick((tick) => tick + 1);
    }
    coalesceKeyRef.current = coalesceKey ?? null;
    widgetsRef.current = nextWidgets;
    selectedWidgetIdRef.current = nextSelectedId;
    setWidgets(nextWidgets);
    setSelectedWidgetId(nextSelectedId);
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
          : { type: 'flex', id: nextId, children: [] };
    commitWidgets(addWidgetToTree(widgetsRef.current, selectedWidgetIdRef.current, widget), nextId);
  }

  function updateWidget(widgetId: string, patch: WidgetPatch, coalesceKey: string) {
    if (readOnlyRef.current) {
      return;
    }
    commitWidgets(
      updateWidgetById(widgetsRef.current, widgetId, (widget) => patchWidget(widget, patch)),
      selectedWidgetIdRef.current,
      coalesceKey,
    );
  }

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
    commitWidgets(insertWidget(widgetsRef.current, selectedWidgetIdRef.current, copy), copy.id);
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
      selectedWidgetId: selectedWidgetIdRef.current,
    };
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, current].slice(-HISTORY_LIMIT);
    widgetsRef.current = previous.widgets;
    selectedWidgetIdRef.current = previous.selectedWidgetId;
    setWidgets(previous.widgets);
    setSelectedWidgetId(previous.selectedWidgetId);
    setHistoryTick((tick) => tick + 1);
  }

  function redoWidgetEdit() {
    if (readOnlyRef.current || futureRef.current.length === 0) {
      return;
    }
    coalesceKeyRef.current = null;
    const current: HistoryEntry = {
      widgets: widgetsRef.current,
      selectedWidgetId: selectedWidgetIdRef.current,
    };
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, current].slice(-HISTORY_LIMIT);
    widgetsRef.current = next.widgets;
    selectedWidgetIdRef.current = next.selectedWidgetId;
    setWidgets(next.widgets);
    setSelectedWidgetId(next.selectedWidgetId);
    setHistoryTick((tick) => tick + 1);
  }

  function dispatchShortcut(shortcut: WidgetShortcut) {
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
      applyXml(created.xml ?? nextXml);
      setVersionModalOpen(false);
      message.success(t('lowcode.versionCreated'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

  async function saveCurrentVersion() {
    if (!id || !selectedPageId || !selectedVersionId) {
      return;
    }
    try {
      const updated = await api.updateVersion(id, selectedPageId, selectedVersionId, { xml });
      setVersions((current) => current.map((version) => (version.id === updated.id ? updated : version)));
      message.success(t('lowcode.versionUpdated'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

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
      const updated = await api.publishVersion(id, selectedPageId, version.id);
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
    setSelectedVersionId(version.id);
    applyXml(version.xml ?? '<page></page>');
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
  const widgetTreeData = toWidgetTreeData(widgets, (widget) => {
    if (widget.type === 'text') {
      return `${t('lowcode.defaultText')} · ${widget.value}`;
    }
    if (widget.type === 'button') {
      return `${t('lowcode.defaultButton')} · ${widget.text}`;
    }
    return t('lowcode.defaultFlex');
  });
  const selectedTypeLabel =
    selectedWidget?.type === 'text'
      ? t('lowcode.defaultText')
      : selectedWidget?.type === 'button'
        ? t('lowcode.defaultButton')
        : t('lowcode.defaultFlex');
  const modifier = modifierShortcutLabel();
  const canUndo = historyTick >= 0 && !readOnly && pastRef.current.length > 0;
  const canRedo = historyTick >= 0 && !readOnly && futureRef.current.length > 0;
  const canDelete = !readOnly && Boolean(selectedWidget);
  const canCopy = Boolean(selectedWidget);
  const canPaste = clipboardTick >= 0 && !readOnly && Boolean(clipboardRef.current);

  return (
    <div className="editor-shell">
      <div className="editor-header">
        <Space>
          <Link to="/">
            <Button icon={<ArrowLeftOutlined />}>{t('lowcode.backHome')}</Button>
          </Link>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {project.name}
          </Typography.Title>
          <Typography.Text type="secondary">{project.key}</Typography.Text>
        </Space>
        {versionsOpen ? null : (
          <Button onClick={() => setVersionsOpen(true)}>{t('lowcode.versions')}</Button>
        )}
      </div>
      <div className={versionsOpen ? 'editor-grid' : 'editor-grid is-versions-collapsed'}>
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
              <Tree
                className="widget-tree"
                blockNode
                expandedKeys={collectExpandableKeys(widgets)}
                selectedKeys={selectedWidgetId ? [selectedWidgetId] : []}
                treeData={widgetTreeData}
                onSelect={(keys) => {
                  if (keys[0]) {
                    selectWidget(String(keys[0]));
                  }
                }}
              />
            )}
          </Card>
        </div>

        <Card
          size="small"
          className="editor-canvas-card"
          title={t('lowcode.canvas')}
          extra={
            <Space>
              <Typography.Text type="secondary">{t('lowcode.screenSize')}</Typography.Text>
              <InputNumber
                size="small"
                min={280}
                max={430}
                value={screenWidth}
                onChange={(value) => setScreenWidth(value ?? 375)}
                addonAfter="px"
              />
              <Typography.Text type="secondary">× {screenHeight}px</Typography.Text>
            </Space>
          }
        >
          <div className="canvas-wrap">
            <div
              ref={stageRef}
              className={['canvas-stage', panning ? 'is-panning' : '', previewing ? 'is-preview' : '']
                .filter(Boolean)
                .join(' ')}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerUp}
              onMouseDown={onCanvasMouseDown}
              onAuxClick={(event) => event.preventDefault()}
            >
              <div
                className="phone-screen"
                style={{
                  width: screenWidth * view.scale,
                  height: screenHeight * view.scale,
                  transform: `translate(${view.x}px, ${view.y}px)`,
                }}
              >
                <iframe
                  ref={iframeRef}
                  className="preview-frame"
                  title={t('lowcode.preview')}
                  src="/preview"
                  onLoad={() => {
                    window.setTimeout(() => {
                      if (!readyRef.current) {
                        sendPreview();
                      }
                    }, 300);
                  }}
                />
              </div>
            </div>
            <div className="canvas-toolbar">
              <Button size="small" icon={<ZoomOutOutlined />} onClick={() => zoomBy(1 / ZOOM_STEP)} />
              <Typography.Text className="canvas-zoom">{Math.round(view.scale * 100)}%</Typography.Text>
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
        </Card>

        <Card size="small" className="editor-panel" title={t('lowcode.widgetInspector')}>
          {selectedWidget ? (
            <Form layout="vertical">
              <Form.Item label={t('lowcode.widgetType')}>
                <Input value={selectedTypeLabel} disabled />
              </Form.Item>
              <Form.Item label={t('lowcode.widgetId')}>
                <Input value={selectedWidget.id} disabled />
              </Form.Item>
              {selectedWidget.type === 'text' ? (
                <Form.Item label={t('lowcode.widgetValue')}>
                  <Input
                    value={selectedWidget.value}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateWidget(selectedWidget.id, { value: event.target.value }, `edit:${selectedWidget.id}:value`)
                    }
                    onBlur={endCoalesce}
                  />
                </Form.Item>
              ) : null}
              {selectedWidget.type === 'button' ? (
                <Form.Item label={t('lowcode.widgetLabel')}>
                  <Input
                    value={selectedWidget.text}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateWidget(selectedWidget.id, { text: event.target.value }, `edit:${selectedWidget.id}:text`)
                    }
                    onBlur={endCoalesce}
                  />
                </Form.Item>
              ) : null}
              {selectedWidget.type === 'flex' ? (
                <CoalesceField onLeave={endCoalesce}>
                  <FlexContainerFields
                    style={selectedWidget.flex}
                    disabled={readOnly}
                    onChange={(flex) => updateWidget(selectedWidget.id, { flex }, `edit:${selectedWidget.id}:flex`)}
                  />
                </CoalesceField>
              ) : null}
              {selectedParent?.type === 'flex' ? (
                <CoalesceField onLeave={endCoalesce}>
                  <FlexItemFields
                    style={selectedWidget.item}
                    disabled={readOnly}
                    onChange={(item) => updateWidget(selectedWidget.id, { item }, `edit:${selectedWidget.id}:item`)}
                  />
                </CoalesceField>
              ) : null}
              <CoalesceField onLeave={endCoalesce}>
                <WidgetStyleFields
                  widgetId={selectedWidget.id}
                  widgetType={selectedWidget.type}
                  style={selectedWidget.style}
                  disabled={readOnly}
                  onChange={(style) => updateWidget(selectedWidget.id, { style }, `edit:${selectedWidget.id}:style`)}
                />
              </CoalesceField>
            </Form>
          ) : (
            <Empty description={t('lowcode.noWidgetSelected')} />
          )}
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
            <Card size="small" className="editor-panel" title={t('lowcode.versions')}>
              <Space style={{ marginBottom: 12 }}>
                <Button size="small" disabled={!selectedPage} onClick={openCreateVersion}>
                  {t('lowcode.createVersion')}
                </Button>
                <Button size="small" disabled={!selectedVersion || versionLocked} onClick={() => void saveCurrentVersion()}>
                  {t('lowcode.updateVersion')}
                </Button>
              </Space>
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

      <Modal
        open={widgetModalOpen}
        title={t('lowcode.addWidget')}
        footer={null}
        onCancel={() => setWidgetModalOpen(false)}
        destroyOnHidden
      >
        <div className="widget-type-picker">
          {(['text', 'button', 'flex'] as const).map((type) => (
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
                  : t('lowcode.defaultFlex')}
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
