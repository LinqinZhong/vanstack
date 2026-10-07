import { isLocale, type Locale } from '@vanstack/shared';

export const H5_ORIGIN = 'http://127.0.0.1:5173';

export function localeFromI18n(language: string | undefined): Locale {
  const raw = (language ?? 'zh').split('-')[0];
  return isLocale(raw) ? raw : 'zh';
}

export function h5Url(options: { projectKey?: string; lang: Locale }) {
  const path = options.projectKey ? `/${encodeURIComponent(options.projectKey)}` : '/';
  const url = new URL(path, H5_ORIGIN);
  url.searchParams.set('lang', options.lang);
  return url.toString();
}

export function h5ProjectUrl(projectKey: string, lang: Locale) {
  return h5Url({ projectKey, lang });
}
