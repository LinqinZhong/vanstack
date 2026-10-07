import './styles.less';
import { CloudDownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Form, Input, Modal, Popconfirm, Space, Table, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProjectDto } from '@vanstack/shared';
import { api } from '../../apis/api';

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export function ProjectHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const [form] = Form.useForm<{ name: string; key: string; description?: string }>();
  const [importForm] = Form.useForm<{ id: string }>();

  async function load() {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(project: ProjectDto) {
    setEditing(project);
    form.setFieldsValue({
      name: project.name,
      key: project.key,
      description: project.description,
    });
    setModalOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.updateProject(editing.id, values);
      } else {
        await api.createProject(values);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.saveFailed'));
    }
  }

  async function importCloud() {
    const values = await importForm.validateFields();
    try {
      await api.importProject(values.id.trim());
      setImportOpen(false);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.loadFailed'));
    }
  }

  async function remove(project: ProjectDto) {
    try {
      await api.deleteProject(project.id);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.deleteFailed'));
    }
  }

  return (
    <Card
      title={t('lowcode.projectsTitle')}
      extra={
        <Space>
          <Button icon={<CloudDownloadOutlined />} onClick={() => { importForm.resetFields(); setImportOpen(true); }}>
            {t('lowcode.addProject')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t('lowcode.createProject')}
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={projects}
        locale={{ emptyText: <Empty description={t('lowcode.emptyProjects')} /> }}
        pagination={false}
        columns={[
          { title: t('lowcode.name'), dataIndex: 'name' },
          { title: t('lowcode.key'), dataIndex: 'key' },
          { title: t('lowcode.description'), dataIndex: 'description' },
          {
            title: t('lowcode.actions'),
            render: (_, project) => (
              <Space>
                <Button type="link" onClick={() => navigate(`/projects/${project.id}`)}>
                  {t('lowcode.enter')}
                </Button>
                <Button type="link" onClick={() => openEdit(project)}>
                  {t('lowcode.edit')}
                </Button>
                <Popconfirm title={t('lowcode.confirmRemoveLocal')} onConfirm={() => void remove(project)}>
                  <Button type="link" danger>
                    {t('lowcode.delete')}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={modalOpen}
        title={editing ? t('lowcode.editProject') : t('lowcode.createProject')}
        onOk={() => void submit()}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('lowcode.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="key"
            label={t('lowcode.key')}
            rules={[
              { required: true },
              { pattern: KEY_PATTERN, message: t('lowcode.keyHint') },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('lowcode.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary">{t('lowcode.keyHint')}</Typography.Paragraph>
      </Modal>
      <Modal
        open={importOpen}
        title={t('lowcode.addProject')}
        onOk={() => void importCloud()}
        onCancel={() => setImportOpen(false)}
        destroyOnHidden
      >
        <Form form={importForm} layout="vertical">
          <Form.Item name="id" label={t('lowcode.cloudProjectId')} rules={[{ required: true }]}>
            <Input placeholder={t('lowcode.cloudProjectIdHint')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
