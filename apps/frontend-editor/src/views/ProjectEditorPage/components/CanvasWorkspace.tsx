import { CaretDownOutlined, CaretRightOutlined, ColumnWidthOutlined, ControlOutlined, DeleteOutlined, DownOutlined, EditOutlined, ExpandOutlined, GlobalOutlined, PlusOutlined, RightOutlined, SettingOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { Button, Card, ConfigProvider, Empty, Input, InputNumber, Modal, Popover, Segmented, Select, Spin, Switch, Tooltip, Typography, message, theme } from 'antd';
import { ScriptEditor } from '../../../components/ScriptEditor';
import { useEffect, useState, type Dispatch, type MouseEvent, type PointerEvent, type RefObject, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTestValues, buildPropsRecord, DEFAULT_COMPONENT_DESIGN_SIZE, evaluateDataExpression, resolvePageData, DEFAULT_DRAWER_PLACE, type ComponentEmit, type ComponentProp, type PageDesignSize, type PageI18n, type PageMethod, type PageTestData, type PageVariable, type PageWidget, type WidgetEvents, type WidgetStateDelta } from '@vanstack/xml';
import { PAGE_EVENT_SPECS, PAGE_ROOT_STATE_OWNER_ID } from '@vanstack/xml';
import type { AnimationDefinitionDto, UpdateAnimationInput } from '@vanstack/shared';
import { ComponentEmitsPanel, ComponentPropsPanel } from '../../../components/ComponentContractPanel';
import { formatTypeLabel, useNamespaceCatalog } from '../../../components/TypeKindFields';
import { PageDataPanel } from '../../../components/PageDataPanel';
import { NamespaceTypesSection } from '../../../components/NamespaceTypesPane';
import { PageMethodPanel } from '../../../components/PageMethodPanel';
import { AnimationPanel } from '../../../components/AnimationPanel';
import { WidgetEventPanel } from '../../../components/WidgetEventPanel';
import {
  WidgetStyleBubble,
  type BoxGroup,
  type TableBubbleModel,
} from '../../../components/WidgetStyleBubble';
import { WidgetStateList, stateRowKey } from '../../../components/WidgetStateList';
import { WidgetStateFnModal } from '../../../components/WidgetStateFnModal';
import { setSpacingDragCursor } from '../../../utils/spacingGuides';
import { patchTableCellStyles, type TableRange } from '../../../utils/tableEdit';
import { collectTreeStateIds, findWidget, updateWidgetById, type WidgetPatch } from '../../../utils/widgetTree';
import {
  createWidgetState,
  deleteWidgetState,
  updateHostTransition,
  updateWidgetState,
  type ViewingByOwner,
  type VisibleWidgetState,
} from '../../../utils/widgetStates';
import { formatDataLiteral, tryParseDataLiteral } from '../../../utils/dataLiteral';
import { widgetCanvasLabel, ZOOM_STEP, type CanvasMode, type CenterTab, type ViewTransform } from '../helpers';
import { drawerStyleForPlace } from '../../../widgets/drawer';

function formatActual(type: string, value: unknown) {
  if (type === 'bool') {
    return value ? 'true' : 'false';
  }
  if (type === 'num') {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
  }
  if (type === 'str' || type === 'icon' || type === 'image' || type === 'widget') {
    return typeof value === 'string' ? value : '';
  }
  return compactJson(value);
}

function compactJson(value: unknown) {
  try {
    return formatDataLiteral(value);
  } catch {
    return '';
  }
}

function prettyJson(value: unknown) {
  try {
    return formatDataLiteral(value, 2);
  } catch {
    return '';
  }
}

function literalValue(source: string | undefined): unknown | undefined {
  if (!source) {
    return undefined;
  }
  return tryParseDataLiteral(source);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function storedLiteral(draft: string, type: string): string | null {
  const parsed = tryParseDataLiteral(draft);
  if (type === 'arr' && Array.isArray(parsed)) {
    return formatDataLiteral(parsed);
  }
  if (type === 'obj' && isPlainRecord(parsed)) {
    return formatDataLiteral(parsed);
  }
  return draft.trim() ? draft : null;
}

function TestValueEditor({
  type,
  display,
  disabled,
  onCommit,
}: {
  type: string;
  display: string;
  disabled?: boolean;
  onCommit: (text: string) => boolean;
}) {
  const [draft, setDraft] = useState(display);
  const [focused, setFocused] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!focused) {
      setDraft(display);
      setDirty(false);
    }
  }, [display, focused]);

  if (type === 'bool') {
    return (
      <Switch
        size="small"
        disabled={disabled}
        checked={display === 'true'}
        onChange={(checked) => {
          onCommit(checked ? 'true' : 'false');
        }}
      />
    );
  }

  const shared = {
    className: 'preview-scope-field',
    disabled,
    value: draft,
    onFocus: () => setFocused(true),
    onChange: (event: { target: { value: string } }) => {
      setDirty(true);
      setDraft(event.target.value);
    },
    onBlur: () => {
      setFocused(false);
      if (!dirty) {
        setDraft(display);
        return;
      }
      if (!onCommit(draft)) {
        setDraft(display);
      }
      setDirty(false);
    },
  };
  return <Input {...shared} size="small" />;
}

type ScopeRow = {
  name: string;
  type: string;
  typeLabel: string;
  display: string;
  value: unknown;
  source?: string;
  readOnly?: boolean;
};

type ScopeEditor = {
  name: string;
  type: string;
  kind: 'value' | 'item' | 'add';
  index?: number;
  draft: string;
  items: unknown[];
};

