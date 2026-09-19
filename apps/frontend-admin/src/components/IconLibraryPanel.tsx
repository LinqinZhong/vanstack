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
import type { ProjectIconFileDto, ProjectIconGroupDto } from '@vanstack/shared';
import { api } from '../apis/api';
import { resolveAssetUrl } from './AssetLibraryPanel';

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IconLibraryBrowser({
  projectId,
  onPick,
}: {
  projectId: string;
  onPick?: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ProjectIconGroupDto[]>([]);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectIconFileDto[]>([]);
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
      const next = await api.listIconGroups(projectId);
      setGroups(next);
      setGroupName((prev) => next.find((item) => item.name === prev)?.name ?? next[0]?.name ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.iconsLoadFailed'));
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
        const next = await api.listIconFiles(projectId, name);
        setFiles(next);
      } catch (error) {
        message.error(error instanceof Error ? error.message : t('lowcode.iconsLoadFailed'));
      } finally {
        setLoadingFiles(false);
      }
    },
    [projectId, t],
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
      const created = await api.createIconGroup(projectId, { name });
      setNewGroup('');
      setCreating(false);
      await loadGroups();
      setGroupName(created.name);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.iconsGroupFailed'));
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
      const renamed = await api.renameIconGroup(projectId, groupName, { name });
      setRenameOpen(false);
      await loadGroups();
      setGroupName(renamed.name);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.iconsGroupFailed'));
    }
  }

  async function removeGroup() {
    if (!groupName) {
      return;
    }
    try {
      await api.deleteIconGroup(projectId, groupName);
      await loadGroups();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.iconsGroupFailed'));
    }
  }

  function pickUpload(file: File) {
    if (!groupName) {
      message.warning(t('lowcode.iconsNeedGroup'));
      return false;
    }
    if (!/\.svg$/i.test(file.name)) {
      message.warning(t('lowcode.iconsNeedSvg'));
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
      message.warning(t('lowcode.iconsNeedName'));
      return;
    }
    setUploading(true);
    try {
      const stored = await api.uploadIconFile(projectId, groupName, pendingFile, name);
      setPendingFile(null);
      setUploadName('');
      await loadFiles(groupName);
      if (onPick) {
        onPick(resolveAssetUrl(stored.url));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.iconsUploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(file: ProjectIconFileDto) {
    if (!groupName) {
      return;
    }
    try {
      await api.deleteIconFile(projectId, groupName, file.name);
      await loadFiles(groupName);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.iconsDeleteFailed'));
    }
  }

  async function copyUrl(file: ProjectIconFileDto) {
    const url = resolveAssetUrl(file.url);
    try {
      await navigator.clipboard.writeText(url.startsWith('http') ? url : `${window.location.origin}${url}`);
      message.success(t('lowcode.iconsCopied'));
    } catch {
      message.error(t('lowcode.iconsCopyFailed'));
    }
  }

  return (
    <div className="asset-library-panel">
      <aside className="asset-library-groups">
        <div className="language-library-section-head">
          <span>{t('lowcode.iconsGroups')}</span>
          <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setCreating(true)} />
        </div>
        {creating ? (
          <div className="asset-library-create">
            <Input
              size="small"
              autoFocus
              maxLength={64}
              value={newGroup}
              placeholder={t('lowcode.iconsGroupName')}
              onChange={(event) => setNewGroup(event.target.value)}
              onPressEnter={() => void createGroup()}
            />
            <Button size="small" type="primary" onClick={() => void createGroup()}>
              {t('lowcode.iconsCreateGroup')}
            </Button>
            <Button size="small" onClick={() => setCreating(false)}>
              {t('lowcode.iconsCancel')}
            </Button>
          </div>
        ) : null}
        {loadingGroups ? (
          <Spin />
        ) : groups.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.iconsEmptyGroups')} />
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
          <span>{groupName ?? t('lowcode.iconsEmptyGroups')}</span>
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
                  {t('lowcode.iconsEditGroup')}
                </Button>
                <Popconfirm title={t('lowcode.iconsConfirmDeleteGroup')} onConfirm={() => void removeGroup()}>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={!groupName}>
                    {t('lowcode.iconsDeleteGroup')}
                  </Button>
                </Popconfirm>
              </>
            )}
            <Upload
              accept=".svg,image/svg+xml"
              showUploadList={false}
              beforeUpload={(file) => pickUpload(file)}
              disabled={!groupName || uploading}
            >
              <Button size="small" type="primary" icon={<UploadOutlined />} loading={uploading} disabled={!groupName}>
                {t('lowcode.iconsUpload')}
              </Button>
            </Upload>
          </div>
        </div>
        {loadingFiles ? (
          <Spin />
        ) : !groupName ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.iconsEmptyGroups')} />
        ) : files.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.iconsEmptyFiles')} />
        ) : (
          <div className="asset-library-grid icon-library-grid">
            {files.map((file) => (
              <article
                key={file.key}
                className={['asset-library-card-item', onPick ? 'is-pickable' : ''].filter(Boolean).join(' ')}
                onClick={onPick ? () => onPick(resolveAssetUrl(file.url)) : undefined}
              >
                <div className="asset-library-thumb icon-library-thumb">
                  <img src={resolveAssetUrl(file.url)} alt={file.name} />
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
        title={t('lowcode.iconsEditGroup')}
        open={renameOpen}
        onOk={() => void renameGroup()}
        onCancel={() => setRenameOpen(false)}
      >
        <Input
          value={renameValue}
          maxLength={64}
          placeholder={t('lowcode.iconsGroupName')}
          onChange={(event) => setRenameValue(event.target.value)}
          onPressEnter={() => void renameGroup()}
        />
      </Modal>
      <Modal
        title={t('lowcode.iconsUpload')}
        open={Boolean(pendingFile)}
        okText={t('lowcode.iconsUpload')}
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
          placeholder={t('lowcode.iconsFileName')}
          onChange={(event) => setUploadName(event.target.value)}
          onPressEnter={() => void confirmUpload()}
        />
      </Modal>
    </div>
  );
}

export function IconLibraryPanel({ projectId }: { projectId: string }) {
  return <IconLibraryBrowser projectId={projectId} />;
}

const EDITOR_MODAL_THEME = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#3dba9a',
    colorBgContainer: '#33404c',
    colorBgContainerDisabled: '#2a333c',
    colorBgElevated: '#171e25',
    colorError: '#ff4d4f',
    colorBorder: 'rgba(255, 255, 255, 0.26)',
    colorText: 'rgba(255, 255, 255, 0.92)',
    colorTextHeading: 'rgba(255, 255, 255, 0.95)',
    colorTextLabel: 'rgba(255, 255, 255, 0.84)',
    colorTextPlaceholder: 'rgba(255, 255, 255, 0.48)',
    colorFillTertiary: 'rgba(255, 255, 255, 0.12)',
  },
};

export function IconPicker({
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
      <Tooltip title={t('lowcode.iconsPickIcon')}>
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
          title={t('lowcode.iconsPickIcon')}
          open={open}
          footer={null}
          width={860}
          destroyOnHidden
          onCancel={() => setOpen(false)}
        >
          <IconLibraryBrowser
            projectId={projectId}
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
