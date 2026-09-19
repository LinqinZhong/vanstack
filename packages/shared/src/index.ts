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

export interface ProjectPageDto {
  id: string;
  projectId: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  xmlKey: string;
  xmlUrl: string;
  xml?: string;
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

export const PAGE_VERSION_STATUSES = ['draft', 'published', 'in_use'] as const;
export type PageVersionStatus = (typeof PAGE_VERSION_STATUSES)[number];

export interface ProjectPageVersionDto {
  id: string;
  pageId: string;
  versionNo: number;
  status: PageVersionStatus;
  description: string;
  xmlKey: string;
  xmlUrl: string;
  xml?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPageVersionInput {
  xml: string;
  description?: string;
}

export interface UpdateProjectPageVersionInput {
  xml?: string;
  description?: string;
}

export interface ActivateProjectPageVersionInput {
  versionId: string;
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
  xmlUrl: string;
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
