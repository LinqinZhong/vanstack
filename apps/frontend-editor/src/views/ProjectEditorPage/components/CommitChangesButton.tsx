import { CloudUploadOutlined } from '@ant-design/icons';
import { Button, List, Modal, Typography, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../apis/api';

type ChangeEntry = {
  path: string;
  op: 'write' | 'delete';
};

export function CommitChangesButton({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<ChangeEntry[]>([]);

  async function show() {
    setOpen(true);
    setLoading(true);
    try {
      const log = await api.listProjectChanges(projectId);
      setEntries(log.entries);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      await api.commitProjectChanges(projectId);
      setEntries([]);
      setOpen(false);
      message.success(t('lowcode.commitDone'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.commitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button size="small" icon={<CloudUploadOutlined />} onClick={() => void show()}>
        {t('lowcode.commitChanges')}
      </Button>
      <Modal
        open={open}
        title={t('lowcode.commitChangesTitle')}
        okText={t('lowcode.commitChanges')}
        confirmLoading={submitting}
        okButtonProps={{ disabled: entries.length === 0 }}
        onOk={() => void submit()}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <List
          loading={loading}
          dataSource={entries}
          locale={{ emptyText: t('lowcode.commitEmpty') }}
          renderItem={(entry) => (
            <List.Item>
              <Typography.Text type={entry.op === 'delete' ? 'danger' : undefined}>
                {entry.op === 'delete' ? t('lowcode.changeDelete') : t('lowcode.changeWrite')} {entry.path}
              </Typography.Text>
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
