import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
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
  type PageMethodParam,
} from '@vanstack/xml';
import { api } from '../apis/api';
import { inspectorTheme } from './inspectorTheme';

type PageMethodPanelProps = {
  methods: PageMethod[];
  projectId?: string;
  disabled?: boolean;
  showExpose?: boolean;
  onChange: (next: PageMethod[]) => void;
};

type ParamDraft = {
  key: string;
  name: string;
  type: MethodParamType;
};

type MethodDraft = {
  id: string | null;
  name: string;
  desc: string;
  expose: boolean;
  params: ParamDraft[];
  returns: ParamDraft[];
  code: string;
  originalCode: string;
};

const editorExtensions = [javascript()];

function blankParam(): ParamDraft {
  return { key: crypto.randomUUID(), name: '', type: 'string' };
}

function toDraftParams(params: PageMethodParam[]): ParamDraft[] {
  return params.map((param) => ({ key: crypto.randomUUID(), name: param.name, type: param.type }));
}

function formatParams(params: PageMethodParam[]) {
  return params.map((param) => `${param.name}: ${param.type}`).join(', ');
}

export function PageMethodPanel({ methods, projectId, disabled, showExpose, onChange }: PageMethodPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<MethodDraft | null>(null);
  const typeOptions = useMemo(
    () =>
      METHOD_PARAM_TYPES.map((type) => ({
        value: type,
        label: t(`lowcode.methodType.${type}`),
      })),
    [t],
  );

  function openCreate() {
    setDraft({
      id: null,
      name: '',
      desc: '',
      expose: false,
      params: [],
      returns: [],
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
        returns: toDraftParams(method.returns),
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

  function updateParam(kind: 'params' | 'returns', key: string, patch: Partial<ParamDraft>) {
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

  function removeParam(kind: 'params' | 'returns', key: string) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, [kind]: current[kind].filter((param) => param.key !== key) };
    });
  }

  function addParam(kind: 'params' | 'returns') {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return { ...current, [kind]: [...current[kind], blankParam()] };
    });
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
    const returns = params ? readParams(draft.returns) : null;
    if (!params || !returns) {
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
        returns,
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
      render: (params: PageMethodParam[]) => formatParams(params) || '—',
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
        <Button size="small" icon={<PlusOutlined />} disabled={disabled || !projectId} onClick={openCreate}>
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
          width={760}
          confirmLoading={saving}
          okButtonProps={{ disabled: disabled || !draft }}
          onCancel={() => {
            setOpen(false);
            setDraft(null);
          }}
          onOk={() => void saveDraft()}
          destroyOnHidden
        >
          {draft ? (
            <Form layout="vertical">
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
                <ParamList
                  rows={draft.returns}
                  typeOptions={typeOptions}
                  disabled={disabled}
                  addLabel={t('lowcode.methodAddReturn')}
                  namePlaceholder={t('lowcode.methodParamName')}
                  onAdd={() => addParam('returns')}
                  onRemove={(key) => removeParam('returns', key)}
                  onChange={(key, patch) => updateParam('returns', key, patch)}
                />
              </Form.Item>
              <Form.Item label={t('lowcode.methodCode')} required>
                <div className="page-data-code">
                  <CodeMirror
                    value={draft.code}
                    height="280px"
                    theme="light"
                    extensions={editorExtensions}
                    editable={!disabled}
                    onChange={(code) => setDraft((current) => (current ? { ...current, code } : current))}
                  />
                </div>
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
