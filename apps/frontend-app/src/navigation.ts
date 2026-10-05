export type PageQuery = Record<string, unknown>;

export type AppRoute = {
  projectKey: string;
  pageKey: string;
  query: PageQuery;
};

const RESERVED_QUERY = new Set(['lang']);

let pendingBack = 0;

export function resetPendingBack() {
  pendingBack = 0;
}

export function parseRoute(location: Pick<Location, 'pathname' | 'search'>): AppRoute {
  const [projectKey = '', pageKey = ''] = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  return {
    projectKey: decodeURIComponent(projectKey),
    pageKey: decodeURIComponent(pageKey),
    query: parseQuery(location.search),
  };
}

export function parseQuery(search: string): PageQuery {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const query: PageQuery = {};
  for (const [key, value] of params) {
    if (RESERVED_QUERY.has(key)) {
      continue;
    }
    query[key] = decodeQueryValue(value);
  }
  return query;
}

export function plainQuery(value: unknown): PageQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const query: PageQuery = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key || RESERVED_QUERY.has(key) || item === undefined) {
      continue;
    }
    query[key] = item;
  }
  return query;
}

export function pageUrl(projectKey: string, pageKey: string, query: PageQuery, currentSearch: string): string {
  const params = new URLSearchParams();
  const lang = new URLSearchParams(currentSearch).get('lang');
  if (lang) {
    params.set('lang', lang);
  }
  for (const [key, value] of Object.entries(query)) {
    if (!key || RESERVED_QUERY.has(key) || value === undefined) {
      continue;
    }
    const encoded = encodeQueryValue(value);
    if (encoded == null) {
      continue;
    }
    params.set(key, encoded);
  }
  const search = params.toString();
  return `/${projectKey}/${pageKey}${search ? `?${search}` : ''}`;
}

export function readNavIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object') {
    return null;
  }
  const index = (state as { navIndex?: unknown }).navIndex;
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : null;
}

export function withNavIndex(state: unknown, index: number): Record<string, unknown> {
  const base = state && typeof state === 'object' ? { ...(state as Record<string, unknown>) } : {};
  return { ...base, navIndex: index };
}

/** 本次还能返回的层数。不会越过打开时的首页。 */
export function takeBackSteps(index: number, times: number | undefined): number {
  const requested = times == null ? 1 : Math.floor(times);
  if (!Number.isFinite(requested) || requested < 1) {
    return 0;
  }
  const steps = Math.min(requested, Math.max(0, index - pendingBack));
  pendingBack += steps;
  return steps;
}

function encodeQueryValue(value: unknown): string | null {
  if (typeof value === 'function' || typeof value === 'symbol') {
    return null;
  }
  if (typeof value === 'string' && !looksLikeJsonLiteral(value)) {
    return value;
  }
  try {
    const text = JSON.stringify(value);
    return text === undefined ? null : text;
  } catch {
    return null;
  }
}

function decodeQueryValue(raw: string): unknown {
  if (!looksLikeJsonLiteral(raw)) {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function looksLikeJsonLiteral(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed !== value) {
    return false;
  }
  if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
    return true;
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    return true;
  }
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  );
}
