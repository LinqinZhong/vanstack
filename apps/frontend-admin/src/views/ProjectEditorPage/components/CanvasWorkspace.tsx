import { DeleteOutlined, EditOutlined, ExpandOutlined, GlobalOutlined, PlusOutlined, SettingOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { Button, Card, ConfigProvider, Empty, Input, Modal, Segmented, Select, Spin, Switch, Tooltip, Typography, message, theme } from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useEffect, useState, type Dispatch, type MouseEvent, type PointerEvent, type RefObject, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTestValues, buildPropsRecord, evaluateDataExpression, resolvePageData, type ComponentEmit, type ComponentProp, type PageI18n, type PageMethod, type PageTestData, type PageVariable, type PageWidget, type WidgetEvents } from '@vanstack/xml';
import { PAGE_EVENT_SPECS } from '@vanstack/xml';
import { ComponentEmitsPanel, ComponentPropsPanel } from '../../../components/ComponentContractPanel';
import { PageDataPanel } from '../../../components/PageDataPanel';
import { PageMethodPanel } from '../../../components/PageMethodPanel';
import { WidgetEventPanel } from '../../../components/WidgetEventPanel';
import {
  WidgetStyleBubble,
  type BoxGroup,
  type TableBubbleModel,
} from '../../../components/WidgetStyleBubble';
import { WidgetStateList } from '../../../components/WidgetStateList';
import { setSpacingDragCursor } from '../../../utils/spacingGuides';
import { patchTableCellStyles, type TableRange } from '../../../utils/tableEdit';
import { collectTreeStateIds, type WidgetPatch } from '../../../utils/widgetTree';
import {
  createWidgetState,
  deleteWidgetState,
  updateHostTransition,
  updateWidgetState,
  type ViewingByOwner,
  type VisibleWidgetState,
} from '../../../utils/widgetStates';
import { widgetCanvasLabel, ZOOM_STEP, type CanvasMode, type CenterTab, type ViewTransform } from '../helpers';

