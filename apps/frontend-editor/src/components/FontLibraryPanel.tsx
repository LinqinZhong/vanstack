import { DeleteOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Popconfirm, Spin, Upload, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectFontFileDto } from '@vanstack/shared';
import { api } from '../apis/api';
import { useProjectVersionId } from '../utils/projectVersion';
import { resolveAssetUrl } from './AssetLibraryPanel';
import { fontFamilyFor, refreshFontCatalog } from '../utils/fontCatalog';

const FONT_EXT = /\.(ttf|otf|woff2?|eot)$/i;

const DEFAULT_PREVIEW_TEXT = [
  '你好，这是字体包的预览效果。',
  '你好，這是字體包的預覽效果。',
  'Hello, This is a preview of the font package.',
].join('\n');

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FontLibraryPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const versionId = useProjectVersionId();
  const [files, setFiles] = useState<ProjectFontFileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [previewFile, setPreviewFile] = useState<ProjectFontFileDto | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      if (!versionId) {
        setFiles([]);
        return;
      }
      setFiles(await api.listFonts(projectId, versionId));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.fontsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [projectId, t, versionId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  function pickUpload(file: File) {
    if (!FONT_EXT.test(file.name)) {
      message.warning(t('lowcode.fontsNeedFont'));
      return false;
    }
    setPendingFile(file);
    setUploadName(file.name.replace(/\.[^.]+$/, '') || file.name);
    return false;
  }

  async function confirmUpload() {
    if (!pendingFile) {
      return;
    }
    const name = uploadName.trim();
    if (!name) {
      message.warning(t('lowcode.fontsNeedName'));
      return;
    }
    setUploading(true);
    try {
      if (!versionId) {
        return;
      }
      await api.uploadFont(projectId, versionId, pendingFile, name);
      setPendingFile(null);
      setUploadName('');
      await loadFiles();
      void refreshFontCatalog(projectId, versionId).catch(() => undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.fontsUploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(file: ProjectFontFileDto) {
    try {
      if (!versionId) {
        return;
      }
      await api.deleteFont(projectId, versionId, file.name);
      await loadFiles();
      void refreshFontCatalog(projectId, versionId).catch(() => undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('lowcode.fontsDeleteFailed'));
    }
  }

  return (
    <div className="asset-library-panel font-library-panel">
      <section className="asset-library-files font-library-files">
        <div className="language-library-section-head">
          <span>{t('lowcode.fontsTitle')}</span>
          <div className="asset-library-file-actions">
            <Upload
              accept=".ttf,.otf,.woff,.woff2,.eot"
              showUploadList={false}
              beforeUpload={(file) => pickUpload(file)}
              disabled={uploading}
            >
              <Button size="small" type="primary" icon={<UploadOutlined />} loading={uploading}>
                {t('lowcode.fontsUpload')}
              </Button>
            </Upload>
          </div>
        </div>
        {loading ? (
          <Spin />
        ) : files.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.fontsEmpty')} />
        ) : (
          <div className="asset-library-grid font-library-grid">
            {files.map((file) => (
              <article key={file.key} className="asset-library-card-item">
                <div className="asset-library-thumb font-library-thumb">Aa</div>
                <div className="asset-library-meta">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{formatSize(file.size)}</span>
                </div>
                <div className="asset-library-item-actions">
                  <Button
                    size="small"
                    type="text"
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewFile(file)}
                  >
                    {t('lowcode.fontsPreview')}
                  </Button>
                  <Popconfirm title={t('lowcode.confirmDelete')} onConfirm={() => void removeFile(file)}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <Modal
        title={t('lowcode.fontsUpload')}
        open={Boolean(pendingFile)}
        okText={t('lowcode.fontsUpload')}
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
          placeholder={t('lowcode.fontsFileName')}
          onChange={(event) => setUploadName(event.target.value)}
          onPressEnter={() => void confirmUpload()}
        />
      </Modal>
      <FontPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}

function FontPreviewModal({ file, onClose }: { file: ProjectFontFileDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(DEFAULT_PREVIEW_TEXT);

  useEffect(() => {
    if (!file) {
      return;
    }
    setText(DEFAULT_PREVIEW_TEXT);
    const url = resolveAssetUrl(file.url);
    const family = fontFamilyFor(file);
    let styleEl = document.getElementById('vanstack-font-preview-face') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'vanstack-font-preview-face';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@font-face { font-family: '${family}'; src: url('${url}'); font-display: swap; }`;
  }, [file]);

  return (
    <Modal
      className="font-preview-modal"
      title={t('lowcode.fontsPreview')}
      open={Boolean(file)}
      footer={null}
      width={560}
      onCancel={onClose}
    >
      <Input.TextArea
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoSize={{ minRows: 3, maxRows: 6 }}
      />
      <div
        className="font-preview-stage"
        style={{ fontFamily: file ? `'${fontFamilyFor(file)}'` : undefined }}
      >
        {text.split('\n').map((line, index) => (
          <div key={index}>{line || '\u00A0'}</div>
        ))}
      </div>
    </Modal>
  );
}