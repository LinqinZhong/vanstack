import type {
  AuthSessionDto,
  AuthUserDto,
  CreateProjectInput,
  CreateProjectPageInput,
  CreateProjectPageVersionInput,
  HealthDto,
  Locale,
  LoginInput,
  ProjectDto,
  ProjectPageDto,
  ProjectPageVersionDto,
  UpdateProjectInput,
  UpdateProjectPageInput,
  UpdateProjectPageVersionInput,
} from '@vanstack/shared';
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

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const api = {
  health: () => request<HealthDto>('/health'),
  login: (body: LoginInput) => request<AuthSessionDto>('/auth/login', json('POST', body)),
  me: () => request<AuthUserDto>('/auth/me'),
  listProjects: () => request<ProjectDto[]>('/projects'),
  createProject: (body: CreateProjectInput) => request<ProjectDto>('/projects', json('POST', body)),
  getProject: (id: string) => request<ProjectDto>(`/projects/${id}`),
  updateProject: (id: string, body: UpdateProjectInput) =>
    request<ProjectDto>(`/projects/${id}`, json('PATCH', body)),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  listPages: (projectId: string) => request<ProjectPageDto[]>(`/projects/${projectId}/pages`),
  createPage: (projectId: string, body: CreateProjectPageInput) =>
    request<ProjectPageDto>(`/projects/${projectId}/pages`, json('POST', body)),
  getPage: (projectId: string, pageId: string) =>
    request<ProjectPageDto>(`/projects/${projectId}/pages/${pageId}`),
  updatePage: (projectId: string, pageId: string, body: UpdateProjectPageInput) =>
    request<ProjectPageDto>(`/projects/${projectId}/pages/${pageId}`, json('PATCH', body)),
  deletePage: (projectId: string, pageId: string) =>
    request<void>(`/projects/${projectId}/pages/${pageId}`, { method: 'DELETE' }),
  listVersions: (projectId: string, pageId: string) =>
    request<ProjectPageVersionDto[]>(`/projects/${projectId}/pages/${pageId}/versions`),
  createVersion: (projectId: string, pageId: string, body: CreateProjectPageVersionInput) =>
    request<ProjectPageVersionDto>(`/projects/${projectId}/pages/${pageId}/versions`, json('POST', body)),
  updateVersion: (
    projectId: string,
    pageId: string,
    versionId: string,
    body: UpdateProjectPageVersionInput,
  ) =>
    request<ProjectPageVersionDto>(
      `/projects/${projectId}/pages/${pageId}/versions/${versionId}`,
      json('PATCH', body),
    ),
  deleteVersion: (projectId: string, pageId: string, versionId: string) =>
    request<void>(`/projects/${projectId}/pages/${pageId}/versions/${versionId}`, { method: 'DELETE' }),
  publishVersion: (projectId: string, pageId: string, versionId: string) =>
    request<ProjectPageVersionDto>(
      `/projects/${projectId}/pages/${pageId}/versions/${versionId}/publish`,
      json('POST', {}),
    ),
  activateVersion: (projectId: string, pageId: string, versionId: string) =>
    request<ProjectPageDto>(
      `/projects/${projectId}/pages/${pageId}/activate-version`,
      json('POST', { versionId }),
    ),
};

export const localeLabel: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};
