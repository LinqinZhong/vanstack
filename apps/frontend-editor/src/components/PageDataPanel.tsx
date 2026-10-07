import { DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, InputNumber, Modal, Segmented, Switch, Table, Tree, Typography, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { ScriptEditor } from './ScriptEditor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildPropsRecord, type ComponentProp, type PageDataType, type PageVariable, type PageWidget } from '@vanstack/xml';
import { DATA_TYPES, formatTypeLabel, TypeKindFields, type NamespaceCatalogEntry } from './TypeKindFields';
import {
  buildPageDataScope,
  canMoveVariable,
  defaultPageDataValue,
  evaluateDataExpression,
  isDataExpression,
  isJsIdentifier,
  isWidgetDrag,
  moveVariable,
  nextVariableName,
  dataEditorDraft,
  dataEditorStored,
  readWidgetDragId,
  validateDataLiteral,
} from '../utils/pageData';
import { formatDataLiteral, parseDataLiteral, tryParseDataLiteral } from '../utils/dataLiteral';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';
import { findWidget, toWidgetTreeData, widgetTreeLabel } from '../utils/widgetTree';

type PageDataPanelProps = {
  variables: PageVariable[];
  widgets: PageWidget[];
  propNames?: string[];
  queryNames?: string[];
  componentProps?: ComponentProp[];
  namespaces?: NamespaceCatalogEntry[];
  sectionTitle?: string;
  disabled?: boolean;
  onChange: (next: PageVariable[], coalesceKey?: string) => void;
  onEndCoalesce: () => void;
};

export function PageDataPanel({
  variables,
  widgets,
  propNames = [],
  queryNames = [],
  componentProps = [],
  namespaces = [],
  sectionTitle,
  disabled,
  onChange,
  onEndCoalesce,
}: PageDataPanelProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ index: number; type: 'arr' | 'obj' } | null>(null);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('return []');
  const [draftItems, setDraftItems] = useState<unknown[] | null>(null);
  const [valueKind, setValueKind] = useState<'static' | 'dynamic'>('static');
  const [reactive, setReactive] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [itemEditor, setItemEditor] = useState<{ kind: 'item' | 'add'; index?: number; draft: string } | null>(null);
  const [bulkDraft, setBulkDraft] = useState<string | null>(null);
  const draggingFromRef = useRef<number | null>(null);

  const editingVariable = editing ? variables[editing.index] : null;
  const pickingVariable = pickingIndex != null ? variables[pickingIndex] : null;
  const knownNames = useMemo(
    () => (editing ? variables.slice(0, editing.index).map((variable) => variable.name) : []),
    [variables, editing],
  );
  const editorExtensions = useMemo(
    () => createPageDataEditorExtensions(knownNames, t('lowcode.dataUnknownRef'), propNames, queryNames),
    [knownNames, propNames, queryNames, t],
  );
  const widgetTreeData = useMemo(
    () => toWidgetTreeData(widgets, (widget) => widgetTreeLabel(widget, t)),
    [widgets, t],
  );

  const editingKey = editingVariable
    ? `${editing?.index}:${editingVariable.name}:${editingVariable.type}:${editingVariable.dynamic ? 1 : 0}:${editingVariable.computed ? 1 : 0}`
    : '';

  function prepareEditor(variable: PageVariable, index: number) {
    const dynamic = isDynamicVariable(variable, variables, componentProps, index);
    setValueKind(dynamic ? 'dynamic' : 'static');
    setReactive(Boolean(variable.computed));
    setDirty(false);
    setItemEditor(null);
    setBulkDraft(null);
    setItemsExpanded(false);
    if (!dynamic && variable.type === 'arr') {
      const parsed = tryParseDataLiteral(variable.value);
      setDraftItems(Array.isArray(parsed) ? parsed : (readArrayItems(variable.value, variables, componentProps, index) ?? []));
      return;
    }
    setDraftItems(null);
    if (!dynamic && variable.type === 'obj') {
      const parsed = tryParseDataLiteral(variable.value);
      setDraft(prettyJson(isPlainRecord(parsed) ? parsed : (readObjectValue(variable.value, variables, componentProps, index) ?? {})));
      return;
    }
    setDraft(dataEditorDraft(variable.value, defaultPageDataValue(variable.type)));
  }

  useEffect(() => {
    if (!editing || !editingVariable || (editingVariable.type !== 'arr' && editingVariable.type !== 'obj')) {
      setDraftItems(null);
      setItemEditor(null);
      setBulkDraft(null);
      return;
    }
    prepareEditor(editingVariable, editing.index);
    // 只在打开或换一条变量时重读，编辑过程中不跟着草稿回写。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingKey]);

  useEffect(() => {
    if (pickingIndex == null) {
      return;
    }
    const variable = variables[pickingIndex];
    if (!variable || variable.type !== 'widget') {
      setPickingIndex(null);
      setPickedId(null);
    }
  }, [pickingIndex, variables]);

  function addVariable() {
    if (disabled) {
      return;
    }
    onChange([
      ...variables,
      { type: 'num', name: nextVariableName(variables), value: defaultPageDataValue('num') },
    ]);
  }

  function rename(index: number, nextName: string) {
    const name = nextName.trim();
    const current = variables[index];
    if (!current || name === current.name) {
      return true;
    }
    if (!isJsIdentifier(name)) {
      message.error(t('lowcode.dataInvalidName'));
      return false;
    }
    if (variables.some((variable, i) => i !== index && variable.name === name)) {
      message.error(t('lowcode.dataDuplicateName'));
      return false;
    }
    const next = variables.map((variable, i) => (i === index ? { ...variable, name } : variable));
    onChange(next, `data:${current.name}:name`);
    return true;
  }

  function changeType(index: number, nextType: PageDataType, of: string | undefined, reset: boolean) {
    const current = variables[index];
    if (!current || (current.type === nextType && (current.of ?? '') === (of ?? '') && !reset)) {
      return;
    }
    const next = variables.map((variable, i) => {
      if (i !== index) {
        return variable;
      }
      const { computed: _computed, dynamic: _dynamic, of: _of, ...rest } = variable;
      const keepMode = nextType === 'arr' || nextType === 'obj';
      return {
        ...rest,
        type: nextType,
        ...(of ? { of } : {}),
        ...(reset ? { value: defaultPageDataValue(nextType) } : {}),
        ...(keepMode && variable.dynamic ? { dynamic: true } : {}),
        ...(keepMode && variable.computed ? { computed: true } : {}),
      };
    });
    onChange(next);
  }

  function changeDesc(index: number, raw: string) {
    const current = variables[index];
    if (!current) {
      return;
    }
    const currentDesc = current.desc ?? '';
    if (currentDesc === raw) {
      return;
    }
    const next = variables.map((variable, i) => {
      if (i !== index) {
        return variable;
      }
      const { desc: _ignored, ...rest } = variable;
      return raw.trim() ? { ...rest, desc: raw } : rest;
    });
    onChange(next, `data:${current.name}:desc`);
  }

  function changeValue(index: number, value: string, coalesce = true) {
    const current = variables[index];
    if (!current || current.value === value) {
      return;
    }
    const next = variables.map((variable, i) => (i === index ? { ...variable, value } : variable));
    onChange(next, coalesce ? `data:${current.name}:value` : undefined);
  }

  function remove(index: number) {
    onChange(variables.filter((_, i) => i !== index));
  }

  function confirmLiteral() {
    if (!editing || !editingVariable) {
      return;
    }
    if (!dirty) {
      setEditing(null);
      return;
    }
    if (valueKind === 'static') {
      if (editing.type === 'arr') {
        const text = stringifyItems(draftItems ?? []);
        if (text == null) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        commitEditing(text, 'static');
        return;
      }
      try {
        const value = parseDataLiteral(draft);
        if (!isPlainRecord(value)) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        commitEditing(formatDataLiteral(value), 'static');
      } catch {
        message.error(t('lowcode.dataInvalidLiteral'));
      }
      return;
    }
    const expr = dataEditorStored(draft);
    const props = buildPropsRecord(componentProps);
    const scope = buildPageDataScope(variables, editing.index, props);
    if (!expr || !validateDataLiteral(expr, editing.type, scope, props)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    commitEditing(expr, 'dynamic');
  }

  function commitEditing(value: string, mode: 'static' | 'dynamic') {
    if (!editing) {
      return;
    }
    const current = variables[editing.index];
    if (!current) {
      return;
    }
    const { computed: _computed, dynamic: _dynamic, ...rest } = current;
    const next = variables.map((item, index) =>
      index === editing.index
        ? {
            ...rest,
            value,
            ...(mode === 'dynamic' ? { dynamic: true } : {}),
            ...(mode === 'dynamic' && reactive ? { computed: true } : {}),
          }
        : item,
    );
    onChange(next);
    setEditing(null);
  }

  function switchValueKind(next: 'static' | 'dynamic') {
    if (!editing || !editingVariable || next === valueKind) {
      return;
    }
    if (next === 'dynamic') {
      const source =
        editing.type === 'arr' ? stringifyItems(draftItems ?? []) ?? '[]' : draft.trim() || '{}';
      setDraft(dataEditorDraft(source, defaultPageDataValue(editing.type)));
      setValueKind('dynamic');
      setDirty(true);
      return;
    }
    const expr = dataEditorStored(draft);
    const props = buildPropsRecord(componentProps);
    const scope = buildPageDataScope(variables, editing.index, props);
    const parsed = expr ? tryParseDataLiteral(expr) : undefined;
    if (editing.type === 'arr' && Array.isArray(parsed)) {
      setDraftItems(parsed);
      setReactive(false);
      setValueKind('static');
      setDirty(true);
      return;
    }
    if (editing.type === 'obj' && isPlainRecord(parsed)) {
      setDraft(prettyJson(parsed));
      setReactive(false);
      setValueKind('static');
      setDirty(true);
      return;
    }
    if (!expr || !validateDataLiteral(expr, editing.type, scope, props)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    try {
      const value = evaluateDataExpression(expr, scope, props);
      if (editing.type === 'arr') {
        if (!Array.isArray(value)) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        setDraftItems(value);
      } else {
        if (!isPlainRecord(value)) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        setDraft(prettyJson(value));
      }
    } catch {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    setReactive(false);
    setValueKind('static');
    setDirty(true);
  }

  function confirmItemEditor() {
    if (!editing || !itemEditor || !draftItems) {
      return;
    }
    const props = buildPropsRecord(componentProps);
    const scope = buildPageDataScope(variables, editing.index, props);
    let value = tryParseDataLiteral(itemEditor.draft);
    if (value === undefined && itemEditor.draft.trim() !== '') {
      try {
        value = evaluateDataExpression(itemEditor.draft, scope, props);
      } catch {
        message.error(t('lowcode.dataInvalidLiteral'));
        return;
      }
    }
    if (value === undefined && itemEditor.draft.trim() === '') {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    setDraftItems(
      itemEditor.kind === 'add'
        ? [...draftItems, value]
        : draftItems.map((item, index) => (index === itemEditor.index ? value : item)),
    );
    setDirty(true);
    setItemEditor(null);
  }

  function openBulkEditor() {
    if (!draftItems) {
      return;
    }
    setBulkDraft(prettyJson(draftItems));
  }

  function confirmBulkEditor() {
    if (bulkDraft == null) {
      return;
    }
    const value = tryParseDataLiteral(bulkDraft);
    if (!Array.isArray(value)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    setDraftItems(value);
    setDirty(true);
    setBulkDraft(null);
  }

  function confirmWidgetPick() {
    if (pickingIndex == null || pickingVariable?.type !== 'widget') {
      return;
    }
    changeValue(pickingIndex, pickedId ?? '', false);
    setPickingIndex(null);
    setPickedId(null);
  }

  function widgetValueLabel(value: string) {
    if (!value) {
      return t('lowcode.dataWidgetEmpty');
    }
    const widget = findWidget(widgets, value);
    if (!widget) {
      return t('lowcode.dataWidgetMissing', { id: value });
    }
    return widgetTreeLabel(widget, t);
  }

  const columns: TableColumnsType<PageVariable> = [
      {
        key: 'drag',
        width: 36,
        render: (_: unknown, __: PageVariable, index: number) => (
          <span
            className={disabled ? 'page-data-handle is-disabled' : 'page-data-handle'}
            draggable={!disabled}
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', String(index));
              draggingFromRef.current = index;
            }}
            onDragEnd={() => {
              draggingFromRef.current = null;
            }}
          >
            <HolderOutlined />
          </span>
        ),
      },
      {
        title: t('lowcode.dataName'),
        dataIndex: 'name',
        width: 108,
        ellipsis: true,
        onCell: () => ({ className: 'page-data-name-cell' }),
        render: (name: string, _record: PageVariable, index: number) => (
          <Input
            size="small"
            className="page-data-name-input"
            defaultValue={name}
            key={name}
            disabled={disabled}
            onBlur={(event) => {
              if (!rename(index, event.target.value)) {
                event.target.value = name;
              }
              onEndCoalesce();
            }}
            onPressEnter={(event) => (event.target as HTMLInputElement).blur()}
          />
        ),
      },
      {
        title: t('lowcode.dataType'),
        dataIndex: 'type',
        width: 220,
        render: (type: PageDataType, record: PageVariable, index: number) => (
          <TypeKindFields
            type={type}
            of={record.of}
            allow={DATA_TYPES}
            namespaces={namespaces}
            disabled={disabled}
            onChange={(next) => changeType(index, next.type, next.of, next.reset)}
          />
        ),
      },
      {
        title: t('lowcode.dataDesc', { defaultValue: t('lowcode.description') }),
        dataIndex: 'desc',
        ellipsis: true,
        onCell: () => ({ className: 'page-data-desc-cell' }),
        render: (desc: string | undefined, _record: PageVariable, index: number) => (
          <Input
            size="small"
            className="page-data-desc-input"
            disabled={disabled}
            value={desc ?? ''}
            title={desc}
            onChange={(event) => changeDesc(index, event.target.value)}
            onBlur={onEndCoalesce}
            onPressEnter={(event) => (event.target as HTMLInputElement).blur()}
          />
        ),
      },
      {
        title: t('lowcode.dataValue'),
        dataIndex: 'value',
        ellipsis: true,
        onCell: () => ({ className: 'page-data-value-cell' }),
        render: (value: string, record: PageVariable, index: number) => {
          if (record.type === 'num') {
            return (
              <InputNumber
                size="small"
                className="page-data-value-input"
                disabled={disabled}
                value={Number(value)}
                onChange={(next) => changeValue(index, String(next ?? 0))}
                onBlur={onEndCoalesce}
              />
            );
          }
          if (record.type === 'str' || record.type === 'icon' || record.type === 'image') {
            return (
              <Input
                size="small"
                className="page-data-value-input"
                disabled={disabled}
                value={value}
                title={value}
                onChange={(event) => changeValue(index, event.target.value)}
                onBlur={onEndCoalesce}
              />
            );
          }
          if (record.type === 'bool') {
            return (
              <Switch
                size="small"
                disabled={disabled}
                checked={value === '1'}
                onChange={(checked) => changeValue(index, checked ? '1' : '0', false)}
              />
            );
          }
          if (record.type === 'widget') {
            const label = widgetValueLabel(value);
            return (
              <div className="page-data-value-row">
                <Typography.Text
                  ellipsis={{ tooltip: label }}
                  className={value ? 'page-data-preview' : 'page-data-preview is-empty'}
                >
                  {label}
                </Typography.Text>
                <Button size="small" disabled={disabled} onClick={() => {
                  setPickingIndex(index);
                  setPickedId(value || null);
                }}>
                  {t('lowcode.dataWidgetPick')}
                </Button>
                <Button size="small" disabled={disabled || !value} onClick={() => changeValue(index, '', false)}>
                  {t('lowcode.dataWidgetClear')}
                </Button>
              </div>
            );
          }
          return (
            <div className="page-data-value-row">
              <Typography.Text ellipsis={{ tooltip: value }} className="page-data-preview">
                {value}
              </Typography.Text>
              <Button
                size="small"
                disabled={disabled}
                onClick={() => {
                  const type = record.type === 'obj' ? 'obj' : 'arr';
                  setEditing({ index, type });
                  prepareEditor(record, index);
                }}
              >
                {t('lowcode.dataEditValue')}
              </Button>
            </div>
          );
        },
      },
      {
        key: 'actions',
        width: 40,
        render: (_: unknown, __: PageVariable, index: number) => (
          <Button
            size="small"
            type="text"
            danger
            disabled={disabled}
            icon={<DeleteOutlined />}
            onClick={() => remove(index)}
          />
        ),
      },
    ];

  return (
    <div
      className="page-data-panel"
      onDragOver={(event) => {
        if (!disabled) {
          event.preventDefault();
        }
      }}
    >
      <div className="page-data-toolbar">
        {sectionTitle ? <span className="component-contract-title">{sectionTitle}</span> : null}
        <Button size="small" icon={<PlusOutlined />} disabled={disabled} onClick={addVariable}>
          {t('lowcode.dataAdd')}
        </Button>
      </div>
      <div className="page-data-table-wrap">
      <Table
        size="small"
        rowKey={(record) => record.name}
        pagination={false}
        tableLayout="fixed"
        dataSource={variables}
        columns={columns}
        locale={{ emptyText: t('lowcode.dataEmpty') }}
        onRow={(record, index) => ({
          className: record.type === 'widget' ? 'page-data-widget-row' : undefined,
          onDragOver: (event) => {
            if (disabled || index == null) {
              return;
            }
            if (isWidgetDrag(event.dataTransfer)) {
              if (record.type === 'widget') {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              } else {
                event.dataTransfer.dropEffect = 'none';
              }
              return;
            }
            const from = draggingFromRef.current;
            if (from == null) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = canMoveVariable(variables, from, index) ? 'move' : 'none';
          },
          onDrop: (event) => {
            if (disabled || index == null) {
              return;
            }
            event.preventDefault();
            const widgetId = readWidgetDragId(event.dataTransfer);
            if (widgetId) {
              draggingFromRef.current = null;
              if (record.type === 'widget') {
                changeValue(index, widgetId, false);
              }
              return;
            }
            const from = draggingFromRef.current;
            draggingFromRef.current = null;
            if (from == null) {
              return;
            }
            if (!canMoveVariable(variables, from, index)) {
              message.error(t('lowcode.dataInvalidOrder'));
              return;
            }
            const next = moveVariable(variables, from, index);
            if (next !== variables) {
              onChange(next);
            }
          },
        })}
      />
      </div>
      <Modal
        title={t('lowcode.dataEditValue')}
        open={Boolean(editingVariable)}
        onCancel={() => {
          setEditing(null);
          setItemEditor(null);
          setBulkDraft(null);
        }}
        onOk={confirmLiteral}
        okButtonProps={{ disabled: disabled || !editingVariable }}
        destroyOnHidden
        width={760}
      >
        {editingVariable ? (
          <>
            <div className="page-data-value-options">
              <label className="page-data-value-option">
                <span>{t('lowcode.dataValueKind')}</span>
                <Segmented
                  size="small"
                  value={valueKind}
                  options={[
                    { label: t('lowcode.dataValueStatic'), value: 'static' },
                    { label: t('lowcode.dataValueDynamic'), value: 'dynamic' },
                  ]}
                  onChange={(next) => switchValueKind(next === 'dynamic' ? 'dynamic' : 'static')}
                />
              </label>
              {valueKind === 'dynamic' ? (
                <label className="page-data-value-option">
                  <span>{t('lowcode.dataValueReactive')}</span>
                  <Switch
                    size="small"
                    disabled={disabled}
                    checked={reactive}
                    title={t('lowcode.dataComputedHint')}
                    onChange={(checked) => {
                      setReactive(checked);
                      setDirty(true);
                    }}
                  />
                </label>
              ) : null}
            </div>
            {valueKind === 'static' && editingVariable.type === 'arr' && draftItems ? (
              <ArrayValueEditor
                name={editingVariable.name}
                typeLabel={formatTypeLabel(editingVariable.type, editingVariable.of, (key) => t(`lowcode.propType.${key}`, { defaultValue: key }))}
                items={draftItems}
                expanded={itemsExpanded}
                disabled={disabled}
                onToggle={() => setItemsExpanded((current) => !current)}
                onEdit={(index) =>
                  setItemEditor({ kind: 'item', index, draft: prettyJson(draftItems[index]) })
                }
                onDelete={(index) => {
                  setDraftItems(draftItems.filter((_, itemIndex) => itemIndex !== index));
                  setDirty(true);
                }}
                onAdd={() => setItemEditor({ kind: 'add', draft: 'null' })}
                onEditAll={openBulkEditor}
              />
            ) : valueKind === 'static' ? (
              <ScriptEditor
                value={draft}
                height="240px"
                extensions={editorExtensions}
                editable={!disabled}
                onChange={(next) => {
                  setDraft(next);
                  setDirty(true);
                }}
              />
            ) : (
              <>
                <ScriptEditor
                  value={draft}
                  height="240px"
                  prefix={`function ${editingVariable.name}(){`}
                  suffix="}"
                  extensions={editorExtensions}
                  editable={!disabled}
                  onChange={(next) => {
                    setDraft(next);
                    setDirty(true);
                  }}
                />
                <Typography.Text type="secondary" className="page-data-hint">
                  {reactive ? t('lowcode.dataComputedHint') : t('lowcode.dataScopeHint')}
                </Typography.Text>
              </>
            )}
          </>
        ) : null}
      </Modal>
      <Modal
        title="JSON"
        open={bulkDraft != null}
        onCancel={() => setBulkDraft(null)}
        onOk={confirmBulkEditor}
        okButtonProps={{ disabled: disabled || bulkDraft == null }}
        destroyOnHidden
        width={640}
      >
        {bulkDraft != null ? (
          <ScriptEditor value={bulkDraft} height="240px" extensions={editorExtensions} editable={!disabled} onChange={setBulkDraft} />
        ) : null}
      </Modal>
      <Modal
        title={itemEditor?.kind === 'add' ? t('lowcode.previewAddItem') : t('lowcode.previewEditItem')}
        open={Boolean(itemEditor)}
        onCancel={() => setItemEditor(null)}
        onOk={confirmItemEditor}
        okButtonProps={{ disabled: disabled || !itemEditor }}
        destroyOnHidden
        width={640}
      >
        {itemEditor ? (
          <ScriptEditor
            value={itemEditor.draft}
            height="240px"
            extensions={editorExtensions}
            editable={!disabled}
            onChange={(next) => setItemEditor((current) => (current ? { ...current, draft: next } : current))}
          />
        ) : null}
      </Modal>
      <Modal
        title={t('lowcode.dataWidgetPickTitle')}
        open={Boolean(pickingVariable)}
        onCancel={() => {
          setPickingIndex(null);
          setPickedId(null);
        }}
        onOk={confirmWidgetPick}
        okButtonProps={{ disabled: disabled || !pickingVariable }}
        destroyOnHidden
      >
        {widgets.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.emptyWidgets')} />
        ) : (
          <Tree
            className="page-data-widget-picker"
            blockNode
            defaultExpandAll
            selectedKeys={pickedId ? [pickedId] : []}
            treeData={widgetTreeData}
            onSelect={(keys) => {
              if (keys[0]) {
                setPickedId(String(keys[0]));
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ArrayValueEditor({
  name,
  typeLabel,
  items,
  expanded,
  disabled,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onEditAll,
}: {
  name: string;
  typeLabel: string;
  items: unknown[];
  expanded: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
  onEditAll: () => void;
}) {
  const { t } = useTranslation();
  const canFold = items.length > 5;
  const folded = canFold && !expanded;
  const shown = folded ? items.slice(0, 3) : items;
  return (
    <div className="preview-scope-row">
      <div className="preview-scope-name">
        <span>{name}</span>
        <span className="preview-scope-type">{typeLabel}</span>
        <Button
          size="small"
          type="text"
          className="preview-scope-name-action"
          icon={<EditOutlined />}
          disabled={disabled}
          aria-label={t('lowcode.edit')}
          title={t('lowcode.edit')}
          onClick={onEditAll}
        />
      </div>
      <div className="preview-scope-items">
        {shown.map((item, index) => {
          const text = compactJson(item);
          return (
            <div key={`${name}:${index}:${text}`} className="preview-scope-item">
              <span className="preview-scope-literal-text" title={text}>
                {text}
              </span>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                disabled={disabled}
                aria-label={t('lowcode.edit')}
                title={t('lowcode.edit')}
                onClick={() => onEdit(index)}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
                aria-label={t('lowcode.delete')}
                title={t('lowcode.delete')}
                onClick={() => onDelete(index)}
              />
            </div>
          );
        })}
        {canFold ? (
          <Button size="small" type="text" className="preview-scope-fold" onClick={onToggle}>
            {folded
              ? t('lowcode.previewExpandItems', { count: items.length - 3 })
              : t('lowcode.previewCollapseItems')}
          </Button>
        ) : null}
        <Button
          size="small"
          type="text"
          className="preview-scope-add"
          icon={<PlusOutlined />}
          disabled={disabled}
          aria-label={t('lowcode.previewAddItem')}
          title={t('lowcode.previewAddItem')}
          onClick={onAdd}
        />
      </div>
    </div>
  );
}

function stringifyItems(items: unknown[]): string | null {
  try {
    return formatDataLiteral(items);
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDynamicVariable(
  variable: PageVariable,
  variables: PageVariable[],
  componentProps: ComponentProp[],
  index: number,
): boolean {
  if (variable.dynamic || variable.computed) {
    return true;
  }
  const trimmed = variable.value.trim();
  if (!trimmed || (variable.type !== 'arr' && variable.type !== 'obj')) {
    return false;
  }
  const parsed = tryParseDataLiteral(trimmed);
  if (variable.type === 'arr' && Array.isArray(parsed)) {
    return false;
  }
  if (variable.type === 'obj' && isPlainRecord(parsed)) {
    return false;
  }
  if (!isDataExpression(trimmed)) {
    return true;
  }
  const props = buildPropsRecord(componentProps);
  const scope = buildPageDataScope(variables, index, props);
  try {
    const value = evaluateDataExpression(trimmed, scope, props);
    return variable.type === 'arr' ? !Array.isArray(value) : !isPlainRecord(value);
  } catch {
    return true;
  }
}

function readObjectValue(
  value: string,
  variables: PageVariable[],
  componentProps: ComponentProp[],
  index: number,
): Record<string, unknown> | null {
  const props = buildPropsRecord(componentProps);
  const scope = buildPageDataScope(variables, index, props);
  try {
    const result = evaluateDataExpression(value.trim() || '{}', scope, props);
    return isPlainRecord(result) ? result : null;
  } catch {
    return null;
  }
}

function readArrayItems(
  value: string,
  variables: PageVariable[],
  componentProps: ComponentProp[],
  index: number,
): unknown[] | null {
  const props = buildPropsRecord(componentProps);
  const scope = buildPageDataScope(variables, index, props);
  try {
    const result = evaluateDataExpression(value.trim() || '[]', scope, props);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
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
