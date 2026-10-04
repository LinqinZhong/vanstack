import { Button, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { PageWidget } from '@vanstack/xml';
import { ADDABLE_WIDGET_TYPES, widgetTypeName } from '../../../utils/widgetTree';

/**
 * 添加组件弹窗。列出当前允许新建的控件类型，点某一项后交给页面插入，并立刻关掉弹窗。
 * 插到哪一层、写入撤销历史、选中新控件都在页面完成，这里不改组件树。
 */
type AddWidgetModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (type: PageWidget['type']) => void;
};

export function AddWidgetModal({ open, onClose, onAdd }: AddWidgetModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('lowcode.addWidget')} footer={null} onCancel={onClose} destroyOnHidden>
      <div className="widget-type-picker">
        {ADDABLE_WIDGET_TYPES.map((type) => (
          <Button
            key={type}
            block
            onClick={() => {
              onAdd(type);
              onClose();
            }}
          >
            {widgetTypeName(type, t)}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
