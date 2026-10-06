import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type RuntimeProjectDto } from '@vanstack/shared';
import { installPageNavigation, renderPage } from '@vanstack/lowcode-runtime';
import { buildPropsRecord, pageI18nFromSnapshot, pickPageLocale, type PageI18n, type PageXmlDocument } from '@vanstack/xml';
import {
  pageUrl,
  parseRoute,
  plainQuery,
  readNavIndex,
  resetPendingBack,
  takeBackSteps,
  withNavIndex,
  type PageQuery,
} from './navigation';
import { loadLangJson, loadPageDocument, loadRuntimeEvent, pickRuntimeLang, pickRuntimePage, preloadPageDocument, preloadPageLangs } from './runtime';

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

export default function App() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const mountRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState(() => parseRoute(window.location));
  const { projectKey, pageKey } = route;
  const [project, setProject] = useState<RuntimeProjectDto | null>(null);
  const [pageDocument, setPageDocument] = useState<PageXmlDocument | null>(null);
  const [catalog, setCatalog] = useState<PageI18n | undefined>(undefined);
  const [shownQuery, setShownQuery] = useState<PageQuery>({});
  const [shownPageKey, setShownPageKey] = useState('');
  const projectRef = useRef<RuntimeProjectDto | null>(null);
  const routeRef = useRef(route);
  projectRef.current = project;
  routeRef.current = route;

  installPageNavigation({
    navigateTo(nextPageKey, query) {
      const current = routeRef.current;
      const currentProject = projectRef.current;
      const key = nextPageKey.trim();
      if (!current.projectKey || !currentProject || !currentProject.pages.some((page) => page.key === key)) {
        return;
      }
      const nextQuery = plainQuery(query);
      const nextUrl = pageUrl(current.projectKey, key, nextQuery, window.location.search);
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl === nextUrl) {
        return;
      }
      const index = (readNavIndex(window.history.state) ?? 0) + 1;
      window.history.pushState(withNavIndex(window.history.state, index), '', nextUrl);
      setRoute(parseRoute(window.location));
    },
    navigateBack(times) {
      const index = readNavIndex(window.history.state) ?? 0;
      const steps = takeBackSteps(index, times);
      if (steps > 0) {
        window.history.go(-steps);
      }
    },
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'missing' | 'empty' | 'ready'>(
    projectKey ? 'loading' : 'idle',
  );

  useEffect(() => {
    function onPopState() {
      resetPendingBack();
      setRoute(parseRoute(window.location));
    }
    if (readNavIndex(window.history.state) == null) {
      window.history.replaceState(withNavIndex(window.history.state, 0), '');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!projectKey) {
      setProject(null);
      setPageDocument(DEMO_PAGE);
      setCatalog(undefined);
      setShownQuery({});
      setShownPageKey('');
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setPageDocument(null);
    setCatalog(undefined);
    setShownQuery({});
    setShownPageKey('');
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

  const queryKey = JSON.stringify(route.query);
  const documentReadyRef = useRef(false);
  documentReadyRef.current = pageDocument != null;
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
    const requestedQuery = JSON.parse(queryKey) as PageQuery;
    if (!documentReadyRef.current) {
      setStatus('loading');
    }
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
        setShownQuery(requestedQuery);
        setShownPageKey(page.key);
        setCatalog(snapshot ? pageI18nFromSnapshot(snapshot) : undefined);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setPageDocument(null);
          setShownQuery({});
          setShownPageKey('');
          setCatalog(undefined);
          setStatus('missing');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lang, pageKey, project, queryKey]);

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
      query: { ...buildPropsRecord(pageDocument.query), ...shownQuery },
      onQueryValue(name, value) {
        setShownQuery((prev) => {
          if (prev[name] === value) {
            return prev;
          }
          const next = { ...prev, [name]: value };
          const current = routeRef.current;
          const url = pageUrl(
            current.projectKey,
            shownPageKey || current.pageKey,
            { ...current.query, ...next },
            window.location.search,
          );
          window.history.replaceState(window.history.state, '', url);
          return next;
        });
      },
      pageId: shownPageKey ? `${shownPageKey}:${JSON.stringify(shownQuery)}` : null,
      loadWidgetEvent: projectKey ? (eventId) => loadRuntimeEvent(projectKey, eventId) : undefined,
      icons: project?.icons,
    });
  }, [catalog, lang, pageDocument, project, projectKey, shownPageKey, shownQuery]);

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
