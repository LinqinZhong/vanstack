import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Modal, Select, Switch, Table, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  METHOD_PARAM_TYPES,
  defaultPageDataValue,
  isJsIdentifier,
  isPageMethodParamName,
  type ComponentEmit,
  type ComponentProp,
  type ComponentPropType,
  type MethodParamType,
  type PageMethodParam,
} from '@vanstack/xml';
import { PROP_TYPES, SCALAR_TYPES, TypeKindFields, type NamespaceCatalogEntry } from './TypeKindFields';

type PropsPanelProps = {
  props: ComponentProp[];
  variant?: 'props' | 'query';
  namespaces?: NamespaceCatalogEntry[];
  disabled?: boolean;
  onChange: (next: ComponentProp[], coalesceKey?: string) => void;
  onEndCoalesce: () => void;
};

type EmitsPanelProps = {
  emits: ComponentEmit[];
  disabled?: boolean;
  onChange: (next: ComponentEmit[]) => void;
};

function nextPropName(props: ComponentProp[], prefix: string) {
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
  onChange,
  onEndCoalesce,
}: PropsPanelProps) {
  const { t } = useTranslation();
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
      render: (value: string, record, index) => {
        if (record.type === 'num') {
          return (
            <InputNumber
              size="small"
              disabled={disabled}
              value={Number(value)}
              style={{ width: '100%' }}
              onChange={(next) => patch(index, { ...record, value: String(next ?? 0) }, `${variant}:${record.name}:value`)}
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
              onChange={(checked) => patch(index, { ...record, value: checked ? '1' : '0' })}
            />
          );
        }
        return (
          <Input
            size="small"
            disabled={disabled}
            value={value}
            onChange={(event) => patch(index, { ...record, value: event.target.value }, `${variant}:${record.name}:value`)}
            onBlur={onEndCoalesce}
          />
        );
      },
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
        <span className="component-contract-title">{t('lowcode.propsTitle')}</span>
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
