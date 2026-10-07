import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Listy, Popconfirm, Segmented, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProjectPageDto } from '@vanstack/shared';

export type CatalogKind = 'page' | 'component';

/**
 * 页面和组件共用的列表。标题是「页面 / 组件」页签，点一行选中，编辑和删除交给页面处理。
 */
type PageListPanelProps = {
  kind: CatalogKind;
  items: ProjectPageDto[];
  selectedId: string | null;
  onKindChange: (kind: CatalogKind) => void;
  onCreate: () => void;
  onEdit: (item: ProjectPageDto) => void;
  onDelete: (item: ProjectPageDto) => void;
  onSelect: (id: string) => void;
};

export function PageListPanel({
  kind,
  items,
  selectedId,
  onKindChange,
  onCreate,
  onEdit,
  onDelete,
  onSelect,
}: PageListPanelProps) {
  const { t } = useTranslation();
  const createLabel = kind === 'component' ? t('lowcode.createComponent') : t('lowcode.createPage');
  const emptyLabel = kind === 'component' ? t('lowcode.emptyComponents') : t('lowcode.emptyPages');
  return (
    <Card
      size="small"
      className="editor-panel"
      title={
        <Segmented
          size="small"
          value={kind}
          options={[
            { label: t('lowcode.pages'), value: 'page' },
            { label: t('lowcode.components'), value: 'component' },
          ]}
          onChange={(value) => onKindChange(value as CatalogKind)}
        />
      }
      extra={
        <Button size="small" icon={<PlusOutlined />} onClick={onCreate}>
          {createLabel}
        </Button>
      }
    >
      {items.length === 0 ? (
        <Empty description={emptyLabel} />
      ) : (
        <Listy
          className="page-list"
          items={items}
          rowKey="id"
          itemRender={(item) => (
            <div
              className={item.id === selectedId ? 'page-list-row is-selected' : 'page-list-row'}
              onClick={() => onSelect(item.id)}
            >
              <div className="page-list-meta">
                <Typography.Text ellipsis>{item.name}</Typography.Text>
                <Typography.Text type="secondary" ellipsis>
                  {item.key}
                </Typography.Text>
              </div>
              <div className="page-list-actions">
                <Button type="link" onClick={() => onEdit(item)}>
                  {t('lowcode.edit')}
                </Button>
                <Popconfirm title={t('lowcode.confirmDelete')} onConfirm={() => void onDelete(item)}>
                  <Button type="link" danger>
                    {t('lowcode.delete')}
                  </Button>
                </Popconfirm>
              </div>
            </div>
          )}
        />
      )}
    </Card>
  );
}
