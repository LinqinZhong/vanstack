import { CaretRightOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown, Form, Input, InputNumber, Modal, type MenuProps } from 'antd';
import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { nextCopiedStateName, type VisibleWidgetState } from '../utils/widgetStates';

type WidgetStateListProps = {
  items: VisibleWidgetState[];
  viewingOwnerId: string | null;
  viewingState: string | null;
  ownedNames: string[];
  onSelect: (row: VisibleWidgetState) => void;
  onCreate: (name: string, from: VisibleWidgetState, transition?: number) => void;
  onEdit: (from: VisibleWidgetState, name: string | null, transition?: number) => void;
  onDelete: (row: VisibleWidgetState) => void;
};

type CreateForm = {
  name: string;
  transition?: number | null;
};

type EditForm = {
  name: string;
  transition?: number | null;
};

function rowKey(row: VisibleWidgetState) {
  return `${row.scopeOwnerId ?? ''}:${row.scopeName ?? ''}/${row.ownerId}:${row.name ?? ''}`;
}

function isLeaf(row: VisibleWidgetState) {
  return !row.children?.length;
}

export function WidgetStateList({
  items,
  viewingOwnerId,
  viewingState,
  ownedNames,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: WidgetStateListProps) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingFrom, setCreatingFrom] = useState<VisibleWidgetState | null>(null);
  const [editing, setEditing] = useState<VisibleWidgetState | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [createForm] = Form.useForm<CreateForm>();
  const [renameForm] = Form.useForm<EditForm>();
  const createNames = ownedNames;

  function openCreate(row: VisibleWidgetState) {
    createForm.setFieldsValue({
      name: '',
      transition: row.transition ?? 0,
    });
    setCreatingFrom(row);
    setCreateOpen(true);
  }

  function openEdit(row: VisibleWidgetState) {
    if (!row.owned || (row.name == null && row.scopeName)) {
      return;
    }
    renameForm.setFieldsValue({ name: row.name ?? '', transition: row.transition ?? 0 });
    setEditing(row);
  }

  function confirmDelete(row: VisibleWidgetState) {
    if (!row.name) {
      return;
    }
    Modal.confirm({
      title: t('lowcode.stateDeleteConfirm'),
      okText: t('lowcode.stateDelete'),
      okButtonProps: { danger: true },
      onOk: () => onDelete(row),
    });
  }

  function menuFor(row: VisibleWidgetState): MenuProps['items'] {
    const items: MenuProps['items'] = [];
    const leaf = isLeaf(row);
    const namedOwned = leaf && row.owned && row.name != null;
    const rootInitial = leaf && row.owned && row.name == null && !row.scopeName;
    if (!leaf) {
      items.push({
        key: 'add',
        icon: <PlusOutlined />,
        label: t('lowcode.stateAdd'),
      });
    }
    if (rootInitial) {
      items.push({
        key: 'add',
        icon: <PlusOutlined />,
        label: t('lowcode.stateAdd'),
      });
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: t('lowcode.stateEdit'),
      });
    }
    if (namedOwned) {
      items.push({
        key: 'edit',
        icon: <EditOutlined />,
        label: t('lowcode.stateEdit'),
      });
      items.push({ type: 'divider' });
      items.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        label: t('lowcode.stateDelete'),
        danger: true,
      });
    }
    return items;
  }

  function toggleCollapsed(row: VisibleWidgetState, event: MouseEvent) {
    event.stopPropagation();
    const key = rowKey(row);
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderNode(row: VisibleWidgetState, depth: number) {
    const viewingThis = isViewingRow(row, viewingOwnerId, viewingState);
    const menuItems = menuFor(row);
    const branch = Boolean(row.children?.length);
    const expanded = branch && !collapsed[rowKey(row)];
    const rowBody = (
      <div
        className="canvas-state-list-row"
        style={{ paddingLeft: 2 + depth * 12 }}
        onClick={() => onSelect(row)}
      >
        {branch ? (
          <button
            type="button"
            className={['canvas-state-list-caret', expanded ? 'is-open' : ''].join(' ')}
            onClick={(event) => toggleCollapsed(row, event)}
            aria-label={expanded ? 'collapse' : 'expand'}
          >
            <CaretRightOutlined />
          </button>
        ) : (
          <span className="canvas-state-list-caret-spacer" />
        )}
        <span className={['canvas-state-list-name', row.owned ? 'is-owned' : 'is-inherited'].join(' ')}>
          {row.name ?? t('lowcode.stateDefault')}
        </span>
        {branch ? (
          <button
            type="button"
            className="canvas-state-list-row-add"
            onClick={(event) => {
              event.stopPropagation();
              openCreate(row);
            }}
            aria-label={t('lowcode.stateAdd')}
          >
            <PlusOutlined />
          </button>
        ) : null}
      </div>
    );
    return (
      <li key={rowKey(row)} className={viewingThis ? 'is-viewing' : undefined}>
        {menuItems?.length ? (
          <Dropdown
            trigger={['contextMenu']}
            getPopupContainer={() => document.body}
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === 'add') {
                  openCreate(row);
                } else if (key === 'edit') {
                  openEdit(row);
                } else if (key === 'delete' && row.name) {
                  confirmDelete(row);
                }
              },
            }}
          >
            {rowBody}
          </Dropdown>
        ) : (
          rowBody
        )}
        {expanded ? <ul className="canvas-state-list-branch">{row.children?.map((child) => renderNode(child, depth + 1))}</ul> : null}
      </li>
    );
  }

  return (
    <div
      className="canvas-state-list"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="canvas-state-list-title">{t('lowcode.states')}</div>
      <ul className="canvas-state-list-items">{items.map((row) => renderNode(row, 0))}</ul>
      <Button
        size="small"
        type="text"
        icon={<PlusOutlined />}
        className="canvas-state-list-add"
        onClick={() => {
          const rootInitial = items.find((row) => row.owned && row.name == null && !row.scopeName) ?? items[0];
          if (rootInitial) {
            openCreate(rootInitial);
          }
        }}
      >
        {t('lowcode.stateAdd')}
      </Button>
      <Modal
        open={createOpen}
        title={t('lowcode.stateCreateTitle')}
        okText={t('lowcode.propEditConfirm')}
        onOk={() => {
          void createForm.validateFields().then((values) => {
            if (!creatingFrom) {
              return;
            }
            onCreate(values.name.trim(), creatingFrom, values.transition ?? 0);
            setCreateOpen(false);
            setCreatingFrom(null);
          });
        }}
        onCancel={() => {
          setCreateOpen(false);
          setCreatingFrom(null);
        }}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('lowcode.stateName')}
            rules={[
              { required: true, whitespace: true, message: t('lowcode.stateNameRequired') },
              {
                validator: async (_, value: string) => {
                  if (value && createNames.includes(value.trim())) {
                    throw new Error(t('lowcode.stateNameDuplicate'));
                  }
                },
              },
            ]}
          >
            <Input placeholder={nextCopiedStateName(createNames, creatingFrom?.name ?? null)} />
          </Form.Item>
          <Form.Item name="transition" label={t('lowcode.stateTransition')}>
            <InputNumber min={0} addonAfter="ms" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={editing != null}
        title={editing?.name ? t('lowcode.stateRename') : t('lowcode.stateEdit')}
        okText={t('lowcode.propEditConfirm')}
        onOk={() => {
          void renameForm.validateFields().then((values) => {
            if (!editing) {
              return;
            }
            onEdit(editing, editing.name ? values.name.trim() : null, values.transition ?? 0);
            setEditing(null);
          });
        }}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={renameForm} layout="vertical">
          {editing?.name != null ? (
            <Form.Item
              name="name"
              label={t('lowcode.stateName')}
              rules={[
                { required: true, whitespace: true, message: t('lowcode.stateNameRequired') },
                {
                  validator: async (_, value: string) => {
                    const next = value?.trim();
                    if (next && next !== editing.name && ownedNames.includes(next)) {
                      throw new Error(t('lowcode.stateNameDuplicate'));
                    }
                  },
                },
              ]}
            >
              <Input />
            </Form.Item>
          ) : null}
          <Form.Item name="transition" label={t('lowcode.stateTransition')}>
            <InputNumber min={0} addonAfter="ms" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function isViewingRow(row: VisibleWidgetState, viewingOwnerId: string | null, viewingState: string | null) {
  if (!row.owned && row.name) {
    return false;
  }
  if (row.scopeName && row.scopeOwnerId && row.name == null) {
    return viewingOwnerId === row.scopeOwnerId && viewingState === row.scopeName;
  }
  if (row.scopeName && row.name) {
    return viewingOwnerId === row.ownerId && viewingState === row.name;
  }
  return row.ownerId === viewingOwnerId && row.name === viewingState && !row.scopeName;
}