function PreviewScopeSection({
  title,
  empty,
  rows,
  dataScope,
  propScope,
  queryScope,
  onCommit,
  onAdd,
  addLabel,
}: {
  title: string;
  empty: string;
  rows: ScopeRow[];
  dataScope: Record<string, unknown>;
  propScope: Record<string, unknown>;
  queryScope: Record<string, unknown>;
  onCommit: (name: string, type: string, text: string) => boolean;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<ScopeEditor | null>(null);
  const [openArrays, setOpenArrays] = useState<Record<string, boolean>>({});
  const [codeValid, setCodeValid] = useState(true);

  function rowItems(row: ScopeRow): unknown[] {
    const parsed = literalValue(row.source);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return Array.isArray(row.value) ? row.value : [];
  }

  function openValue(row: ScopeRow) {
    const parsed = literalValue(row.source);
    const fromSource =
      (row.type === 'arr' && Array.isArray(parsed)) || (row.type === 'obj' && isPlainRecord(parsed));
    const source = row.type === 'arr' || row.type === 'obj'
      ? prettyJson(fromSource ? parsed : row.value)
      : row.display;
    setEditor({ name: row.name, type: row.type, kind: 'value', draft: source, items: [] });
  }

  function commitItems(name: string, items: unknown[]) {
    let text = '';
    try {
      text = formatDataLiteral(items);
    } catch {
      message.error(t('lowcode.dataInvalidLiteral'));
      return false;
    }
    return text ? onCommit(name, 'arr', text) : false;
  }

  function confirmEditor() {
    if (!editor) {
      return;
    }
    if (editor.kind === 'value') {
      const draft = editor.type === 'arr' || editor.type === 'obj' ? storedLiteral(editor.draft, editor.type) : editor.draft;
      if (draft == null) {
        message.error(t('lowcode.dataInvalidLiteral'));
        return;
      }
      if (onCommit(editor.name, editor.type, draft)) {
        setEditor(null);
      }
      return;
    }
    let value = tryParseDataLiteral(editor.draft);
    if (value === undefined && editor.draft.trim() !== '') {
      try {
        value = evaluateDataExpression(editor.draft, dataScope, propScope, queryScope);
      } catch {
        message.error(t('lowcode.dataInvalidLiteral'));
        return;
      }
    }
    if (value === undefined && editor.draft.trim() === '') {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    const next = editor.kind === 'add'
      ? [...editor.items, value]
      : editor.items.map((item, index) => (index === editor.index ? value : item));
    if (commitItems(editor.name, next)) {
      setEditor(null);
    }
  }

  return (
    <section className="preview-scope-section">
      <div className="preview-scope-section-title">
        <span>{title}</span>
        {onAdd ? (
          <Button
            type="text"
            size="small"
            className="preview-scope-section-add"
            icon={<PlusOutlined />}
            aria-label={addLabel}
            onClick={onAdd}
          />
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="preview-scope-empty">{empty}</div>
      ) : (
        <ul className="preview-scope-list">
          {rows.map((row) => {
            const items = row.type === 'arr' ? rowItems(row) : [];
            const canFold = items.length > 5;
            const folded = canFold && !openArrays[row.name];
            const shown = folded ? items.slice(0, 3) : items;
            return (
              <li key={row.name} className="preview-scope-row">
                <div className="preview-scope-name">
                  <span>{row.name}</span>
                  <span className="preview-scope-type">{row.typeLabel}</span>
                  {row.type === 'arr' && !row.readOnly ? (
                    <Button
                      size="small"
                      type="text"
                      className="preview-scope-name-action"
                      icon={<EditOutlined />}
                      aria-label={t('lowcode.edit')}
                      title={t('lowcode.edit')}
                      onClick={() => openValue(row)}
                    />
                  ) : null}
                </div>
                {row.type === 'obj' ? (
                  <div className="preview-scope-literal">
                    <span className="preview-scope-literal-text" title={row.display}>
                      {row.display}
                    </span>
                    {row.readOnly ? null : (
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        aria-label={t('lowcode.edit')}
                        title={t('lowcode.edit')}
                        onClick={() => openValue(row)}
                      />
                    )}
                  </div>
                ) : row.type === 'arr' ? (
                  <div className="preview-scope-items">
                    {shown.map((item, index) => {
                      const text = compactJson(item);
                      return (
                        <div key={`${row.name}:${index}`} className="preview-scope-item">
                          <span className="preview-scope-literal-text" title={text}>
                            {text}
                          </span>
                          {row.readOnly ? null : (
                            <>
                              <Button
                                size="small"
                                type="text"
                                icon={<EditOutlined />}
                                aria-label={t('lowcode.edit')}
                                title={t('lowcode.edit')}
                                onClick={() =>
                                  setEditor({
                                    name: row.name,
                                    type: 'arr',
                                    kind: 'item',
                                    index,
                                    draft: prettyJson(item),
                                    items,
                                  })
                                }
                              />
                              <Button
                                size="small"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                aria-label={t('lowcode.delete')}
                                title={t('lowcode.delete')}
                                onClick={() => commitItems(row.name, items.filter((_, i) => i !== index))}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                    {canFold ? (
                      <Button
                        size="small"
                        type="text"
                        className="preview-scope-fold"
                        onClick={() => setOpenArrays((current) => ({ ...current, [row.name]: folded }))}
                      >
                        {folded
                          ? t('lowcode.previewExpandItems', { count: items.length - 3 })
                          : t('lowcode.previewCollapseItems')}
                      </Button>
                    ) : null}
                    {row.readOnly ? null : (
                      <Button
                        size="small"
                        type="text"
                        className="preview-scope-add"
                        icon={<PlusOutlined />}
                        aria-label={t('lowcode.previewAddItem')}
                        title={t('lowcode.previewAddItem')}
                        onClick={() =>
                          setEditor({
                            name: row.name,
                            type: 'arr',
                            kind: 'add',
                            draft: 'null',
                            items,
                          })
                        }
                      />
                    )}
                  </div>
                ) : (
                  <TestValueEditor
                    type={row.type}
                    display={row.display}
                    disabled={row.readOnly}
                    onCommit={(text) => onCommit(row.name, row.type, text)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Modal
        title={
          editor?.kind === 'add'
            ? t('lowcode.previewAddItem')
            : editor?.kind === 'item'
              ? t('lowcode.previewEditItem')
              : t('lowcode.dataEditValue')
        }
        open={Boolean(editor)}
        onCancel={() => setEditor(null)}
        onOk={confirmEditor}
        okButtonProps={{ disabled: !editor || !codeValid }}
        destroyOnHidden
        width={640}
      >
        {editor ? (
          <ScriptEditor
            value={editor.draft}
            height="240px"
            onValidateChange={setCodeValid}
            onChange={(draft) => setEditor((current) => (current ? { ...current, draft } : current))}
          />
        ) : null}
      </Modal>
    </section>
  );
}

/**
 * 中间工作区，包含布局、页面数据、事件、方法四个页签。
 * 平移、缩放、选中、表格编辑和预览消息都留在页面，这里只把对应的 ref 和回调接到 DOM。
 *
 * 布局页用 is-hidden 藏起来，而不是卸掉，切到数据和事件时 iframe 里的预览不会重新加载。
 * iframe 的 onLoad 若发现页面还没收到 ready，会延迟再推一次当前草稿，避免首屏空白。
 * 有可编样式时画 WidgetStyleBubble；没有时退回浅色主题的设置按钮，用来打开检查器。
 * 切编辑/预览会先进入 settling，等页面把相机和预览同步完再揭开画布。
 */
type CanvasWorkspaceProps = {
  centerTab: CenterTab;
  setCenterTab: Dispatch<SetStateAction<CenterTab>>;
  userAdjustedRef: RefObject<boolean>;
  fitCanvas: (fromUser?: boolean) => void;
  pageI18n: PageI18n | undefined;
  previewLocale: string | null;
  setPreviewLocale: Dispatch<SetStateAction<string | null>>;
  onCanvasPanPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  stageRef: RefObject<HTMLDivElement | null>;
  phoneScreenRef: RefObject<HTMLDivElement | null>;
  phoneFrameRef: RefObject<HTMLDivElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  readyRef: RefObject<boolean>;
  zoomLabelRef: RefObject<HTMLElement | null>;
  panning: boolean;
  panningRef: RefObject<boolean>;
  previewing: boolean;
  canvasSettling: boolean;
  tableEditId: string | null;
  scrollEditId: string | null;
  swiperEditId: string | null;
  componentEditId: string | null;
  /** 组件定义编辑器：正在调试的插槽 id（画布只渲染该插槽内部的调试节点）。 */
  slotDebugId: string | null;
  /** 组件定义编辑器：插槽调试面板里的插槽清单。 */
  slotDebugSlots: Array<{ id: string; name: string }>;
  onToggleSlotDebug: (slotId?: string | null) => void;
  componentEditSelectionKind: 'slot' | 'content' | null;
  componentEditSlotId: string | null;
  /** 插槽使用编辑：选中组件实例时的插槽清单（画布左上角面板）。 */
  slotUseSlots: Array<{ id: string; name: string }>;
  /** 插槽使用编辑：正在编辑的插槽控件 id（为空表示未进入插槽编辑）。 */
  slotUseActiveId: string | null;
  onToggleSlotUse: (slotWidgetId: string) => void;
  /** 组件定义编辑器预览态点选的插槽：展示「声明 + 当前实例解析值」。 */
  previewSlot?: { name: string; params: ComponentProp[]; values: Record<string, unknown> } | null;
  sendPreview: () => void;
  showStyleChrome: boolean;
  selectedWidget: PageWidget | null;
  selectedWidgetId: string | null;
  bubbleWidget: PageWidget | null;
  rangeWidget: PageWidget | null;
  selectedOwnKeys: Set<string> | null | undefined;
  pageData: PageVariable[];
  testData?: PageTestData;
  previewDataEdits?: Readonly<Record<string, string>>;
  previewPropEdits?: Readonly<Record<string, string>>;
  previewQueryEdits?: Readonly<Record<string, string>>;
  commitPreviewTest: (section: 'props' | 'data' | 'query', name: string, type: string, text: string) => boolean;
  componentMode?: boolean;
  /** 组件定义编辑器的「定义尺寸」：定义态画布上这块区域的大小。 */
  designSize?: PageDesignSize;
  onComponentDesignSizeChange?: (size: PageDesignSize | undefined) => void;
  pageQuery: ComponentProp[];
  addPageQuery: () => void;
  commitPageQuery: (next: ComponentProp[], coalesceKey?: string) => void;
  componentProps: ComponentProp[];
  /** 当前选中控件所在插槽声明的出参（`$slot.名称`）。 */
  slotProps?: ComponentProp[];
  componentEmits: ComponentEmit[];
  componentEmitsById: Record<string, ComponentEmit[]>;
  commitComponentProps: (next: ComponentProp[], coalesceKey?: string) => void;
  commitComponentEmits: (next: ComponentEmit[]) => void;
  pageEvents: WidgetEvents | undefined;
  commitPageEvents: (next: WidgetEvents | undefined) => void;
  pageMethods: PageMethod[];
  commitPageMethods: (next: PageMethod[]) => void;
  animations: AnimationDefinitionDto[];
  onCreateAnimation: (name: string) => Promise<AnimationDefinitionDto | null>;
  onUpdateAnimation: (id: string, input: UpdateAnimationInput) => Promise<AnimationDefinitionDto | null>;
  onDeleteAnimation: (id: string) => Promise<void>;
  pageScopeId: string;
  readOnly: boolean;
  openBoxGroup: BoxGroup | null;
  handleOpenBoxGroupChange: (group: BoxGroup | null) => void;
  tableBubble: TableBubbleModel | undefined;
  projectId: string;
  updateWidget: (widgetId: string, patch: WidgetPatch, coalesceKey: string) => void;
  commitWidgets: (nextWidgets: PageWidget[], nextSelectedId: string | null, coalesceKey?: string) => void;
  widgetsRef: RefObject<PageWidget[]>;
  selectedWidgetIdRef: RefObject<string | null>;
  tableStyleIds: string[];
  activeRange: TableRange | null;
  spacingDragRef: { current: object | null };
  syncSelectChrome: () => void;
  toolbarPopupOpenRef: RefObject<boolean>;
  setInspectorOpen: Dispatch<SetStateAction<boolean>>;
  widgets: PageWidget[];
  visibleStates: VisibleWidgetState[];
  /** 状态栏操作宿主：选中控件、组件根控件或合成的页面根（页面全局状态）。 */
  stateHostWidget: PageWidget | null;
  /** 状态栏「全局状态」区块：文档级全局状态宿主（组件编辑态为 null，改由右上角下拉框承载）。 */
  globalStateBarWidget: PageWidget | null;
  globalVisibleStates: VisibleWidgetState[];
  commitPageStates: (next: WidgetStateDelta[] | undefined, coalesceKey?: string) => void;
  /** 工具栏「全局状态控制」编辑的宿主：文档级全局状态（与最外层节点自身状态独立）。 */
  componentGlobalWidget: PageWidget | null;
  onComponentGlobalStateFnChange: (stateFn: string | undefined, hoverStateId?: string) => void;
  viewingOwnerId: string | null;
  viewingState: string | null;
  /** 每个宿主当前正在查看的状态（ownerId → stateId）：供状态栏两个区块各自独立高亮选中项。 */
  viewingByOwner: ViewingByOwner;
  setViewingOwnerId: Dispatch<SetStateAction<string | null>>;
  setViewingState: Dispatch<SetStateAction<string | null>>;
  setViewingByOwner: Dispatch<SetStateAction<ViewingByOwner>>;
  view: ViewTransform;
  zoomBy: (factor: number) => void;
  mode: CanvasMode;
  modeRef: RefObject<CanvasMode>;
  settleGenRef: RefObject<number>;
  canvasSettlingRef: RefObject<boolean>;
  setCanvasSettling: Dispatch<SetStateAction<boolean>>;
  setMode: Dispatch<SetStateAction<CanvasMode>>;
  commitPageData: (next: PageVariable[], coalesceKey?: string) => void;
  endCoalesce: () => void;
};

/** 组件定义编辑器的「定义尺寸」工具：只调整定义态画布上这块区域的大小，与组件被使用时的尺寸无关。 */
function ComponentDesignSizeTool({
  size,
  disabled,
  onChange,
}: {
  size: PageDesignSize | undefined;
  disabled: boolean;
  onChange: (next: PageDesignSize | undefined) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<number | null>(size?.width ?? DEFAULT_COMPONENT_DESIGN_SIZE.width);
  const [height, setHeight] = useState<number | null>(size?.height ?? DEFAULT_COMPONENT_DESIGN_SIZE.height);
  useEffect(() => {
    if (open) {
      return;
    }
    setWidth(size?.width ?? DEFAULT_COMPONENT_DESIGN_SIZE.width);
    setHeight(size?.height ?? DEFAULT_COMPONENT_DESIGN_SIZE.height);
  }, [size, open]);
  const commit = (nextWidth: number | null, nextHeight: number | null) => {
    const w = typeof nextWidth === 'number' && nextWidth > 0 ? nextWidth : undefined;
    const h = typeof nextHeight === 'number' && nextHeight > 0 ? nextHeight : undefined;
    onChange(
      w == null && h == null ? undefined : { ...(w != null ? { width: w } : {}), ...(h != null ? { height: h } : {}) },
    );
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      destroyOnHidden
      content={
        <div className="design-size-panel" onPointerDown={(event) => event.stopPropagation()}>
          <div className="design-size-panel-row">
            <span className="design-size-panel-label">{t('lowcode.designSizeWidth')}</span>
            <InputNumber
              size="small"
              min={1}
              max={4096}
              suffix="px"
              value={width}
              disabled={disabled}
              onChange={(value) => setWidth(typeof value === 'number' ? value : null)}
              onBlur={() => commit(width, height)}
              onPressEnter={() => commit(width, height)}
            />
          </div>
          <div className="design-size-panel-row">
            <span className="design-size-panel-label">{t('lowcode.designSizeHeight')}</span>
            <InputNumber
              size="small"
              min={1}
              max={4096}
              suffix="px"
              value={height}
              disabled={disabled}
              onChange={(value) => setHeight(typeof value === 'number' ? value : null)}
              onBlur={() => commit(width, height)}
              onPressEnter={() => commit(width, height)}
            />
          </div>
          <Button
            size="small"
            block
            disabled={disabled}
            onClick={() => {
              // 重置 = 清掉文档里的自定义尺寸，显示回默认值。
              setWidth(DEFAULT_COMPONENT_DESIGN_SIZE.width);
              setHeight(DEFAULT_COMPONENT_DESIGN_SIZE.height);
              commit(null, null);
            }}
          >
            {t('lowcode.designSizeReset')}
          </Button>
        </div>
      }
    >
      <Tooltip title={t('lowcode.componentDesignSize')}>
        <Button size="small" type="text" icon={<ColumnWidthOutlined />} disabled={disabled} />
      </Tooltip>
    </Popover>
  );
}

export function CanvasWorkspace({
  centerTab,
  setCenterTab,
  userAdjustedRef,
  fitCanvas,
  pageI18n,
  previewLocale,
  setPreviewLocale,
  onCanvasPanPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasPointerDown,
  onCanvasMouseDown,
  stageRef,
  phoneScreenRef,
  phoneFrameRef,
  iframeRef,
  readyRef,
  zoomLabelRef,
  panning,
  panningRef,
  previewing,
  canvasSettling,
  tableEditId,
  scrollEditId,
  swiperEditId,
  componentEditId,
  slotDebugId,
  slotDebugSlots,
  onToggleSlotDebug,
  componentEditSelectionKind,
  componentEditSlotId,
  slotUseSlots,
  slotUseActiveId,
  onToggleSlotUse,
  previewSlot,
  sendPreview,
  showStyleChrome,
  selectedWidget,
  selectedWidgetId,
  bubbleWidget,
  rangeWidget,
  selectedOwnKeys,
  pageData,
  testData,
  previewDataEdits,
  previewPropEdits,
  previewQueryEdits,
  commitPreviewTest,
  componentMode,
  designSize,
  onComponentDesignSizeChange,
  pageQuery,
  addPageQuery,
  commitPageQuery,
  componentProps,
  slotProps,
  componentEmits,
  componentEmitsById,
  commitComponentProps,
  commitComponentEmits,
  pageEvents,
  commitPageEvents,
  pageMethods,
  commitPageMethods,
  animations,
  onCreateAnimation,
  onUpdateAnimation,
  onDeleteAnimation,
  pageScopeId,
  readOnly,
  openBoxGroup,
  handleOpenBoxGroupChange,
  tableBubble,
  projectId,
  updateWidget,
  commitWidgets,
  widgetsRef,
  selectedWidgetIdRef,
  tableStyleIds,
  activeRange,
  spacingDragRef,
  syncSelectChrome,
  toolbarPopupOpenRef,
  setInspectorOpen,
  widgets,
  visibleStates,
  stateHostWidget,
  globalStateBarWidget,
  globalVisibleStates,
  commitPageStates,
  componentGlobalWidget,
  onComponentGlobalStateFnChange,
  viewingOwnerId,
  viewingState,
  viewingByOwner,
  setViewingOwnerId,
  setViewingState,
  setViewingByOwner,
  view,
  zoomBy,
  mode,
  modeRef,
  settleGenRef,
  canvasSettlingRef,
  setCanvasSettling,
  setMode,
  commitPageData,
  endCoalesce,
}: CanvasWorkspaceProps) {
  const { t } = useTranslation();
  const namespaces = useNamespaceCatalog(projectId);
  const [dataSectionOpen, setDataSectionOpen] = useState({ contract: true, variables: true, types: false });
  const [componentStateFnOpen, setComponentStateFnOpen] = useState(false);
  const [nodeStateFnOpen, setNodeStateFnOpen] = useState(false);
  /** 画布「数据」浮动面板是否展开；折叠后只保留固定标题行。 */
  const [scopeCardOpen, setScopeCardOpen] = useState(true);
  const toggleDataSection = (key: keyof typeof dataSectionOpen) =>
    setDataSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const typeLabel = (type: string, of?: string) => formatTypeLabel(type, of, (key) => t(`lowcode.propType.${key}`, { defaultValue: key }));
  const selectedCanvasLabel = selectedWidget ? widgetCanvasLabel(selectedWidget, t) : null;
  const stateUsedIds = collectTreeStateIds(
    stateHostWidget && !widgets.some((widget) => widget.id === stateHostWidget.id)
      ? [...widgets, stateHostWidget, ...(globalStateBarWidget ? [globalStateBarWidget] : [])]
      : [...widgets, ...(globalStateBarWidget ? [globalStateBarWidget] : [])],
  );
  // 「全局状态」区块的 id 去重集：除页面控件外还要包含文档级全局状态，避免新建全局状态时 id 冲突。
  const globalStateUsedIds = globalStateBarWidget
    ? collectTreeStateIds([...widgets, globalStateBarWidget])
    : collectTreeStateIds(widgets);
  // 「状态」区块显隐：组件编辑态仅选中插槽内容时显示；其余模式选中控件时显示。
  // 「全局状态」区块由 globalStateBarWidget 驱动，始终显示（组件编辑态改由右上角下拉框承载）。
  const nodeStateBarVisible = componentEditId
    ? componentEditSelectionKind === 'content'
    : Boolean(selectedWidget);
  // 插槽调试入口已改为画布左上角的插槽面板，这里只保留面板自身的显隐条件。
  const showSlotDebugPanel = componentMode && !readOnly && !previewing && slotDebugSlots.length > 0;
  // 插槽使用编辑：页面编辑态选中组件实例时，在画布左上角显示插槽清单面板。
  const showSlotUsePanel = !componentMode && !readOnly && !previewing && slotUseSlots.length > 0;

  // 状态栏两个区块各自始终只高亮一行（且必须有且仅有一行高亮）：
  // 优先按当前查看态精确定位，找不到时回退到该区块的根行（默认态）。
  function flattenStateRows(rows: VisibleWidgetState[]): VisibleWidgetState[] {
    return rows.flatMap((row) => [row, ...flattenStateRows(row.children ?? [])]);
  }
  function blockRootKey(rows: VisibleWidgetState[]): string | null {
    const flat = flattenStateRows(rows);
    const root = flat.find((row) => row.owned && row.id == null && !row.scopeId) ?? flat[0];
    return root ? stateRowKey(root) : null;
  }
  // 「控件状态」区块：查看态宿主可能是该控件自身、祖先（继承）或作用域宿主。
  const nodeActiveKey = (() => {
    const flat = flattenStateRows(visibleStates);
    const exact = flat.find(
      (row) => !row.scopeId && row.ownerId === viewingOwnerId && (row.id ?? null) === (viewingState ?? null),
    );
    const scoped = flat.find(
      (row) => row.id == null && row.scopeOwnerId === viewingOwnerId && row.scopeId === viewingState,
    );
    const fallback = flat.find((row) => row.ownerId === stateHostWidget?.id);
    const matched = exact ?? scoped ?? fallback;
    return matched ? stateRowKey(matched) : blockRootKey(visibleStates);
  })();
  // 「全局状态」区块：宿主固定为文档级 __page__，查看态直接读 viewingByOwner。
  const globalActiveKey = (() => {
    if (globalVisibleStates.length === 0) {
      return null;
    }
    const current = viewingByOwner[PAGE_ROOT_STATE_OWNER_ID] ?? null;
    const flat = flattenStateRows(globalVisibleStates);
    const matched = flat.find(
      (row) => !row.scopeId && row.ownerId === PAGE_ROOT_STATE_OWNER_ID && (row.id ?? null) === current,
    );
    return matched ? stateRowKey(matched) : blockRootKey(globalVisibleStates);
  })();

  function handleStateSelect(row: VisibleWidgetState) {
    const isContent = componentEditSelectionKind === 'content' && componentEditId && componentEditSlotId;
    const contentOwnerKey = isContent
      ? `${componentEditId}__slot-${componentEditSlotId}__${selectedWidget?.id ?? ''}`
      : selectedWidget?.id ?? null;
    // 点到继承来的状态：记下拥有者正在看它，当前控件回到基础外观。
    if (!row.owned && row.id && !row.scopeId) {
      const inheritedId = row.id;
      setViewingOwnerId(row.ownerId);
      setViewingState(inheritedId);
      setViewingByOwner((prev) => {
        const next: ViewingByOwner = { ...prev, [row.ownerId]: inheritedId };
        if (contentOwnerKey) {
          next[contentOwnerKey] = null;
        }
        return next;
      });
      return;
    }
    // 带作用域的状态要同时记住外层 scope 和这一层正在看的 id。
    const scopeOwnerId = row.scopeOwnerId;
    const scopeId = row.scopeId;
    if (scopeId && scopeOwnerId) {
      setViewingOwnerId(row.id ? row.ownerId : scopeOwnerId);
      setViewingState(row.id ?? scopeId);
      setViewingByOwner((prev) => ({
        ...prev,
        [scopeOwnerId]: scopeId,
        [row.ownerId]: row.id ?? null,
      }));
      return;
    }
    setViewingOwnerId(row.ownerId);
    setViewingState(row.id);
    setViewingByOwner((prev) => {
      const next: ViewingByOwner = { ...prev, [row.ownerId]: row.id };
      // 回到基础外观时清掉同一区块内其它拥有者正在看的状态，避免下层仍叠着旧状态。
      // 「全局状态」与「节点状态」是两个独立区块，互不清理：点全局默认不影响节点选中，反之亦然。
      if (row.id == null) {
        const isGlobalRow = row.ownerId === PAGE_ROOT_STATE_OWNER_ID;
        for (const key of Object.keys(next)) {
          if (key === row.ownerId) {
            continue;
          }
          if (isGlobalRow || key === PAGE_ROOT_STATE_OWNER_ID) {
            continue;
          }
          next[key] = null;
        }
      }
      return next;
    });
  }

  // 状态栏增删改按宿主参数化：同一套逻辑服务「全局状态」区块（宿主为文档级 __page__）与「状态」区块（宿主为选中控件）。
  function stateListHandlers(host: PageWidget | null) {
    return {
      onCreate: (id: string, name: string, from: VisibleWidgetState, transition?: number) => {
        if (componentEditSelectionKind === 'content' && componentEditId && componentEditSlotId && selectedWidget) {
          const componentWidget = findWidget(widgets, componentEditId);
          if (componentWidget?.type === 'component') {
            const scopeId = from.scopeId ?? (!from.owned ? from.id : null);
            const scopeOwnerId = from.scopeOwnerId ?? (!from.owned ? from.ownerId : undefined);
            const contentWidgets = componentWidget.slotContent?.[componentEditSlotId] ?? [];
            const created = createWidgetState(
              contentWidgets,
              selectedWidget.id,
              id,
              name,
              from.id,
              from.owned && !from.scopeId,
              transition,
              scopeId,
            );
            const nextComponent = {
              ...componentWidget,
              slotContent: { ...componentWidget.slotContent, [componentEditSlotId]: created },
            };
            commitWidgets(updateWidgetById(widgets, componentWidget.id, () => nextComponent), selectedWidgetId);
            const prefixedOwnerId = `${componentEditId}__slot-${componentEditSlotId}__${selectedWidget.id}`;
            setViewingOwnerId(prefixedOwnerId);
            setViewingState(id);
            setViewingByOwner((prev) => {
              const next: ViewingByOwner = { ...prev, [prefixedOwnerId]: id };
              if (scopeId && scopeOwnerId) {
                next[scopeOwnerId] = scopeId;
              }
              return next;
            });
            return;
          }
        }
        if (!host) {
          return;
        }
        const scopeId = from.scopeId ?? (!from.owned ? from.id : null);
        const scopeOwnerId = from.scopeOwnerId ?? (!from.owned ? from.ownerId : undefined);
        if (host.id === PAGE_ROOT_STATE_OWNER_ID) {
          const created = createWidgetState([host], host.id, id, name, from.id, from.owned && !from.scopeId, transition, scopeId);
          commitPageStates(created[0].states);
          setViewingOwnerId(host.id);
          setViewingState(id);
          setViewingByOwner((prev) => {
            const next: ViewingByOwner = { ...prev, [host.id]: id };
            if (scopeId && scopeOwnerId) {
              next[scopeOwnerId] = scopeId;
            }
            return next;
          });
          return;
        }
        const created = createWidgetState(widgets, host.id, id, name, from.id, from.owned && !from.scopeId, transition, scopeId);
        commitWidgets(created, selectedWidgetId);
        setViewingOwnerId(host.id);
        setViewingState(id);
        setViewingByOwner((prev) => {
          const next: ViewingByOwner = { ...prev, [host.id]: id };
          if (scopeId && scopeOwnerId) {
            next[scopeOwnerId] = scopeId;
          }
          return next;
        });
      },
      onEdit: (from: VisibleWidgetState, name: string | null, transition?: number) => {
        if (componentEditSelectionKind === 'content' && componentEditId && componentEditSlotId && selectedWidget) {
          const componentWidget = findWidget(widgets, componentEditId);
          if (componentWidget?.type === 'component') {
            const contentWidgets = componentWidget.slotContent?.[componentEditSlotId] ?? [];
            let next: PageWidget[];
            if (from.id == null) {
              next = updateHostTransition(contentWidgets, selectedWidget.id, transition);
            } else if (!name) {
              return;
            } else {
              next = updateWidgetState(contentWidgets, selectedWidget.id, from.id, name, transition, from.scopeId);
            }
            const nextComponent = {
              ...componentWidget,
              slotContent: { ...componentWidget.slotContent, [componentEditSlotId]: next },
            };
            commitWidgets(updateWidgetById(widgets, componentWidget.id, () => nextComponent), selectedWidgetId);
            return;
          }
        }
        if (!host) {
          return;
        }
        if (host.id === PAGE_ROOT_STATE_OWNER_ID) {
          if (from.id == null || !name) {
            return;
          }
          const next = updateWidgetState([host], host.id, from.id, name, transition, from.scopeId);
          commitPageStates(next[0].states);
          return;
        }
        if (from.id == null) {
          commitWidgets(updateHostTransition(widgets, host.id, transition), selectedWidgetId);
          return;
        }
        if (!name) {
          return;
        }
        commitWidgets(
          updateWidgetState(widgets, host.id, from.id, name, transition, from.scopeId),
          selectedWidgetId,
        );
      },
      onDelete: (row: VisibleWidgetState) => {
        if (!row.id) {
          return;
        }
        if (componentEditSelectionKind === 'content' && componentEditId && componentEditSlotId && selectedWidget) {
          const componentWidget = findWidget(widgets, componentEditId);
          if (componentWidget?.type === 'component') {
            const contentWidgets = componentWidget.slotContent?.[componentEditSlotId] ?? [];
            const next = deleteWidgetState(contentWidgets, selectedWidget.id, row.id, row.scopeId);
            const nextComponent = {
              ...componentWidget,
              slotContent: { ...componentWidget.slotContent, [componentEditSlotId]: next },
            };
            commitWidgets(updateWidgetById(widgets, componentWidget.id, () => nextComponent), selectedWidgetId);
            const prefixedOwnerId = `${componentEditId}__slot-${componentEditSlotId}__${selectedWidget.id}`;
            if (viewingOwnerId === prefixedOwnerId && viewingState === row.id) {
              setViewingOwnerId(row.scopeOwnerId ?? prefixedOwnerId);
              setViewingState(row.scopeId ?? null);
            }
            setViewingByOwner((prev) => {
              if (prev[prefixedOwnerId] !== row.id) {
                return prev;
              }
              return { ...prev, [prefixedOwnerId]: null };
            });
            return;
          }
        }
        if (!host) {
          return;
        }
        if (host.id === PAGE_ROOT_STATE_OWNER_ID) {
          const next = deleteWidgetState([host], host.id, row.id, row.scopeId);
          commitPageStates(next[0].states);
          if (viewingOwnerId === host.id && viewingState === row.id) {
            setViewingOwnerId(host.id);
            setViewingState(row.scopeId ?? null);
          }
          setViewingByOwner((prev) => (prev[host.id] !== row.id ? prev : { ...prev, [host.id]: null }));
          return;
        }
        commitWidgets(deleteWidgetState(widgets, host.id, row.id, row.scopeId), selectedWidgetId);
        if (viewingOwnerId === host.id && viewingState === row.id) {
          setViewingOwnerId(row.scopeOwnerId ?? host.id);
          setViewingState(row.scopeId ?? null);
        }
        setViewingByOwner((prev) => (prev[host.id] !== row.id ? prev : { ...prev, [host.id]: null }));
      },
    };
  }
  const schemaProps = buildPropsRecord(componentProps);
  const previewPropScope = buildPropsRecord(applyTestValues(componentProps, {
    ...testData?.props,
    ...previewPropEdits,
  }));
  const previewQueryScope = buildPropsRecord(applyTestValues(pageQuery, {
    ...testData?.query,
    ...previewQueryEdits,
  }));
  const previewDataOverrides = previewDataEdits && Object.keys(previewDataEdits).length > 0
    ? { ...testData?.data, ...previewDataEdits }
    : testData?.data;
  const previewDataScope = resolvePageData(
    pageData,
    previewDataOverrides,
    schemaProps,
    previewPropScope,
    previewQueryScope,
  );
  return (
    <Card
      size="small"
      className="editor-canvas-card"
      tabList={[
        { key: 'layout', tab: t('lowcode.tabLayout') },
        { key: 'data', tab: t('lowcode.tabData') },
        { key: 'events', tab: t('lowcode.tabEvents') },
        { key: 'methods', tab: t('lowcode.tabMethods') },
        { key: 'animation', tab: t('lowcode.tabAnimation') },
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
        <div className="canvas-head-extra">
          <Segmented
            size="small"
            value={mode}
            onChange={(value) => {
              const next = value as CanvasMode;
              if (next === modeRef.current) {
                return;
              }
              // 先盖上 settling，等页面把相机和预览同步完再揭开，避免切换瞬间闪一帧旧布局。
              settleGenRef.current += 1;
              canvasSettlingRef.current = true;
              setCanvasSettling(true);
              setMode(next);
            }}
            options={[
              { label: t('lowcode.modeEdit'), value: 'edit' },
              { label: t('lowcode.modePreview'), value: 'preview' },
            ]}
          />
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
        </div>
      }
    >
      <div className="canvas-card-body">
        {/* 切走布局页时只隐藏，保留 iframe，避免预览重新加载。 */}
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
              componentMode ? 'is-component' : '',
              canvasSettling ? 'is-settling' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={onCanvasPointerDown}
            onMouseDown={onCanvasMouseDown}
          >
            {previewing ? (
              <aside
                className={scopeCardOpen ? 'preview-scope-card' : 'preview-scope-card is-collapsed'}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="preview-scope-card-title">
                  <span>{t('lowcode.tabData')}</span>
                  <Button
                    size="small"
                    type="text"
                    className="preview-scope-card-toggle"
                    icon={scopeCardOpen ? <CaretDownOutlined /> : <CaretRightOutlined />}
                    aria-label={t(scopeCardOpen ? 'lowcode.dataCardCollapse' : 'lowcode.dataCardExpand')}
                    title={t(scopeCardOpen ? 'lowcode.dataCardCollapse' : 'lowcode.dataCardExpand')}
                    onClick={() => setScopeCardOpen((open) => !open)}
                  />
                </div>
                <div className="preview-scope-card-body">
                {componentMode ? (
                  <PreviewScopeSection
                    title={t('lowcode.propsTitle')}
                    empty={t('lowcode.propsEmpty')}
                    dataScope={previewDataScope}
                    propScope={previewPropScope}
                    queryScope={previewQueryScope}
                    rows={componentProps.map((prop) => ({
                      name: prop.name,
                      type: prop.type,
                      typeLabel: typeLabel(prop.type, prop.of),
                      value: previewPropScope[prop.name],
                      source: previewPropEdits?.[prop.name] ?? testData?.props?.[prop.name] ?? prop.value,
                      display: formatActual(prop.type, previewPropScope[prop.name]),
                    }))}
                    onCommit={(name, type, text) => commitPreviewTest('props', name, type, text)}
                  />
                ) : (
                  <PreviewScopeSection
                    title={t('lowcode.propsTitle')}
                    empty={t('lowcode.propsEmpty')}
                    dataScope={previewDataScope}
                    propScope={previewPropScope}
                    queryScope={previewQueryScope}
                    addLabel={t('lowcode.propsAdd')}
                    onAdd={readOnly ? undefined : addPageQuery}
                    rows={pageQuery.map((item) => ({
                      name: item.name,
                      type: item.type,
                      typeLabel: typeLabel(item.type, item.of),
                      value: previewQueryScope[item.name],
                      source: previewQueryEdits?.[item.name] ?? testData?.query?.[item.name] ?? item.value,
                      display: formatActual(item.type, previewQueryScope[item.name]),
                    }))}
                    onCommit={(name, type, text) => commitPreviewTest('query', name, type, text)}
                  />
                )}
                <PreviewScopeSection
                  title={t('lowcode.dataSection')}
                  empty={t('lowcode.dataEmpty')}
                  dataScope={previewDataScope}
                  propScope={previewPropScope}
                  queryScope={previewQueryScope}
                  rows={pageData.map((variable) => ({
                    name: variable.name,
                    type: variable.type,
                    typeLabel: typeLabel(variable.type, variable.of),
                    value: previewDataScope[variable.name],
                    source: previewDataEdits?.[variable.name] ?? testData?.data?.[variable.name] ?? variable.value,
                    display: formatActual(variable.type, previewDataScope[variable.name]),
                    readOnly: Boolean(variable.computed),
                  }))}
                  onCommit={(name, type, text) => commitPreviewTest('data', name, type, text)}
                />
                {previewSlot ? (
                  <PreviewScopeSection
                    title={`${t('lowcode.slotParamsTitle')} · ${previewSlot.name}`}
                    empty={t('lowcode.slotsParamsEmpty')}
                    dataScope={previewDataScope}
                    propScope={previewPropScope}
                    queryScope={previewQueryScope}
                    rows={previewSlot.params.map((param) => ({
                      name: param.name,
                      type: param.type,
                      typeLabel: typeLabel(param.type, param.of),
                      value: previewSlot.values[param.name],
                      display: formatActual(param.type, previewSlot.values[param.name]),
                      readOnly: true,
                    }))}
                    onCommit={() => false}
                  />
                ) : null}
                </div>
              </aside>
            ) : null}
            {canvasSettling ? (
              <div className="canvas-settle" aria-busy="true">
                <Spin />
                <span>{t('lowcode.canvasLoading')}</span>
              </div>
            ) : null}
            <div ref={phoneScreenRef} className="phone-screen">
              <iframe
                ref={iframeRef}
                className="preview-frame"
                title={t('lowcode.preview')}
                src="/preview"
                scrolling="no"
                onLoad={() => {
                  // 预览页若还没回 ready，延迟再推一次草稿，补上首屏没收到的那次。
                  window.setTimeout(() => {
                    if (!readyRef.current) {
                      sendPreview();
                    }
                  }, 300);
                }}
              />
            </div>
            <div
              ref={phoneFrameRef}
              className={['phone-page-frame', !previewing && tableEditId ? 'is-table-editing' : '', !previewing && scrollEditId ? 'is-scroll-editing' : '', !previewing && swiperEditId ? 'is-swiper-editing' : '', !previewing && componentEditId ? 'is-component-editing' : '']
                .filter(Boolean)
                .join(' ')}
            />
            {showStyleChrome && selectedCanvasLabel ? (
              <div className="canvas-selection-label" title={selectedCanvasLabel}>
                {selectedCanvasLabel}
              </div>
            ) : null}
            {showStyleChrome ? (
              <div
                className="widget-style-bubble-host"
                onPointerDown={(event) => {
                  // 点气泡时结束未完成的间距拖拽，并拦住事件，避免画布把它当成平移或取消选中。
                  if (spacingDragRef.current) {
                    spacingDragRef.current = null;
                    setSpacingDragCursor(null, null);
                    syncSelectChrome();
                  }
                  event.stopPropagation();
                }}
              >
                {bubbleWidget ? (
                  <WidgetStyleBubble
                    widget={bubbleWidget}
                    style={bubbleWidget.style}
                    ownKeys={rangeWidget ? undefined : (selectedOwnKeys ?? undefined)}
                    i18nCatalog={pageI18n}
                    projectId={projectId}
                    variables={pageData}
                    componentProps={componentMode ? componentProps : []}
                    slotProps={slotProps}
                    scriptEmits={componentMode ? componentEmits : undefined}
                    listenEmits={
                      bubbleWidget.type === 'component' ? componentEmitsById[bubbleWidget.componentId] : undefined
                    }
                    disabled={readOnly}
                    openGroup={openBoxGroup}
                    onOpenGroupChange={handleOpenBoxGroupChange}
                    table={tableBubble}
                    onTableLines={
                      bubbleWidget.type === 'table'
                        ? (lines) => updateWidget(bubbleWidget.id, { lines }, `edit:${bubbleWidget.id}:lines`)
                        : undefined
                    }
                    onStyleDelta={
                      rangeWidget
                        ? (delta) => {
                            const next = patchTableCellStyles(widgetsRef.current, tableStyleIds, delta);
                            if (next !== widgetsRef.current) {
                              const rangeKey = activeRange
                                ? `${activeRange.kind}:${activeRange.tableId}:${'index' in activeRange ? activeRange.index : 'rowId' in activeRange ? activeRange.rowId : 'header'}`
                                : 'range';
                              commitWidgets(next, selectedWidgetIdRef.current, `edit:table-style:${rangeKey}`);
                            }
                          }
                        : undefined
                    }
                    onChange={(nextStyle) =>
                      updateWidget(bubbleWidget.id, { style: nextStyle }, `edit:${bubbleWidget.id}:style`)
                    }
                    onSrcChange={
                      bubbleWidget.type === 'image' || bubbleWidget.type === 'icon'
                        ? (src) => updateWidget(bubbleWidget.id, { src }, `edit:${bubbleWidget.id}:src`)
                        : undefined
                    }
                    onTextChange={
                      bubbleWidget.type === 'text' ||
                      bubbleWidget.type === 'button' ||
                      bubbleWidget.type === 'checkbox' ||
                      (bubbleWidget.type === 'input' && !bubbleWidget.modelValue?.trim()) ||
                      ((bubbleWidget.type === 'th' || bubbleWidget.type === 'td') && !rangeWidget)
                        ? (text) =>
                            updateWidget(
                              bubbleWidget.id,
                              bubbleWidget.type === 'button' || bubbleWidget.type === 'checkbox' ? { text } : { value: text },
                              `edit:${bubbleWidget.id}:${bubbleWidget.type === 'button' || bubbleWidget.type === 'checkbox' ? 'text' : 'value'}`,
                            )
                        : undefined
                    }
                    onLoopChange={
                      bubbleWidget.type === 'drawer'
                        ? undefined
                        : (loop) => updateWidget(bubbleWidget.id, { loop }, `loop:${bubbleWidget.id}`)
                    }
                    onPlaceChange={
                      bubbleWidget.type === 'drawer'
                        ? (place) => {
                            const from = bubbleWidget.place ?? DEFAULT_DRAWER_PLACE;
                            updateWidget(
                              bubbleWidget.id,
                              {
                                place: place === DEFAULT_DRAWER_PLACE ? undefined : place,
                                style: drawerStyleForPlace(bubbleWidget.style, from, place),
                              },
                              `edit:${bubbleWidget.id}:place`,
                            );
                          }
                        : undefined
                    }
                    onEventsChange={(events) =>
                      updateWidget(bubbleWidget.id, { events }, `events:${bubbleWidget.id}`)
                    }
                    onPresenceChange={
                      bubbleWidget.type === 'drawer'
                        ? undefined
                        : (presence) => updateWidget(bubbleWidget.id, { presence }, `presence:${bubbleWidget.id}`)
                    }
                    onFlexChange={
                      bubbleWidget.type === 'flex'
                        ? (flex) => updateWidget(bubbleWidget.id, { flex }, `edit:${bubbleWidget.id}:flex`)
                        : undefined
                    }
                    onGridChange={
                      bubbleWidget.type === 'grid'
                        ? (grid) => updateWidget(bubbleWidget.id, { grid }, `edit:${bubbleWidget.id}:grid`)
                        : undefined
                    }
                    onScrollChange={
                      bubbleWidget.type === 'scroll'
                        ? (axis, enabled) =>
                            updateWidget(bubbleWidget.id, { [axis]: enabled }, `edit:${bubbleWidget.id}:${axis}`)
                        : undefined
                    }
                    onSizeChange={
                      bubbleWidget.type === 'switch' || bubbleWidget.type === 'icon'
                        ? (size) => updateWidget(bubbleWidget.id, { size }, `edit:${bubbleWidget.id}:size`)
                        : undefined
                    }
                    animations={animations}
                    onAnimationChange={(animation) =>
                      updateWidget(bubbleWidget.id, { animation }, `edit:${bubbleWidget.id}:animation`)
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
                  // 没有可编样式时只留设置按钮（组件定义态再加「调整大小」）。这里强制浅色，不跟检查器的深色主题走。
                  <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
                    <div className="widget-style-bubble is-minimal">
                      {componentMode && onComponentDesignSizeChange ? (
                        <ComponentDesignSizeTool
                          size={designSize}
                          disabled={readOnly}
                          onChange={onComponentDesignSizeChange}
                        />
                      ) : null}
                      <Tooltip title={selectedWidget ? t('lowcode.widgetInspector') : t('lowcode.pageInspector')}>
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
          {componentGlobalWidget ? (
            <WidgetStateFnModal
              open={componentStateFnOpen}
              widget={componentGlobalWidget}
              variables={pageData}
              props={componentProps}
              slotProps={slotProps}
              disabled={readOnly}
              onCancel={() => setComponentStateFnOpen(false)}
              onChange={(stateFn, hoverStateId) => {
                onComponentGlobalStateFnChange(stateFn, hoverStateId);
                setComponentStateFnOpen(false);
              }}
            />
          ) : null}
          {stateHostWidget ? (
            <WidgetStateFnModal
              open={nodeStateFnOpen}
              widget={stateHostWidget}
              variables={pageData}
              props={componentProps}
              slotProps={slotProps}
              disabled={readOnly}
              onCancel={() => setNodeStateFnOpen(false)}
              onChange={(stateFn, hoverStateId) => {
                updateWidget(stateHostWidget.id, { stateFn, hoverStateId }, `stateFn:${stateHostWidget.id}`);
                setNodeStateFnOpen(false);
              }}
            />
          ) : null}
          {showStyleChrome && !readOnly && (nodeStateBarVisible || Boolean(globalStateBarWidget)) ? (
            <div className="canvas-float-panels">
              {nodeStateBarVisible || globalStateBarWidget ? (
                <div className="canvas-state-bar">
                  {nodeStateBarVisible ? (
                    <WidgetStateList
                      title={t('lowcode.controlStates')}
                      titleExtra={
                        stateHostWidget && !(Boolean(componentEditId) && componentEditSelectionKind !== 'content') ? (
                          <Tooltip title={t('lowcode.styleState')}>
                            <Button
                              size="small"
                              type="text"
                              icon={<ControlOutlined />}
                              onClick={() => setNodeStateFnOpen(true)}
                            />
                          </Tooltip>
                        ) : null
                      }
                      items={visibleStates}
                      viewing={viewingByOwner}
                      activeKey={nodeActiveKey}
                      usedIds={stateUsedIds}
                      readOnly={Boolean(componentEditId) && componentEditSelectionKind !== 'content'}
                      onSelect={handleStateSelect}
                      {...stateListHandlers(stateHostWidget)}
                    />
                  ) : null}
                  {globalStateBarWidget && nodeStateBarVisible ? <div className="canvas-state-bar-split" /> : null}
                  {globalStateBarWidget ? (
                    <WidgetStateList
                      title={t('lowcode.globalStates')}
                      titleExtra={
                        componentGlobalWidget ? (
                          <Tooltip title={t('lowcode.styleState')}>
                            <Button
                              size="small"
                              type="text"
                              icon={<ControlOutlined />}
                              onClick={() => setComponentStateFnOpen(true)}
                            />
                          </Tooltip>
                        ) : null
                      }
                      items={globalVisibleStates}
                      viewing={viewingByOwner}
                      activeKey={globalActiveKey}
                      usedIds={globalStateUsedIds}
                      onSelect={handleStateSelect}
                      {...stateListHandlers(globalStateBarWidget)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {showSlotUsePanel ? (
            <div
              className="canvas-slot-debug-panel"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="canvas-slot-debug-panel-title">{t('lowcode.slotUsePanelTitle')}</div>
              {slotUseSlots.map((slot) => {
                const active = slot.id === slotUseActiveId;
                return (
                  <div
                    key={slot.id}
                    className={active ? 'canvas-slot-debug-row is-active' : 'canvas-slot-debug-row'}
                  >
                    <span className="canvas-slot-debug-name" title={slot.name}>
                      {slot.name}
                    </span>
                    <Button
                      size="small"
                      type={active ? 'primary' : 'default'}
                      onClick={() => onToggleSlotUse(slot.id)}
                    >
                      {t(active ? 'lowcode.slotUseExit' : 'lowcode.slotUseEnter')}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
          {showSlotDebugPanel ? (
            <div
              className="canvas-slot-debug-panel"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="canvas-slot-debug-panel-title">{t('lowcode.slotDebugPanelTitle')}</div>
              {slotDebugSlots.map((slot) => {
                const active = slot.id === slotDebugId;
                return (
                  <div
                    key={slot.id}
                    className={active ? 'canvas-slot-debug-row is-active' : 'canvas-slot-debug-row'}
                  >
                    <span className="canvas-slot-debug-name" title={slot.name}>
                      {slot.name}
                    </span>
                    <Button
                      size="small"
                      type={active ? 'primary' : 'default'}
                      onClick={() => onToggleSlotDebug(slot.id)}
                    >
                      {t(active ? 'lowcode.slotDebugExit' : 'lowcode.slotDebugEnter')}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="canvas-toolbar">
            <Button size="small" icon={<ZoomOutOutlined />} onClick={() => zoomBy(1 / ZOOM_STEP)} />
            <Typography.Text ref={zoomLabelRef} className="canvas-zoom">
              {Math.round(view.scale * 100)}%
            </Typography.Text>
            <Button size="small" icon={<ZoomInOutlined />} onClick={() => zoomBy(ZOOM_STEP)} />
            <Button
              size="small"
              icon={<ExpandOutlined />}
              onClick={() => {
                fitCanvas(false);
              }}
            >
              {t('lowcode.canvasReset')}
            </Button>
          </div>
        </div>
        {centerTab === 'data' ? (
          <div className="page-data-stack is-split">
            {componentMode ? (
              <ComponentPropsPanel
                props={componentProps}
                namespaces={namespaces}
                disabled={readOnly}
                collapsed={!dataSectionOpen.contract}
                onToggleCollapse={() => toggleDataSection('contract')}
                collapseIcon={dataSectionOpen.contract ? <DownOutlined /> : <RightOutlined />}
                onChange={commitComponentProps}
                onEndCoalesce={endCoalesce}
              />
            ) : (
              <ComponentPropsPanel
                variant="query"
                props={pageQuery}
                disabled={readOnly}
                collapsed={!dataSectionOpen.contract}
                onToggleCollapse={() => toggleDataSection('contract')}
                collapseIcon={dataSectionOpen.contract ? <DownOutlined /> : <RightOutlined />}
                onChange={commitPageQuery}
                onEndCoalesce={endCoalesce}
              />
            )}
            <div className="page-section-split" />
            <PageDataPanel
              variables={pageData}
              widgets={widgets}
              propNames={componentMode ? componentProps.map((item) => item.name) : []}
              queryNames={componentMode ? [] : pageQuery.map((item) => item.name)}
              componentProps={componentMode ? componentProps : []}
              namespaces={namespaces}
              sectionTitle={t('lowcode.dataSection')}
              disabled={readOnly}
              collapsed={!dataSectionOpen.variables}
              onToggleCollapse={() => toggleDataSection('variables')}
              collapseIcon={dataSectionOpen.variables ? <DownOutlined /> : <RightOutlined />}
              onChange={commitPageData}
              onEndCoalesce={endCoalesce}
            />
            <div className="page-section-split" />
            <NamespaceTypesSection
              projectId={projectId}
              disabled={readOnly}
              collapsed={!dataSectionOpen.types}
              onToggleCollapse={() => toggleDataSection('types')}
              collapseIcon={dataSectionOpen.types ? <DownOutlined /> : <RightOutlined />}
            />
          </div>
        ) : null}
        {centerTab === 'events' ? (
          <div className={['page-events-panel', componentMode ? 'is-split' : ''].filter(Boolean).join(' ')}>
            {componentMode ? (
              <ComponentEmitsPanel emits={componentEmits} disabled={readOnly} onChange={commitComponentEmits} />
            ) : null}
            {componentMode ? <div className="page-section-split" /> : null}
            <WidgetEventPanel
              specs={PAGE_EVENT_SPECS}
              events={pageEvents}
              scopeKey={pageScopeId}
              projectId={projectId}
              sectionTitle={componentMode ? t('lowcode.pageEventsTitle') : undefined}
              emits={componentMode ? componentEmits : undefined}
              disabled={readOnly}
              onChange={commitPageEvents}
            />
            {pageEvents || componentMode ? null : (
              <div className="page-events-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.eventsEmpty')} />
              </div>
            )}
          </div>
        ) : null}
        {centerTab === 'methods' ? (
          <PageMethodPanel
            methods={pageMethods}
            projectId={projectId}
            disabled={readOnly}
            showExpose={componentMode}
            dataNames={pageData.map((item) => item.name)}
            propNames={componentMode ? componentProps.map((item) => item.name) : []}
            onChange={commitPageMethods}
          />
        ) : null}
        {centerTab === 'animation' ? (
          <AnimationPanel
            animations={animations}
            disabled={readOnly}
            onCreate={onCreateAnimation}
            onUpdate={onUpdateAnimation}
            onDelete={onDeleteAnimation}
          />
        ) : null}
      </div>
    </Card>
  );
}
