import type { DocumentDto, HealthDto, Locale } from '@vanstack/shared';
import i18n from './i18n';

const API_BASE = '/api';

function lang(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'zh';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('x-lang', lang());
  headers.set('Accept-Language', lang());

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 204) {
    return undefined as T;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthDto>('/health'),
  listDocuments: () => request<DocumentDto[]>('/documents'),
  getDocument: (id: string) => request<DocumentDto>(`/documents/${id}`),
  createDocument: (body: Partial<DocumentDto> & { title: string }) =>
    request<{ item: DocumentDto; message: string }>('/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateDocument: (id: string, body: Partial<DocumentDto>) =>
    request<{ item: DocumentDto; message: string }>(`/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteDocument: (id: string) =>
    request<void>(`/documents/${id}`, { method: 'DELETE' }),
  exportXml: (id?: string) =>
    request<string>(id ? `/documents/${id}/export.xml` : '/documents/export.xml'),
  importXml: (xml: string) =>
    request<{ items: DocumentDto[]; message: string }>('/documents/import.xml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml,
    }),
  uploadFile: async (file: File, documentId?: string) => {
    const form = new FormData();
    form.append('file', file);
    const suffix = documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';
    return request<{ item: DocumentDto['files'][number]; message: string }>(`/files${suffix}`, {
      method: 'POST',
      body: form,
    });
  },
  deleteFile: (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' }),
  listFiles: () => request<DocumentDto['files']>('/files'),
};

export const localeLabel: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};
