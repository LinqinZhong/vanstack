import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type RuntimeProjectDto } from '@vanstack/shared';
import { renderPageXml } from '@vanstack/lowcode-runtime';
import { pageI18nFromSnapshot, pickPageLocale, type PageI18n } from '@vanstack/xml';
import { loadLangJson, loadPageXml, pickRuntimeLang, pickRuntimePage, preloadPageLangs, preloadPageXml } from './runtime';

const DEMO_PAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<page>
  <flex id="f1" flex-direction="row" justify-content="space-between" gap="8">
    <text id="t1" value="左" />
    <button id="b1" text="右" />
  </flex>
</page>`;

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
  const [xml, setXml] = useState('');
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
      setXml(DEMO_PAGE_XML);
      setCatalog(undefined);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setXml('');
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
      loadPageXml(page.xmlUrl),
      langMeta ? loadLangJson(langMeta.jsonUrl) : Promise.resolve(null),
    ]);
    for (const other of project.pages) {
      if (other.xmlUrl !== page.xmlUrl) {
        preloadPageXml(other.xmlUrl);
      }
      preloadPageLangs(other);
    }
    void loading
      .then(([nextXml, snapshot]) => {
        if (cancelled) {
          return;
        }
        setXml(nextXml);
        setCatalog(snapshot ? pageI18nFromSnapshot(snapshot) : undefined);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setXml('');
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
    if (!xml) {
      mountRef.current.replaceChildren();
      return;
    }
    renderPageXml(mountRef.current, xml, {
      locale: pickPageLocale(catalog, lang),
      catalog,
    });
  }, [catalog, lang, xml]);

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
