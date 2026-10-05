import { RightOutlined } from '@ant-design/icons';
import { Button, Card, Empty, List, Popconfirm, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
/**
 * 右侧工程版本列表。折叠只收起侧栏，不改变当前选中项。
 */
export type VersionListItem = {
  id: string;
  versionNo: number;
};

type VersionListPanelProps = {
  versions: VersionListItem[];
  selectedVersionId: string | null;
  createDisabled: boolean;
  onCollapse: () => void;
  onCreate: () => void;
  onSelect: (version: VersionListItem) => void;
  onDelete: (version: VersionListItem) => void;
};

export function VersionListPanel({
  versions,
  selectedVersionId,
  createDisabled,
  onCollapse,
  onCreate,
  onSelect,
  onDelete,
}: VersionListPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="editor-versions">
      <button
        type="button"
        className="versions-collapse"
        aria-label={t('lowcode.collapseVersions')}
        title={t('lowcode.collapseVersions')}
        onClick={onCollapse}
      >
        <RightOutlined />
      </button>
      <Card
        size="small"
        className="editor-panel"
        title={t('lowcode.versions')}
        extra={
          <Button size="small" disabled={createDisabled} onClick={onCreate}>
            {t('lowcode.createVersion')}
          </Button>
        }
      >
        {versions.length === 0 ? (
          <Empty description={t('lowcode.emptyVersions')} />
        ) : (
          <Radio.Group
            value={selectedVersionId}
            onChange={(event) => {
              const version = versions.find((item) => item.id === event.target.value);
              if (version) {
                onSelect(version);
              }
            }}
            style={{ width: '100%' }}
          >
            <List
              className="version-list"
              dataSource={versions}
              renderItem={(version) => (
                <List.Item>
                  <div className="version-item">
                    <Radio value={version.id}>v{version.versionNo}</Radio>
                    <div className="version-item-actions">
                      <Popconfirm title={t('lowcode.confirmDelete')} onConfirm={() => void onDelete(version)}>
                        <Button type="link" danger>
                          {t('lowcode.delete')}
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Radio.Group>
        )}
      </Card>
    </div>
  );
}
