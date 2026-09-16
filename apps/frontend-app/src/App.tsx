import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentDto, Locale } from '@vanstack/shared';
import { LOCALES } from '@vanstack/shared';
import { api, localeLabel } from './api';

const emptyDraft: Pick<DocumentDto, 'title' | 'summary' | 'content' | 'locale'> = {
  title: '',
  summary: '',
  content: '',
  locale: 'zh',
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [xmlText, setXmlText] = useState('');
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => documents.find((item) => item.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const load = useCallback(async () => {
    try {
      const [health, list] = await Promise.all([api.health(), api.listDocuments()]);
      setOnline(health.ok);
      setDocuments(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, i18n.language]);

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft);
      return;
    }
    setDraft({
      title: selected.title,
      summary: selected.summary,
      content: selected.content,
      locale: selected.locale,
    });
  }, [selected]);

  async function run<T>(task: () => Promise<T>) {
    setBusy(true);
    try {
      const result = await task();
      return result;
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function createDocument() {
    const result = await run(() =>
      api.createDocument({
        title: i18n.language === 'zh' ? '未命名文档' : 'Untitled',
        locale: (i18n.resolvedLanguage as Locale) ?? 'zh',
      }),
    );
    setToast(result.message);
    await load();
    setSelectedId(result.item.id);
  }

  async function saveDocument() {
    if (!selected) {
      return;
    }
    const result = await run(() => api.updateDocument(selected.id, draft));
    setToast(result.message);
    await load();
  }

  async function deleteDocument() {
    if (!selected) {
      return;
    }
    await run(() => api.deleteDocument(selected.id));
    setSelectedId(null);
    await load();
  }

  async function importXml() {
    const result = await run(() => api.importXml(xmlText));
    setToast(result.message);
    await load();
    setSelectedId(result.items[0]?.id ?? null);
  }

  async function exportXml(id?: string) {
    const xml = await run(() => api.exportXml(id));
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = id ? `document-${id}.xml` : 'documents.xml';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selected) {
      return;
    }
    const result = await run(() => api.uploadFile(file, selected.id));
    setToast(result.message);
    await load();
  }

  async function removeFile(id: string) {
    await run(() => api.deleteFile(id));
    await load();
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
          <li>{t('nav.workspace')}</li>
          <li>{t('nav.xml')}</li>
          <li>{t('nav.oss')}</li>
          <li>
            <a href="http://127.0.0.1:5174">{t('nav.admin')}</a>
          </li>
        </ul>
        <p className={`status ${online ? 'ok' : ''}`}>
          {online ? t('status.online') : t('status.offline')}
        </p>
      </aside>

      <main className="workspace">
        <section className="panel">
          <div className="panel-header">
            <strong>{t('nav.workspace')}</strong>
            <div className="toolbar-actions">
              <button className="ghost" onClick={() => void load()} type="button">
                {t('actions.refresh')}
              </button>
              <button className="button" onClick={() => void createDocument()} type="button">
                {t('actions.newDocument')}
              </button>
            </div>
          </div>
          {documents.length === 0 ? (
            <p className="empty">{t('document.empty')}</p>
          ) : (
            <ul className="doc-list">
              {documents.map((item) => (
                <li key={item.id}>
                  <button
                    className={`doc-item ${item.id === selectedId ? 'active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                    type="button"
                  >
                    {item.title}
                    <small>
                      {t('document.updated')} {new Date(item.updatedAt).toLocaleString()}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="editor-toolbar">
            <strong>{selected ? selected.title : t('actions.newDocument')}</strong>
            <div className="toolbar-actions">
              <button className="ghost" disabled={!selected} onClick={() => void exportXml(selected?.id)} type="button">
                {t('actions.exportXml')}
              </button>
              <button className="button" disabled={!selected || busy} onClick={() => void saveDocument()} type="button">
                {t('actions.save')}
              </button>
              <button className="button danger" disabled={!selected} onClick={() => void deleteDocument()} type="button">
                {t('actions.delete')}
              </button>
            </div>
          </div>

          <div className="form-grid">
            <label>
              {t('document.title')}
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              {t('document.locale')}
              <select
                value={draft.locale}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, locale: event.target.value as Locale }))
                }
              >
                {LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {localeLabel[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('document.summary')}
              <input
                value={draft.summary}
                onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
            <label>
              {t('document.content')}
              <textarea
                value={draft.content}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              />
            </label>

            <div>
              <div className="panel-header">
                <span>{t('document.attachments')}</span>
                <label className="button">
                  {t('actions.upload')}
                  <input disabled={!selected} hidden type="file" onChange={(event) => void uploadFile(event)} />
                </label>
              </div>
              <div className="files">
                {selected?.files.map((file) => (
                  <a className="file-pill" href={file.url} key={file.id} rel="noreferrer" target="_blank">
                    {file.originalName}
                    <button className="ghost" onClick={(event) => { event.preventDefault(); void removeFile(file.id); }} type="button">
                      ×
                    </button>
                  </a>
                ))}
              </div>
            </div>

            <label>
              {t('xml.hint')}
              <textarea
                className="xml-box"
                placeholder={t('xml.placeholder')}
                value={xmlText}
                onChange={(event) => setXmlText(event.target.value)}
              />
            </label>
            <div className="toolbar-actions">
              <button className="button" disabled={!xmlText.trim() || busy} onClick={() => void importXml()} type="button">
                {t('actions.importXml')}
              </button>
              <button className="ghost" onClick={() => void exportXml()} type="button">
                {t('actions.exportXml')}
              </button>
            </div>
            {toast ? <p className="toast">{toast}</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
