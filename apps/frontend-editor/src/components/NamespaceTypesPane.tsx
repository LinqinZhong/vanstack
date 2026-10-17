import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Popconfirm, Select, Spin, Table, Tabs, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { NamespaceDocumentDto, NamespaceTypeDto, NamespaceTypeFieldDto, ProjectNamespaceDto } from '@vanstack/shared';
import { api } from '../apis/api';
import { ScriptEditor } from './ScriptEditor';
import { TypeCascader, useNamespaceCatalog } from './TypeKindFields';
import { fieldsToSource, parseInterface } from './namespaceSchema';

const IDENT = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

const PRIMITIVES = ['string', 'number', 'boolean', 'object', 'array', 'icon', 'image'] as const;
const PRIMITIVE_LABEL: Record<(typeof PRIMITIVES)[number], string> = {
  string: 'str',
  number: 'num',
  boolean: 'bool',
  object: 'obj',
  array: 'arr',
  icon: 'icon',
  image: 'image',
};

function nid(): string {
  return crypto.randomUUID();
}

export function nextIdent(used: string[], prefix: string): string {
  let index = used.length + 1;
  let name = `${prefix}${index}`;
  const taken = new Set(used);
  while (taken.has(name)) {
    index += 1;
    name = `${prefix}${index}`;
  }
  return name;
}

export function canSaveNamespaceDoc(doc: NamespaceDocumentDto): boolean {
  const names = doc.types.map((item) => item.name);
  return names.every((name) => IDENT.test(name)) && new Set(names).size === names.length && doc.data.every((item) => item.name.trim().length > 0);
}

function sourcePreview(source: string): string {
  const line = source.replace(/\s+/g, ' ').trim();
  return line.length > 72 ? `${line.slice(0, 72)}…` : line;
}

function blankField(type = 'string'): NamespaceTypeFieldDto {
  return { id: nid(), name: '', description: '', type };
}

function isPrimitive(value: string): boolean {
  return (PRIMITIVES as readonly string[]).includes(value);
}

/** 在文档末尾追加一个空类型草稿，数据池和数据面板的新建入口共用。 */
export function appendTypeDraft(doc: NamespaceDocumentDto): NamespaceDocumentDto {
  const name = nextIdent(doc.types.map((item) => item.name), 'Type');
  const fields: NamespaceTypeFieldDto[] = [];
  return { ...doc, types: [...doc.types, { id: nid(), name, description: '', fields, source: fieldsToSource(name, fields) }] };
}

export type NamespaceTypesPaneProps = {
  projectId: string;
  doc: NamespaceDocumentDto;
  disabled?: boolean;
  /** 数据面板复用时隐藏自带头部，由外层区块渲染统一的折叠头。 */
  headless?: boolean;
  /** 头部右侧、位于「添加类型」之前的附加动作（数据池传重命名/删除命名空间按钮）。 */
  headActions?: ReactNode;
  onCommit: (next: NamespaceDocumentDto, immediate?: boolean) => void;
};

