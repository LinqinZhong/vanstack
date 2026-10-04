import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Listy, Popconfirm, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProjectPageDto } from '@vanstack/shared';

/**
 * 当前项目的页面列表。点一行选中该页；编辑打开页面表单，删除先弹出确认再交给页面调接口。
 * 没有页面时只显示空状态，不渲染可点的行。
 */
type PageListPanelProps = {
  pages: ProjectPageDto[];
  selectedPageId: string | null;
  onCreate: () => void;
  onEdit: (page: ProjectPageDto) => void;
  onDelete: (page: ProjectPageDto) => void;
  onSelect: (pageId: string) => void;
};

export function PageListPanel({ pages, selectedPageId, onCreate, onEdit, onDelete, onSelect }: PageListPanelProps) {
  const { t } = useTranslation();
  return (
    <Card
      size="small"
      className="editor-panel"
      title={t('lowcode.pages')}
      extra={
        <Button size="small" icon={<PlusOutlined />} onClick={onCreate}>
          {t('lowcode.createPage')}
        </Button>
      }
    >
      {pages.length === 0 ? (
        <Empty description={t('lowcode.emptyPages')} />
      ) : (
        <Listy
          className="page-list"
          items={pages}
          rowKey="id"
          itemRender={(page) => (
            <div
              className={page.id === selectedPageId ? 'page-list-row is-selected' : 'page-list-row'}
              onClick={() => onSelect(page.id)}
            >
              <div className="page-list-meta">
                <Typography.Text ellipsis>{page.name}</Typography.Text>
                <Typography.Text type="secondary" ellipsis>
                  {page.key}
                </Typography.Text>
              </div>
              <div className="page-list-actions">
                <Button type="link" onClick={() => onEdit(page)}>
                  {t('lowcode.edit')}
                </Button>
                <Popconfirm title={t('lowcode.confirmDelete')} onConfirm={() => void onDelete(page)}>
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
