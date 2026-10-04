import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, List, Popconfirm } from 'antd';
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
        <List
          dataSource={pages}
          renderItem={(page) => (
            <List.Item
              className={page.id === selectedPageId ? 'is-selected' : undefined}
              actions={[
                <Button key="edit" type="link" onClick={() => onEdit(page)}>
                  {t('lowcode.edit')}
                </Button>,
                <Popconfirm key="del" title={t('lowcode.confirmDelete')} onConfirm={() => void onDelete(page)}>
                  <Button type="link" danger>
                    {t('lowcode.delete')}
                  </Button>
                </Popconfirm>,
              ]}
              onClick={() => onSelect(page.id)}
            >
              <List.Item.Meta title={page.name} description={page.key} />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
