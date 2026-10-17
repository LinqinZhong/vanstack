import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Select, Switch, Table, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  METHOD_PARAM_TYPES,
  defaultPageDataValue,
  isJsIdentifier,
  isPageMethodParamName,
  type ComponentEmit,
  type ComponentProp,
  type ComponentPropType,
  type ComponentSlot,
  type MethodParamType,
  type PageMethodParam,
} from '@vanstack/xml';
import { PROP_TYPES, SCALAR_TYPES, TypeKindFields, type NamespaceCatalogEntry } from './TypeKindFields';
import { ValueEditCell, ValueEditor, applyValueResult } from './PropValueEditor';
import { nextSlotName } from '../utils/widgetTree';

type PropsPanelProps = {
  props: ComponentProp[];
  variant?: 'props' | 'query';
  namespaces?: NamespaceCatalogEntry[];
  disabled?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseIcon?: ReactNode;
  onChange: (next: ComponentProp[], coalesceKey?: string) => void;
  onEndCoalesce: () => void;
};

type EmitsPanelProps = {
  emits: ComponentEmit[];
  disabled?: boolean;
  onChange: (next: ComponentEmit[]) => void;
};

type SlotsPanelProps = {
  slots: ComponentSlot[];
  namespaces?: NamespaceCatalogEntry[];
  disabled?: boolean;
  onChange: (next: ComponentSlot[], coalesceKey?: string) => void;
  onEndCoalesce: () => void;
};

