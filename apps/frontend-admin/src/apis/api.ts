import type {
  AuthSessionDto,
  AuthUserDto,
  CreateProjectAssetGroupInput,
  CreateProjectInput,
  CreateProjectPageInput,
  CreateProjectPageVersionInput,
  HealthDto,
  Locale,
  LoginInput,
  ProjectAssetFileDto,
  ProjectAssetGroupDto,
  ProjectDto,
  ProjectLangCatalogDto,
  ProjectPageDto,
  ProjectPageVersionDto,
  UpdateProjectAssetGroupInput,
  UpdateProjectInput,
  UpdateProjectPageInput,
  UpdateProjectPageVersionInput,
} from '@vanstack/shared';
import i18n from '../i18n';
import { apiBase } from './serverConfig';
import { clearAccessToken, getAccessToken, UNAUTHORIZED_EVENT } from './session';

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

  const response = await fetch(`${apiBase()}${path}`, { ...init, headers });
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
  getProjectLangs: (id: string) => request<ProjectLangCatalogDto>(`/projects/${id}/langs`),
  putProjectLangs: (id: string, body: ProjectLangCatalogDto) =>
    request<ProjectLangCatalogDto>(`/projects/${id}/langs`, json('PUT', body)),
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
  updateVersionKeepalive: (
    projectId: string,
    pageId: string,
    versionId: string,
    body: UpdateProjectPageVersionInput,
  ) => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('x-lang', lang());
    headers.set('Accept-Language', lang());
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    try {
      void fetch(`${apiBase()}/projects/${projectId}/pages/${pageId}/versions/${versionId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      return;
    }
  },
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
  listAssetGroups: (projectId: string) =>
    request<ProjectAssetGroupDto[]>(`/projects/${projectId}/assets/groups`),
  createAssetGroup: (projectId: string, body: CreateProjectAssetGroupInput) =>
    request<ProjectAssetGroupDto>(`/projects/${projectId}/assets/groups`, json('POST', body)),
  renameAssetGroup: (projectId: string, group: string, body: UpdateProjectAssetGroupInput) =>
    request<ProjectAssetGroupDto>(
      `/projects/${projectId}/assets/groups/${encodeURIComponent(group)}`,
      json('PATCH', body),
    ),
  deleteAssetGroup: (projectId: string, group: string) =>
    request<void>(`/projects/${projectId}/assets/groups/${encodeURIComponent(group)}`, { method: 'DELETE' }),
  listAssetFiles: (projectId: string, group: string) =>
    request<ProjectAssetFileDto[]>(
      `/projects/${projectId}/assets/groups/${encodeURIComponent(group)}/files`,
    ),
  uploadAssetFile: (projectId: string, group: string, file: File, name?: string) => {
    const body = new FormData();
    body.append('file', file);
    if (name?.trim()) {
      body.append('name', name.trim());
    }
    return request<ProjectAssetFileDto>(
      `/projects/${projectId}/assets/groups/${encodeURIComponent(group)}/files`,
      { method: 'POST', body },
    );
  },
  deleteAssetFile: (projectId: string, group: string, name: string) =>
    request<void>(
      `/projects/${projectId}/assets/groups/${encodeURIComponent(group)}/files/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    ),
};

export const localeLabel: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};
