import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, InputNumber, Modal, Select, Switch, Table, Tree, Typography, message } from 'antd';
import type { TableColumnsType } from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageDataType, PageVariable, PageWidget } from '@vanstack/xml';
import {
  PAGE_DATA_TYPE_OPTIONS,
  buildPageDataScope,
  canMoveVariable,
  defaultPageDataValue,
  isJsIdentifier,
  isWidgetDrag,
  moveVariable,
  nextVariableName,
  parseReturnExpression,
  readWidgetDragId,
  validateDataLiteral,
} from '../utils/pageData';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';
import { findWidget, toWidgetTreeData, widgetTreeLabel } from '../utils/widgetTree';

type PageDataPanelProps = {
  variables: PageVariable[];
  widgets: PageWidget[];
  disabled?: boolean;
  onChange: (next: PageVariable[], coalesceKey?: string) => void;
  onEndCoalesce: () => void;
};

export function PageDataPanel({ variables, widgets, disabled, onChange, onEndCoalesce }: PageDataPanelProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ index: number; type: 'arr' | 'obj' } | null>(null);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('return []');
  const draggingFromRef = useRef<number | null>(null);

  const editingVariable = editing ? variables[editing.index] : null;
  const pickingVariable = pickingIndex != null ? variables[pickingIndex] : null;
  const knownNames = useMemo(
    () => (editing ? variables.slice(0, editing.index).map((variable) => variable.name) : []),
    [variables, editing],
  );
  const editorExtensions = useMemo(
    () => createPageDataEditorExtensions(knownNames, t('lowcode.dataUnknownRef')),
    [knownNames, t],
  );
  const typeOptions = useMemo(
    () =>
      PAGE_DATA_TYPE_OPTIONS.map((option) =>
        option.value === 'widget' ? { ...option, label: t('lowcode.dataTypeWidget') } : option,
      ),
    [t],
  );
  const widgetTreeData = useMemo(
    () => toWidgetTreeData(widgets, (widget) => widgetTreeLabel(widget, t)),
    [widgets, t],
  );

  useEffect(() => {
    if (!editingVariable || (editingVariable.type !== 'arr' && editingVariable.type !== 'obj')) {
      return;
    }
    setDraft(`return ${editingVariable.value || defaultPageDataValue(editingVariable.type)}`);
  }, [editingVariable]);

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

  function changeType(index: number, type: PageDataType) {
    const current = variables[index];
    if (!current || current.type === type) {
      return;
    }
    const next = variables.map((variable, i) =>
      i === index
        ? {
            ...variable,
            type,
            value: defaultPageDataValue(type),
          }
        : variable,
    );
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
    const expr = parseReturnExpression(draft);
    const scope = buildPageDataScope(variables, editing.index);
    if (!expr || !validateDataLiteral(expr, editing.type, scope)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    changeValue(editing.index, expr, false);
    setEditing(null);
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
        width: 118,
        render: (type: PageDataType, _record: PageVariable, index: number) => (
          <Select
            size="small"
            value={type}
            disabled={disabled}
            options={typeOptions}
            onChange={(value) => changeType(index, value)}
            style={{ width: '100%' }}
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
          if (record.type === 'str') {
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
                onClick={() => setEditing({ index, type: record.type === 'obj' ? 'obj' : 'arr' })}
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
        <Button size="small" type="primary" icon={<PlusOutlined />} disabled={disabled} onClick={addVariable}>
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
        onCancel={() => setEditing(null)}
        onOk={confirmLiteral}
        okButtonProps={{ disabled: disabled || !editingVariable }}
        destroyOnHidden
      >
        {editingVariable ? (
          <div className="page-data-code">
            <pre className="page-data-code-line">{`function ${editingVariable.name}(){`}</pre>
            <CodeMirror
              value={draft}
              height="180px"
              theme={oneDark}
              extensions={editorExtensions}
              basicSetup={{ lineNumbers: false, foldGutter: false, autocompletion: false }}
              onChange={setDraft}
            />
            <pre className="page-data-code-line">{'}'}</pre>
            <Typography.Text type="secondary" className="page-data-hint">
              {t('lowcode.dataScopeHint')}
            </Typography.Text>
          </div>
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
