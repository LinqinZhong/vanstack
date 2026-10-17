import { CaretRightOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown, Form, Input, InputNumber, Modal, type MenuProps } from 'antd';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { nextCopiedStateName, nextStateId, type ViewingByOwner, type VisibleWidgetState } from '../utils/widgetStates';

type WidgetStateListProps = {
  items: VisibleWidgetState[];
  /** 区块标题，默认「状态」。 */
  title?: string;
  /** 标题行右侧的附加操作（如「状态控制」按钮）。 */
  titleExtra?: ReactNode;
  /** 每个宿主当前正在查看的状态（ownerId → stateId）：各区块按自身宿主独立高亮。 */
  viewing: ViewingByOwner;
  /** 区块内当前唯一高亮的行 key；为空时回退到 viewing 推导（兼容旧调用）。 */
  activeKey?: string | null;
  usedIds: ReadonlySet<string>;
  readOnly?: boolean;
  onSelect: (row: VisibleWidgetState) => void;
  onCreate: (id: string, name: string, from: VisibleWidgetState, transition?: number) => void;
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

export function stateRowKey(row: VisibleWidgetState) {
  return rowKey(row);
}

function rowKey(row: VisibleWidgetState) {
  return `${row.scopeOwnerId ?? ''}:${row.scopeId ?? ''}/${row.ownerId}:${row.id ?? ''}`;
}

function isLeaf(row: VisibleWidgetState) {
  return !row.children?.length;
}

export function WidgetStateList({
  items,
  title,
  titleExtra,
  viewing,
  activeKey,
  usedIds,
  readOnly,
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

  function openCreate(row: VisibleWidgetState) {
    const ownedNames = items
      .filter((item) => item.owned && item.name != null)
      .map((item) => item.name as string);
    createForm.setFieldsValue({
      name: nextCopiedStateName(ownedNames, row.name ?? null),
      transition: typeof row.transition === 'number' ? row.transition : 0,
    });
    setCreatingFrom(row);
    setCreateOpen(true);
  }

  function openEdit(row: VisibleWidgetState) {
    if (!row.owned || (row.id == null && row.scopeId)) {
      return;
    }
    renameForm.setFieldsValue({ name: row.name ?? '', transition: typeof row.transition === 'number' ? row.transition : 0 });
    setEditing(row);
  }

  function confirmDelete(row: VisibleWidgetState) {
    if (!row.id) {
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
    const namedOwned = leaf && row.owned && row.id != null;
    const rootInitial = leaf && row.owned && row.id == null && !row.scopeId;
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
    const viewingThis = activeKey != null ? rowKey(row) === activeKey : isViewingRow(row, viewing);
    const menuItems = readOnly ? [] : menuFor(row);
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
                } else if (key === 'delete' && row.id) {
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
      <div className="canvas-state-list-title">
        <span className="canvas-state-list-title-text">{title ?? t('lowcode.states')}</span>
        {titleExtra ? <span className="canvas-state-list-title-extra">{titleExtra}</span> : null}
      </div>
      <ul className="canvas-state-list-items">{items.map((row) => renderNode(row, 0))}</ul>
      {!readOnly ? (
        <Button
          size="small"
          type="text"
          icon={<PlusOutlined />}
          className="canvas-state-list-add"
          onClick={() => {
            const rootInitial = items.find((row) => row.owned && row.id == null && !row.scopeId) ?? items[0];
            if (rootInitial) {
              openCreate(rootInitial);
            }
          }}
        >
          {t('lowcode.stateAdd')}
        </Button>
      ) : null}
      <Modal
        open={createOpen}
        title={t('lowcode.stateCreateTitle')}
        okText={t('lowcode.propEditConfirm')}
        onOk={() => {
          void createForm.validateFields().then((values) => {
            if (!creatingFrom) {
              return;
            }
            onCreate(nextStateId(usedIds), values.name.trim(), creatingFrom, values.transition ?? 0);
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
            rules={[{ required: true, whitespace: true, message: t('lowcode.stateNameRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="transition" label={t('lowcode.stateTransition')}>
            <InputNumber min={0} addonAfter="ms" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        open={editing != null}
        title={editing?.id ? t('lowcode.stateRename') : t('lowcode.stateEdit')}
        okText={t('lowcode.propEditConfirm')}
        onOk={() => {
          void renameForm.validateFields().then((values) => {
            if (!editing) {
              return;
            }
            onEdit(editing, editing.id ? values.name.trim() : null, values.transition ?? 0);
            setEditing(null);
          });
        }}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={renameForm} layout="vertical">
          {editing?.id != null ? (
            <Form.Item
              name="name"
              label={t('lowcode.stateName')}
              rules={[{ required: true, whitespace: true, message: t('lowcode.stateNameRequired') }]}
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

function isViewingRow(row: VisibleWidgetState, viewing: ViewingByOwner) {
  if (!row.owned && row.id) {
    return false;
  }
  if (row.scopeId && row.scopeOwnerId && row.id == null) {
    return (viewing[row.scopeOwnerId] ?? null) === row.scopeId;
  }
  if (row.scopeId && row.id) {
    return (viewing[row.ownerId] ?? null) === row.id;
  }
  return (viewing[row.ownerId] ?? null) === row.id && !row.scopeId;
}