export function ComponentSlotsPanel({ slots, namespaces = [], disabled, onChange, onEndCoalesce }: SlotsPanelProps) {
  const { t } = useTranslation();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ComponentProp[]>([]);
  const [editingValueIndex, setEditingValueIndex] = useState<number | null>(null);

  function openParams(index: number) {
    const slot = slots[index];
    if (!slot) {
      return;
    }
    setDraft((slot.params ?? []).map((param) => ({ ...param })));
    setEditingIndex(index);
  }

  function saveParams() {
    if (editingIndex == null) {
      return;
    }
    const params: ComponentProp[] = [];
    const names = new Set<string>();
    for (const row of draft) {
      const name = row.name.trim();
      if (!name || !isJsIdentifier(name) || names.has(name)) {
        message.error(t('lowcode.dataInvalidName'));
        return;
      }
      names.add(name);
      params.push({ ...row, name });
    }
    onChange(
      slots.map((item, index) => (index === editingIndex ? { ...item, ...(params.length > 0 ? { params } : { params: undefined }) } : item)),
    );
    setEditingIndex(null);
  }

  function patchDraft(index: number, next: ComponentProp) {
    setDraft((current) => current.map((item, i) => (i === index ? next : item)));
  }

  const paramColumns: TableColumnsType<ComponentProp> = [
    {
      title: t('lowcode.propsName'),
      dataIndex: 'name',
      width: 120,
      render: (name: string, _record, index) => (
        <Input
          size="small"
          value={name}
          disabled={disabled}
          onChange={(event) => patchDraft(index, { ...draft[index], name: event.target.value })}
        />
      ),
    },
    {
      title: t('lowcode.dataDesc'),
      dataIndex: 'desc',
      width: 120,
      render: (desc: string | undefined, _record, index) => (
        <Input
          size="small"
          value={desc ?? ''}
          disabled={disabled}
          onChange={(event) => patchDraft(index, { ...draft[index], desc: event.target.value })}
        />
      ),
    },
    {
      title: t('lowcode.dataType'),
      dataIndex: 'type',
      width: 200,
      render: (type: ComponentPropType, record, index) => (
        <TypeKindFields
          type={type}
          of={record.of}
          allow={PROP_TYPES}
          namespaces={namespaces}
          disabled={disabled}
          onChange={(next) => {
            if (next.type === 'widget') {
              return;
            }
            const { of: _of, ...rest } = record;
            patchDraft(index, {
              ...rest,
              type: next.type,
              ...(next.of ? { of: next.of } : {}),
              ...(next.reset ? { value: defaultPageDataValue(next.type) } : {}),
            });
          }}
        />
      ),
    },
    {
      title: t('lowcode.dataValue'),
      dataIndex: 'value',
      width: 160,
      render: (value: string, record, index) => (
        <ValueEditCell
          preview={record.type === 'bool' ? (value === '1' ? 'true' : 'false') : value}
          disabled={disabled}
          onEdit={() => setEditingValueIndex(index)}
        />
      ),
    },
    {
      title: t('lowcode.actions'),
      width: 48,
      render: (_value, _record, index) => (
        <Button
          size="small"
          type="text"
          danger
          disabled={disabled}
          icon={<DeleteOutlined />}
          onClick={() => setDraft((current) => current.filter((_, i) => i !== index))}
        />
      ),
    },
  ];

  const columns: TableColumnsType<ComponentSlot> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 120,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#999' }}>{id}</span>
      ),
    },
    {
      title: t('lowcode.slotName'),
      dataIndex: 'name',
      render: (name: string | undefined, record, index) => (
        <Input
          size="small"
          disabled={disabled}
          value={name ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(
              slots.map((item, i) => {
                if (i !== index) {
                  return item;
                }
                const { name: _ignored, ...rest } = item;
                return raw.trim() ? { ...rest, name: raw } : rest;
              }),
              `slots:${record.id}:name`,
            );
          }}
          onBlur={onEndCoalesce}
        />
      ),
    },
    {
      title: t('lowcode.slotsParams'),
      dataIndex: 'params',
      width: 240,
      ellipsis: true,
      render: (params: ComponentProp[] | undefined) =>
        (params ?? []).map((param) => `${param.name}: ${param.type}`).join(', ') || '—',
    },
    {
      title: t('lowcode.actions'),
      width: 88,
      render: (_value, _record, index) => (
        <div className="page-method-actions">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            disabled={disabled}
            aria-label={t('lowcode.slotsEditParams')}
            onClick={() => openParams(index)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            aria-label={t('lowcode.delete')}
            onClick={() => onChange(slots.filter((_, i) => i !== index))}
          />
        </div>
      ),
    },
  ];

  return (
    <section className="component-contract">
      <div className="page-data-toolbar">
        <span className="component-contract-title">{t('lowcode.slotsTitle')}</span>
        <span className="component-contract-hint">{t('lowcode.slotsHint')}</span>
        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={disabled}
          onClick={() => onChange([...slots, { id: generateSlotId(), name: nextSlotName(slots.map((s) => s.name ?? '')) }])}
        >
          {t('lowcode.slotsAdd')}
        </Button>
      </div>
      <div className="page-data-table-wrap">
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          columns={columns}
          dataSource={slots}
          locale={{ emptyText: <span className="component-contract-empty">{t('lowcode.slotsEmpty')}</span> }}
        />
      </div>
      <Modal
        title={t('lowcode.slotsEditParams')}
        open={editingIndex != null}
        onCancel={() => setEditingIndex(null)}
        onOk={saveParams}
        destroyOnHidden
        width={640}
      >
        <Table
          size="small"
          rowKey={(_, index) => String(index)}
          pagination={false}
          columns={paramColumns}
          dataSource={draft}
          locale={{ emptyText: <span className="component-contract-empty">{t('lowcode.slotsParamsEmpty')}</span> }}
        />
        <Button
          size="small"
          icon={<PlusOutlined />}
          style={{ marginTop: 8 }}
          onClick={() =>
            setDraft((current) => [
              ...current,
              { type: 'str', name: nextPropName(current, 'param'), value: defaultPageDataValue('str') },
            ])
          }
        >
          {t('lowcode.slotsAddParam')}
        </Button>
      </Modal>
      <ValueEditor
        open={editingValueIndex != null}
        type={draft[editingValueIndex ?? -1]?.type ?? 'str'}
        of={draft[editingValueIndex ?? -1]?.of}
        name={draft[editingValueIndex ?? -1]?.name}
        value={draft[editingValueIndex ?? -1]?.value ?? ''}
        dynamic={draft[editingValueIndex ?? -1]?.dynamic}
        computed={draft[editingValueIndex ?? -1]?.computed}
        disabled={disabled}
        onCancel={() => setEditingValueIndex(null)}
        onConfirm={(next) => {
          const target = editingValueIndex;
          if (target == null) {
            return;
          }
          setDraft((current) => current.map((item, i) => (i === target ? applyValueResult(item, next) : item)));
          setEditingValueIndex(null);
        }}
      />
    </section>
  );
}

