import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, ConfigProvider, Empty, Input, Modal, Popconfirm, Spin, Tooltip, Upload, message, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectAssetFileDto, ProjectAssetGroupDto } from '@vanstack/shared';
import { api } from '../apis/api';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function resolveAssetUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (url.startsWith('/')) {
    return url;
  }
  return `/${url}`;
}

export function isImageAsset(name: string) {
  return IMAGE_EXT.test(name);
}

export function AssetLibraryBrowser({
  projectId,
  imagesOnly,
  onPick,
}: {
  projectId: string;
  imagesOnly?: boolean;
  onPick?: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ProjectAssetGroupDto[]>([]);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectAssetFileDto[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const next = await api.listAssetGroups(projectId);
      setGroups(next);
      setGroupName((prev) => next.find((item) => item.name === prev)?.name ?? next[0]?.name ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.assetsLoadFailed'));
    } finally {
      setLoadingGroups(false);
    }
  }, [projectId, t]);

  const loadFiles = useCallback(
    async (name: string | null) => {
      if (!name) {
        setFiles([]);
        return;
      }
      setLoadingFiles(true);
      try {
        const next = await api.listAssetFiles(projectId, name);
        setFiles(imagesOnly ? next.filter((file) => isImageAsset(file.name)) : next);
      } catch (error) {
        message.error(error instanceof Error ? error.message : t('lowcode.assetsLoadFailed'));
      } finally {
        setLoadingFiles(false);
      }
    },
    [imagesOnly, projectId, t],
  );

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    void loadFiles(groupName);
  }, [groupName, loadFiles]);

  async function createGroup() {
    const name = newGroup.trim();
    if (!name) {
      return;
    }
    try {
      const created = await api.createAssetGroup(projectId, { name });
      setNewGroup('');
      setCreating(false);
      await loadGroups();
      setGroupName(created.name);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.assetsGroupFailed'));
    }
  }

  async function renameGroup() {
    if (!groupName) {
      return;
    }
    const name = renameValue.trim();
    if (!name) {
      return;
    }
    try {
      const renamed = await api.renameAssetGroup(projectId, groupName, { name });
      setRenameOpen(false);
      await loadGroups();
      setGroupName(renamed.name);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.assetsGroupFailed'));
    }
  }

  async function removeGroup() {
    if (!groupName) {
      return;
    }
    try {
      await api.deleteAssetGroup(projectId, groupName);
      await loadGroups();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.assetsGroupFailed'));
    }
  }

  function pickUpload(file: File) {
    if (!groupName) {
      message.warning(t('lowcode.assetsNeedGroup'));
      return false;
    }
    if (imagesOnly && !isImageAsset(file.name)) {
      message.warning(t('lowcode.assetsNeedImage'));
      return false;
    }
    setPendingFile(file);
    setUploadName(file.name.replace(/\.[^.]+$/, '') || file.name);
    return false;
  }

  async function confirmUpload() {
    if (!groupName || !pendingFile) {
      return;
    }
    const name = uploadName.trim();
    if (!name) {
      message.warning(t('lowcode.assetsNeedName'));
      return;
    }
    setUploading(true);
    try {
      const stored = await api.uploadAssetFile(projectId, groupName, pendingFile, name);
      setPendingFile(null);
      setUploadName('');
      await loadFiles(groupName);
      if (onPick) {
        onPick(resolveAssetUrl(stored.url));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.assetsUploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(file: ProjectAssetFileDto) {
    if (!groupName) {
      return;
    }
    try {
      await api.deleteAssetFile(projectId, groupName, file.name);
      await loadFiles(groupName);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.assetsDeleteFailed'));
    }
  }

  async function copyUrl(file: ProjectAssetFileDto) {
    const url = resolveAssetUrl(file.url);
    try {
      await navigator.clipboard.writeText(url.startsWith('http') ? url : `${window.location.origin}${url}`);
      message.success(t('lowcode.assetsCopied'));
    } catch {
      message.error(t('lowcode.assetsCopyFailed'));
    }
  }

  return (
    <div className="asset-library-panel">
      <aside className="asset-library-groups">
        <div className="language-library-section-head">
          <span>{t('lowcode.assetsGroups')}</span>
          <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setCreating(true)} />
        </div>
        {creating ? (
          <div className="asset-library-create">
            <Input
              size="small"
              autoFocus
              maxLength={64}
              value={newGroup}
              placeholder={t('lowcode.assetsGroupName')}
              onChange={(event) => setNewGroup(event.target.value)}
              onPressEnter={() => void createGroup()}
            />
            <Button size="small" type="primary" onClick={() => void createGroup()}>
              {t('lowcode.assetsCreateGroup')}
            </Button>
            <Button size="small" onClick={() => setCreating(false)}>
              {t('lowcode.assetsCancel')}
            </Button>
          </div>
        ) : null}
        {loadingGroups ? (
          <Spin />
        ) : groups.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.assetsEmptyGroups')} />
        ) : (
          <div className="asset-library-group-list">
            {groups.map((group) => (
              <button
                key={group.name}
                type="button"
                className={['asset-library-group', group.name === groupName ? 'is-active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setGroupName(group.name)}
              >
                <FolderOpenOutlined />
                <span>{group.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>
      <section className="asset-library-files">
        <div className="language-library-section-head">
          <span>{groupName ?? t('lowcode.assetsEmptyGroups')}</span>
          <div className="asset-library-file-actions">
            {onPick ? null : (
              <>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  disabled={!groupName}
                  onClick={() => {
                    setRenameValue(groupName ?? '');
                    setRenameOpen(true);
                  }}
                >
                  {t('lowcode.assetsEditGroup')}
                </Button>
                <Popconfirm title={t('lowcode.assetsConfirmDeleteGroup')} onConfirm={() => void removeGroup()}>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={!groupName}>
                    {t('lowcode.assetsDeleteGroup')}
                  </Button>
                </Popconfirm>
              </>
            )}
            <Upload
              accept={imagesOnly ? 'image/*' : '*'}
              showUploadList={false}
              beforeUpload={(file) => pickUpload(file)}
              disabled={!groupName || uploading}
            >
              <Button size="small" type="primary" icon={<UploadOutlined />} loading={uploading} disabled={!groupName}>
                {t('lowcode.assetsUpload')}
              </Button>
            </Upload>
          </div>
        </div>
        {loadingFiles ? (
          <Spin />
        ) : !groupName ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.assetsEmptyGroups')} />
        ) : files.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.assetsEmptyFiles')} />
        ) : (
          <div className="asset-library-grid">
            {files.map((file) => (
              <article
                key={file.key}
                className={['asset-library-card-item', onPick ? 'is-pickable' : ''].filter(Boolean).join(' ')}
                onClick={onPick ? () => onPick(resolveAssetUrl(file.url)) : undefined}
              >
                <div className="asset-library-thumb">
                  {isImageAsset(file.name) ? (
                    <img src={resolveAssetUrl(file.url)} alt={file.name} />
                  ) : (
                    <span>{file.name.slice(file.name.lastIndexOf('.') + 1).toUpperCase() || 'FILE'}</span>
                  )}
                </div>
                <div className="asset-library-meta">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{formatSize(file.size)}</span>
                </div>
                {onPick ? null : (
                  <div className="asset-library-item-actions">
                    <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => void copyUrl(file)} />
                    <Popconfirm title={t('lowcode.confirmDelete')} onConfirm={() => void removeFile(file)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <Modal
        title={t('lowcode.assetsEditGroup')}
        open={renameOpen}
        onOk={() => void renameGroup()}
        onCancel={() => setRenameOpen(false)}
      >
        <Input
          value={renameValue}
          maxLength={64}
          placeholder={t('lowcode.assetsGroupName')}
          onChange={(event) => setRenameValue(event.target.value)}
          onPressEnter={() => void renameGroup()}
        />
      </Modal>
      <Modal
        title={t('lowcode.assetsUpload')}
        open={Boolean(pendingFile)}
        okText={t('lowcode.assetsUpload')}
        confirmLoading={uploading}
        onOk={() => void confirmUpload()}
        onCancel={() => {
          if (uploading) {
            return;
          }
          setPendingFile(null);
          setUploadName('');
        }}
      >
        <Input
          autoFocus
          maxLength={200}
          value={uploadName}
          placeholder={t('lowcode.assetsFileName')}
          onChange={(event) => setUploadName(event.target.value)}
          onPressEnter={() => void confirmUpload()}
        />
      </Modal>
    </div>
  );
}

export function AssetLibraryPanel({ projectId }: { projectId: string }) {
  return <AssetLibraryBrowser projectId={projectId} />;
}

const EDITOR_MODAL_THEME = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#3dba9a',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorError: '#ff4d4f',
  },
};

export function AssetImagePicker({
  projectId,
  disabled,
  onPick,
}: {
  projectId: string;
  disabled?: boolean;
  onPick: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={t('lowcode.assetsPickImage')}>
        <Button
          size="small"
          type="text"
          disabled={disabled}
          icon={<PictureOutlined />}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <ConfigProvider theme={EDITOR_MODAL_THEME}>
        <Modal
          className="asset-picker-modal"
          title={t('lowcode.assetsPickImage')}
          open={open}
          footer={null}
          width={860}
          destroyOnHidden
          onCancel={() => setOpen(false)}
        >
          <AssetLibraryBrowser
            projectId={projectId}
            imagesOnly
            onPick={(url) => {
              onPick(url);
              setOpen(false);
            }}
          />
        </Modal>
      </ConfigProvider>
    </>
  );
}
