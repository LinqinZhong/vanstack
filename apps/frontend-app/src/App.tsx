import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type RuntimeProjectDto } from '@vanstack/shared';
import { renderPage } from '@vanstack/lowcode-runtime';
import { pageI18nFromSnapshot, pickPageLocale, type PageI18n, type PageXmlDocument } from '@vanstack/xml';
import { loadLangJson, loadPageDocument, pickRuntimeLang, pickRuntimePage, preloadPageDocument, preloadPageLangs } from './runtime';

const DEMO_PAGE: PageXmlDocument = {
  widgets: [
    {
      type: 'flex',
      id: 'f1',
      flex: { flexDirection: 'row', justifyContent: 'space-between', columnGap: 8, rowGap: 8 },
      children: [
        { type: 'text', id: 't1', value: '左' },
        { type: 'button', id: 'b1', text: '右' },
      ],
    },
  ],
};

function parsePath() {
  const [projectKey = '', pageKey = ''] = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  return { projectKey, pageKey };
}

export default function App() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const mountRef = useRef<HTMLDivElement>(null);
  const [{ projectKey, pageKey }, setRoute] = useState(parsePath);
  const [project, setProject] = useState<RuntimeProjectDto | null>(null);
  const [pageDocument, setPageDocument] = useState<PageXmlDocument | null>(null);
  const [catalog, setCatalog] = useState<PageI18n | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'loading' | 'missing' | 'empty' | 'ready'>(
    projectKey ? 'loading' : 'idle',
  );

  useEffect(() => {
    function onPopState() {
      setRoute(parsePath());
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!projectKey) {
      setProject(null);
      setPageDocument(DEMO_PAGE);
      setCatalog(undefined);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setPageDocument(null);
    setCatalog(undefined);
    void fetch(`/api/runtime/projects/${encodeURIComponent(projectKey)}?lang=${encodeURIComponent(lang)}`, {
      headers: { Accept: 'application/json', 'x-lang': lang },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        return (await response.json()) as RuntimeProjectDto;
      })
      .then((next) => {
        if (!cancelled) {
          setProject(next);
          if (next.pages.length === 0) {
            setStatus('empty');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProject(null);
          setStatus('missing');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lang, projectKey]);

  useEffect(() => {
    if (!project || project.pages.length === 0) {
      return;
    }
    const page = pickRuntimePage(project, pageKey);
    if (!page) {
      setStatus('empty');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    const langMeta = pickRuntimeLang(page.langs ?? [], lang);
    const loading = Promise.all([
      loadPageDocument(page.documentUrl),
      langMeta ? loadLangJson(langMeta.jsonUrl) : Promise.resolve(null),
    ]);
    for (const other of project.pages) {
      if (other.documentUrl !== page.documentUrl) {
        preloadPageDocument(other.documentUrl);
      }
      preloadPageLangs(other);
    }
    void loading
      .then(([nextDocument, snapshot]) => {
        if (cancelled) {
          return;
        }
        setPageDocument(nextDocument);
        setCatalog(snapshot ? pageI18nFromSnapshot(snapshot) : undefined);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setPageDocument(null);
          setCatalog(undefined);
          setStatus('missing');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lang, pageKey, project]);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }
    if (!pageDocument) {
      mountRef.current.replaceChildren();
      return;
    }
    renderPage(mountRef.current, pageDocument, {
      locale: pickPageLocale(catalog, lang),
      catalog,
    });
  }, [catalog, lang, pageDocument]);

  return (
    <div className="h5-frame">
      <main className={status === 'ready' ? 'h5-body is-runtime' : 'h5-body'}>
        {status === 'idle' ? <p className="h5-hint">{t('runtime.hint')}</p> : null}
        {status === 'loading' ? <p className="h5-hint">{t('runtime.loading')}</p> : null}
        {status === 'missing' ? <p className="h5-hint">{t('runtime.missing')}</p> : null}
        {status === 'empty' ? <p className="h5-hint">{t('runtime.empty')}</p> : null}
        <div ref={mountRef} className="h5-runtime" />
      </main>
    </div>
  );
}