export function NamespaceTypesPane({ projectId, doc, disabled, headless, headActions, onCommit }: NamespaceTypesPaneProps) {
  const { t } = useTranslation();
  const [editingType, setEditingType] = useState<NamespaceTypeDto | null>(null);
  const [typeTab, setTypeTab] = useState('tree');
  const [draftFields, setDraftFields] = useState<NamespaceTypeFieldDto[]>([]);
  const [draftSource, setDraftSource] = useState('');
  // 默认视为有效：弹窗默认停在「定义」tab，代码编辑器未挂载；挂载后会立即回报真实结果。
  const [codeValid, setCodeValid] = useState(true);
  const remoteNamespaces = useNamespaceCatalog(projectId);
  const typeNames = useMemo(() => doc.types.map((item) => item.name).filter((name) => IDENT.test(name)), [doc.types]);
  const fieldNamespaces = useMemo(() => {
    const currentTypes = typeNames.filter((name) => name !== editingType?.name && !isPrimitive(name));
    const current = doc.name && currentTypes.length > 0 ? [{ name: doc.name, types: currentTypes }] : [];
    const rest = remoteNamespaces
      .filter((item) => item.name !== doc.name)
      .map((item) => ({ name: item.name, types: item.types.filter((name) => !isPrimitive(name)) }))
      .filter((item) => item.types.length > 0);
    return [...current, ...rest];
  }, [doc.name, editingType?.name, remoteNamespaces, typeNames]);

  function openType(row: NamespaceTypeDto) {
    setEditingType(row);
    setTypeTab('tree');
    setDraftFields(row.fields);
    setDraftSource(row.source.trim() ? row.source : fieldsToSource(row.name, row.fields));
  }

  function switchTypeTab(next: string) {
    if (!editingType || next === typeTab) {
      return;
    }
    if (next === 'code') {
      setDraftSource(fieldsToSource(editingType.name, draftFields));
      setTypeTab('code');
      return;
    }
    try {
      const parsed = parseInterface(draftSource);
      setDraftFields(parsed.fields);
      setEditingType({ ...editingType, name: parsed.name });
      setTypeTab('tree');
    } catch {
      message.error(t('lowcode.poolTypeInvalid'));
    }
  }

  function saveType() {
    if (!editingType) {
      return;
    }
    let fields = draftFields;
    let source = draftSource;
    let name = editingType.name;
    if (typeTab === 'code') {
      try {
        const parsed = parseInterface(draftSource);
        fields = parsed.fields;
        name = parsed.name;
        source = draftSource;
      } catch {
        message.error(t('lowcode.poolTypeInvalid'));
        return;
      }
    } else {
      source = fieldsToSource(name, fields);
    }
    const previous = doc.types.find((item) => item.id === editingType.id)?.name;
    const types = doc.types.map((item) => (item.id === editingType.id ? { ...item, name, fields, source } : item));
    const data =
      previous && previous !== name ? doc.data.map((item) => (item.type === previous ? { ...item, type: name } : item)) : doc.data;
    onCommit({ ...doc, types, data }, true);
    setEditingType(null);
  }

  return (
    <>
      {headless ? null : (
        <div className="language-library-section-head">
          <span>{t('lowcode.poolTypes')}</span>
          <div className="asset-library-file-actions">
            {headActions}
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              disabled={disabled}
              onClick={() => onCommit(appendTypeDraft(doc))}
            >
              {t('lowcode.poolAddType')}
            </Button>
          </div>
        </div>
      )}
      <div className="data-pool-table">
        <Table
          size="small"
          pagination={false}
          rowKey="id"
          dataSource={doc.types}
          locale={{ emptyText: t('lowcode.poolEmptyTypes') }}
          columns={[
            {
              title: t('lowcode.poolColName'),
              dataIndex: 'name',
              width: 160,
              render: (_value, row: NamespaceTypeDto) => (
                <Input
                  size="small"
                  value={row.name}
                  disabled={disabled}
                  onChange={(event) => {
                    const name = event.target.value;
                    const previous = row.name;
                    onCommit({
                      ...doc,
                      types: doc.types.map((item) =>
                        item.id === row.id ? { ...item, name, source: fieldsToSource(name || 'Type', item.fields) } : item,
                      ),
                      data: doc.data.map((item) => (item.type === previous ? { ...item, type: name } : item)),
                    });
                  }}
                />
              ),
            },
            {
              title: t('lowcode.poolColDescription'),
              dataIndex: 'description',
              render: (_value, row: NamespaceTypeDto) => (
                <Input
                  size="small"
                  value={row.description}
                  disabled={disabled}
                  onChange={(event) =>
                    onCommit({
                      ...doc,
                      types: doc.types.map((item) => (item.id === row.id ? { ...item, description: event.target.value } : item)),
                    })
                  }
                />
              ),
            },
            {
              title: t('lowcode.poolColValue'),
              dataIndex: 'source',
              ellipsis: true,
              render: (value: string) => <span className="data-pool-preview">{sourcePreview(value)}</span>,
            },
            {
              title: t('lowcode.poolEdit'),
              width: 88,
              render: (_value, row: NamespaceTypeDto) => (
                <div className="data-pool-row-actions">
                  <Button size="small" type="link" disabled={disabled} onClick={() => openType(row)}>
                    {t('lowcode.poolEdit')}
                  </Button>
                  <Popconfirm
                    title={t('lowcode.confirmDelete')}
                    onConfirm={() => onCommit({ ...doc, types: doc.types.filter((item) => item.id !== row.id) }, true)}
                  >
                    <Button size="small" type="text" danger disabled={disabled} icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              ),
            },
          ]}
        />
      </div>
      <Modal
        title={editingType ? `${t('lowcode.poolEditType')} ${editingType.name}` : t('lowcode.poolEditType')}
        open={Boolean(editingType)}
        width={760}
        onOk={saveType}
        okButtonProps={{ disabled: !codeValid }}
        onCancel={() => setEditingType(null)}
        destroyOnHidden
      >
        <Tabs
          activeKey={typeTab}
          onChange={switchTypeTab}
          items={[
            {
              key: 'tree',
              label: t('lowcode.poolTypeTree'),
              children: (
                <TypeFieldList
                  fields={draftFields}
                  namespaces={fieldNamespaces}
                  onChange={setDraftFields}
                />
              ),
            },
            {
              key: 'code',
              label: t('lowcode.poolTypeCode'),
              children: (
                <ScriptEditor value={draftSource} height="320px" onValidateChange={setCodeValid} onChange={setDraftSource} />
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
}

/** 数据 tab 的「类型」区块：命名空间选择 + 共享类型表格，折叠由外层状态控制。 */
export function NamespaceTypesSection({
  projectId,
  disabled,
  collapsed,
  onToggleCollapse,
  collapseIcon,
}: {
  projectId: string;
  disabled?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  collapseIcon?: ReactNode;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ProjectNamespaceDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [doc, setDoc] = useState<NamespaceDocumentDto | null>(null);
  const [loading, setLoading] = useState(false);
  const tail = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.listNamespaces(projectId);
        if (cancelled) {
          return;
        }
        setRows(list);
        setSelected((prev) => list.find((item) => item.name === prev)?.name ?? list[0]?.name ?? null);
      } catch (error) {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : t('lowcode.poolLoadFailed'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  useEffect(() => {
    if (!selected) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void tail.current
      .then(() => api.getNamespace(projectId, selected))
      .then((next) => {
        if (!cancelled) {
          setDoc(next);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : t('lowcode.poolLoadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, selected, t]);

  function commit(next: NamespaceDocumentDto) {
    setDoc(next);
    if (!canSaveNamespaceDoc(next)) {
      return;
    }
    tail.current = tail.current.then(async () => {
      try {
        await api.putNamespace(projectId, next.name, { types: next.types, data: next.data });
      } catch (error) {
        message.error(error instanceof Error ? error.message : t('lowcode.poolSaveFailed'));
      }
    });
  }

  return (
    <section className="component-contract">
      <div className="page-data-toolbar">
        <span className="page-data-head-title">
          {onToggleCollapse ? (
            <Button size="small" type="text" className="page-data-collapse-btn" icon={collapseIcon} onClick={onToggleCollapse} />
          ) : null}
          <span className="component-contract-title">{t('lowcode.poolTypes')}</span>
        </span>
        <Select
          size="small"
          className="page-data-namespace-select"
          value={selected}
          options={rows.map((row) => ({ value: row.name, label: row.name }))}
          placeholder={t('lowcode.typesSelectNamespace')}
          onChange={(name) => {
            setDoc(null);
            setSelected(name);
          }}
        />
        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={disabled || !doc}
          onClick={() => doc && commit(appendTypeDraft(doc))}
        >
          {t('lowcode.poolAddType')}
        </Button>
      </div>
      {collapsed ? null : loading || (selected && !doc) ? (
        <Spin />
      ) : doc ? (
        <NamespaceTypesPane projectId={projectId} doc={doc} disabled={disabled} headless onCommit={commit} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.poolNeedNamespace')} />
      )}
    </section>
  );
}

function TypeFieldList({
  fields,
  onChange,
  namespaces,
  hideName = false,
}: {
  fields: NamespaceTypeFieldDto[];
  onChange: (fields: NamespaceTypeFieldDto[]) => void;
  namespaces: { name: string; types: string[] }[];
  hideName?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="data-pool-fields">
      <div className="data-pool-field-head">
        {hideName ? <span>{t('lowcode.poolElement')}</span> : <span>{t('lowcode.poolColName')}</span>}
        <span>{t('lowcode.poolColType')}</span>
        <span>{t('lowcode.poolColDescription')}</span>
        <span />
      </div>
      {fields.map((field, index) => (
        <TypeFieldRow
          key={field.id}
          field={field}
          hideName={hideName}
          namespaces={namespaces}
          onChange={(next) => onChange(fields.map((item, itemIndex) => (itemIndex === index ? next : item)))}
          onDelete={hideName ? undefined : () => onChange(fields.filter((_, itemIndex) => itemIndex !== index))}
        />
      ))}
      {hideName ? null : (
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => onChange([...fields, blankField()])}>
          {t('lowcode.poolAddField')}
        </Button>
      )}
    </div>
  );
}

function TypeFieldRow({
  field,
  hideName,
  namespaces,
  onChange,
  onDelete,
}: {
  field: NamespaceTypeFieldDto;
  hideName?: boolean;
  namespaces: { name: string; types: string[] }[];
  onChange: (field: NamespaceTypeFieldDto) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const choices = PRIMITIVES.map((item) => ({
    value: item,
    label: t(`lowcode.propType.${PRIMITIVE_LABEL[item]}`),
  }));
  return (
    <div className="data-pool-field">
      <div className="data-pool-field-row">
        {hideName ? (
          <span className="data-pool-element">{t('lowcode.poolElement')}</span>
        ) : (
          <Input size="small" value={field.name} onChange={(event) => onChange({ ...field, name: event.target.value })} />
        )}
        <TypeCascader
          value={field.type}
          choices={choices}
          namespaces={namespaces}
          onChange={(type) => onChange(retarget(field, type))}
        />
        <Input
          size="small"
          value={field.description}
          onChange={(event) => onChange({ ...field, description: event.target.value })}
        />
        {onDelete ? <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onDelete} /> : <span />}
      </div>
      {field.type === 'object' ? (
        <div className="data-pool-field-nest">
          <TypeFieldList fields={field.children ?? []} namespaces={namespaces} onChange={(children) => onChange({ ...field, children })} />
        </div>
      ) : null}
      {field.type === 'array' ? (
        <div className="data-pool-field-nest">
          <TypeFieldList
            hideName
            fields={[field.children?.[0] ?? { id: `${field.id}:item`, name: '', description: '', type: 'string' }]}
            namespaces={namespaces}
            onChange={(children) => onChange({ ...field, children: children.slice(0, 1) })}
          />
        </div>
      ) : null}
    </div>
  );
}

function retarget(field: NamespaceTypeFieldDto, type: string): NamespaceTypeFieldDto {
  if (type === 'object') {
    return { ...field, type, children: field.type === 'object' ? field.children ?? [] : [] };
  }
  if (type === 'array') {
    const item = field.type === 'array' ? field.children?.[0] : undefined;
    return { ...field, type, children: [item ?? blankField()] };
  }
  return { id: field.id, name: field.name, description: field.description, type };
}
