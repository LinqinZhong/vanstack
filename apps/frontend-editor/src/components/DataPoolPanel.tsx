import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { javascript } from '@codemirror/lang-javascript';
import { ScriptEditor } from './ScriptEditor';
import { Button, Empty, Input, Modal, Popconfirm, Select, Spin, Table, Tabs, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NamespaceDataDto, NamespaceDocumentDto, NamespaceTypeDto, NamespaceTypeFieldDto, ProjectNamespaceDto } from '@vanstack/shared';
import { api } from '../apis/api';
import { TypeCascader, useNamespaceCatalog, type NamespaceCatalogEntry } from './TypeKindFields';
import { formatDataLiteral, tryParseDataLiteral } from '../utils/dataLiteral';
import { fieldsToSource, parseInterface } from './namespaceSchema';

const typeExtensions = [javascript({ typescript: true })];
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

function preview(value: unknown): string {
  const text = JSON.stringify(value) ?? '';
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function sourcePreview(source: string): string {
  const line = source.replace(/\s+/g, ' ').trim();
  return line.length > 72 ? `${line.slice(0, 72)}…` : line;
}

function blankField(type = 'string'): NamespaceTypeFieldDto {
  return { id: nid(), name: '', description: '', type };
}

function canSave(doc: NamespaceDocumentDto): boolean {
  const names = doc.types.map((item) => item.name);
  return names.every((name) => IDENT.test(name)) && new Set(names).size === names.length && doc.data.every((item) => item.name.trim().length > 0);
}

export function DataPoolPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [namespaces, setNamespaces] = useState<ProjectNamespaceDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [doc, setDoc] = useState<NamespaceDocumentDto | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editingType, setEditingType] = useState<NamespaceTypeDto | null>(null);
  const [typeTab, setTypeTab] = useState('tree');
  const [draftFields, setDraftFields] = useState<NamespaceTypeFieldDto[]>([]);
  const [draftSource, setDraftSource] = useState('');
  const [editingData, setEditingData] = useState<NamespaceDataDto | null>(null);
  const [draftValue, setDraftValue] = useState('null');
  const timer = useRef<number | null>(null);
  const tail = useRef(Promise.resolve());
  const pending = useRef<NamespaceDocumentDto | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await api.listNamespaces(projectId);
      setNamespaces(rows);
      setSelected((prev) => rows.find((item) => item.name === prev)?.name ?? rows[0]?.name ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.poolLoadFailed'));
    } finally {
      setLoadingList(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selected) {
      setDoc(null);
      return;
    }
    let cancelled = false;
    setLoadingDoc(true);
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
          setLoadingDoc(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, selected, t]);

  useEffect(
    () => () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
      }
      const snapshot = pending.current;
      if (snapshot && canSave(snapshot)) {
        void api.putNamespace(projectId, snapshot.name, { types: snapshot.types, data: snapshot.data });
      }
    },
    [projectId],
  );

  function flush() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const snapshot = pending.current;
    pending.current = null;
    if (!snapshot || !canSave(snapshot)) {
      return;
    }
    tail.current = tail.current.then(async () => {
      try {
        await api.putNamespace(projectId, snapshot.name, { types: snapshot.types, data: snapshot.data });
      } catch (error) {
        message.error(error instanceof Error ? error.message : t('lowcode.poolSaveFailed'));
      }
    });
  }

  function saveLater(snapshot: NamespaceDocumentDto, _immediate = false) {
    const queued = pending.current;
    if (queued && queued.name !== snapshot.name) {
      flush();
    }
    pending.current = snapshot;
    if (timer.current != null) {
      window.clearTimeout(timer.current);
    }
    const run = () => {
      pending.current = null;
      if (!canSave(snapshot)) {
        return;
      }
      tail.current = tail.current.then(async () => {
        try {
          await api.putNamespace(projectId, snapshot.name, { types: snapshot.types, data: snapshot.data });
        } catch (error) {
          message.error(error instanceof Error ? error.message : t('lowcode.poolSaveFailed'));
        }
      });
    };
    run();
  }

  function commit(next: NamespaceDocumentDto, immediate = false) {
    setDoc(next);
    saveLater(next, immediate);
  }

  async function createNamespace() {
    const name = newName.trim();
    if (!name) {
      return;
    }
    flush();
    try {
      const created = await api.createNamespace(projectId, { name });
      setNamespaces((prev) => [...prev, created]);
      setSelected(created.name);
      setDoc({ name: created.name, versionId: created.versionId, types: [], data: [] });
      setCreating(false);
      setNewName('');
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.poolSaveFailed'));
    }
  }

  async function renameNamespace() {
    if (!selected) {
      return;
    }
    flush();
    await tail.current;
    try {
      const renamed = await api.renameNamespace(projectId, selected, { name: renameValue.trim() });
      setNamespaces((prev) => prev.map((item) => (item.name === selected ? renamed : item)));
      setDoc((prev) => (prev ? { ...prev, name: renamed.name, versionId: renamed.versionId } : prev));
      setSelected(renamed.name);
      setRenameOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.poolSaveFailed'));
    }
  }

  async function removeNamespace() {
    if (!selected) {
      return;
    }
    const current = selected;
    flush();
    await tail.current;
    try {
      await api.deleteNamespace(projectId, current);
      const rest = namespaces.filter((item) => item.name !== current);
      setNamespaces(rest);
      setSelected(rest[0]?.name ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.poolSaveFailed'));
    }
  }

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
    if (!doc || !editingType) {
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
    commit({ ...doc, types, data }, true);
    setEditingType(null);
  }

  function openValue(row: NamespaceDataDto) {
    setEditingData(row);
    setDraftValue(formatDataLiteral(row.value, 2));
  }

  function saveValue() {
    if (!doc || !editingData) {
      return;
    }
    const value = draftValue.trim() ? tryParseDataLiteral(draftValue) : null;
    if (draftValue.trim() && value === undefined) {
      message.error(t('lowcode.poolValueInvalid'));
      return;
    }
    commit(
      {
        ...doc,
        data: doc.data.map((item) => (item.id === editingData.id ? { ...item, value } : item)),
      },
      true,
    );
    setEditingData(null);
  }

  const typeNames = doc?.types.map((item) => item.name).filter((name) => IDENT.test(name)) ?? [];
  const remoteNamespaces = useNamespaceCatalog(projectId);
  const fieldNamespaces = useMemo(() => {
    const currentName = doc?.name ?? '';
    const currentTypes = typeNames.filter((name) => name !== editingType?.name && !isPrimitive(name));
    const current = currentName && currentTypes.length > 0 ? [{ name: currentName, types: currentTypes }] : [];
    const rest = remoteNamespaces
      .filter((item) => item.name !== currentName)
      .map((item) => ({ name: item.name, types: item.types.filter((name) => !isPrimitive(name)) }))
      .filter((item) => item.types.length > 0);
    return [...current, ...rest];
  }, [doc?.name, editingType?.name, remoteNamespaces, typeNames]);

  return (
    <div className="data-pool-panel">
      <aside className="data-pool-namespaces">
        <div className="language-library-section-head">
          <span>{t('lowcode.poolNamespaces')}</span>
          <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setCreating(true)} />
        </div>
        {creating ? (
          <div className="asset-library-create">
            <Input
              size="small"
              autoFocus
              maxLength={64}
              value={newName}
              placeholder={t('lowcode.poolNamespaceName')}
              onChange={(event) => setNewName(event.target.value)}
              onPressEnter={() => void createNamespace()}
            />
            <Button size="small" type="primary" onClick={() => void createNamespace()}>
              {t('lowcode.poolAddNamespace')}
            </Button>
            <Button size="small" onClick={() => setCreating(false)}>
              {t('lowcode.assetsCancel')}
            </Button>
          </div>
        ) : null}
        {loadingList ? (
          <Spin />
        ) : namespaces.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.poolEmptyNamespaces')} />
        ) : (
          <div className="asset-library-group-list">
            {namespaces.map((item) => (
              <button
                key={item.versionId}
                type="button"
                className={['asset-library-group', item.name === selected ? 'is-active' : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  flush();
                  setDoc(null);
                  setSelected(item.name);
                }}
              >
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>
      <section className="data-pool-main">
        {!selected || !doc ? (
          loadingDoc ? (
            <Spin />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.poolNeedNamespace')} />
          )
        ) : (
          <>
            <div className="data-pool-pane">
              <div className="language-library-section-head">
                <span>{t('lowcode.poolTypes')}</span>
                <div className="asset-library-file-actions">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setRenameValue(selected);
                      setRenameOpen(true);
                    }}
                  >
                    {t('lowcode.poolRenameNamespace')}
                  </Button>
                  <Popconfirm title={t('lowcode.poolConfirmDeleteNamespace')} onConfirm={() => void removeNamespace()}>
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      {t('lowcode.poolDeleteNamespace')}
                    </Button>
                  </Popconfirm>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      const name = nextIdent(doc.types.map((item) => item.name), 'Type');
                      const fields: NamespaceTypeFieldDto[] = [];
                      commit({
                        ...doc,
                        types: [...doc.types, { id: nid(), name, description: '', fields, source: fieldsToSource(name, fields) }],
                      });
                    }}
                  >
                    {t('lowcode.poolAddType')}
                  </Button>
                </div>
              </div>
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
                          onChange={(event) => {
                            const name = event.target.value;
                            const previous = row.name;
                            commit({
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
                          onChange={(event) =>
                            commit({
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
                          <Button size="small" type="link" onClick={() => openType(row)}>
                            {t('lowcode.poolEdit')}
                          </Button>
                          <Popconfirm
                            title={t('lowcode.confirmDelete')}
                            onConfirm={() => commit({ ...doc, types: doc.types.filter((item) => item.id !== row.id) }, true)}
                          >
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
            <div className="data-pool-pane">
              <div className="language-library-section-head">
                <span>{t('lowcode.poolData')}</span>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const name = nextIdent(doc.data.map((item) => item.name), 'data');
                    commit({
                      ...doc,
                      data: [...doc.data, { id: nid(), type: doc.types[0]?.name ?? '', name, description: '', value: null }],
                    });
                  }}
                >
                  {t('lowcode.poolAddData')}
                </Button>
              </div>
              <div className="data-pool-table">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={doc.data}
                  locale={{ emptyText: t('lowcode.poolEmptyData') }}
                  columns={[
                    {
                      title: t('lowcode.poolColType'),
                      dataIndex: 'type',
                      width: 160,
                      render: (_value, row: NamespaceDataDto) => (
                        <Select
                          size="small"
                          value={row.type || undefined}
                          options={typeNames.map((name) => ({ value: name, label: name }))}
                          onChange={(type) =>
                            commit({ ...doc, data: doc.data.map((item) => (item.id === row.id ? { ...item, type } : item)) })
                          }
                          style={{ width: '100%' }}
                        />
                      ),
                    },
                    {
                      title: t('lowcode.poolColName'),
                      dataIndex: 'name',
                      width: 160,
                      render: (_value, row: NamespaceDataDto) => (
                        <Input
                          size="small"
                          value={row.name}
                          onChange={(event) =>
                            commit({
                              ...doc,
                              data: doc.data.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)),
                            })
                          }
                        />
                      ),
                    },
                    {
                      title: t('lowcode.poolColDescription'),
                      dataIndex: 'description',
                      render: (_value, row: NamespaceDataDto) => (
                        <Input
                          size="small"
                          value={row.description}
                          onChange={(event) =>
                            commit({
                              ...doc,
                              data: doc.data.map((item) => (item.id === row.id ? { ...item, description: event.target.value } : item)),
                            })
                          }
                        />
                      ),
                    },
                    {
                      title: t('lowcode.poolColValue'),
                      dataIndex: 'value',
                      ellipsis: true,
                      render: (value: unknown) => <span className="data-pool-preview">{preview(value)}</span>,
                    },
                    {
                      title: t('lowcode.poolEdit'),
                      width: 88,
                      render: (_value, row: NamespaceDataDto) => (
                        <div className="data-pool-row-actions">
                          <Button size="small" type="link" onClick={() => openValue(row)}>
                            {t('lowcode.poolEdit')}
                          </Button>
                          <Popconfirm
                            title={t('lowcode.confirmDelete')}
                            onConfirm={() => commit({ ...doc, data: doc.data.filter((item) => item.id !== row.id) }, true)}
                          >
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </>
        )}
      </section>
      <Modal
        title={t('lowcode.poolRenameNamespace')}
        open={renameOpen}
        onOk={() => void renameNamespace()}
        onCancel={() => setRenameOpen(false)}
      >
        <Input
          value={renameValue}
          maxLength={64}
          onChange={(event) => setRenameValue(event.target.value)}
          onPressEnter={() => void renameNamespace()}
        />
      </Modal>
      <Modal
        title={editingType ? `${t('lowcode.poolEditType')} ${editingType.name}` : t('lowcode.poolEditType')}
        open={Boolean(editingType)}
        width={760}
        onOk={saveType}
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
                <ScriptEditor value={draftSource} height="320px" extensions={typeExtensions} onChange={setDraftSource} />
              ),
            },
          ]}
        />
      </Modal>
      <Modal
        title={t('lowcode.poolEditValue')}
        open={Boolean(editingData)}
        onOk={saveValue}
        onCancel={() => setEditingData(null)}
        destroyOnHidden
      >
        <ScriptEditor value={draftValue} height="240px" extensions={typeExtensions} onChange={setDraftValue} />
      </Modal>
    </div>
  );
}

function nextIdent(used: string[], prefix: string): string {
  let index = used.length + 1;
  let name = `${prefix}${index}`;
  const taken = new Set(used);
  while (taken.has(name)) {
    index += 1;
    name = `${prefix}${index}`;
  }
  return name;
}

function TypeFieldList({
  fields,
  onChange,
  namespaces,
  hideName = false,
}: {
  fields: NamespaceTypeFieldDto[];
  onChange: (fields: NamespaceTypeFieldDto[]) => void;
  namespaces: NamespaceCatalogEntry[];
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
  namespaces: NamespaceCatalogEntry[];
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

function isPrimitive(value: string): boolean {
  return (PRIMITIVES as readonly string[]).includes(value);
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
