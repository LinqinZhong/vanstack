import { pickPageLocale, resolveI18nCopy, type PageI18n } from '@vanstack/xml';

export type I18nEntry = {
  path: string;
  text: string;
};

let entries: I18nEntry[] = [];
const entryMap = new Map<string, string>();
let generation = 0;
const listeners = new Set<() => void>();

export function getI18nEntries() {
  return entries;
}

export function getI18nText(path: string) {
  return entryMap.get(path) ?? '';
}

export function i18nGeneration() {
  return generation;
}

/** 语言库或当前预览语言变化时通知编辑器重绘 $t 预览。 */
export function subscribeEditorI18n(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 编辑器补全和页面数据求值共用当前语言库。 */
export function publishEditorI18n(catalog: PageI18n | undefined, locale?: string | null) {
  const current = locale || pickPageLocale(catalog);
  const next: I18nEntry[] = [];
  entryMap.clear();
  for (const group of catalog?.groups ?? []) {
    for (const entry of group.entries) {
      const path = `${group.key}.${entry.key}`;
      const text = current ? (entry.values[current] ?? '') : '';
      next.push({ path, text });
      entryMap.set(path, text);
    }
  }
  next.sort((a, b) => a.path.localeCompare(b.path));
  entries = next;
  generation += 1;
  const host = globalThis as { $t?: (path: string) => string };
  host.$t = (path: string) => translateI18n(path, catalog, current);
  for (const listener of listeners) {
    listener();
  }
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
