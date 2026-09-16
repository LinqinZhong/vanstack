import type { AuthSessionDto, AuthUserDto, HealthDto, Locale, LoginInput } from '@vanstack/shared';
import i18n from './i18n';
import { clearAccessToken, getAccessToken, UNAUTHORIZED_EVENT } from './session';

const API_BASE = '/api';

function lang(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'zh';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('x-lang', lang());
  headers.set('Accept-Language', lang());
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 204) {
    return undefined as T;
  }
  if (response.status === 401 && token && path !== '/auth/login') {
    clearAccessToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthDto>('/health'),
  login: (body: LoginInput) =>
    request<AuthSessionDto>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  me: () => request<AuthUserDto>('/auth/me'),
};

export const localeLabel: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};
