export const LOCALES = ['zh', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh';

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export interface HealthDto {
  ok: true;
  service: string;
  timestamp: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface AuthSessionDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: AuthUserDto;
}

export interface ProjectDto {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  key?: string;
  description?: string;
}

export interface PageDocumentDto {
  widgets: unknown[];
  style?: object;
  data?: unknown[];
  events?: object;
  methods?: unknown[];
  props?: unknown[];
  emits?: unknown[];
}

export interface ProjectComponentDto {
  id: string;
  projectId: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPageDto {
  id: string;
  projectId: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPageInput {
  name: string;
  key: string;
  description?: string;
}

export interface UpdateProjectPageInput {
  name?: string;
  key?: string;
  description?: string;
}

export interface ProjectPageVersionDto {
  id: string;
  pageId: string;
  versionNo: number;
  description: string;
  document: PageDocumentDto;
  createdAt: string;
  updatedAt: string;
  lastModified: string;
}

export interface ProjectPageVersionMetaDto {
  id: string;
  pageId: string;
  versionNo: number;
  description: string;
  lastModified: string;
}

export interface CreateProjectPageVersionInput {
  document: PageDocumentDto;
  description?: string;
}

export interface UpdateProjectPageVersionInput {
  document?: PageDocumentDto;
  description?: string;
}

export type ProjectLangDir = 'ltr' | 'rtl';

export interface ProjectLangDto {
  key: string;
  name: string;
  dir: ProjectLangDir;
}

export interface ProjectLangEntryDto {
  key: string;
  values: Record<string, string>;
}

export interface ProjectLangGroupDto {
  key: string;
  entries: ProjectLangEntryDto[];
}

export interface ProjectLangCatalogDto {
  langs: ProjectLangDto[];
  groups: ProjectLangGroupDto[];
}

export interface RuntimeLangDto {
  key: string;
  name: string;
  dir: ProjectLangDir;
  jsonUrl: string;
}

export interface RuntimePageDto {
  name: string;
  key: string;
  documentUrl: string;
  langs: RuntimeLangDto[];
}

export interface RuntimeProjectDto {
  name: string;
  key: string;
  pages: RuntimePageDto[];
}

export interface ProjectAssetGroupDto {
  name: string;
}

export interface ProjectAssetFileDto {
  name: string;
  key: string;
  url: string;
  size: number;
}

export interface CreateProjectAssetGroupInput {
  name: string;
}

export interface UpdateProjectAssetGroupInput {
  name: string;
}

export interface ProjectIconGroupDto {
  name: string;
}

export interface ProjectIconFileDto {
  name: string;
  key: string;
  url: string;
  size: number;
}

export interface CreateProjectIconGroupInput {
  name: string;
}

export interface UpdateProjectIconGroupInput {
  name: string;
}

export interface WidgetEventScriptDto {
  id: string;
  source: string;
  forked: boolean;
}

export interface PutWidgetEventInput {
  source: string;
}

export interface MethodCodeDto {
  id: string;
  code: string;
  forked: boolean;
}

export interface PutMethodCodeInput {
  code: string;
}
