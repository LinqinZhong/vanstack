import { pickPageLocale, resolveI18nCopy, type PageI18n } from '@vanstack/xml';

export type I18nEntry = {
  path: string;
  text: string;
};

let entries: I18nEntry[] = [];

export function getI18nEntries() {
  return entries;
}

/** 编辑器补全和页面数据求值共用当前语言库。 */
export function publishEditorI18n(catalog: PageI18n | undefined, locale?: string | null) {
  const current = locale || pickPageLocale(catalog);
  const next: I18nEntry[] = [];
  for (const group of catalog?.groups ?? []) {
    for (const entry of group.entries) {
      const path = `${group.key}.${entry.key}`;
      next.push({ path, text: current ? (entry.values[current] ?? '') : '' });
    }
  }
  next.sort((a, b) => a.path.localeCompare(b.path));
  entries = next;
  const host = globalThis as { $t?: (path: string) => string };
  host.$t = (path: string) => translateI18n(path, catalog, current);
}

export function translateI18n(path: string, catalog: PageI18n | undefined, locale?: string) {
  const key = String(path ?? '').trim();
  const match = /^([^".]+)\.([^".]+)$/.exec(key);
  if (!match) {
    return '';
  }
  return resolveI18nCopy(`$t("${match[1]}.${match[2]}")`, catalog, locale);
}

publishEditorI18n(undefined, undefined);
