import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Popconfirm } from 'antd';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnimationDefinitionDto, UpdateAnimationInput } from '@vanstack/shared';
import { AnimationEditorModal } from './AnimationEditorModal';

export type AnimationPanelProps = {
  animations: AnimationDefinitionDto[];
  disabled?: boolean;
  onCreate: (name: string) => Promise<AnimationDefinitionDto | null>;
  onUpdate: (id: string, input: UpdateAnimationInput) => Promise<AnimationDefinitionDto | null>;
  onDelete: (id: string) => Promise<void>;
};

export function AnimationPanel({ animations, disabled, onCreate, onUpdate, onDelete }: AnimationPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AnimationDefinitionDto | null>(null);

  const name = newName.trim();

  async function submitCreate() {
    if (!name || creating) {
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate(name);
      if (created) {
        setCreateOpen(false);
        setNewName('');
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div onMouseDown={(event) => event.stopPropagation()}>
      <div style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          disabled={disabled}
          onClick={() => {
            setNewName('');
            setCreateOpen(true);
          }}
        >
          {t('lowcode.animationAdd')}
        </Button>
      </div>
      {animations.length === 0 ? (
        <Empty description={t('lowcode.animationEmpty')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {animations.map((animation) => (
            <div
              key={animation.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 12,
                background: '#fff',
              }}
            >
              <div
                style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={animation.name}
              >
                {animation.name}
              </div>
              <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                {t('lowcode.animationKeyframesCount', { count: animation.keyframes.length })}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  disabled={disabled}
                  onClick={() => setEditing(animation)}
                >
                  {t('lowcode.edit')}
                </Button>
                <Popconfirm
                  title={t('lowcode.confirmDelete')}
                  okText={t('lowcode.delete')}
                  cancelText={t('lowcode.animationCancel')}
                  disabled={disabled}
                  onConfirm={() => void onDelete(animation.id)}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={disabled}>
                    {t('lowcode.delete')}
                  </Button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal
        title={t('lowcode.animationAdd')}
        open={createOpen}
        width={360}
        confirmLoading={creating}
        okText={t('lowcode.animationSave')}
        cancelText={t('lowcode.animationCancel')}
        okButtonProps={{ disabled: !name }}
        onOk={() => void submitCreate()}
        onCancel={() => {
          setCreateOpen(false);
          setNewName('');
        }}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={newName}
          maxLength={64}
          placeholder={t('lowcode.animationNamePlaceholder')}
          onChange={(event) => setNewName(event.target.value)}
          onPressEnter={() => void submitCreate()}
        />
      </Modal>
      <AnimationEditorModal
        open={editing != null}
        animation={editing}
        onCancel={() => setEditing(null)}
        onSave={async (input) => {
          if (!editing) {
            return;
          }
          await onUpdate(editing.id, input);
          setEditing(null);
        }}
      />
    </div>
  );
}
