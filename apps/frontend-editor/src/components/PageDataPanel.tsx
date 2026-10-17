import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Table, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type ComponentProp, type PageDataType, type PageVariable, type PageWidget } from '@vanstack/xml';
import { DATA_TYPES, TypeKindFields, type NamespaceCatalogEntry } from './TypeKindFields';
import { ValueEditCell, ValueEditor, type ValueEditorResult } from './PropValueEditor';
import {
  canMoveVariable,
  defaultPageDataValue,
  isJsIdentifier,
  isWidgetDrag,
  moveVariable,
  nextVariableName,
  readWidgetDragId,
} from '../utils/pageData';
import { findWidget, widgetTreeLabel } from '../utils/widgetTree';

type PageDataPanelProps = {
  variables: PageVariable[];
  widgets: PageWidget[];
  propNames?: string[];
  queryNames?: string[];
  componentProps?: ComponentProp[];
  namespaces?: NamespaceCatalogEntry[];
  sectionTitle?: string;
  disabled?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseIcon?: ReactNode;
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
  collapsed,
  onToggleCollapse,
  collapseIcon,
  onChange,
  onEndCoalesce,
}: PageDataPanelProps) {
  const { t } = useTranslation();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const draggingFromRef = useRef<number | null>(null);

  const editingVariable = editingIndex != null ? variables[editingIndex] : null;

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
      return {
        ...rest,
        type: nextType,
        ...(of ? { of } : {}),
        ...(reset ? { value: defaultPageDataValue(nextType) } : {}),
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

  function changeValue(index: number, value: string) {
    const current = variables[index];
    if (!current || current.value === value) {
      return;
    }
    const next = variables.map((variable, i) => (i === index ? { ...variable, value } : variable));
    onChange(next);
  }

  function commitValue(index: number, next: ValueEditorResult) {
    const current = variables[index];
    if (!current) {
      return;
    }
    const { computed: _computed, dynamic: _dynamic, ...rest } = current;
    onChange(
      variables.map((variable, i) =>
        i === index
          ? {
              ...rest,
              value: next.value,
              ...(next.dynamic ? { dynamic: true } : {}),
              ...(next.dynamic && next.computed ? { computed: true } : {}),
            }
          : variable,
      ),
    );
  }

  function remove(index: number) {
    onChange(variables.filter((_, i) => i !== index));
  }

  function widgetValueLabel(value: string): string {
    if (!value) {
      return t('lowcode.dataWidgetEmpty');
    }
    const widget = findWidget(widgets, value);
    return widget ? widgetTreeLabel(widget, t) : t('lowcode.dataWidgetMissing', { id: value });
  }

  function valuePreview(record: PageVariable): string {
    if (record.type === 'widget') {
      return widgetValueLabel(record.value);
    }
    if (record.type === 'bool') {
      return record.value === '1' ? 'true' : 'false';
    }
    return record.value;
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
        render: (_value: string, record: PageVariable, index: number) => (
          <ValueEditCell preview={valuePreview(record)} disabled={disabled} onEdit={() => setEditingIndex(index)} />
        ),
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
        {sectionTitle ? (
          <span className="page-data-head-title">
            {onToggleCollapse ? (
              <Button size="small" type="text" className="page-data-collapse-btn" icon={collapseIcon} onClick={onToggleCollapse} />
            ) : null}
            <span className="component-contract-title">{sectionTitle}</span>
          </span>
        ) : null}
        <Button size="small" icon={<PlusOutlined />} disabled={disabled} onClick={addVariable}>
          {t('lowcode.dataAdd')}
        </Button>
      </div>
      {collapsed ? null : (
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
                    changeValue(index, widgetId);
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
      )}
      <ValueEditor
        open={editingVariable != null}
        type={editingVariable?.type ?? 'str'}
        of={editingVariable?.of}
        name={editingVariable?.name}
        value={editingVariable?.value ?? ''}
        dynamic={editingVariable?.dynamic}
        computed={editingVariable?.computed}
        disabled={disabled}
        variables={variables}
        index={editingIndex ?? undefined}
        componentProps={componentProps}
        propNames={propNames}
        queryNames={queryNames}
        widgets={widgets}
        onCancel={() => setEditingIndex(null)}
        onConfirm={(next) => {
          if (editingIndex == null) {
            return;
          }
          commitValue(editingIndex, next);
          setEditingIndex(null);
        }}
      />
    </div>
  );
}