function formatActual(type: string, value: unknown) {
  if (type === 'bool') {
    return value ? 'true' : 'false';
  }
  if (type === 'num') {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
  }
  if (type === 'str' || type === 'widget') {
    return typeof value === 'string' ? value : '';
  }
  return compactJson(value);
}

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
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
  onCommit,
}: {
  title: string;
  empty: string;
  rows: ScopeRow[];
  dataScope: Record<string, unknown>;
  propScope: Record<string, unknown>;
  onCommit: (name: string, type: string, text: string) => boolean;
}) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<ScopeEditor | null>(null);
  const [openArrays, setOpenArrays] = useState<Record<string, boolean>>({});

  function openValue(row: ScopeRow) {
    const source = row.type === 'arr' || row.type === 'obj' ? prettyJson(row.value) : row.display;
    setEditor({ name: row.name, type: row.type, kind: 'value', draft: source, items: [] });
  }

  function commitItems(name: string, items: unknown[]) {
    let text = '';
    try {
      text = JSON.stringify(items) ?? '';
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
      if (onCommit(editor.name, editor.type, editor.draft)) {
        setEditor(null);
      }
      return;
    }
    let value: unknown;
    try {
      value = evaluateDataExpression(editor.draft, dataScope, propScope);
    } catch {
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
      <div className="preview-scope-section-title">{title}</div>
      {rows.length === 0 ? (
        <div className="preview-scope-empty">{empty}</div>
      ) : (
        <ul className="preview-scope-list">
          {rows.map((row) => {
            const items = row.type === 'arr' && Array.isArray(row.value) ? row.value : [];
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
        okButtonProps={{ disabled: !editor }}
        destroyOnHidden
        width={640}
      >
        {editor ? (
          <CodeMirror
            value={editor.draft}
            height="240px"
            theme="light"
            extensions={[javascript()]}
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
  commitPreviewTest: (section: 'props' | 'data', name: string, type: string, text: string) => boolean;
  componentMode?: boolean;
  componentProps: ComponentProp[];
  componentEmits: ComponentEmit[];
  commitComponentProps: (next: ComponentProp[], coalesceKey?: string) => void;
  commitComponentEmits: (next: ComponentEmit[]) => void;
  pageEvents: WidgetEvents | undefined;
  commitPageEvents: (next: WidgetEvents | undefined) => void;
  pageMethods: PageMethod[];
  commitPageMethods: (next: PageMethod[]) => void;
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
  viewingOwnerId: string | null;
  viewingState: string | null;
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
  commitPreviewTest,
  componentMode,
  componentProps,
  componentEmits,
  commitComponentProps,
  commitComponentEmits,
  pageEvents,
  commitPageEvents,
  pageMethods,
  commitPageMethods,
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
  viewingOwnerId,
  viewingState,
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
  const selectedCanvasLabel = selectedWidget ? widgetCanvasLabel(selectedWidget, t) : null;
  const schemaProps = buildPropsRecord(componentProps);
  const previewPropScope = buildPropsRecord(applyTestValues(componentProps, testData?.props));
  const previewDataOverrides = previewDataEdits && Object.keys(previewDataEdits).length > 0
    ? { ...testData?.data, ...previewDataEdits }
    : testData?.data;
  const previewDataScope = resolvePageData(pageData, previewDataOverrides, schemaProps, previewPropScope);
  return (
    <Card
      size="small"
      className="editor-canvas-card"
      tabList={[
        { key: 'layout', tab: t('lowcode.tabLayout') },
        { key: 'data', tab: t('lowcode.tabData') },
        { key: 'events', tab: t('lowcode.tabEvents') },
        { key: 'methods', tab: t('lowcode.tabMethods') },
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
                className="preview-scope-card"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="preview-scope-card-title">{t('lowcode.tabData')}</div>
                {componentMode ? (
                  <PreviewScopeSection
                    title={t('lowcode.propsTitle')}
                    empty={t('lowcode.propsEmpty')}
                    dataScope={previewDataScope}
                    propScope={previewPropScope}
                    rows={componentProps.map((prop) => ({
                      name: prop.name,
                      type: prop.type,
                      typeLabel: t(`lowcode.propType.${prop.type}`),
                      value: previewPropScope[prop.name],
                      display: formatActual(prop.type, previewPropScope[prop.name]),
                    }))}
                    onCommit={(name, type, text) => commitPreviewTest('props', name, type, text)}
                  />
                ) : null}
                <PreviewScopeSection
                  title={t('lowcode.dataSection')}
                  empty={t('lowcode.dataEmpty')}
                  dataScope={previewDataScope}
                  propScope={previewPropScope}
                  rows={pageData.map((variable) => ({
                    name: variable.name,
                    type: variable.type,
                    typeLabel:
                      variable.type === 'widget'
                        ? t('lowcode.dataTypeWidget')
                        : t(`lowcode.propType.${variable.type}`, { defaultValue: variable.type }),
                    value: previewDataScope[variable.name],
                    display: formatActual(variable.type, previewDataScope[variable.name]),
                    readOnly: Boolean(variable.computed),
                  }))}
                  onCommit={(name, type, text) => commitPreviewTest('data', name, type, text)}
                />
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
              className={['phone-page-frame', !previewing && tableEditId ? 'is-table-editing' : '']
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
                    onLoopChange={(loop) => updateWidget(bubbleWidget.id, { loop }, `loop:${bubbleWidget.id}`)}
                    onEventsChange={(events) =>
                      updateWidget(bubbleWidget.id, { events }, `events:${bubbleWidget.id}`)
                    }
                    onStateFnChange={(stateFn, hoverStateId) =>
                      updateWidget(bubbleWidget.id, { stateFn, hoverStateId }, `stateFn:${bubbleWidget.id}`)
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
                  // 没有可编样式时只留设置按钮。这里强制浅色，不跟检查器的深色主题走。
                  <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
                    <div className="widget-style-bubble">
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
          {showStyleChrome && selectedWidget && !readOnly ? (
            <WidgetStateList
              items={visibleStates}
              viewingOwnerId={viewingOwnerId}
              viewingState={viewingState}
              usedIds={collectTreeStateIds(widgets)}
              onSelect={(row) => {
                // 点到继承来的状态：记下拥有者正在看它，当前控件回到基础外观。
                if (!row.owned && row.id && !row.scopeId) {
                  const inheritedId = row.id;
                  setViewingOwnerId(row.ownerId);
                  setViewingState(inheritedId);
                  setViewingByOwner((prev) => ({
                    ...prev,
                    [row.ownerId]: inheritedId,
                    [selectedWidget.id]: null,
                  }));
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
                  // 回到基础外观时清掉其它拥有者正在看的状态，避免下层仍叠着旧状态。
                  if (row.id == null) {
                    for (const key of Object.keys(next)) {
                      if (key !== row.ownerId) {
                        next[key] = null;
                      }
                    }
                  }
                  return next;
                });
              }}
              onCreate={(id, name, from, transition) => {
                const scopeId = from.scopeId ?? (!from.owned ? from.id : null);
                const scopeOwnerId = from.scopeOwnerId ?? (!from.owned ? from.ownerId : undefined);
                const created = createWidgetState(
                  widgets,
                  selectedWidget.id,
                  id,
                  name,
                  from.id,
                  from.owned && !from.scopeId,
                  transition,
                  scopeId,
                );
                commitWidgets(created, selectedWidgetId);
                setViewingOwnerId(selectedWidget.id);
                setViewingState(id);
                setViewingByOwner((prev) => {
                  const next: ViewingByOwner = { ...prev, [selectedWidget.id]: id };
                  if (scopeId && scopeOwnerId) {
                    next[scopeOwnerId] = scopeId;
                  }
                  return next;
                });
              }}
              onEdit={(from, name, transition) => {
                if (from.id == null) {
                  commitWidgets(updateHostTransition(widgets, selectedWidget.id, transition), selectedWidgetId);
                  return;
                }
                if (!name) {
                  return;
                }
                commitWidgets(
                  updateWidgetState(widgets, selectedWidget.id, from.id, name, transition, from.scopeId),
                  selectedWidgetId,
                );
              }}
              onDelete={(row) => {
                if (!row.id) {
                  return;
                }
                commitWidgets(deleteWidgetState(widgets, selectedWidget.id, row.id, row.scopeId), selectedWidgetId);
                if (viewingOwnerId === selectedWidget.id && viewingState === row.id) {
                  setViewingOwnerId(row.scopeOwnerId ?? selectedWidget.id);
                  setViewingState(row.scopeId ?? null);
                }
                setViewingByOwner((prev) => {
                  if (prev[selectedWidget.id] !== row.id) {
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
          <div className={['page-data-stack', componentMode ? 'is-split' : ''].filter(Boolean).join(' ')}>
            {componentMode ? (
              <ComponentPropsPanel
                props={componentProps}
                disabled={readOnly}
                onChange={commitComponentProps}
                onEndCoalesce={endCoalesce}
              />
            ) : null}
            {componentMode ? <div className="page-section-split" /> : null}
            <PageDataPanel
              variables={pageData}
              widgets={widgets}
              propNames={componentMode ? componentProps.map((item) => item.name) : []}
              componentProps={componentMode ? componentProps : []}
              sectionTitle={componentMode ? t('lowcode.dataSection') : undefined}
              disabled={readOnly}
              onChange={commitPageData}
              onEndCoalesce={endCoalesce}
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
            onChange={commitPageMethods}
          />
        ) : null}
      </div>
    </Card>
  );
}
