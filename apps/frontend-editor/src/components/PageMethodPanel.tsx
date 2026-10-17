import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { ScriptEditor } from './ScriptEditor';
import { Button, ConfigProvider, Form, Input, Modal, Popconfirm, Select, Switch, Table, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  METHOD_PARAM_TYPES,
  isPageMethodName,
  isPageMethodParamName,
  type MethodParamType,
  type PageMethod,
  type PageMethodData,
  type PageMethodParam,
} from '@vanstack/xml';
import { api } from '../apis/api';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';
import { inspectorTheme } from './inspectorTheme';

type PageMethodPanelProps = {
  methods: PageMethod[];
  projectId?: string;
  disabled?: boolean;
  showExpose?: boolean;
  /** 可用的页面/组件数据名，用于 $data.xxx 补全。 */
  dataNames?: string[];
  /** 组件入参名，用于 $props.xxx 补全。 */
  propNames?: string[];
  onChange: (next: PageMethod[]) => void;
};

type ParamDraft = {
  key: string;
  name: string;
  type: MethodParamType;
};

type DataDraft = {
  key: string;
  name: string;
  type: MethodParamType;
  value: string;
};

type MethodDraft = {
  id: string | null;
  name: string;
  desc: string;
  expose: boolean;
  params: ParamDraft[];
  /** 出参：单个可选类型，null 表示无出参（void）。 */
  returns: MethodParamType | null;
  data: DataDraft[];
  code: string;
  originalCode: string;
};

/** 方法类型到 TypeScript 类型的映射，用于生成函数声明。 */
const TS_TYPES: Record<MethodParamType, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  object: 'Record<string, any>',
  array: 'any[]',
  any: 'any',
};

function blankParam(): ParamDraft {
  return { key: crypto.randomUUID(), name: '', type: 'string' };
}

function blankData(): DataDraft {
  return { key: crypto.randomUUID(), name: '', type: 'string', value: '' };
}

function toDraftParams(params: PageMethodParam[]): ParamDraft[] {
  return params.map((param) => ({ key: crypto.randomUUID(), name: param.name, type: param.type }));
}

function toDraftData(data: PageMethodData[]): DataDraft[] {
  return data.map((item) => ({ key: crypto.randomUUID(), name: item.name, type: item.type, value: item.value }));
}

function formatParams(params: PageMethodParam[]) {
  return params.map((param) => `${param.name}: ${param.type}`).join(', ');
}

/** 由方法名、入参和出参拼出不可编辑的函数声明首行。 */
function methodSignature(name: string, params: ParamDraft[], returns: MethodParamType | null): string {
  const args = params
    .filter((param) => param.name.trim())
    .map((param) => `${param.name.trim()}: ${TS_TYPES[param.type]}`)
    .join(', ');
  return `function ${name.trim() || 'method'}(${args}): ${returns ? TS_TYPES[returns] : 'void'} {`;
}

/** 用 \u0000 连接成稳定 key，避免上层每次渲染传入新数组导致补全扩展重建。 */
function listKey(items: string[]): string {
  return items.filter(Boolean).join('\u0000');
}

