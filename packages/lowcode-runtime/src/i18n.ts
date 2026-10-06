import { resolveI18nCopy, type PageI18n } from '@vanstack/xml';

type TranslateFn = (path: string) => string;

/** 安装 `$t("分组.条目")`，按当前语言取文案。找不到时返回空字符串。 */
export function installPageI18n(catalog: PageI18n | undefined, locale?: string) {
  const host = globalThis as { $t?: TranslateFn };
  host.$t = (path: string) => {
    const key = String(path ?? '').trim();
    const match = /^([^".]+)\.([^".]+)$/.exec(key);
    if (!match) {
      return '';
    }
    return resolveI18nCopy(`$t("${match[1]}.${match[2]}")`, catalog, locale);
  };
}
