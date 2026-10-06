import type {
  AuthSessionDto,
  AuthUserDto,
  CreateProjectAssetGroupInput,
  CreateProjectIconGroupInput,
  CreateProjectInput,
  CreateProjectPageInput,
  CreateProjectPageVersionInput,
  CreateProjectVersionInput,
  HealthDto,
  Locale,
  LoginInput,
  ProjectAssetFileDto,
  ProjectAssetGroupDto,
  ProjectDto,
  ProjectIconFileDto,
  ProjectIconGroupDto,
  ProjectLangCatalogDto,
  ProjectComponentDto,
  ProjectPageDto,
  ProjectPageSnapshotDto,
  ProjectPageVersionDto,
  ProjectPageVersionMetaDto,
  ProjectVersionDto,
  UpdateProjectAssetGroupInput,
  UpdateProjectIconGroupInput,
  UpdateProjectInput,
  UpdateProjectPageInput,
  UpdateProjectPageVersionInput,
  CreateNamespaceInput,
  MethodCodeDto,
  NamespaceDocumentDto,
  ProjectNamespaceDto,
  PutMethodCodeInput,
  PutNamespaceInput,
  RenameNamespaceInput,
  PutWidgetEventInput,
  WidgetEventScriptDto,
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
  listProjectVersions: (projectId: string) =>
    request<ProjectVersionDto[]>(`/projects/${projectId}/versions`),
  createProjectVersion: (projectId: string, body: CreateProjectVersionInput) =>
    request<ProjectVersionDto>(`/projects/${projectId}/versions`, json('POST', body)),
  deleteProjectVersion: (projectId: string, versionId: string) =>
    request<void>(`/projects/${projectId}/versions/${versionId}`, { method: 'DELETE' }),
  getProjectLangs: (id: string, versionId: string) =>
    request<ProjectLangCatalogDto>(`/projects/${id}/versions/${versionId}/langs`),
  putProjectLangs: (id: string, versionId: string, body: ProjectLangCatalogDto) =>
    request<ProjectLangCatalogDto>(`/projects/${id}/versions/${versionId}/langs`, json('PUT', body)),
  listPages: (projectId: string, versionId: string) =>
    request<ProjectPageDto[]>(`/projects/${projectId}/versions/${versionId}/pages`),
  createPage: (projectId: string, versionId: string, body: CreateProjectPageInput) =>
    request<ProjectPageDto>(`/projects/${projectId}/versions/${versionId}/pages`, json('POST', body)),
  getPage: (projectId: string, versionId: string, pageId: string) =>
    request<ProjectPageDto>(`/projects/${projectId}/versions/${versionId}/pages/${pageId}`),
  updatePage: (projectId: string, versionId: string, pageId: string, body: UpdateProjectPageInput) =>
    request<ProjectPageDto>(`/projects/${projectId}/versions/${versionId}/pages/${pageId}`, json('PATCH', body)),
  deletePage: (projectId: string, versionId: string, pageId: string) =>
    request<void>(`/projects/${projectId}/versions/${versionId}/pages/${pageId}`, { method: 'DELETE' }),
  getPageDocument: (projectId: string, versionId: string, pageId: string) =>
    request<ProjectPageSnapshotDto>(`/projects/${projectId}/versions/${versionId}/pages/${pageId}/document`),
  updatePageDocument: (projectId: string, versionId: string, pageId: string, body: UpdateProjectPageVersionInput) =>
    request<ProjectPageSnapshotDto>(
      `/projects/${projectId}/versions/${versionId}/pages/${pageId}/document`,
      json('PATCH', body),
    ),
  updatePageDocumentKeepalive: (
    projectId: string,
    versionId: string,
    pageId: string,
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
      void fetch(`${apiBase()}/projects/${projectId}/versions/${versionId}/pages/${pageId}/document`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      return;
    }
  },
  listComponents: (projectId: string) => request<ProjectComponentDto[]>(`/projects/${projectId}/components`),
  createComponent: (projectId: string, body: CreateProjectPageInput) =>
    request<ProjectComponentDto>(`/projects/${projectId}/components`, json('POST', body)),
  getComponent: (projectId: string, componentId: string) =>
    request<ProjectComponentDto>(`/projects/${projectId}/components/${componentId}`),
  updateComponent: (projectId: string, componentId: string, body: UpdateProjectPageInput) =>
    request<ProjectComponentDto>(`/projects/${projectId}/components/${componentId}`, json('PATCH', body)),
  deleteComponent: (projectId: string, componentId: string) =>
    request<void>(`/projects/${projectId}/components/${componentId}`, { method: 'DELETE' }),
  listComponentVersions: (projectId: string, componentId: string) =>
    request<ProjectPageVersionDto[]>(`/projects/${projectId}/components/${componentId}/versions`),
  listComponentVersionMeta: (projectId: string, componentId: string) =>
    request<ProjectPageVersionMetaDto[]>(`/projects/${projectId}/components/${componentId}/versions/meta`),
  getComponentVersion: (projectId: string, componentId: string, versionId: string) =>
    request<ProjectPageVersionDto>(`/projects/${projectId}/components/${componentId}/versions/${versionId}`),
  createComponentVersion: (projectId: string, componentId: string, body: CreateProjectPageVersionInput) =>
    request<ProjectPageVersionDto>(
      `/projects/${projectId}/components/${componentId}/versions`,
      json('POST', body),
    ),
  updateComponentVersion: (
    projectId: string,
    componentId: string,
    versionId: string,
    body: UpdateProjectPageVersionInput,
  ) =>
    request<ProjectPageVersionDto>(
      `/projects/${projectId}/components/${componentId}/versions/${versionId}`,
      json('PATCH', body),
    ),
  updateComponentVersionKeepalive: (
    projectId: string,
    componentId: string,
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
      void fetch(`${apiBase()}/projects/${projectId}/components/${componentId}/versions/${versionId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch {
      return;
    }
  },
  deleteComponentVersion: (projectId: string, componentId: string, versionId: string) =>
    request<void>(`/projects/${projectId}/components/${componentId}/versions/${versionId}`, { method: 'DELETE' }),
  listAssetGroups: (projectId: string, versionId: string) =>
    request<ProjectAssetGroupDto[]>(`/projects/${projectId}/versions/${versionId}/assets/groups`),
  createAssetGroup: (projectId: string, versionId: string, body: CreateProjectAssetGroupInput) =>
    request<ProjectAssetGroupDto>(`/projects/${projectId}/versions/${versionId}/assets/groups`, json('POST', body)),
  renameAssetGroup: (projectId: string, versionId: string, group: string, body: UpdateProjectAssetGroupInput) =>
    request<ProjectAssetGroupDto>(
      `/projects/${projectId}/versions/${versionId}/assets/groups/${encodeURIComponent(group)}`,
      json('PATCH', body),
    ),
  deleteAssetGroup: (projectId: string, versionId: string, group: string) =>
    request<void>(`/projects/${projectId}/versions/${versionId}/assets/groups/${encodeURIComponent(group)}`, {
      method: 'DELETE',
    }),
  listAssetFiles: (projectId: string, versionId: string, group: string) =>
    request<ProjectAssetFileDto[]>(
      `/projects/${projectId}/versions/${versionId}/assets/groups/${encodeURIComponent(group)}/files`,
    ),
  uploadAssetFile: (projectId: string, versionId: string, group: string, file: File, name?: string) => {
    const body = new FormData();
    body.append('file', file);
    if (name?.trim()) {
      body.append('name', name.trim());
    }
    return request<ProjectAssetFileDto>(
      `/projects/${projectId}/versions/${versionId}/assets/groups/${encodeURIComponent(group)}/files`,
      { method: 'POST', body },
    );
  },
  deleteAssetFile: (projectId: string, versionId: string, group: string, name: string) =>
    request<void>(
      `/projects/${projectId}/versions/${versionId}/assets/groups/${encodeURIComponent(group)}/files/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    ),
  listIconGroups: (projectId: string, versionId: string) =>
    request<ProjectIconGroupDto[]>(`/projects/${projectId}/versions/${versionId}/icons/groups`),
  createIconGroup: (projectId: string, versionId: string, body: CreateProjectIconGroupInput) =>
    request<ProjectIconGroupDto>(`/projects/${projectId}/versions/${versionId}/icons/groups`, json('POST', body)),
  renameIconGroup: (projectId: string, versionId: string, group: string, body: UpdateProjectIconGroupInput) =>
    request<ProjectIconGroupDto>(
      `/projects/${projectId}/versions/${versionId}/icons/groups/${encodeURIComponent(group)}`,
      json('PATCH', body),
    ),
  deleteIconGroup: (projectId: string, versionId: string, group: string) =>
    request<void>(`/projects/${projectId}/versions/${versionId}/icons/groups/${encodeURIComponent(group)}`, {
      method: 'DELETE',
    }),
  listIconFiles: (projectId: string, versionId: string, group: string) =>
    request<ProjectIconFileDto[]>(
      `/projects/${projectId}/versions/${versionId}/icons/groups/${encodeURIComponent(group)}/files`,
    ),
  uploadIconFile: (projectId: string, versionId: string, group: string, file: File, name?: string) => {
    const body = new FormData();
    body.append('file', file);
    if (name?.trim()) {
      body.append('name', name.trim());
    }
    return request<ProjectIconFileDto>(
      `/projects/${projectId}/versions/${versionId}/icons/groups/${encodeURIComponent(group)}/files`,
      { method: 'POST', body },
    );
  },
  deleteIconFile: (projectId: string, versionId: string, group: string, name: string) =>
    request<void>(
      `/projects/${projectId}/versions/${versionId}/icons/groups/${encodeURIComponent(group)}/files/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    ),
  getMethodCode: (projectId: string, methodId: string) =>
    request<MethodCodeDto>(`/projects/${projectId}/methods/${methodId}`),
  putMethodCode: (projectId: string, methodId: string, body: PutMethodCodeInput) =>
    request<MethodCodeDto>(`/projects/${projectId}/methods/${methodId}`, json('PUT', body)),
  getWidgetEvent: (projectId: string, eventId: string) =>
    request<WidgetEventScriptDto>(`/projects/${projectId}/events/${eventId}`),
  putWidgetEvent: (projectId: string, eventId: string, body: PutWidgetEventInput) =>
    request<WidgetEventScriptDto>(`/projects/${projectId}/events/${eventId}`, json('PUT', body)),
  deleteWidgetEvent: (projectId: string, eventId: string) =>
    request<void>(`/projects/${projectId}/events/${eventId}`, { method: 'DELETE' }),
  listNamespaces: (projectId: string) => request<ProjectNamespaceDto[]>(`/projects/${projectId}/namespaces`),
  createNamespace: (projectId: string, body: CreateNamespaceInput) =>
    request<ProjectNamespaceDto>(`/projects/${projectId}/namespaces`, json('POST', body)),
  renameNamespace: (projectId: string, name: string, body: RenameNamespaceInput) =>
    request<ProjectNamespaceDto>(
      `/projects/${projectId}/namespaces/${encodeURIComponent(name)}`,
      json('PATCH', body),
    ),
  deleteNamespace: (projectId: string, name: string) =>
    request<void>(`/projects/${projectId}/namespaces/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  getNamespace: (projectId: string, name: string) =>
    request<NamespaceDocumentDto>(`/projects/${projectId}/namespaces/${encodeURIComponent(name)}`),
  putNamespace: (projectId: string, name: string, body: PutNamespaceInput) =>
    request<NamespaceDocumentDto>(
      `/projects/${projectId}/namespaces/${encodeURIComponent(name)}`,
      json('PUT', body),
    ),
};

export const localeLabel: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};
