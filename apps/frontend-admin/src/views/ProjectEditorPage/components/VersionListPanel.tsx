import { RightOutlined } from '@ant-design/icons';
import { Button, Card, Empty, List, Popconfirm, Radio, Space, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProjectPageVersionDto } from '@vanstack/shared';

/**
 * 右侧版本列表。单选切换正在编辑的版本；草稿可发布，已发布可设为使用中。
 * 使用中的版本不能删除。折叠只收起侧栏，不改变当前选中项。
 * 没有选中页面时 createDisabled 为真，不能新建版本。
 */
type VersionListPanelProps = {
  versions: ProjectPageVersionDto[];
  selectedVersionId: string | null;
  createDisabled: boolean;
  onCollapse: () => void;
  onCreate: () => void;
  onSelect: (version: ProjectPageVersionDto) => void;
  onPublish: (version: ProjectPageVersionDto) => void;
  onActivate: (version: ProjectPageVersionDto) => void;
  onDelete: (version: ProjectPageVersionDto) => void;
};

export function VersionListPanel({
  versions,
  selectedVersionId,
  createDisabled,
  onCollapse,
  onCreate,
  onSelect,
  onPublish,
  onActivate,
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
                    <Radio value={version.id}>
                      <Space size={6}>
                        <span>v{version.versionNo}</span>
                        <Tag
                          color={
                            version.status === 'in_use'
                              ? 'success'
                              : version.status === 'published'
                                ? 'blue'
                                : 'default'
                          }
                        >
                          {t(`lowcode.versionStatus.${version.status}`)}
                        </Tag>
                      </Space>
                    </Radio>
                    <div className="version-item-actions">
                      {version.status === 'draft' ? (
                        <Button type="link" onClick={() => void onPublish(version)}>
                          {t('lowcode.publishVersion')}
                        </Button>
                      ) : null}
                      {version.status === 'published' ? (
                        <Button type="link" onClick={() => void onActivate(version)}>
                          {t('lowcode.useVersion')}
                        </Button>
                      ) : null}
                      {version.status === 'in_use' ? null : (
                        <Popconfirm title={t('lowcode.confirmDelete')} onConfirm={() => void onDelete(version)}>
                          <Button type="link" danger>
                            {t('lowcode.delete')}
                          </Button>
                        </Popconfirm>
                      )}
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
