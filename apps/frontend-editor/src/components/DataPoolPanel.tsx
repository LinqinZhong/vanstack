import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Popconfirm, Select, Spin, Table, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NamespaceDataDto, NamespaceDocumentDto, ProjectNamespaceDto } from '@vanstack/shared';
import { api } from '../apis/api';
import { NamespaceTypesPane, canSaveNamespaceDoc as canSave, nextIdent } from './NamespaceTypesPane';
import { formatDataLiteral, tryParseDataLiteral } from '../utils/dataLiteral';
import { ValueEditCell, ValueEditor, type ValueEditorResult } from './PropValueEditor';

const IDENT = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

function nid(): string {
  return crypto.randomUUID();
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
  const [editingData, setEditingData] = useState<NamespaceDataDto | null>(null);
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

  function poolValueText(row: NamespaceDataDto): string {
    if (row.dynamic) {
      return typeof row.value === 'string' ? row.value : '';
    }
    return formatDataLiteral(row.value, 2);
  }

  function poolPreview(row: NamespaceDataDto): string {
    if (row.dynamic) {
      return typeof row.value === 'string' ? row.value : JSON.stringify(row.value) ?? '';
    }
    return preview(row.value);
  }

  function savePoolValue(next: ValueEditorResult) {
    if (!doc || !editingData) {
      return;
    }
    const current = editingData;
    const { dynamic: _dynamic, computed: _computed, ...rest } = current;
    let updated: NamespaceDataDto;
    if (next.dynamic) {
      updated = {
        ...rest,
        value: next.value,
        dynamic: true,
        ...(next.computed ? { computed: true } : {}),
      };
    } else {
      const parsed = next.value.trim() ? tryParseDataLiteral(next.value) : null;
      if (next.value.trim() && parsed === undefined) {
        message.error(t('lowcode.poolValueInvalid'));
        return;
      }
      updated = { ...rest, value: parsed };
    }
    commit({ ...doc, data: doc.data.map((item) => (item.id === current.id ? updated : item)) }, true);
    setEditingData(null);
  }

  const typeNames = doc?.types.map((item) => item.name).filter((name) => IDENT.test(name)) ?? [];

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
              <NamespaceTypesPane
                projectId={projectId}
                doc={doc}
                onCommit={commit}
                headActions={
                  <>
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
                  </>
                }
              />
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
                      render: (_value: unknown, row: NamespaceDataDto) => (
                        <ValueEditCell preview={poolPreview(row)} onEdit={() => setEditingData(row)} />
                      ),
                    },
                    {
                      title: t('lowcode.poolEdit'),
                      width: 88,
                      render: (_value, row: NamespaceDataDto) => (
                        <div className="data-pool-row-actions">
                          <Button size="small" type="link" onClick={() => setEditingData(row)}>
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
      <ValueEditor
        open={editingData != null}
        type={editingData?.type ?? 'obj'}
        name={editingData?.name}
        value={editingData ? poolValueText(editingData) : ''}
        dynamic={editingData?.dynamic}
        computed={editingData?.computed}
        onCancel={() => setEditingData(null)}
        onConfirm={savePoolValue}
      />
    </div>
  );
}

function preview(value: unknown): string {
  const text = JSON.stringify(value) ?? '';
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}