function generateSlotId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 's';
  for (let i = 0; i < 10; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function nextPropName<T extends { name: string }>(props: T[], prefix: string) {
  const used = new Set(props.map((item) => item.name));
  let index = props.length + 1;
  let name = `${prefix}${index}`;
  while (used.has(name)) {
    index += 1;
    name = `${prefix}${index}`;
  }
  return name;
}

export function ComponentPropsPanel({
  props,
  variant = 'props',
  namespaces = [],
  disabled,
  collapsed,
  onToggleCollapse,
  collapseIcon,
  onChange,
  onEndCoalesce,
}: PropsPanelProps) {
  const { t } = useTranslation();
  const [editingValueIndex, setEditingValueIndex] = useState<number | null>(null);
  const typeAllow = variant === 'query' ? SCALAR_TYPES : PROP_TYPES;

  function rename(index: number, nextName: string) {
    const name = nextName.trim();
    const current = props[index];
    if (!current || name === current.name) {
      return true;
    }
    if (!isJsIdentifier(name)) {
      message.error(t('lowcode.dataInvalidName'));
      return false;
    }
    if (props.some((item, i) => i !== index && item.name === name)) {
      message.error(t('lowcode.dataDuplicateName'));
      return false;
    }
    onChange(
      props.map((item, i) => (i === index ? { ...item, name } : item)),
      `${variant}:${current.name}:name`,
    );
    return true;
  }

  function patch(index: number, next: ComponentProp, coalesceKey?: string) {
    onChange(
      props.map((item, i) => (i === index ? next : item)),
      coalesceKey,
    );
  }

  const columns: TableColumnsType<ComponentProp> = [
    {
      title: t('lowcode.propsName'),
      dataIndex: 'name',
      width: 120,
      render: (name: string, _record, index) => (
        <Input
          size="small"
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
      width: variant === 'query' ? 120 : 220,
      render: (type: ComponentPropType, record, index) => (
        <TypeKindFields
          type={type}
          of={record.of}
          allow={typeAllow}
          namespaces={variant === 'query' ? [] : namespaces}
          disabled={disabled}
          onChange={(next) => {
            if (next.type === 'widget') {
              return;
            }
            const { of: _of, ...rest } = record;
            patch(index, {
              ...rest,
              type: next.type,
              ...(next.of ? { of: next.of } : {}),
              ...(next.reset ? { value: defaultPageDataValue(next.type) } : {}),
            });
          }}
        />
      ),
    },
    {
      title: t('lowcode.dataDesc'),
      dataIndex: 'desc',
      render: (desc: string | undefined, record, index) => (
        <Input
          size="small"
          disabled={disabled}
          value={desc ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            const { desc: _ignored, ...rest } = record;
            patch(index, raw.trim() ? { ...rest, desc: raw } : rest, `${variant}:${record.name}:desc`);
          }}
          onBlur={onEndCoalesce}
        />
      ),
    },
    ...(variant === 'props'
      ? [
          {
            title: t('lowcode.propsRequired'),
            dataIndex: 'required',
            width: 72,
            render: (required: boolean | undefined, record: ComponentProp, index: number) => (
              <Switch
                size="small"
                disabled={disabled}
                checked={Boolean(required)}
                onChange={(checked) =>
                  patch(index, { ...record, ...(checked ? { required: true } : { required: undefined }) })
                }
              />
            ),
          } satisfies TableColumnsType<ComponentProp>[number],
        ]
      : []),
    {
      title: t('lowcode.dataValue'),
      dataIndex: 'value',
      width: 140,
      render: (value: string, record, index) => (
        <ValueEditCell
          preview={record.type === 'bool' ? (value === '1' ? 'true' : 'false') : value}
          disabled={disabled}
          onEdit={() => setEditingValueIndex(index)}
        />
      ),
    },
    ...(variant === 'props'
      ? [
          {
            title: t('lowcode.propsBind'),
            dataIndex: 'bind',
            width: 96,
            render: (bind: boolean | undefined, record: ComponentProp, index: number) => (
              <Switch
                size="small"
                disabled={disabled}
                checked={Boolean(bind)}
                onChange={(checked) => patch(index, { ...record, ...(checked ? { bind: true } : { bind: undefined }) })}
              />
            ),
          } satisfies TableColumnsType<ComponentProp>[number],
        ]
      : []),
    {
      title: t('lowcode.delete'),
      width: 64,
      render: (_value, _record, index) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={disabled}
          aria-label={t('lowcode.delete')}
          onClick={() => onChange(props.filter((_, i) => i !== index))}
        />
      ),
    },
  ];

  return (
    <section className="component-contract">
      <div className="page-data-toolbar">
        <span className="page-data-head-title">
          {onToggleCollapse ? (
            <Button size="small" type="text" className="page-data-collapse-btn" icon={collapseIcon} onClick={onToggleCollapse} />
          ) : null}
          <span className="component-contract-title">{t('lowcode.propsTitle')}</span>
        </span>
        <span className="component-contract-hint">
          {t(variant === 'query' ? 'lowcode.queryHint' : 'lowcode.propsHint')}
        </span>
        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={disabled}
          onClick={() =>
            onChange([
              ...props,
              {
                type: 'str',
                name: nextPropName(props, variant === 'query' ? 'query' : 'prop'),
                value: defaultPageDataValue('str'),
              },
            ])
          }
        >
          {t('lowcode.propsAdd')}
        </Button>
      </div>
      {collapsed ? null : (
        <div className="page-data-table-wrap">
          <Table
            size="small"
            rowKey="name"
            pagination={false}
            columns={columns}
            dataSource={props}
            locale={{ emptyText: <span className="component-contract-empty">{t('lowcode.propsEmpty')}</span> }}
          />
        </div>
      )}
      <ValueEditor
        open={editingValueIndex != null}
        type={props[editingValueIndex ?? -1]?.type ?? 'str'}
        of={props[editingValueIndex ?? -1]?.of}
        name={props[editingValueIndex ?? -1]?.name}
        value={props[editingValueIndex ?? -1]?.value ?? ''}
        dynamic={props[editingValueIndex ?? -1]?.dynamic}
        computed={props[editingValueIndex ?? -1]?.computed}
        disabled={disabled}
        allowDynamic={variant === 'query'}
        onCancel={() => setEditingValueIndex(null)}
        onConfirm={(next) => {
          const target = editingValueIndex;
          if (target == null) {
            return;
          }
          patch(target, applyValueResult(props[target], next));
          setEditingValueIndex(null);
        }}
      />
    </section>
  );
}

