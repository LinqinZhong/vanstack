import { Form, Input, Modal, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { KEY_PATTERN } from '../helpers';

/**
 * 新建和编辑页面共用的表单。Form 实例留在页面上，打开前由页面写入初始值，提交校验也在页面的 onOk。
 * key 必须匹配 KEY_PATTERN：小写字母开头，其余为小写字母、数字或连字符，总长不超过 64。
 * editing 为真时标题是「编辑页面」，否则是「新建页面」，字段本身相同。
 */
export type PageFormValues = {
  name: string;
  key: string;
  description?: string;
};

type PageFormModalProps = {
  open: boolean;
  editing: boolean;
  kind?: 'page' | 'component';
  form: FormInstance<PageFormValues>;
  onOk: () => void;
  onCancel: () => void;
};

export function PageFormModal({ open, editing, kind = 'page', form, onOk, onCancel }: PageFormModalProps) {
  const { t } = useTranslation();
  const title = editing
    ? t(kind === 'component' ? 'lowcode.editComponent' : 'lowcode.editPage')
    : t(kind === 'component' ? 'lowcode.createComponent' : 'lowcode.createPage');
  return (
    <Modal open={open} title={title} onOk={onOk} onCancel={onCancel} destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t(kind === 'component' ? 'lowcode.componentName' : 'lowcode.pageName')}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="key"
          label={t('lowcode.key')}
          rules={[{ required: true }, { pattern: KEY_PATTERN, message: t('lowcode.keyHint') }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t('lowcode.description')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
