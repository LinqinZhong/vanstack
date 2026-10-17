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
  currentVersionId: string | null;
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

/** 工程版本。页面、语言、资源和图标都是这份版本里的指针，可以和别的工程版本共享。 */
export interface ProjectVersionDto {
  id: string;
  projectId: string;
  versionNo: number;
  description: string;
  createdAt: string;
  updatedAt: string;
  lastModified: string;
}

export interface CreateProjectVersionInput {
  source: 'blank' | 'copy';
  copyFromId?: string;
}

/** 某个工程版本里一页的内容快照。id 是 page.version 的项。 */
export interface ProjectPageSnapshotDto {
  id: string;
  pageId: string;
  forked: boolean;
  document: PageDocumentDto;
  updatedAt: string;
  lastModified: string;
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
  /** 图标路径 `分组.名称` 到文件地址。 */
  icons?: Record<string, string>;
  /** 发布页运行时使用的动画目录。 */
  animations?: AnimationDefinitionDto[];
}

/** 关键帧上的元素变形属性。translate 单位 px，rotate/screw 单位 deg，opacity 0–1，scale 无单位。 */
export interface AnimationProps {
  translateX?: number;
  translateY?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  /** skew（倾斜），单位 deg。 */
  screw?: number;
  opacity?: number;
  scale?: number;
}

/** 动画的关键帧。offset 为 0–100 的百分比，最小粒度 0.1。 */
export interface AnimationKeyframe {
  offset: number;
  props: AnimationProps;
}

/** 独立的动画资源，存于 animation.version 集合，每个动画一条文档。 */
export interface AnimationDefinitionDto {
  id: string;
  name: string;
  keyframes: AnimationKeyframe[];
  updatedAt?: string;
}

export interface CreateAnimationInput {
  name: string;
}

export interface UpdateAnimationInput {
  name?: string;
  keyframes?: AnimationKeyframe[];
}

/** 播放模式：单次 / 重复 / 往复 / 保持。 */
export const ANIMATION_MODES = ['once', 'repeat', 'alternate', 'hold'] as const;
export type WidgetAnimationMode = (typeof ANIMATION_MODES)[number];

/** 缓动函数。 */
export const ANIMATION_EASINGS = [
  'linear',
  'ease',
  'easeIn',
  'easeOut',
  'easeInOut',
  'cubicIn',
  'cubicOut',
  'cubicInOut',
] as const;
export type WidgetAnimationEasing = (typeof ANIMATION_EASINGS)[number];

/** 控件绑定的动画：只存动画 id 与播放参数，定义由运行时按 id 查目录。 */
export interface WidgetAnimationBinding {
  id: string;
  /** 播放时长，单位：秒。 */
  duration: number;
  mode: WidgetAnimationMode;
  easing: WidgetAnimationEasing;
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

export interface ProjectFontFileDto {
  name: string;
  key: string;
  url: string;
  size: number;
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

/** 工程文档上的命名空间指针。内容在 namespace.version。 */
export interface ProjectNamespaceDto {
  name: string;
  versionId: string;
}

export interface NamespaceTypeFieldDto {
  id: string;
  name: string;
  description: string;
  /** string、number、boolean、object、array、icon、image，或同一命名空间里的类型名。 */
  type: string;
  children?: NamespaceTypeFieldDto[];
}

export interface NamespaceTypeDto {
  id: string;
  name: string;
  description: string;
  fields: NamespaceTypeFieldDto[];
  /** `interface Name { ... }` */
  source: string;
}

export interface NamespaceDataDto {
  id: string;
  type: string;
  name: string;
  description: string;
  value: unknown;
  /** 值用表达式生成。缺省按静态字面量编辑。 */
  dynamic?: boolean;
  /** 动态值打开后按表达式跟随数据变化。 */
  computed?: boolean;
}

export interface NamespaceDocumentDto {
  name: string;
  versionId: string;
  types: NamespaceTypeDto[];
  data: NamespaceDataDto[];
}

export interface CreateNamespaceInput {
  name: string;
}

export interface RenameNamespaceInput {
  name: string;
}

export interface PutNamespaceInput {
  types: NamespaceTypeDto[];
  data: NamespaceDataDto[];
}
