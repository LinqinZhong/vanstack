import type { RuntimeLangDto, RuntimePageDto, RuntimeProjectDto } from '@vanstack/shared';
import { isPageLangSnapshot, pickPageLocale, type PageI18n, type PageLangSnapshot } from '@vanstack/xml';

const xmlLoads = new Map<string, Promise<string>>();
const langLoads = new Map<string, Promise<PageLangSnapshot | null>>();

export function pickRuntimePage(project: RuntimeProjectDto, pageKey: string) {
  return project.pages.find((page) => page.key === pageKey) ?? project.pages[0];
}

export function pickRuntimeLang(langs: RuntimeLangDto[], runtimeLang?: string): RuntimeLangDto | undefined {
  if (langs.length === 0) {
    return undefined;
  }
  const catalog: PageI18n = {
    langs: langs.map((lang) => ({ key: lang.key, name: lang.name, dir: lang.dir })),
    groups: [],
  };
  const key = pickPageLocale(catalog, runtimeLang);
  return langs.find((lang) => lang.key === key) ?? langs[0];
}

export function loadPageXml(xmlUrl: string) {
  const pending = xmlLoads.get(xmlUrl);
  if (pending) {
    return pending;
  }
  const next = fetch(xmlUrl).then(async (response) => {
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    return response.text();
  });
  xmlLoads.set(xmlUrl, next);
  next.catch(() => {
    xmlLoads.delete(xmlUrl);
  });
  return next;
}

export function preloadPageXml(xmlUrl: string) {
  void loadPageXml(xmlUrl);
}

export function loadLangJson(jsonUrl: string) {
  const pending = langLoads.get(jsonUrl);
  if (pending) {
    return pending;
  }
  const next = fetch(jsonUrl)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      return (await response.json()) as unknown;
    })
    .then((payload) => (isPageLangSnapshot(payload) ? payload : null))
    .catch(() => null);
  langLoads.set(jsonUrl, next);
  next.then((snapshot) => {
    if (!snapshot) {
      langLoads.delete(jsonUrl);
    }
  });
  return next;
}

export function preloadPageLangs(page: RuntimePageDto) {
  for (const lang of page.langs ?? []) {
    void loadLangJson(lang.jsonUrl);
  }
}
