import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentDto, DocumentFileDto } from '@vanstack/shared';
import { LOCALES } from '@vanstack/shared';
import { api, localeLabel } from './api';

export default function App() {
  const { t, i18n } = useTranslation();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [files, setFiles] = useState<DocumentFileDto[]>([]);
  const [online, setOnline] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const [health, docs, objects] = await Promise.all([
        api.health(),
        api.listDocuments(),
        api.listFiles(),
      ]);
      setOnline(health.ok);
      setDocuments(docs);
      setFiles(objects);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, i18n.language]);

  async function removeDocument(id: string) {
    await api.deleteDocument(id);
    await load();
  }

  async function removeFile(id: string) {
    await api.deleteFile(id);
    await load();
  }

  async function exportXml() {
    const xml = await api.exportXml();
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'documents.xml';
    anchor.click();
    URL.revokeObjectURL(url);
    setToast('XML');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">{t('app.name')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
        <div className="lang-switch">
          {LOCALES.map((locale) => (
            <button
              key={locale}
              className={`chip ${i18n.language.startsWith(locale) ? 'active' : ''}`}
              onClick={() => void i18n.changeLanguage(locale)}
              type="button"
            >
              {localeLabel[locale]}
            </button>
          ))}
        </div>
        <ul className="nav-list">
          <li>{t('nav.overview')}</li>
          <li>{t('nav.documents')}</li>
          <li>{t('nav.files')}</li>
          <li>
            <a href="http://127.0.0.1:5173">{t('nav.app')}</a>
          </li>
        </ul>
        <p className={`status ${online ? 'ok' : ''}`}>
          {online ? t('status.online') : t('status.offline')}
        </p>
      </aside>

      <main className="workspace">
        <section className="stats">
          <div className="panel">
            <span>{t('status.documents')}</span>
            <p className="metric">{documents.length}</p>
          </div>
          <div className="panel">
            <span>{t('status.files')}</span>
            <p className="metric">{files.length}</p>
          </div>
          <div className="panel">
            <span>{t('status.online')}</span>
            <p className="metric">{online ? 'OK' : '—'}</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <strong>{t('nav.documents')}</strong>
            <div className="toolbar-actions">
              <button className="ghost" onClick={() => void load()} type="button">
                {t('actions.refresh')}
              </button>
              <button className="button" onClick={() => void exportXml()} type="button">
                {t('actions.exportXml')}
              </button>
            </div>
          </div>
          {documents.length === 0 ? (
            <p className="empty">{t('document.empty')}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('document.title')}</th>
                  <th>{t('document.locale')}</th>
                  <th>{t('document.attachments')}</th>
                  <th>{t('document.updated')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{localeLabel[item.locale]}</td>
                    <td>{item.files.length}</td>
                    <td>{new Date(item.updatedAt).toLocaleString()}</td>
                    <td>
                      <button className="button danger" onClick={() => void removeDocument(item.id)} type="button">
                        {t('actions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <strong>{t('nav.files')}</strong>
          </div>
          {files.length === 0 ? (
            <p className="empty">{t('file.empty')}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('file.name')}</th>
                  <th>{t('file.size')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <a href={file.url} rel="noreferrer" target="_blank">
                        {file.originalName}
                      </a>
                    </td>
                    <td>{file.size}</td>
                    <td>
                      <button className="button danger" onClick={() => void removeFile(file.id)} type="button">
                        {t('actions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {toast ? <p className="toast">{toast}</p> : null}
        </section>
      </main>
    </div>
  );
}