type ParamDraft = { key: string; name: string; type: MethodParamType };

export function ComponentEmitsPanel({ emits, disabled, onChange }: EmitsPanelProps) {
  const { t } = useTranslation();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [params, setParams] = useState<ParamDraft[]>([]);
  const typeOptions = useMemo(
    () => METHOD_PARAM_TYPES.map((type) => ({ value: type, label: t(`lowcode.methodType.${type}`) })),
    [t],
  );

  function rename(index: number, nextName: string) {
    const name = nextName.trim();
    const current = emits[index];
    if (!current || name === current.name) {
      return true;
    }
    if (!isJsIdentifier(name)) {
      message.error(t('lowcode.dataInvalidName'));
      return false;
    }
    if (emits.some((item, i) => i !== index && item.name === name)) {
      message.error(t('lowcode.dataDuplicateName'));
      return false;
    }
    onChange(emits.map((item, i) => (i === index ? { ...item, name } : item)));
    return true;
  }

  function openParams(index: number) {
    const emit = emits[index];
    if (!emit) {
      return;
    }
    setParams(emit.params.map((param) => ({ key: crypto.randomUUID(), name: param.name, type: param.type })));
    setEditingIndex(index);
  }

  function saveParams() {
    if (editingIndex == null) {
      return;
    }
    const next: PageMethodParam[] = [];
    const names = new Set<string>();
    for (const row of params) {
      const name = row.name.trim();
      if (!isPageMethodParamName(name) || names.has(name)) {
        message.error(t('lowcode.methodInvalidParam'));
        return;
      }
      names.add(name);
      next.push({ name, type: row.type });
    }
    onChange(emits.map((item, index) => (index === editingIndex ? { ...item, params: next } : item)));
    setEditingIndex(null);
  }

  const columns: TableColumnsType<ComponentEmit> = [
    {
      title: t('lowcode.emitsName'),
      dataIndex: 'name',
      width: 180,
      render: (name: string, _record, index) => (
        <Input
          size="small"
          defaultValue={name}
          key={name}
          disabled={disabled}
          onBlur={(event) => {
            if (!rename(index, event.target.value)) {
              event.target.value = name;
            }
          }}
          onPressEnter={(event) => (event.target as HTMLInputElement).blur()}
        />
      ),
    },
    {
      title: t('lowcode.dataDesc'),
      dataIndex: 'desc',
      render: (desc: string | undefined, record, index) => (
        <Input
          size="small"
          disabled={disabled}
          value={desc ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            const { desc: _ignored, ...rest } = record;
            onChange(emits.map((item, i) => (i === index ? (raw.trim() ? { ...rest, desc: raw } : rest) : item)));
          }}
        />
      ),
    },
    {
      title: t('lowcode.emitsParams'),
      dataIndex: 'params',
      width: 220,
      ellipsis: true,
      render: (rows: PageMethodParam[]) => rows.map((param) => `${param.name}: ${param.type}`).join(', ') || '—',
    },
    {
      title: t('lowcode.actions'),
      width: 88,
      render: (_value, _record, index) => (
        <div className="page-method-actions">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            disabled={disabled}
            aria-label={t('lowcode.emitsEditParams')}
            onClick={() => openParams(index)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            aria-label={t('lowcode.delete')}
            onClick={() => onChange(emits.filter((_, i) => i !== index))}
          />
        </div>
      ),
    },
  ];

  return (
    <section className="component-contract">
      <div className="page-data-toolbar">
        <span className="component-contract-title">{t('lowcode.emitsTitle')}</span>
        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={disabled}
          onClick={() => {
            const used = new Set(emits.map((item) => item.name));
            let index = emits.length + 1;
            let name = `onEvent${index}`;
            while (used.has(name)) {
              index += 1;
              name = `onEvent${index}`;
            }
            onChange([...emits, { name, params: [] }]);
          }}
        >
          {t('lowcode.emitsAdd')}
        </Button>
      </div>
      <div className="page-data-table-wrap">
        <Table
          size="small"
          rowKey="name"
          pagination={false}
          columns={columns}
          dataSource={emits}
          locale={{ emptyText: <span className="component-contract-empty">{t('lowcode.emitsEmpty')}</span> }}
        />
      </div>
      <Modal
        title={t('lowcode.emitsEditParams')}
        open={editingIndex != null}
        onCancel={() => setEditingIndex(null)}
        onOk={saveParams}
        destroyOnHidden
      >
        <div className="page-method-params">
          {params.map((row) => (
            <div key={row.key} className="page-method-param-row">
              <Input
                value={row.name}
                placeholder={t('lowcode.methodParamName')}
                disabled={disabled}
                onChange={(event) =>
                  setParams((current) =>
                    current.map((item) => (item.key === row.key ? { ...item, name: event.target.value } : item)),
                  )
                }
              />
              <Select
                value={row.type}
                options={typeOptions}
                disabled={disabled}
                onChange={(type: MethodParamType) =>
                  setParams((current) => current.map((item) => (item.key === row.key ? { ...item, type } : item)))
                }
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => setParams((current) => current.filter((item) => item.key !== row.key))}
              />
            </div>
          ))}
          <Button
            size="small"
            icon={<PlusOutlined />}
            disabled={disabled}
            onClick={() => setParams((current) => [...current, { key: crypto.randomUUID(), name: '', type: 'string' }])}
          >
            {t('lowcode.methodAddParam')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
