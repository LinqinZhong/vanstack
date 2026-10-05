import { Form, Modal, Radio, Select, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import type { VersionListItem } from './VersionListPanel';

/**
 * 新建版本。source 在组件内用 Form.useWatch 读取，选「从已有版本复制」时才出现来源下拉。
 * 当前页面还没有任何版本时，「复制」不可选。创建请求在页面的 onOk，这里不直接调接口。
 */
export type VersionFormValues = {
  source: 'blank' | 'copy';
  copyFromId?: string;
};

type CreateVersionModalProps = {
  open: boolean;
  form: FormInstance<VersionFormValues>;
  versions: VersionListItem[];
  onOk: () => void;
  onCancel: () => void;
};

export function CreateVersionModal({ open, form, versions, onOk, onCancel }: CreateVersionModalProps) {
  const { t } = useTranslation();
  const source = Form.useWatch('source', form);
  return (
    <Modal
      className="version-create-modal"
      open={open}
      title={t('lowcode.createVersion')}
      onOk={onOk}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form
        className="version-create-form"
        form={form}
        layout="horizontal"
        labelAlign="left"
        colon={false}
        initialValues={{ source: 'blank' }}
      >
        <Form.Item name="source" label={t('lowcode.createVersionSource')} rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="blank">{t('lowcode.createVersionBlank')}</Radio>
            <Radio value="copy" disabled={versions.length === 0}>
              {t('lowcode.createVersionCopy')}
            </Radio>
          </Radio.Group>
        </Form.Item>
        {source === 'copy' ? (
          <Form.Item
            name="copyFromId"
            label={t('lowcode.createVersionFrom')}
            rules={[{ required: true, message: t('lowcode.createVersionFromRequired') }]}
          >
            <Select
              placeholder={t('lowcode.createVersionFrom')}
              options={versions.map((version) => ({
                value: version.id,
                label: `v${version.versionNo}`,
              }))}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
