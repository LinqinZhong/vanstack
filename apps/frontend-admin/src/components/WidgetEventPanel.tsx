import { DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { Button, ConfigProvider, Form, Input, Modal, Popconfirm, Select, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  appendWidgetEvent,
  buildEventSource,
  compactEvents,
  eventFunctionHeader,
  eventLabelKey,
  eventRows,
  eventsFromSpecRows,
  parseEventSource,
  removeWidgetEvent,
  reorderEvents,
  type WidgetEventSpec,
  type WidgetEvents,
} from '@vanstack/xml';
import { api } from '../apis/api';
import { createEventEditorExtensions } from '../utils/eventEditor';
import { inspectorTheme } from './inspectorTheme';

export function WidgetEventPanel({
  specs,
  events,
  scopeKey,
  projectId,
  disabled,
  onChange,
}: {
  specs: WidgetEventSpec[];
  events: WidgetEvents | undefined;
  scopeKey: string;
  projectId?: string;
  disabled?: boolean;
  onChange: (events: WidgetEvents | undefined) => void;
}) {
  const { t } = useTranslation();
  const rows = useMemo(() => eventRows(specs, events), [specs, events]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [eventName, setEventName] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [body, setBody] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const editorExtensions = useMemo(
    () =>
      createEventEditorExtensions({
        info: t('lowcode.toastInfo'),
        short: t('lowcode.toastShort'),
        long: t('lowcode.toastLong'),
        params: editingName ? (specs.find((item) => item.name === editingName)?.params ?? []) : [],
      }),
    [t, editingName, specs],
  );

  const rowKey = rows.map((row) => `${row.name}:${row.id}`).join(',');

  useEffect(() => {
    if (!projectId || rows.length === 0) {
      setDescriptions({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      rows.map(async (row) => {
        try {
          const script = await api.getWidgetEvent(projectId, row.id);
          return [row.id, parseEventSource(script.source)?.description ?? ''] as const;
        } catch {
          return [row.id, ''] as const;
        }
      }),
    ).then((loaded) => {
      if (cancelled) {
        return;
      }
      setDescriptions(Object.fromEntries(loaded));
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, scopeKey, rowKey, rows]);

  const editingSpec = editingName ? specs.find((item) => item.name === editingName) : undefined;

  async function createEvent() {
    const spec = eventName ? specs.find((item) => item.name === eventName) : undefined;
    if (!spec || !projectId || disabled) {
      return;
    }
    const id = crypto.randomUUID();
    const source = buildEventSource(spec, description, '');
    setSaving(true);
    try {
      await api.putWidgetEvent(projectId, id, { source });
      setDescriptions((prev) => ({ ...prev, [id]: description.replace(/\s+/g, ' ').trim() }));
      onChange(compactEvents(specs, appendWidgetEvent(events, spec.name, id)));
      setCreateOpen(false);
      setEventName(undefined);
      setDescription('');
    } catch {
      message.error(t('lowcode.eventSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function openEditor(name: string, id: string) {
    if (!projectId) {
      return;
    }
    const spec = specs.find((item) => item.name === name);
    if (!spec) {
      return;
    }
    setSaving(true);
    try {
      const script = await api.getWidgetEvent(projectId, id);
      const parsed = parseEventSource(script.source);
      setEditingId(id);
      setEditingName(name);
      setEditingDescription(parsed?.description ?? descriptions[id] ?? '');
      setBody(parsed?.body ?? '');
    } catch {
      message.error(t('lowcode.eventLoadFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function saveEditor() {
    const spec = editingName ? specs.find((item) => item.name === editingName) : undefined;
    if (!spec || !editingId || !editingName || !projectId || disabled) {
      return;
    }
    const source = buildEventSource(spec, editingDescription, body);
    const previous = eventRows(specs, events).find((row) => row.id === editingId);
    setSaving(true);
    try {
      await api.putWidgetEvent(projectId, editingId, { source });
      const desc = editingDescription.replace(/\s+/g, ' ').trim();
      setDescriptions((prev) => ({ ...prev, [editingId]: desc }));
      if (previous && previous.name !== editingName) {
        const nextRows = eventRows(specs, events).map((row) =>
          row.id === editingId ? { ...row, name: editingName } : row,
        );
        onChange(eventsFromSpecRows(specs, nextRows));
      }
      setEditingId(null);
      setEditingName(null);
    } catch {
      message.error(t('lowcode.eventSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(name: string, id: string) {
    if (!projectId || disabled) {
      return;
    }
    onChange(compactEvents(specs, removeWidgetEvent(events, name, id)));
    try {
      await api.deleteWidgetEvent(projectId, id);
    } catch {
      message.error(t('lowcode.eventDeleteFailed'));
    }
  }

  return (
    <div className="widget-event-panel" onMouseDown={(event) => event.stopPropagation()}>
      <Button
        size="small"
        block
        icon={<PlusOutlined />}
        disabled={disabled || !projectId}
        onClick={() => {
          setEventName(specs[0]?.name);
          setDescription('');
          setCreateOpen(true);
        }}
      >
        {t('lowcode.eventCreate')}
      </Button>
      {rows.map((row) => (
        <div
          key={row.id}
          className={[
            'widget-event-card',
            draggingId === row.id ? 'is-dragging' : '',
            overId === row.id && draggingId !== row.id ? 'is-over' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={(event) => {
            if (!draggingId || disabled) {
              return;
            }
            event.preventDefault();
            setOverId(row.id);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggingId && draggingId !== row.id) {
              onChange(reorderEvents(specs, events, draggingId, row.id));
            }
            setDraggingId(null);
            setOverId(null);
          }}
        >
          <span
            className="widget-event-grip"
            draggable={!disabled}
            aria-label={t('lowcode.eventReorder')}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', row.id);
              setDraggingId(row.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setOverId(null);
            }}
          >
            <HolderOutlined />
          </span>
          <div className="widget-event-card-copy">
            <div className="widget-event-name">{t(eventLabelKey(row.name))}</div>
            <div className="widget-event-desc" title={descriptions[row.id] || undefined}>
              {descriptions[row.id] || t('lowcode.eventNoDesc')}
            </div>
          </div>
          <div className="widget-event-card-actions">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              disabled={!projectId || saving}
              aria-label={t('lowcode.eventEdit')}
              onClick={() => void openEditor(row.name, row.id)}
            />
            <Popconfirm
              title={t('lowcode.eventDeleteConfirm')}
              okText={t('lowcode.eventDelete')}
              disabled={disabled}
              onConfirm={() => void removeEvent(row.name, row.id)}
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
                aria-label={t('lowcode.eventDelete')}
              />
            </Popconfirm>
          </div>
        </div>
      ))}
      <ConfigProvider theme={inspectorTheme}>
      <Modal
        className="inspector-modal"
        title={t('lowcode.eventCreateTitle')}
        open={createOpen}
        confirmLoading={saving}
        okButtonProps={{ disabled: disabled || !eventName }}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void createEvent()}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label={t('lowcode.eventField')} required>
            <Select
              value={eventName}
              options={specs.map((item) => ({ value: item.name, label: t(eventLabelKey(item.name)) }))}
              onChange={setEventName}
            />
          </Form.Item>
          <Form.Item label={t('lowcode.eventDesc')}>
            <Input value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        className="inspector-modal"
        title={t('lowcode.eventEditTitle')}
        open={editingId != null}
        width={720}
        confirmLoading={saving}
        okButtonProps={{ disabled: disabled || !editingName }}
        onCancel={() => {
          setEditingId(null);
          setEditingName(null);
        }}
        onOk={() => void saveEditor()}
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label={t('lowcode.eventField')} required>
            <Select
              value={editingName ?? undefined}
              disabled={disabled}
              options={specs.map((item) => ({ value: item.name, label: t(eventLabelKey(item.name)) }))}
              onChange={setEditingName}
            />
          </Form.Item>
          <Form.Item label={t('lowcode.eventDesc')}>
            <Input
              value={editingDescription}
              maxLength={200}
              disabled={disabled}
              onChange={(event) => setEditingDescription(event.target.value)}
            />
          </Form.Item>
        </Form>
        {editingSpec ? (
          <div className="page-data-code widget-event-code">
            <pre className="page-data-code-line">{eventFunctionHeader(editingSpec)}</pre>
            <CodeMirror
              value={body}
              height="280px"
              theme={oneDark}
              extensions={editorExtensions}
              editable={!disabled}
              basicSetup={{ lineNumbers: true, foldGutter: false }}
              onChange={setBody}
            />
            <pre className="page-data-code-line">{'}'}</pre>
          </div>
        ) : null}
      </Modal>
      </ConfigProvider>
    </div>
  );
}
