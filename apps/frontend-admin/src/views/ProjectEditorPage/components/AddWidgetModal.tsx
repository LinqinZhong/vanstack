import { CodeOutlined } from '@ant-design/icons';
import { Input, Modal } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectComponentDto } from '@vanstack/shared';
import type { PageWidget } from '@vanstack/xml';
import { ADDABLE_WIDGET_TYPES, widgetTypeName } from '../../../utils/widgetTree';

export type AddWidgetChoice =
  | { kind: 'widget'; type: PageWidget['type'] }
  | { kind: 'component'; component: Pick<ProjectComponentDto, 'id' | 'key' | 'name'> };

/**
 * 添加控件弹窗。元素和组件都排成宫格，顶部输入框按名称过滤。
 * 插到哪一层、写入撤销历史、选中新控件都在页面完成。
 */
type AddWidgetModalProps = {
  open: boolean;
  components: ProjectComponentDto[];
  onClose: () => void;
  onAdd: (choice: AddWidgetChoice) => void;
};

function PlugIcon() {
  return (
    <svg className="widget-type-plug" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 2h2v4h4V2h2v4h2v5a6 6 0 0 1-5 5.91V22h-2v-5.09A6 6 0 0 1 6 11V6h2V2zm-2 6v3a4 4 0 0 0 8 0V8H6z"
      />
    </svg>
  );
}

export function AddWidgetModal({ open, components, onClose, onAdd }: AddWidgetModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const keyword = query.trim().toLowerCase();
  const widgets = useMemo(
    () =>
      ADDABLE_WIDGET_TYPES.map((type) => ({ type, label: widgetTypeName(type, t) })).filter((item) =>
        keyword ? item.label.toLowerCase().includes(keyword) : true,
      ),
    [keyword, t],
  );
  const matchedComponents = useMemo(
    () =>
      components.filter((item) =>
        keyword ? `${item.name} ${item.key}`.toLowerCase().includes(keyword) : true,
      ),
    [components, keyword],
  );

  function choose(choice: AddWidgetChoice) {
    onAdd(choice);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('lowcode.addWidget')}
      footer={null}
      width={520}
      onCancel={onClose}
      afterOpenChange={(next) => {
        if (!next) {
          setQuery('');
        }
      }}
      destroyOnHidden
    >
      <Input
        allowClear
        value={query}
        placeholder={t('lowcode.widgetSearch')}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="widget-type-grid">
        {widgets.map((item) => (
          <button key={item.type} type="button" className="widget-type-card" onClick={() => choose({ kind: 'widget', type: item.type })}>
            <CodeOutlined />
            <span>{item.label}</span>
          </button>
        ))}
        {matchedComponents.map((item) => (
          <button
            key={item.id}
            type="button"
            className="widget-type-card"
            onClick={() => choose({ kind: 'component', component: item })}
          >
            <PlugIcon />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
