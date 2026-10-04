import { Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';

/**
 * 设置控件别名。输入完全受控，回车和确定都走 onOk。
 * 别名写回树节点和画布标签由页面完成。destroyOnHidden 会在关闭时卸掉输入框，下次打开不会留下上一次的焦点。
 */
type AliasModalProps = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onOk: () => void;
  onCancel: () => void;
};

export function AliasModal({ open, value, onChange, onOk, onCancel }: AliasModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('lowcode.setAlias')} onOk={onOk} onCancel={onCancel} destroyOnHidden>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPressEnter={onOk}
        placeholder={t('lowcode.aliasPlaceholder')}
        maxLength={30}
        autoFocus
      />
    </Modal>
  );
}