export function PageMethodPanel({
  methods,
  projectId,
  disabled,
  showExpose,
  dataNames = [],
  propNames = [],
  onChange,
}: PageMethodPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MethodDraft | null>(null);
  const [codeValid, setCodeValid] = useState(true);
  const typeOptions = useMemo(
    () =>
      METHOD_PARAM_TYPES.map((type) => ({
        value: type,
        label: t(`lowcode.methodType.${type}`),
      })),
    [t],
  );

  const dataKey = listKey(dataNames);
  const propKey = listKey(propNames);
  const localKey = listKey(draft ? draft.data.map((item) => item.name.trim()) : []);
  // `$this.xxx()`：方法体里调用本文档（页面/组件）自己的方法，用现有方法名补全。
  const thisKey = listKey(methods.map((method) => method.name));
  const editorExtensions = useMemo(
    () =>
      createPageDataEditorExtensions(
        dataKey ? dataKey.split('\u0000') : [],
        t('lowcode.dataUnknownRef'),
        propKey ? propKey.split('\u0000') : [],
        [],
        [],
        localKey ? localKey.split('\u0000') : [],
        thisKey ? thisKey.split('\u0000') : [],
      ),
    [dataKey, propKey, localKey, thisKey, t],
  );

  function openCreate() {
    setDraft({
      id: null,
      name: '',
      desc: '',
      expose: false,
      params: [],
      returns: null,
      data: [],
      code: '',
      originalCode: '',
    });
    setOpen(true);
  }

  async function openEdit(method: PageMethod) {
    if (!projectId) {
      return;
    }
    setSaving(true);
    try {
      const saved = await api.getMethodCode(projectId, method.id);
      setDraft({
        id: method.id,
        name: method.name,
        desc: method.desc ?? '',
        expose: Boolean(method.expose),
        params: toDraftParams(method.params),
        returns: method.returns ?? null,
        data: toDraftData(method.data ?? []),
        code: saved.code,
        originalCode: saved.code,
      });
      setOpen(true);
    } catch {
      message.error(t('lowcode.methodLoadFailed'));
    } finally {
      setSaving(false);
    }
  }

  function updateParam(kind: 'params', key: string, patch: Partial<ParamDraft>) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        [kind]: current[kind].map((param) => (param.key === key ? { ...param, ...patch } : param)),
      };
    });
  }

  function removeParam(kind: 'params', key: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, [kind]: current[kind].filter((param) => param.key !== key) };
    });
  }

  function addParam(kind: 'params') {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, [kind]: [...current[kind], blankParam()] };
    });
  }

  function updateData(key: string, patch: Partial<DataDraft>) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, data: current.data.map((row) => (row.key === key ? { ...row, ...patch } : row)) };
    });
  }

  function removeData(key: string) {
    setDraft((current) => (current ? { ...current, data: current.data.filter((row) => row.key !== key) } : current));
  }

  function addData() {
    setDraft((current) => (current ? { ...current, data: [...current.data, blankData()] } : current));
  }

  function readParams(rows: ParamDraft[]): PageMethodParam[] | null {
    const params: PageMethodParam[] = [];
    const names = new Set<string>();
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) {
        message.error(t('lowcode.methodInvalidParam'));
        return null;
      }
      if (!isPageMethodParamName(name) || names.has(name)) {
        message.error(t('lowcode.methodInvalidParam'));
        return null;
      }
      names.add(name);
      params.push({ name, type: row.type });
    }
    return params;
  }

  function readData(rows: DataDraft[]): PageMethodData[] | null {
    const data: PageMethodData[] = [];
    const names = new Set<string>();
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) {
        message.error(t('lowcode.methodInvalidData'));
        return null;
      }
      if (!isPageMethodParamName(name) || names.has(name)) {
        message.error(t('lowcode.methodInvalidData'));
        return null;
      }
      names.add(name);
      data.push({ name, type: row.type, value: row.value });
    }
    return data;
  }

  async function saveDraft() {
    if (!draft || !projectId || disabled) {
      return;
    }
    const name = draft.name.trim();
    if (!isPageMethodName(name)) {
      message.error(t('lowcode.methodInvalidName'));
      return;
    }
    if (methods.some((method) => method.name === name && method.id !== draft.id)) {
      message.error(t('lowcode.methodDuplicateName'));
      return;
    }
    const params = readParams(draft.params);
    const data = params ? readData(draft.data) : null;
    if (!params || !data) {
      return;
    }
    setSaving(true);
    try {
      let id = draft.id ?? crypto.randomUUID();
      if (draft.id == null || draft.code !== draft.originalCode) {
        const saved = await api.putMethodCode(projectId, id, { code: draft.code });
        id = saved.id;
      }
      const desc = draft.desc.trim();
      const next: PageMethod = {
        id,
        name,
        params,
        ...(draft.returns ? { returns: draft.returns } : {}),
        ...(data.length > 0 ? { data } : {}),
        ...(desc ? { desc } : {}),
        ...(draft.expose ? { expose: true } : {}),
      };
      if (draft.id == null) {
        onChange([...methods, next]);
      } else {
        onChange(methods.map((method) => (method.id === draft.id ? next : method)));
      }
      setOpen(false);
      setDraft(null);
    } catch {
      message.error(t('lowcode.methodSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const columns: TableColumnsType<PageMethod> = [
    {
      title: t('lowcode.methodName'),
      dataIndex: 'name',
      width: 160,
    },
    {
      title: t('lowcode.methodDesc'),
      dataIndex: 'desc',
      ellipsis: true,
      render: (desc: string | undefined) => desc || t('lowcode.methodNoDesc'),
    },
    {
      title: t('lowcode.methodParams'),
      dataIndex: 'params',
      ellipsis: true,
      render: (params: PageMethodParam[]) => formatParams(params) || '—',
    },
    {
      title: t('lowcode.methodReturns'),
      dataIndex: 'returns',
      ellipsis: true,
      render: (returns: MethodParamType | undefined) =>
        returns ? t(`lowcode.methodType.${returns}`) : t('lowcode.methodReturnVoid'),
    },
    ...(showExpose
      ? [
          {
            title: t('lowcode.methodExpose'),
            dataIndex: 'expose',
            width: 72,
            render: (expose: boolean | undefined, method: PageMethod) => (
              <Switch
                size="small"
                disabled={disabled}
                checked={Boolean(expose)}
                onChange={(checked) =>
                  onChange(
                    methods.map((item) =>
                      item.id === method.id
                        ? { ...item, ...(checked ? { expose: true } : { expose: undefined }) }
                        : item,
                    ),
                  )
                }
              />
            ),
          } satisfies TableColumnsType<PageMethod>[number],
        ]
      : []),
    {
      title: t('lowcode.actions'),
      width: 96,
      render: (_value, method) => (
        <div className="page-method-actions">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            disabled={disabled || saving}
            aria-label={t('lowcode.methodEdit')}
            onClick={() => void openEdit(method)}
          />
          <Popconfirm
            title={t('lowcode.methodDeleteConfirm')}
            okText={t('lowcode.methodDelete')}
            disabled={disabled}
            onConfirm={() => onChange(methods.filter((item) => item.id !== method.id))}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={disabled}
              aria-label={t('lowcode.methodDelete')}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-methods-panel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="page-data-toolbar">
        <Button className="create-method-button" size="small" icon={<PlusOutlined />} disabled={disabled || !projectId} onClick={openCreate}>
          {t('lowcode.methodCreate')}
        </Button>
      </div>
      {methods.length === 0 ? (
        <div className="component-contract-empty">{t('lowcode.methodsEmpty')}</div>
      ) : (
        <div className="page-data-table-wrap">
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            columns={columns}
            dataSource={methods}
          />
        </div>
      )}
      <ConfigProvider theme={inspectorTheme}>
        <Modal
          className="inspector-modal"
          title={draft?.id ? t('lowcode.methodEdit') : t('lowcode.methodCreate')}
          open={open}
          width={800}
          confirmLoading={saving}
          okButtonProps={{ disabled: disabled || !draft || !codeValid }}
          onCancel={() => {
            setOpen(false);
            setDraft(null);
          }}
          onOk={() => void saveDraft()}
          destroyOnHidden
        >
          {draft ? (
            <Form
              className="page-method-form"
              layout="horizontal"
              labelAlign="left"
              labelCol={{ flex: '0 0 76px' }}
              wrapperCol={{ flex: '1 1 auto' }}
            >
              <Form.Item label={t('lowcode.methodName')} required extra={t('lowcode.methodNameHint')}>
                <Input
                  value={draft.name}
                  maxLength={64}
                  disabled={disabled}
                  onChange={(event) => {
                    const name = event.target.value;
                    setDraft((current) => (current ? { ...current, name } : current));
                  }}
                />
              </Form.Item>
              {showExpose ? (
                <Form.Item label={t('lowcode.methodExpose')}>
                  <Switch
                    disabled={disabled}
                    checked={draft.expose}
                    onChange={(expose) => setDraft((current) => (current ? { ...current, expose } : current))}
                  />
                </Form.Item>
              ) : null}
              <Form.Item label={t('lowcode.methodDesc')}>
                <Input.TextArea
                  value={draft.desc}
                  maxLength={500}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  disabled={disabled}
                  onChange={(event) => {
                    const desc = event.target.value;
                    setDraft((current) => (current ? { ...current, desc } : current));
                  }}
                />
              </Form.Item>
              <Form.Item label={t('lowcode.methodParams')}>
                <ParamList
                  rows={draft.params}
                  typeOptions={typeOptions}
                  disabled={disabled}
                  addLabel={t('lowcode.methodAddParam')}
                  namePlaceholder={t('lowcode.methodParamName')}
                  onAdd={() => addParam('params')}
                  onRemove={(key) => removeParam('params', key)}
                  onChange={(key, patch) => updateParam('params', key, patch)}
                />
              </Form.Item>
              <Form.Item label={t('lowcode.methodReturns')}>
                <Select
                  allowClear
                  value={draft.returns ?? undefined}
                  options={typeOptions}
                  placeholder={t('lowcode.methodReturnVoid')}
                  disabled={disabled}
                  onChange={(type: MethodParamType | undefined) =>
                    setDraft((current) => (current ? { ...current, returns: type ?? null } : current))
                  }
                />
              </Form.Item>
              <Form.Item label={t('lowcode.methodData')} extra={t('lowcode.methodDataHint')}>
                <DataList
                  rows={draft.data}
                  typeOptions={typeOptions}
                  disabled={disabled}
                  addLabel={t('lowcode.methodAddData')}
                  namePlaceholder={t('lowcode.methodDataName')}
                  valuePlaceholder={t('lowcode.methodDataValue')}
                  onAdd={addData}
                  onRemove={removeData}
                  onChange={updateData}
                />
              </Form.Item>
              <Form.Item label={t('lowcode.methodCode')} required>
                <ScriptEditor
                  value={draft.code}
                  height="280px"
                  editable={!disabled}
                  prefix={methodSignature(draft.name, draft.params, draft.returns)}
                  suffix="}"
                  extensions={editorExtensions}
                  onValidateChange={setCodeValid}
                  onChange={(code) => setDraft((current) => (current ? { ...current, code } : current))}
                />
              </Form.Item>
            </Form>
          ) : null}
        </Modal>
      </ConfigProvider>
    </div>
  );
}

function ParamList({
  rows,
  typeOptions,
  disabled,
  addLabel,
  namePlaceholder,
  onAdd,
  onRemove,
  onChange,
}: {
  rows: ParamDraft[];
  typeOptions: Array<{ value: MethodParamType; label: string }>;
  disabled?: boolean;
  addLabel: string;
  namePlaceholder: string;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onChange: (key: string, patch: Partial<ParamDraft>) => void;
}) {
  return (
    <div className="page-method-params">
      {rows.map((row) => (
        <div key={row.key} className="page-method-param-row">
          <Input
            value={row.name}
            placeholder={namePlaceholder}
            disabled={disabled}
            onChange={(event) => onChange(row.key, { name: event.target.value })}
          />
          <Select
            value={row.type}
            options={typeOptions}
            disabled={disabled}
            onChange={(type: MethodParamType) => onChange(row.key, { type })}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            onClick={() => onRemove(row.key)}
          />
        </div>
      ))}
      <Button size="small" icon={<PlusOutlined />} disabled={disabled} onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );
}

function DataList({
  rows,
  typeOptions,
  disabled,
  addLabel,
  namePlaceholder,
  valuePlaceholder,
  onAdd,
  onRemove,
  onChange,
}: {
  rows: DataDraft[];
  typeOptions: Array<{ value: MethodParamType; label: string }>;
  disabled?: boolean;
  addLabel: string;
  namePlaceholder: string;
  valuePlaceholder: string;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onChange: (key: string, patch: Partial<DataDraft>) => void;
}) {
  return (
    <div className="page-method-params">
      {rows.map((row) => (
        <div key={row.key} className="page-method-param-row page-method-data-row">
          <Input
            value={row.name}
            placeholder={namePlaceholder}
            disabled={disabled}
            onChange={(event) => onChange(row.key, { name: event.target.value })}
          />
          <Select
            value={row.type}
            options={typeOptions}
            disabled={disabled}
            onChange={(type: MethodParamType) => onChange(row.key, { type })}
          />
          <Input
            value={row.value}
            placeholder={valuePlaceholder}
            disabled={disabled}
            onChange={(event) => onChange(row.key, { value: event.target.value })}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            onClick={() => onRemove(row.key)}
          />
        </div>
      ))}
      <Button size="small" icon={<PlusOutlined />} disabled={disabled} onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );
}
