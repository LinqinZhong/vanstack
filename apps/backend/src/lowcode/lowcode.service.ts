import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ProjectAssetFileDto,
  ProjectAssetGroupDto,
  ProjectDto,
  ProjectIconFileDto,
  ProjectIconGroupDto,
  ProjectLangCatalogDto,
  ProjectLangDto,
  ProjectLangEntryDto,
  ProjectLangGroupDto,
  ProjectComponentDto,
  ProjectPageDto,
  ProjectPageSnapshotDto,
  MethodCodeDto,
  ProjectPageVersionDto,
  ProjectPageVersionMetaDto,
  NamespaceDataDto,
  NamespaceDocumentDto,
  NamespaceTypeDto,
  NamespaceTypeFieldDto,
  ProjectNamespaceDto,
  ProjectVersionDto,
  WidgetEventScriptDto,
  RuntimeLangDto,
  RuntimeProjectDto,
} from '@vanstack/shared';
import {
  documentEventIds,
  documentMethodIds,
  EMPTY_PAGE_DOCUMENT,
  isI18nKey,
  isPageMethodId,
  isWidgetEventId,
  normalizePageDocument,
  parseEventSource,
  XmlParseError,
  type PageWidget,
  type PageXmlDocument,
} from '@vanstack/xml';
import { OssService } from '../oss/oss.service';
import {
  LowcodeMongo,
  type ComponentRecord,
  type ComponentVersionRecord,
  type LangVersionRecord,
  type LibraryFileRecord,
  type LibraryGroupRecord,
  type LibraryVersionRecord,
  type NamespaceDataRecord,
  type NamespaceFieldRecord,
  type NamespaceTypeRecord,
  type NamespaceVersionRecord,
  type PageVersionRecord,
  type ProjectLangValueRecord,
  type ProjectPageRecord,
  type ProjectRecord,
  type ProjectVersionRecord,
} from './lowcode-mongo';

function eventJavaScript(source: string): string {
  try {
    const output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
      },
    }).outputText;
    return output.trim() || source;
  } catch {
    return source;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000;
}

function toIso(value: Date): string {
  return value.toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function nextPlaceholderEntryKey(used: string[]) {
  const taken = new Set(used);
  let n = 1;
  while (taken.has(`key${n}`)) {
    n += 1;
  }
  return `key${n}`;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

@Injectable()
export class LowcodeService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LowcodeService.name);

  async onApplicationBootstrap() {
    await this.migrateProjectVersions();
  }

  constructor(
    private readonly oss: OssService,
    private readonly mongo: LowcodeMongo,
    private readonly config: ConfigService,
  ) {}

  async listProjects(): Promise<ProjectDto[]> {
    const rows = await this.mongo.listProjects();
    return rows.map((row) => this.toProjectDto(row));
  }

  async getProject(id: string): Promise<ProjectDto> {
    return this.toProjectDto(await this.requireProject(id));
  }

  async getRuntimeProject(projectKey: string): Promise<RuntimeProjectDto> {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(projectKey)) {
      throw new NotFoundException();
    }
    const project = await this.mongo.getProjectByKey(projectKey);
    const version = project ? await this.publishedVersion(project) : null;
    if (!project || !version) {
      throw new NotFoundException();
    }
    const langRows = [...((await this.mongo.getLangVersion(version.langVersionId))?.langs ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const runtimePages = [];
    for (const page of this.sortedPages(version.pages)) {
      if (!page.currentVersionId) {
        continue;
      }
      const snapshot = await this.mongo.getPage(page.currentVersionId);
      if (!snapshot) {
        continue;
      }
      const langs: RuntimeLangDto[] = langRows.map((lang) => ({
        key: lang.key,
        name: lang.name,
        dir: lang.dir === 'rtl' ? 'rtl' : 'ltr',
        jsonUrl: this.oss.getPublicUrl(this.langObjectKey(project.key, page.key, version.versionNo, lang.key)),
      }));
      runtimePages.push({
        name: page.name,
        key: page.key,
        documentUrl: this.runtimeDocumentUrl(project.key, page.key),
        langs,
      });
    }
    const iconLibrary = await this.mongo.getLibraryVersion('icon', version.iconVersionId);
    const icons: Record<string, string> = {};
    for (const group of iconLibrary?.groups ?? []) {
      for (const file of group.files) {
        icons[`${group.name}.${file.name.replace(/\.svg$/i, '')}`] = this.oss.getPublicUrl(file.key);
      }
    }
    return {
      name: project.name,
      key: project.key,
      pages: runtimePages,
      icons,
    };
  }

  async getRuntimeEvent(projectKey: string, eventId: string): Promise<{ source: string }> {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(projectKey) || !isWidgetEventId(eventId)) {
      throw new NotFoundException();
    }
    const project = await this.mongo.getProjectByKey(projectKey);
    if (!project) {
      throw new NotFoundException();
    }
    const current = await this.mongo.getEvent(project._id, eventId);
    if (!current?.source) {
      throw new NotFoundException();
    }
    return { source: eventJavaScript(current.source) };
  }

  async getRuntimePage(projectKey: string, pageKey: string): Promise<PageXmlDocument> {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(projectKey) || !/^[a-z][a-z0-9-]{0,63}$/.test(pageKey)) {
      throw new NotFoundException();
    }
    const project = await this.mongo.getProjectByKey(projectKey);
    const version = project ? await this.publishedVersion(project) : null;
    if (!project || !version) {
      throw new NotFoundException();
    }
    const page = version.pages.find((item) => item.key === pageKey);
    if (!page?.currentVersionId) {
      throw new NotFoundException();
    }
    const snapshot = await this.mongo.getPage(page.currentVersionId);
    if (!snapshot || snapshot.pageId !== page.id) {
      throw new NotFoundException();
    }
    return this.contentOf(snapshot);
  }

  async createProject(input: { name: string; key: string; description?: string }): Promise<ProjectDto> {
    const now = new Date();
    const project: ProjectRecord = {
      _id: randomUUID(),
      name: input.name.trim(),
      key: input.key,
      description: input.description?.trim() ?? '',
      currentVersionId: null,
      namespace: [],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.mongo.insertProject(project);
      const version = await this.insertProjectVersion(project, 1, [], null);
      project.currentVersionId = version._id;
      await this.mongo.saveProject(project);
      return this.toProjectDto(project);
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async updateProject(
    id: string,
    input: { name?: string; key?: string; description?: string },
  ): Promise<ProjectDto> {
    const project = await this.requireProject(id);
    const previousKey = project.key;
    if (input.name != null) {
      project.name = input.name.trim();
    }
    if (input.key != null) {
      project.key = input.key;
    }
    if (input.description != null) {
      project.description = input.description.trim();
    }
    project.updatedAt = new Date();
    try {
      await this.mongo.saveProject(project);
    } catch (error) {
      this.rethrowUnique(error);
    }
    if (project.key !== previousKey) {
      await this.mongo.renameProjectKey(project._id, project.key);
    }
    return this.toProjectDto(project);
  }

  async deleteProject(id: string): Promise<void> {
    const project = await this.requireProject(id);
    const versions = await this.mongo.listProjectVersions(project._id);
    const keys = new Set<string>();
    for (const version of versions) {
      const lang = await this.mongo.getLangVersion(version.langVersionId);
      for (const page of version.pages) {
        for (const item of lang?.langs ?? []) {
          keys.add(this.langObjectKey(project.key, page.key, version.versionNo, item.key));
        }
      }
      for (const kind of ['asset', 'icon'] as const) {
        const libraryId = kind === 'asset' ? version.assetVersionId : version.iconVersionId;
        const library = await this.mongo.getLibraryVersion(kind, libraryId);
        for (const group of library?.groups ?? []) {
          for (const file of group.files) {
            keys.add(file.key);
          }
        }
      }
    }
    for (const prefix of [this.assetRoot(project.key), this.iconRoot(project.key), `lowcode/${project.key}/blobs/`, `lowcode/${project.key}/lang/`]) {
      for (const item of await this.oss.listObjects(prefix)) {
        keys.add(item.key);
      }
    }
    await this.mongo.deleteByProject(project._id);
    await this.deleteOssKeys([...keys]);
  }

  async listProjectVersions(projectId: string): Promise<ProjectVersionDto[]> {
    await this.requireProject(projectId);
    const rows = await this.mongo.listProjectVersions(projectId);
    return rows.map((row) => this.toProjectVersionDto(row));
  }

  async createProjectVersion(
    projectId: string,
    input: { source: 'blank' | 'copy'; copyFromId?: string },
  ): Promise<ProjectVersionDto> {
    const project = await this.requireProject(projectId);
    const existing = await this.mongo.listProjectVersions(project._id);
    const versionNo = existing.reduce((max, version) => Math.max(max, version.versionNo), 0) + 1;
    let saved: ProjectVersionRecord;
    if (input.source === 'copy') {
      const source = existing.find((version) => version._id === input.copyFromId);
      if (!source) {
        throw new NotFoundException();
      }
      const now = new Date();
      saved = {
        _id: randomUUID(),
        projectId: project._id,
        projectKey: project.key,
        versionNo,
        description: '',
        pages: source.pages.map((page) => ({ ...page })),
        langVersionId: source.langVersionId,
        assetVersionId: source.assetVersionId,
        iconVersionId: source.iconVersionId,
        createdAt: now,
        updatedAt: now,
      };
      await this.mongo.saveProjectVersion(saved);
      await this.retainVersionShares(saved);
    } else {
      saved = await this.insertProjectVersion(project, versionNo, [], null);
    }
    if (!project.currentVersionId) {
      project.currentVersionId = saved._id;
      project.updatedAt = new Date();
      await this.mongo.saveProject(project);
    }
    await this.recountCodeUses(project._id);
    return this.toProjectVersionDto(saved);
  }

  async deleteProjectVersion(projectId: string, versionId: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const version = await this.requireProjectVersion(projectId, versionId);
    const wasCurrent = project.currentVersionId === version._id;
    const lang = await this.mongo.getLangVersion(version.langVersionId);
    await this.mongo.deleteProjectVersion(version._id);
    await this.releaseVersionShares(version);
    if (wasCurrent) {
      const rest = (await this.mongo.listProjectVersions(project._id)).sort((a, b) => b.versionNo - a.versionNo);
      project.currentVersionId = rest[0]?._id ?? null;
      project.updatedAt = new Date();
      await this.mongo.saveProject(project);
    }
    await this.deleteOssKeys(this.langSnapshotKeys(project.key, version, lang?.langs ?? []));
    await this.recountCodeUses(project._id);
  }

  async getLangs(projectId: string, versionId: string): Promise<ProjectLangCatalogDto> {
    const version = await this.requireProjectVersion(projectId, versionId);
    return this.catalogOf(await this.mongo.getLangVersion(version.langVersionId));
  }

  async putLangs(
    projectId: string,
    versionId: string,
    input: { langs: unknown[]; groups: unknown[] },
  ): Promise<ProjectLangCatalogDto> {
    const project = await this.requireProject(projectId);
    const version = await this.requireProjectVersion(projectId, versionId);
    const catalog = this.parseLangCatalog(input);
    const langs = catalog.langs.map((lang, index) => ({
      key: lang.key,
      name: lang.name,
      dir: lang.dir,
      sortOrder: index,
    }));
    const valueRows: ProjectLangValueRecord[] = [];
    for (const [groupIndex, group] of catalog.groups.entries()) {
      const filled = group.entries.flatMap((entry, entryIndex) =>
        Object.entries(entry.values)
          .filter(([, text]) => text)
          .map(([langKey, value]) => ({
            groupKey: group.key,
            entryKey: entry.key,
            langKey,
            value,
            sortOrder: groupIndex * 10000 + entryIndex,
          })),
      );
      if (filled.length > 0) {
        valueRows.push(...filled);
        continue;
      }
      if (catalog.langs.length === 0) {
        continue;
      }
      valueRows.push({
        groupKey: group.key,
        entryKey: group.entries[0]?.key ?? nextPlaceholderEntryKey([]),
        langKey: catalog.langs[0].key,
        value: '',
        sortOrder: groupIndex * 10000,
      });
    }
    const lang = await this.writableLang(version);
    lang.langs = langs;
    lang.langValues = valueRows;
    lang.updatedAt = new Date();
    await this.mongo.saveLangVersion(lang);
    if (project.currentVersionId === version._id) {
      await this.writeLangSnapshots(project, version);
    }
    return this.catalogOf(lang);
  }

  async listPages(projectId: string, versionId: string): Promise<ProjectPageDto[]> {
    const version = await this.requireProjectVersion(projectId, versionId);
    return this.sortedPages(version.pages).map((row) => this.toPageDto(projectId, row));
  }

  async getPage(projectId: string, versionId: string, pageId: string): Promise<ProjectPageDto> {
    const version = await this.requireProjectVersion(projectId, versionId);
    return this.toPageDto(projectId, this.pageIn(version, pageId));
  }

  async createPage(
    projectId: string,
    versionId: string,
    input: { name: string; key: string; description?: string },
  ): Promise<ProjectPageDto> {
    const project = await this.requireProject(projectId);
    const version = await this.requireProjectVersion(projectId, versionId);
    if (version.pages.some((page) => page.key === input.key)) {
      throw new ConflictException('key already exists');
    }
    const now = new Date();
    const page: ProjectPageRecord = {
      id: randomUUID(),
      name: input.name.trim(),
      key: input.key,
      description: input.description?.trim() ?? '',
      currentVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    const snapshot = await this.mongo.putPage({
      _id: randomUUID(),
      projectId: project._id,
      projectKey: project.key,
      pageId: page.id,
      pageKey: page.key,
      uses: 1,
      createdAt: now,
      ...this.contentOf(this.normalizeDocument(EMPTY_PAGE_DOCUMENT)),
    });
    page.currentVersionId = snapshot._id;
    version.pages.push(page);
    version.updatedAt = now;
    await this.mongo.saveProjectVersion(version);
    if (project.currentVersionId === version._id) {
      await this.writeLangSnapshots(project, version);
    }
    return this.toPageDto(project._id, page);
  }

  async updatePage(
    projectId: string,
    versionId: string,
    pageId: string,
    input: { name?: string; key?: string; description?: string },
  ): Promise<ProjectPageDto> {
    const version = await this.requireProjectVersion(projectId, versionId);
    const page = this.pageIn(version, pageId);
    if (input.name != null) {
      page.name = input.name.trim();
    }
    if (input.key != null) {
      if (version.pages.some((item) => item.id !== page.id && item.key === input.key)) {
        throw new ConflictException('key already exists');
      }
      page.key = input.key;
    }
    if (input.description != null) {
      page.description = input.description.trim();
    }
    page.updatedAt = new Date();
    version.updatedAt = page.updatedAt;
    await this.mongo.saveProjectVersion(version);
    if (page.currentVersionId) {
      const snapshot = await this.mongo.getPage(page.currentVersionId);
      if (snapshot && snapshot.uses <= 1 && snapshot.pageKey !== page.key) {
        snapshot.pageKey = page.key;
        await this.mongo.putPage(this.versionBody(snapshot));
      }
    }
    return this.toPageDto(projectId, page);
  }

  async deletePage(projectId: string, versionId: string, pageId: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const version = await this.requireProjectVersion(projectId, versionId);
    const page = this.pageIn(version, pageId);
    const snapshotId = page.currentVersionId;
    version.pages = version.pages.filter((item) => item.id !== page.id);
    version.updatedAt = new Date();
    await this.mongo.saveProjectVersion(version);
    if (snapshotId) {
      await this.releasePageSnapshot(version, snapshotId);
    }
    await this.recountCodeUses(projectId);
    if (project.currentVersionId === version._id && snapshotId) {
      const lang = await this.mongo.getLangVersion(version.langVersionId);
      await this.deleteOssKeys(
        (lang?.langs ?? []).map((item) => this.langObjectKey(project.key, page.key, version.versionNo, item.key)),
      );
    }
  }

  async getPageDocument(projectId: string, versionId: string, pageId: string): Promise<ProjectPageSnapshotDto> {
    const version = await this.requireProjectVersion(projectId, versionId);
    const page = this.pageIn(version, pageId);
    const snapshot = await this.pageSnapshot(page);
    return this.toSnapshotDto(snapshot, false);
  }

  async updatePageDocument(
    projectId: string,
    versionId: string,
    pageId: string,
    input: { document: object },
  ): Promise<ProjectPageSnapshotDto> {
    const project = await this.requireProject(projectId);
    const version = await this.requireProjectVersion(projectId, versionId);
    const page = this.pageIn(version, pageId);
    const originalId = page.currentVersionId;
    const snapshot = await this.writablePage(version, page);
    const next = this.normalizeDocument(input.document);
    if (await this.keepStoredPage(projectId, snapshot.widgets, next.widgets)) {
      return this.toSnapshotDto(snapshot, false);
    }
    this.applyDocument(snapshot, next);
    const saved = await this.mongo.putPage(this.versionBody(snapshot));
    await this.recountCodeUses(projectId);
    if (project.currentVersionId === version._id) {
      await this.writeLangSnapshots(project, version);
    }
    return this.toSnapshotDto(saved, saved._id !== originalId);
  }

  async listComponents(projectId: string): Promise<ProjectComponentDto[]> {
    const project = await this.requireProject(projectId);
    const rows = await this.mongo.listComponents(project._id);
    return rows.map((row) => this.toComponentDto(row));
  }

  async getComponent(projectId: string, componentId: string): Promise<ProjectComponentDto> {
    const component = await this.requireComponent(projectId, componentId);
    return this.toComponentDto(component);
  }

  async createComponent(
    projectId: string,
    input: { name: string; key: string; description?: string },
  ): Promise<ProjectComponentDto> {
    const project = await this.requireProject(projectId);
    const existing = await this.mongo.listComponents(project._id);
    if (existing.some((item) => item.key === input.key)) {
      throw new ConflictException('key already exists');
    }
    const document = this.normalizeDocument(EMPTY_PAGE_DOCUMENT);
    const now = new Date();
    const component: ComponentRecord = {
      _id: randomUUID(),
      projectId: project._id,
      projectKey: project.key,
      name: input.name.trim(),
      key: input.key,
      description: input.description?.trim() ?? '',
      currentVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    const version: ComponentVersionRecord = {
      _id: randomUUID(),
      projectId: project._id,
      projectKey: project.key,
      componentId: component._id,
      componentKey: component.key,
      versionNo: 1,
      description: '',
      createdAt: now,
      updatedAt: now,
      ...this.contentOf(document),
    };
    try {
      component.currentVersionId = version._id;
      await this.mongo.saveComponent(component);
      await this.mongo.putComponentVersion(this.componentVersionBody(version));
      return this.toComponentDto(component);
    } catch (error) {
      await this.mongo.deleteComponent(component._id).catch(() => undefined);
      await this.mongo.deleteComponentVersion(version._id).catch(() => undefined);
      this.rethrowUnique(error);
    }
  }

  async updateComponent(
    projectId: string,
    componentId: string,
    input: { name?: string; key?: string; description?: string },
  ): Promise<ProjectComponentDto> {
    const component = await this.requireComponent(projectId, componentId);
    const previousKey = component.key;
    if (input.name != null) {
      component.name = input.name.trim();
    }
    if (input.key != null) {
      const existing = await this.mongo.listComponents(component.projectId);
      if (existing.some((item) => item._id !== component._id && item.key === input.key)) {
        throw new ConflictException('key already exists');
      }
      component.key = input.key;
    }
    if (input.description != null) {
      component.description = input.description.trim();
    }
    component.updatedAt = new Date();
    await this.mongo.saveComponent(component);
    if (component.key !== previousKey) {
      const versions = await this.mongo.listComponentVersions(component._id);
      for (const version of versions) {
        await this.mongo.putComponentVersion({ ...this.componentVersionBody(version), componentKey: component.key });
      }
    }
    return this.toComponentDto(component);
  }

  async deleteComponent(projectId: string, componentId: string): Promise<void> {
    const component = await this.requireComponent(projectId, componentId);
    const versions = await this.mongo.listComponentVersions(component._id);
    await this.mongo.deleteComponentVersions(component._id);
    await this.mongo.deleteComponent(component._id);
    await this.recountCodeUses(projectId);
  }

  async listComponentVersions(projectId: string, componentId: string): Promise<ProjectPageVersionDto[]> {
    await this.requireComponent(projectId, componentId);
    const rows = await this.mongo.listComponentVersions(componentId);
    return rows.map((row) => this.toComponentVersionDto(row));
  }

  async listComponentVersionMeta(projectId: string, componentId: string): Promise<ProjectPageVersionMetaDto[]> {
    await this.requireComponent(projectId, componentId);
    const rows = await this.mongo.listComponentVersionStamps(componentId);
    return rows.map((row) => this.toVersionMeta(row, componentId));
  }

  async getComponentVersion(
    projectId: string,
    componentId: string,
    versionId: string,
  ): Promise<ProjectPageVersionDto> {
    const version = await this.requireComponentVersion(projectId, componentId, versionId);
    return this.toComponentVersionDto(version);
  }

  async createComponentVersion(
    projectId: string,
    componentId: string,
    input: { document: object; description?: string },
  ): Promise<ProjectPageVersionDto> {
    const component = await this.requireComponent(projectId, componentId);
    const document = this.normalizeDocument(input.document);
    const existing = await this.mongo.listComponentVersions(component._id);
    const versionNo = existing.reduce((max, version) => Math.max(max, version.versionNo), 0) + 1;
    const now = new Date();
    let saved: ComponentVersionRecord | undefined;
    try {
      saved = await this.mongo.putComponentVersion({
        _id: randomUUID(),
        projectId: component.projectId,
        projectKey: component.projectKey,
        componentId: component._id,
        componentKey: component.key,
        versionNo,
        description: input.description?.trim() ?? '',
        createdAt: now,
        ...this.contentOf(document),
      });
    } catch (error) {
      if (saved) {
        await this.mongo.deleteComponentVersion(saved._id).catch(() => undefined);
      }
      this.rethrowUnique(error);
    }
    await this.recountCodeUses(projectId);
    if (!component.currentVersionId) {
      component.currentVersionId = saved._id;
      component.updatedAt = now;
      await this.mongo.saveComponent(component);
    }
    return this.toComponentVersionDto(saved);
  }

  async updateComponentVersion(
    projectId: string,
    componentId: string,
    versionId: string,
    input: { document?: object; description?: string },
  ): Promise<ProjectPageVersionDto> {
    const component = await this.requireComponent(projectId, componentId);
    const version = await this.requireComponentVersion(projectId, componentId, versionId);
    if (input.description != null) {
      version.description = input.description.trim();
    }
    if (input.document != null) {
      const next = this.normalizeDocument(input.document);
      this.applyDocument(version, next);
    }
    const saved = await this.mongo.putComponentVersion(this.componentVersionBody(version));
    if (input.document != null) {
      await this.recountCodeUses(projectId);
    }
    if (!component.currentVersionId || component.currentVersionId === version._id) {
      component.currentVersionId = version._id;
      component.updatedAt = new Date();
      await this.mongo.saveComponent(component);
    }
    return this.toComponentVersionDto(saved);
  }

  async deleteComponentVersion(projectId: string, componentId: string, versionId: string): Promise<void> {
    const component = await this.requireComponent(projectId, componentId);
    const version = await this.requireComponentVersion(projectId, componentId, versionId);
    const wasCurrent = component.currentVersionId === version._id;
    await this.mongo.deleteComponentVersion(versionId);
    if (wasCurrent) {
      const rest = (await this.mongo.listComponentVersions(component._id)).sort((a, b) => b.versionNo - a.versionNo);
      component.currentVersionId = rest[0]?._id ?? null;
      component.updatedAt = new Date();
      await this.mongo.saveComponent(component);
    }
    await this.recountCodeUses(projectId);
  }

  async listAssetGroups(projectId: string, versionId: string): Promise<ProjectAssetGroupDto[]> {
    return (await this.libraryOf('asset', projectId, versionId)).groups
      .map((group) => ({ name: group.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createAssetGroup(projectId: string, versionId: string, name: string): Promise<ProjectAssetGroupDto> {
    const group = this.assertAssetGroupName(name);
    await this.editLibrary('asset', projectId, versionId, (library) => {
      if (library.groups.some((item) => item.name === group)) {
        throw new ConflictException('group already exists');
      }
      library.groups.push({ name: group, files: [] });
    });
    return { name: group };
  }

  async renameAssetGroup(projectId: string, versionId: string, fromName: string, toName: string): Promise<ProjectAssetGroupDto> {
    const from = this.assertAssetGroupName(fromName);
    const to = this.assertAssetGroupName(toName);
    await this.editLibrary('asset', projectId, versionId, (library) => {
      this.renameLibraryGroup(library, from, to);
    });
    return { name: to };
  }

  async deleteAssetGroup(projectId: string, versionId: string, name: string): Promise<void> {
    const group = this.assertAssetGroupName(name);
    const removed: string[] = [];
    await this.editLibrary('asset', projectId, versionId, (library) => {
      const index = library.groups.findIndex((item) => item.name === group);
      if (index < 0) {
        throw new NotFoundException();
      }
      removed.push(...library.groups[index].files.map((file) => file.key));
      library.groups.splice(index, 1);
    });
    for (const key of removed) {
      await this.releaseBlob(key);
    }
  }

  async listAssetFiles(projectId: string, versionId: string, name: string): Promise<ProjectAssetFileDto[]> {
    const group = this.assertAssetGroupName(name);
    const library = await this.libraryOf('asset', projectId, versionId);
    return this.libraryFiles(library, group);
  }

  async uploadAssetFile(
    projectId: string,
    versionId: string,
    name: string,
    file: Express.Multer.File,
    displayName?: string,
  ): Promise<ProjectAssetFileDto> {
    const project = await this.requireProject(projectId);
    const group = this.assertAssetGroupName(name);
    const fileName = this.assertAssetFileName(this.assetUploadName(file.originalname, displayName));
    const key = this.blobKey(project.key, fileName);
    const stored = await this.oss.putObject(key, file.buffer, file.mimetype || 'application/octet-stream');
    try {
      await this.editLibrary('asset', projectId, versionId, (library) => {
        const target = library.groups.find((item) => item.name === group);
        if (!target) {
          throw new NotFoundException();
        }
        if (target.files.some((item) => item.name === fileName)) {
          throw new ConflictException('file already exists');
        }
        target.files.push({ name: fileName, key: stored.key, size: file.size, contentType: file.mimetype });
      });
    } catch (error) {
      await this.releaseBlob(stored.key);
      throw error;
    }
    return { name: fileName, key: stored.key, url: stored.url, size: file.size };
  }

  async deleteAssetFile(projectId: string, versionId: string, groupName: string, fileName: string): Promise<void> {
    const group = this.assertAssetGroupName(groupName);
    const name = this.assertAssetFileName(fileName);
    const removed: string[] = [];
    await this.editLibrary('asset', projectId, versionId, (library) => {
      removed.push(...this.takeLibraryFile(library, group, name));
    });
    for (const key of removed) {
      await this.releaseBlob(key);
    }
  }

  async listIconGroups(projectId: string, versionId: string): Promise<ProjectIconGroupDto[]> {
    return (await this.libraryOf('icon', projectId, versionId)).groups
      .map((group) => ({ name: group.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createIconGroup(projectId: string, versionId: string, name: string): Promise<ProjectIconGroupDto> {
    const group = this.assertIconGroupName(name);
    await this.editLibrary('icon', projectId, versionId, (library) => {
      if (library.groups.some((item) => item.name === group)) {
        throw new ConflictException('group already exists');
      }
      library.groups.push({ name: group, files: [] });
    });
    return { name: group };
  }

  async renameIconGroup(projectId: string, versionId: string, fromName: string, toName: string): Promise<ProjectIconGroupDto> {
    const from = this.assertIconGroupName(fromName);
    const to = this.assertIconGroupName(toName);
    await this.editLibrary('icon', projectId, versionId, (library) => {
      this.renameLibraryGroup(library, from, to);
    });
    return { name: to };
  }

  async deleteIconGroup(projectId: string, versionId: string, name: string): Promise<void> {
    const group = this.assertIconGroupName(name);
    const removed: string[] = [];
    await this.editLibrary('icon', projectId, versionId, (library) => {
      const index = library.groups.findIndex((item) => item.name === group);
      if (index < 0) {
        throw new NotFoundException();
      }
      removed.push(...library.groups[index].files.map((file) => file.key));
      library.groups.splice(index, 1);
    });
    for (const key of removed) {
      await this.releaseBlob(key);
    }
  }

  async listIconFiles(projectId: string, versionId: string, name: string): Promise<ProjectIconFileDto[]> {
    const group = this.assertIconGroupName(name);
    const library = await this.libraryOf('icon', projectId, versionId);
    return this.libraryFiles(library, group);
  }

  async uploadIconFile(
    projectId: string,
    versionId: string,
    name: string,
    file: Express.Multer.File,
    displayName?: string,
  ): Promise<ProjectIconFileDto> {
    const project = await this.requireProject(projectId);
    if (!/\.svg$/i.test(file.originalname)) {
      throw new BadRequestException('only svg files are allowed');
    }
    const group = this.assertIconGroupName(name);
    const fileName = this.assertIconFileName(this.assetUploadName(file.originalname, displayName));
    const key = this.blobKey(project.key, fileName);
    const stored = await this.oss.putObject(key, file.buffer, file.mimetype || 'image/svg+xml');
    try {
      await this.editLibrary('icon', projectId, versionId, (library) => {
        const target = library.groups.find((item) => item.name === group);
        if (!target) {
          throw new NotFoundException();
        }
        if (target.files.some((item) => item.name === fileName)) {
          throw new ConflictException('file already exists');
        }
        target.files.push({ name: fileName, key: stored.key, size: file.size, contentType: file.mimetype || 'image/svg+xml' });
      });
    } catch (error) {
      await this.releaseBlob(stored.key);
      throw error;
    }
    return { name: fileName, key: stored.key, url: stored.url, size: file.size };
  }

  async deleteIconFile(projectId: string, versionId: string, groupName: string, fileName: string): Promise<void> {
    const group = this.assertIconGroupName(groupName);
    const name = this.assertIconFileName(fileName);
    const removed: string[] = [];
    await this.editLibrary('icon', projectId, versionId, (library) => {
      removed.push(...this.takeLibraryFile(library, group, name));
    });
    for (const key of removed) {
      await this.releaseBlob(key);
    }
  }


  async getMethodCode(projectId: string, methodId: string): Promise<MethodCodeDto> {
    await this.requireProject(projectId);
    this.assertMethodId(methodId);
    const current = await this.mongo.getFunction(projectId, methodId);
    if (typeof current?.code !== 'string') {
      throw new NotFoundException();
    }
    return { id: methodId, code: current.code, forked: false };
  }

  async putMethodCode(projectId: string, methodId: string, code: string): Promise<MethodCodeDto> {
    const project = await this.requireProject(projectId);
    this.assertMethodId(methodId);
    const current = await this.mongo.getFunction(projectId, methodId);
    if ((current?.uses ?? 0) > 1) {
      const nextId = randomUUID();
      await this.mongo.putFunctionCode(projectId, project.key, nextId, code);
      return { id: nextId, code, forked: true };
    }
    await this.mongo.putFunctionCode(projectId, project.key, methodId, code);
    return { id: methodId, code, forked: false };
  }

  async getWidgetEvent(projectId: string, eventId: string): Promise<WidgetEventScriptDto> {
    await this.requireProject(projectId);
    this.assertEventId(eventId);
    const current = await this.mongo.getEvent(projectId, eventId);
    if (!current) {
      throw new NotFoundException();
    }
    return { id: eventId, source: current.source, forked: false };
  }

  async putWidgetEvent(projectId: string, eventId: string, source: string): Promise<WidgetEventScriptDto> {
    const project = await this.requireProject(projectId);
    this.assertEventId(eventId);
    if (!parseEventSource(source)) {
      throw new BadRequestException('Invalid event script');
    }
    const current = await this.mongo.getEvent(projectId, eventId);
    if ((current?.uses ?? 0) > 1) {
      const nextId = randomUUID();
      await this.mongo.putEvent(projectId, project.key, nextId, source);
      return { id: nextId, source, forked: true };
    }
    await this.mongo.putEvent(projectId, project.key, eventId, source);
    return { id: eventId, source, forked: false };
  }

  async deleteWidgetEvent(projectId: string, eventId: string): Promise<void> {
    await this.requireProject(projectId);
    this.assertEventId(eventId);
    const current = await this.mongo.getEvent(projectId, eventId);
    if (!current || (current.uses ?? 0) > 0) {
      return;
    }
    await this.mongo.deleteEvent(projectId, eventId);
  }

  async listNamespaces(projectId: string): Promise<ProjectNamespaceDto[]> {
    const project = await this.requireProject(projectId);
    return (project.namespace ?? []).map((item) => ({ name: item.name, versionId: item.versionId }));
  }

  async createNamespace(projectId: string, name: string): Promise<ProjectNamespaceDto> {
    const project = await this.requireProject(projectId);
    const trimmed = this.namespaceName(name);
    const list = project.namespace ?? [];
    if (list.some((item) => item.name === trimmed)) {
      throw new ConflictException('namespace already exists');
    }
    const now = new Date();
    const versionId = randomUUID();
    await this.mongo.saveNamespaceVersion({
      _id: versionId,
      projectId: project._id,
      projectKey: project.key,
      uses: 1,
      types: [],
      data: [],
      updatedAt: now,
    });
    project.namespace = [...list, { name: trimmed, versionId }];
    project.updatedAt = now;
    await this.mongo.saveProject(project);
    return { name: trimmed, versionId };
  }

  async renameNamespace(projectId: string, name: string, nextName: string): Promise<ProjectNamespaceDto> {
    const project = await this.requireProject(projectId);
    const current = name;
    const trimmed = this.namespaceName(nextName);
    const list = project.namespace ?? [];
    const index = list.findIndex((item) => item.name === current);
    if (index < 0) {
      throw new NotFoundException();
    }
    if (trimmed !== current && list.some((item) => item.name === trimmed)) {
      throw new ConflictException('namespace already exists');
    }
    const next = list.map((item, itemIndex) => (itemIndex === index ? { ...item, name: trimmed } : item));
    project.namespace = next;
    project.updatedAt = new Date();
    await this.mongo.saveProject(project);
    return next[index];
  }

  async deleteNamespace(projectId: string, name: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const current = name;
    const list = project.namespace ?? [];
    const found = list.find((item) => item.name === current);
    if (!found) {
      throw new NotFoundException();
    }
    project.namespace = list.filter((item) => item.name !== current);
    project.updatedAt = new Date();
    await this.mongo.saveProject(project);
    await this.mongo.deleteNamespaceVersion(found.versionId);
  }

  async getNamespace(projectId: string, name: string): Promise<NamespaceDocumentDto> {
    const project = await this.requireProject(projectId);
    const found = (project.namespace ?? []).find((item) => item.name === name);
    if (!found) {
      throw new NotFoundException();
    }
    const version = await this.mongo.getNamespaceVersion(found.versionId);
    if (!version || version.projectId !== project._id) {
      throw new NotFoundException();
    }
    return this.toNamespaceDocument(found.name, version);
  }

  async putNamespace(
    projectId: string,
    name: string,
    input: { types: unknown[]; data: unknown[] },
  ): Promise<NamespaceDocumentDto> {
    const project = await this.requireProject(projectId);
    const found = (project.namespace ?? []).find((item) => item.name === name);
    if (!found) {
      throw new NotFoundException();
    }
    const version = await this.mongo.getNamespaceVersion(found.versionId);
    if (!version || version.projectId !== project._id) {
      throw new NotFoundException();
    }
    const types = input.types.map((item) => this.normalizeNamespaceType(item));
    const names = new Set(types.map((item) => item.name));
    if (names.size !== types.length) {
      throw new BadRequestException('duplicate type name');
    }
    version.types = types;
    version.data = input.data.map((item) => this.normalizeNamespaceData(item));
    version.updatedAt = new Date();
    await this.mongo.saveNamespaceVersion(version);
    return this.toNamespaceDocument(found.name, version);
  }

  private namespaceName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 64 || /[\s/\\]/.test(trimmed)) {
      throw new BadRequestException('invalid namespace name');
    }
    return trimmed;
  }

  private normalizeNamespaceType(value: unknown): NamespaceTypeRecord {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('invalid type');
    }
    const row = value as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(name) || name.length > 64) {
      throw new BadRequestException('invalid type name');
    }
    const fields = Array.isArray(row.fields) ? row.fields.map((item) => this.normalizeNamespaceField(item, 0)) : [];
    const source = typeof row.source === 'string' ? row.source.slice(0, 100_000) : '';
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : randomUUID(),
      name,
      description: typeof row.description === 'string' ? row.description.slice(0, 4000) : '',
      fields,
      source,
    };
  }

  private normalizeNamespaceField(value: unknown, depth: number): NamespaceFieldRecord {
    if (depth > 12 || !value || typeof value !== 'object') {
      throw new BadRequestException('invalid type field');
    }
    const row = value as Record<string, unknown>;
    const type = typeof row.type === 'string' ? row.type.trim() : '';
    if (!type || type.length > 64) {
      throw new BadRequestException('invalid field type');
    }
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 64) : '';
    const children = Array.isArray(row.children)
      ? row.children.map((item) => this.normalizeNamespaceField(item, depth + 1))
      : undefined;
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : randomUUID(),
      name,
      description: typeof row.description === 'string' ? row.description.slice(0, 4000) : '',
      type,
      ...(children && children.length > 0 ? { children } : {}),
    };
  }

  private normalizeNamespaceData(value: unknown): NamespaceDataRecord {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('invalid data');
    }
    const row = value as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name || name.length > 64) {
      throw new BadRequestException('invalid data name');
    }
    return {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : randomUUID(),
      type: typeof row.type === 'string' ? row.type.trim().slice(0, 64) : '',
      name,
      description: typeof row.description === 'string' ? row.description.slice(0, 4000) : '',
      value: row.value === undefined ? null : row.value,
    };
  }

  private toNamespaceDocument(name: string, version: NamespaceVersionRecord): NamespaceDocumentDto {
    return {
      name,
      versionId: version._id,
      types: version.types.map((item) => this.toNamespaceType(item)),
      data: version.data.map((item) => this.toNamespaceData(item)),
    };
  }

  private toNamespaceType(item: NamespaceTypeRecord): NamespaceTypeDto {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      fields: item.fields.map((field) => this.toNamespaceField(field)),
      source: item.source,
    };
  }

  private toNamespaceField(field: NamespaceFieldRecord): NamespaceTypeFieldDto {
    return {
      id: field.id,
      name: field.name,
      description: field.description,
      type: field.type,
      ...(field.children ? { children: field.children.map((child) => this.toNamespaceField(child)) } : {}),
    };
  }

  private toNamespaceData(item: NamespaceDataRecord): NamespaceDataDto {
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      description: item.description,
      value: item.value,
    };
  }

  private catalogOf(record: LangVersionRecord | null): ProjectLangCatalogDto {
    const langRows = [...(record?.langs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const valueRows = [...(record?.langValues ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const langs: ProjectLangDto[] = langRows.map((row) => ({
      key: row.key,
      name: row.name,
      dir: row.dir === 'rtl' ? 'rtl' : 'ltr',
    }));
    const groups: ProjectLangGroupDto[] = [];
    const groupMap = new Map<string, ProjectLangGroupDto>();
    for (const row of valueRows) {
      let group = groupMap.get(row.groupKey);
      if (!group) {
        group = { key: row.groupKey, entries: [] };
        groupMap.set(row.groupKey, group);
        groups.push(group);
      }
      let entry = group.entries.find((item) => item.key === row.entryKey);
      if (!entry) {
        entry = { key: row.entryKey, values: {} };
        group.entries.push(entry);
      }
      if (row.value) {
        entry.values[row.langKey] = row.value;
      }
    }
    return { langs, groups };
  }

  private parseLangCatalog(input: { langs: unknown[]; groups: unknown[] }): ProjectLangCatalogDto {
    const langs: ProjectLangDto[] = [];
    const langKeys = new Set<string>();
    for (const item of input.langs) {
      const row = asRecord(item);
      if (!row) {
        throw new BadRequestException('Invalid language');
      }
      const key = String(row.key ?? '').trim();
      if (!isI18nKey(key)) {
        throw new BadRequestException('Invalid language key');
      }
      if (langKeys.has(key)) {
        throw new ConflictException('key already exists');
      }
      langKeys.add(key);
      const dirRaw = String(row.dir ?? 'ltr').trim();
      if (dirRaw !== 'ltr' && dirRaw !== 'rtl') {
        throw new BadRequestException('Invalid language dir');
      }
      langs.push({
        key,
        name: String(row.name ?? '').trim(),
        dir: dirRaw,
      });
    }

    const groups: ProjectLangGroupDto[] = [];
    const groupKeys = new Set<string>();
    for (const item of input.groups) {
      const row = asRecord(item);
      if (!row) {
        throw new BadRequestException('Invalid group');
      }
      const groupKey = String(row.key ?? '').trim();
      if (!isI18nKey(groupKey)) {
        throw new BadRequestException('Invalid group key');
      }
      if (groupKeys.has(groupKey)) {
        throw new ConflictException('key already exists');
      }
      groupKeys.add(groupKey);
      const entries: ProjectLangEntryDto[] = [];
      const entryKeys = new Set<string>();
      const rawEntries = Array.isArray(row.entries) ? row.entries : [];
      for (const entryItem of rawEntries) {
        const entryRow = asRecord(entryItem);
        if (!entryRow) {
          throw new BadRequestException('Invalid entry');
        }
        const entryKey = String(entryRow.key ?? '').trim();
        if (!isI18nKey(entryKey)) {
          throw new BadRequestException('Invalid entry key');
        }
        if (entryKeys.has(entryKey)) {
          throw new ConflictException('key already exists');
        }
        entryKeys.add(entryKey);
        const values: Record<string, string> = {};
        const rawValues = asRecord(entryRow.values) ?? {};
        for (const [langKey, text] of Object.entries(rawValues)) {
          if (!isI18nKey(langKey) || !langKeys.has(langKey)) {
            continue;
          }
          if (typeof text !== 'string') {
            continue;
          }
          const trimmed = text.trim();
          if (!trimmed) {
            continue;
          }
          values[langKey] = trimmed;
        }
        entries.push({ key: entryKey, values });
      }
      groups.push({ key: groupKey, entries });
    }

    return { langs, groups };
  }

  private async writeLangSnapshots(project: ProjectRecord, version: ProjectVersionRecord) {
    const catalog = this.catalogOf(await this.mongo.getLangVersion(version.langVersionId));
    if (catalog.langs.length === 0) {
      return;
    }
    for (const page of version.pages) {
      for (const lang of catalog.langs) {
        const values: Record<string, string> = {};
        for (const group of catalog.groups) {
          for (const entry of group.entries) {
            const text = entry.values[lang.key];
            if (text) {
              values[`${group.key}.${entry.key}`] = text;
            }
          }
        }
        const body = JSON.stringify({
          key: lang.key,
          name: lang.name,
          dir: lang.dir,
          values,
        });
        await this.oss.putObject(
          this.langObjectKey(project.key, page.key, version.versionNo, lang.key),
          Buffer.from(body, 'utf8'),
          'application/json',
        );
      }
    }
  }

  private langSnapshotKeys(
    projectKey: string,
    version: ProjectVersionRecord,
    langs: Array<{ key: string }>,
  ): string[] {
    return version.pages.flatMap((page) => langs.map((lang) => this.langObjectKey(projectKey, page.key, version.versionNo, lang.key)));
  }

  private langObjectKey(projectKey: string, pageKey: string, versionNo: number, langKey: string) {
    return `lowcode/${projectKey}/lang/${pageKey}-v${versionNo}-${langKey}.json`;
  }

  private async requireProject(id: string): Promise<ProjectRecord> {
    const project = await this.mongo.getProject(id);
    if (!project) {
      throw new NotFoundException();
    }
    return project;
  }

  private async requireProjectVersion(projectId: string, versionId: string): Promise<ProjectVersionRecord> {
    await this.requireProject(projectId);
    const version = await this.mongo.getProjectVersion(versionId);
    if (!version || version.projectId !== projectId) {
      throw new NotFoundException();
    }
    version.pages ??= [];
    return version;
  }

  private pageIn(version: ProjectVersionRecord, pageId: string): ProjectPageRecord {
    const page = version.pages.find((item) => item.id === pageId);
    if (!page) {
      throw new NotFoundException();
    }
    return page;
  }

  private async pageSnapshot(page: ProjectPageRecord): Promise<PageVersionRecord> {
    if (!page.currentVersionId) {
      throw new NotFoundException();
    }
    const snapshot = await this.mongo.getPage(page.currentVersionId);
    if (!snapshot || snapshot.pageId !== page.id) {
      throw new NotFoundException();
    }
    return snapshot;
  }

  private async publishedVersion(project: ProjectRecord): Promise<ProjectVersionRecord | null> {
    if (!project.currentVersionId) {
      return null;
    }
    const version = await this.mongo.getProjectVersion(project.currentVersionId);
    if (!version || version.projectId !== project._id) {
      return null;
    }
    version.pages ??= [];
    return version;
  }

  /** 这份页面快照被多个工程版本使用时，先复制一份，只改当前工程版本的指针。 */
  private async writablePage(version: ProjectVersionRecord, page: ProjectPageRecord): Promise<PageVersionRecord> {
    const snapshot = await this.pageSnapshot(page);
    if ((snapshot.uses ?? 1) <= 1) {
      return snapshot;
    }
    const now = new Date();
    const copy = await this.mongo.putPage({
      ...this.versionBody(snapshot),
      _id: randomUUID(),
      uses: 1,
      pageKey: page.key,
      createdAt: now,
    });
    page.currentVersionId = copy._id;
    page.updatedAt = now;
    version.updatedAt = now;
    await this.mongo.saveProjectVersion(version);
    const still = version.pages.some((item) => item.currentVersionId === snapshot._id);
    if (!still) {
      await this.mongo.addPageUses(snapshot._id, -1);
    }
    return copy;
  }

  private async writableLang(version: ProjectVersionRecord): Promise<LangVersionRecord> {
    const current = await this.mongo.getLangVersion(version.langVersionId);
    if (!current) {
      throw new NotFoundException();
    }
    if ((current.uses ?? 1) <= 1) {
      return current;
    }
    const copy: LangVersionRecord = {
      ...current,
      _id: randomUUID(),
      uses: 1,
      langs: current.langs.map((lang) => ({ ...lang })),
      langValues: current.langValues.map((row) => ({ ...row })),
      updatedAt: new Date(),
    };
    await this.mongo.saveLangVersion(copy);
    version.langVersionId = copy._id;
    version.updatedAt = new Date();
    await this.mongo.saveProjectVersion(version);
    await this.mongo.addLangUses(current._id, -1);
    return copy;
  }

  private async writableLibrary(kind: 'asset' | 'icon', version: ProjectVersionRecord): Promise<LibraryVersionRecord> {
    const currentId = kind === 'asset' ? version.assetVersionId : version.iconVersionId;
    const current = await this.mongo.getLibraryVersion(kind, currentId);
    if (!current) {
      throw new NotFoundException();
    }
    if ((current.uses ?? 1) <= 1) {
      return current;
    }
    const copy: LibraryVersionRecord = {
      ...current,
      _id: randomUUID(),
      uses: 1,
      groups: this.cloneGroups(current.groups),
      updatedAt: new Date(),
    };
    await this.mongo.saveLibraryVersion(kind, copy);
    if (kind === 'asset') {
      version.assetVersionId = copy._id;
    } else {
      version.iconVersionId = copy._id;
    }
    version.updatedAt = new Date();
    await this.mongo.saveProjectVersion(version);
    await this.mongo.addLibraryUses(kind, current._id, -1);
    return copy;
  }

  private async libraryOf(kind: 'asset' | 'icon', projectId: string, versionId: string): Promise<LibraryVersionRecord> {
    const version = await this.requireProjectVersion(projectId, versionId);
    const id = kind === 'asset' ? version.assetVersionId : version.iconVersionId;
    const library = await this.mongo.getLibraryVersion(kind, id);
    if (!library) {
      throw new NotFoundException();
    }
    return library;
  }

  private async editLibrary(
    kind: 'asset' | 'icon',
    projectId: string,
    versionId: string,
    mutate: (library: LibraryVersionRecord) => void,
  ): Promise<void> {
    const version = await this.requireProjectVersion(projectId, versionId);
    const library = await this.writableLibrary(kind, version);
    mutate(library);
    library.updatedAt = new Date();
    await this.mongo.saveLibraryVersion(kind, library);
  }

  private cloneGroups(groups: LibraryGroupRecord[]): LibraryGroupRecord[] {
    return groups.map((group) => ({
      name: group.name,
      files: group.files.map((file) => ({ ...file })),
    }));
  }

  private renameLibraryGroup(library: LibraryVersionRecord, from: string, to: string) {
    if (from === to) {
      return;
    }
    const group = library.groups.find((item) => item.name === from);
    if (!group) {
      throw new NotFoundException();
    }
    if (library.groups.some((item) => item.name === to)) {
      throw new ConflictException('group already exists');
    }
    group.name = to;
  }

  private libraryFiles(library: LibraryVersionRecord, groupName: string): ProjectAssetFileDto[] {
    const group = library.groups.find((item) => item.name === groupName);
    if (!group) {
      throw new NotFoundException();
    }
    return group.files
      .map((file) => ({
        name: file.name,
        key: file.key,
        url: this.oss.getPublicUrl(file.key),
        size: file.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private takeLibraryFile(library: LibraryVersionRecord, groupName: string, fileName: string): string[] {
    const group = library.groups.find((item) => item.name === groupName);
    if (!group) {
      throw new NotFoundException();
    }
    const file = group.files.find((item) => item.name === fileName);
    if (!file) {
      throw new NotFoundException();
    }
    group.files = group.files.filter((item) => item.name !== fileName);
    return [file.key];
  }

  private async releaseBlob(key: string) {
    if ((await this.mongo.countBlobKey(key)) > 0) {
      return;
    }
    try {
      await this.oss.deleteObject(key);
    } catch (error) {
      this.logger.warn(`Failed to delete OSS object ${key}: ${String(error)}`);
    }
  }

  private blobKey(projectKey: string, fileName: string) {
    return `lowcode/${projectKey}/blobs/${randomUUID()}/${fileName}`;
  }

  private async insertProjectVersion(
    project: ProjectRecord,
    versionNo: number,
    pages: ProjectPageRecord[],
    shared: { langVersionId: string; assetVersionId: string; iconVersionId: string } | null,
  ): Promise<ProjectVersionRecord> {
    const now = new Date();
    const langId = shared?.langVersionId ?? randomUUID();
    const assetId = shared?.assetVersionId ?? randomUUID();
    const iconId = shared?.iconVersionId ?? randomUUID();
    if (!shared) {
      await this.mongo.saveLangVersion({
        _id: langId,
        projectId: project._id,
        projectKey: project.key,
        uses: 1,
        langs: [],
        langValues: [],
        updatedAt: now,
      });
      await this.mongo.saveLibraryVersion('asset', {
        _id: assetId,
        projectId: project._id,
        projectKey: project.key,
        uses: 1,
        groups: [],
        updatedAt: now,
      });
      await this.mongo.saveLibraryVersion('icon', {
        _id: iconId,
        projectId: project._id,
        projectKey: project.key,
        uses: 1,
        groups: [],
        updatedAt: now,
      });
    }
    const version: ProjectVersionRecord = {
      _id: randomUUID(),
      projectId: project._id,
      projectKey: project.key,
      versionNo,
      description: '',
      pages,
      langVersionId: langId,
      assetVersionId: assetId,
      iconVersionId: iconId,
      createdAt: now,
      updatedAt: now,
    };
    await this.mongo.saveProjectVersion(version);
    return version;
  }

  private async retainVersionShares(version: ProjectVersionRecord) {
    for (const snapshotId of new Set(version.pages.map((page) => page.currentVersionId).filter((id): id is string => Boolean(id)))) {
      await this.mongo.addPageUses(snapshotId, 1);
    }
    await this.mongo.addLangUses(version.langVersionId, 1);
    await this.mongo.addLibraryUses('asset', version.assetVersionId, 1);
    await this.mongo.addLibraryUses('icon', version.iconVersionId, 1);
  }

  private async releaseVersionShares(version: ProjectVersionRecord) {
    for (const snapshotId of new Set(version.pages.map((page) => page.currentVersionId).filter((id): id is string => Boolean(id)))) {
      const uses = await this.mongo.addPageUses(snapshotId, -1);
      if (uses <= 0) {
        await this.mongo.deletePage(snapshotId);
      }
    }
    const langUses = await this.mongo.addLangUses(version.langVersionId, -1);
    if (langUses <= 0) {
      await this.mongo.deleteLangVersion(version.langVersionId);
    }
    await this.releaseLibrary('asset', version.assetVersionId);
    await this.releaseLibrary('icon', version.iconVersionId);
  }

  private async releasePageSnapshot(version: ProjectVersionRecord, snapshotId: string) {
    if (version.pages.some((page) => page.currentVersionId === snapshotId)) {
      return;
    }
    const uses = await this.mongo.addPageUses(snapshotId, -1);
    if (uses <= 0) {
      await this.mongo.deletePage(snapshotId);
    }
  }

  private async releaseLibrary(kind: 'asset' | 'icon', id: string) {
    const current = await this.mongo.getLibraryVersion(kind, id);
    const uses = await this.mongo.addLibraryUses(kind, id, -1);
    if (uses > 0 || !current) {
      return;
    }
    const keys = current.groups.flatMap((group) => group.files.map((file) => file.key));
    await this.mongo.deleteLibraryVersion(kind, id);
    for (const key of keys) {
      await this.releaseBlob(key);
    }
  }

  private async migrateProjectVersions() {
    const projects = await this.mongo.listProjects();
    for (const project of projects) {
      const existing = await this.mongo.listProjectVersions(project._id);
      if (existing.length > 0) {
        continue;
      }
      const legacy = project as ProjectRecord & { pages?: ProjectPageRecord[] };
      const pages = Array.isArray(legacy.pages) ? legacy.pages : [];
      const lang = await this.mongo.getLegacyLang(project._id);
      const now = new Date();
      const langVersion: LangVersionRecord = {
        _id: randomUUID(),
        projectId: project._id,
        projectKey: project.key,
        uses: 1,
        langs: lang?.langs ?? [],
        langValues: lang?.langValues ?? [],
        updatedAt: now,
      };
      const assetVersion: LibraryVersionRecord = {
        _id: randomUUID(),
        projectId: project._id,
        projectKey: project.key,
        uses: 1,
        groups: await this.manifestFromPrefix(this.assetRoot(project.key)),
        updatedAt: now,
      };
      const iconVersion: LibraryVersionRecord = {
        _id: randomUUID(),
        projectId: project._id,
        projectKey: project.key,
        uses: 1,
        groups: await this.manifestFromPrefix(this.iconRoot(project.key)),
        updatedAt: now,
      };
      await this.mongo.saveLangVersion(langVersion);
      await this.mongo.saveLibraryVersion('asset', assetVersion);
      await this.mongo.saveLibraryVersion('icon', iconVersion);
      const version: ProjectVersionRecord = {
        _id: randomUUID(),
        projectId: project._id,
        projectKey: project.key,
        versionNo: 1,
        description: '',
        pages,
        langVersionId: langVersion._id,
        assetVersionId: assetVersion._id,
        iconVersionId: iconVersion._id,
        createdAt: now,
        updatedAt: now,
      };
      await this.mongo.saveProjectVersion(version);
      const seen = new Set(pages.map((page) => page.currentVersionId).filter((id): id is string => Boolean(id)));
      for (const snapshotId of seen) {
        await this.mongo.setPageUses(snapshotId, 1);
      }
      for (const snapshot of await this.mongo.listProjectPageSnapshots(project._id)) {
        if (!seen.has(snapshot._id)) {
          await this.mongo.setPageUses(snapshot._id, 0);
        }
      }
      await this.mongo.finishProjectMigration(project._id, version._id);
      project.currentVersionId = version._id;
      await this.writeLangSnapshots(project, version);
    }
    for (const project of await this.mongo.listProjects()) {
      await this.recountCodeUses(project._id);
    }
  }

  private async manifestFromPrefix(prefix: string): Promise<LibraryGroupRecord[]> {
    const groups = new Map<string, LibraryFileRecord[]>();
    for (const item of await this.oss.listObjects(prefix)) {
      const rest = item.key.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash <= 0) {
        continue;
      }
      const name = rest.slice(0, slash);
      const file = rest.slice(slash + 1);
      if (!file || file.includes('/')) {
        continue;
      }
      const files = groups.get(name) ?? [];
      if (file !== '.keep') {
        files.push({ name: file, key: item.key, size: item.size });
      }
      groups.set(name, files);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, files]) => ({
        name,
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }

  /** 方法、事件按工程版本计一次。同一个工程版本里重复出现不算第二次。组件版本仍各计一次。 */
  private async recountCodeUses(projectId: string) {
    const methodCounts = new Map<string, number>();
    const eventCounts = new Map<string, number>();
    const add = (bucket: Map<string, number>, ids: string[]) => {
      for (const id of ids) {
        bucket.set(id, (bucket.get(id) ?? 0) + 1);
      }
    };
    for (const version of await this.mongo.listProjectVersions(projectId)) {
      const methods = new Set<string>();
      const events = new Set<string>();
      for (const page of version.pages ?? []) {
        if (!page.currentVersionId) {
          continue;
        }
        const snapshot = await this.mongo.getPage(page.currentVersionId);
        if (!snapshot) {
          continue;
        }
        for (const id of documentMethodIds(snapshot)) {
          methods.add(id);
        }
        for (const id of documentEventIds(snapshot)) {
          events.add(id);
        }
      }
      add(methodCounts, [...methods]);
      add(eventCounts, [...events]);
    }
    const components = await this.mongo.listComponents(projectId);
    for (const component of components) {
      for (const version of await this.mongo.listComponentVersions(component._id)) {
        add(methodCounts, documentMethodIds(version));
        add(eventCounts, documentEventIds(version));
      }
    }
    const functions = await this.mongo.listFunctions(projectId);
    const events = await this.mongo.listEvents(projectId);
    const seenMethods = new Set<string>();
    const seenEvents = new Set<string>();
    for (const row of functions) {
      seenMethods.add(row.id);
      await this.mongo.setFunctionUses(projectId, row.id, methodCounts.get(row.id) ?? 0);
    }
    for (const row of events) {
      seenEvents.add(row.id);
      await this.mongo.setEventUses(projectId, row.id, eventCounts.get(row.id) ?? 0);
    }
    for (const [id, uses] of methodCounts) {
      if (!seenMethods.has(id) && uses > 0) {
        await this.mongo.setFunctionUses(projectId, id, uses);
      }
    }
  }

  private async requireComponentVersion(
    projectId: string,
    componentId: string,
    versionId: string,
  ): Promise<ComponentVersionRecord> {
    await this.requireComponent(projectId, componentId);
    const version = await this.mongo.getComponentVersion(versionId);
    if (!version || version.projectId !== projectId || version.componentId !== componentId) {
      throw new NotFoundException('Component version not found');
    }
    return version;
  }

  private async requireComponent(projectId: string, componentId: string): Promise<ComponentRecord> {
    await this.requireProject(projectId);
    const component = await this.mongo.getComponent(componentId);
    if (!component || component.projectId !== projectId) {
      throw new NotFoundException('Component not found');
    }
    return component;
  }

  private sortedPages(pages: ProjectPageRecord[]): ProjectPageRecord[] {
    return [...pages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  private versionBody(version: PageVersionRecord): Omit<PageVersionRecord, 'updatedAt'> {
    return {
      _id: version._id,
      projectId: version.projectId,
      projectKey: version.projectKey,
      pageId: version.pageId,
      pageKey: version.pageKey,
      uses: version.uses ?? 0,
      createdAt: version.createdAt,
      ...this.contentOf(version),
    };
  }

  private componentVersionBody(version: ComponentVersionRecord): Omit<ComponentVersionRecord, 'updatedAt'> {
    return {
      _id: version._id,
      projectId: version.projectId,
      projectKey: version.projectKey,
      componentId: version.componentId,
      componentKey: version.componentKey,
      versionNo: version.versionNo,
      description: version.description,
      createdAt: version.createdAt,
      ...this.contentOf(version),
    };
  }

  /**
   * 空画布，或一份和组件文档控件 id 完全相同的树，不能覆盖已经有内容的页面。
   * 组件树被原样写进页面时，id 和组件版本一致。
   */
  private async keepStoredPage(projectId: string, stored: PageWidget[], next: PageWidget[]): Promise<boolean> {
    if (stored.length > 0 && next.length === 0) {
      return true;
    }
    if (next.length === 0) {
      return false;
    }
    const incoming = widgetIdKey(next);
    const components = await this.mongo.listComponents(projectId);
    for (const component of components) {
      if (!component.currentVersionId) {
        continue;
      }
      const version = await this.mongo.getComponentVersion(component.currentVersionId);
      if (!version || version.widgets.length === 0 || widgetIdKey(version.widgets) !== incoming) {
        continue;
      }
      return widgetIdKey(stored) !== incoming;
    }
    return false;
  }

  private applyDocument(version: PageXmlDocument, next: PageXmlDocument) {
    version.widgets = next.widgets;
    if (next.style) {
      version.style = next.style;
    } else {
      delete version.style;
    }
    if (next.data && next.data.length > 0) {
      version.data = next.data;
    } else {
      delete version.data;
    }
    if (next.events) {
      version.events = next.events;
    } else {
      delete version.events;
    }
    if (next.methods && next.methods.length > 0) {
      version.methods = next.methods;
    } else {
      delete version.methods;
    }
    if (next.props && next.props.length > 0) {
      version.props = next.props;
    } else {
      delete version.props;
    }
    if (next.query && next.query.length > 0) {
      version.query = next.query;
    } else {
      delete version.query;
    }
    if (next.emits && next.emits.length > 0) {
      version.emits = next.emits;
    } else {
      delete version.emits;
    }
    if (next.testData) {
      version.testData = next.testData;
    } else {
      delete version.testData;
    }
  }

  private normalizeDocument(input: unknown): PageXmlDocument {
    try {
      return normalizePageDocument(input);
    } catch (error) {
      if (error instanceof XmlParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private contentOf(record: PageXmlDocument): PageXmlDocument {
    return {
      widgets: record.widgets,
      ...(record.style ? { style: record.style } : {}),
      ...(record.data && record.data.length > 0 ? { data: record.data } : {}),
      ...(record.events ? { events: record.events } : {}),
      ...(record.methods && record.methods.length > 0 ? { methods: record.methods } : {}),
      ...(record.props && record.props.length > 0 ? { props: record.props } : {}),
      ...(record.query && record.query.length > 0 ? { query: record.query } : {}),
      ...(record.emits && record.emits.length > 0 ? { emits: record.emits } : {}),
      ...(record.testData ? { testData: record.testData } : {}),
    };
  }

  private runtimeDocumentUrl(projectKey: string, pageKey: string): string {
    const base = this.config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/api/runtime/projects/${encodeURIComponent(projectKey)}/pages/${encodeURIComponent(pageKey)}`;
  }

  private assertEventId(eventId: string) {
    if (!isWidgetEventId(eventId)) {
      throw new BadRequestException('Invalid event id');
    }
  }

  private assertMethodId(methodId: string) {
    if (!isPageMethodId(methodId)) {
      throw new BadRequestException('Invalid method id');
    }
  }

  private assetRoot(projectKey: string) {
    return `lowcode/${projectKey}/assets/`;
  }

  private iconRoot(projectKey: string) {
    return `lowcode/${projectKey}/icons/`;
  }

  private assertIconGroupName(name: string) {
    const trimmed = safeDecode(name).trim();
    if (!trimmed || trimmed.length > 64 || trimmed === '.' || trimmed === '..' || trimmed.startsWith('.')) {
      throw new BadRequestException('invalid group name');
    }
    if (/[\\/]/.test(trimmed)) {
      throw new BadRequestException('invalid group name');
    }
    return trimmed;
  }

  private assertIconFileName(name: string) {
    const trimmed = safeDecode(name).trim().replace(/[\\/]/g, '');
    if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed === '.keep' || trimmed.length > 200) {
      throw new BadRequestException('invalid file name');
    }
    if (!/\.svg$/i.test(trimmed)) {
      throw new BadRequestException('only svg files are allowed');
    }
    return trimmed;
  }

  private assertAssetGroupName(name: string) {
    const trimmed = safeDecode(name).trim();
    if (!trimmed || trimmed.length > 64 || trimmed === '.' || trimmed === '..' || trimmed.startsWith('.')) {
      throw new BadRequestException('invalid group name');
    }
    if (/[\\/]/.test(trimmed)) {
      throw new BadRequestException('invalid group name');
    }
    return trimmed;
  }

  private assertAssetFileName(name: string) {
    const trimmed = safeDecode(name).trim().replace(/[\\/]/g, '');
    if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed === '.keep' || trimmed.length > 200) {
      throw new BadRequestException('invalid file name');
    }
    return trimmed;
  }

  private assetUploadName(originalName: string, displayName?: string) {
    const original = originalName.replace(/[\\/]/g, '').trim();
    const originalExt = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
    const raw = (displayName ?? '').trim();
    if (!raw) {
      return original;
    }
    if (raw.includes('.') || !originalExt) {
      return raw;
    }
    return `${raw}${originalExt}`;
  }

  private async deleteOssKeys(keys: string[]) {
    for (const key of keys) {
      try {
        await this.oss.deleteObject(key);
      } catch (error) {
        this.logger.warn(`Failed to delete OSS object ${key}: ${String(error)}`);
      }
    }
  }

  private rethrowUnique(error: unknown): never {
    if (isUniqueViolation(error)) {
      throw new ConflictException('key already exists');
    }
    throw error;
  }

  private toProjectDto(project: ProjectRecord): ProjectDto {
    return {
      id: project._id,
      name: project.name,
      key: project.key,
      description: project.description,
      currentVersionId: project.currentVersionId ?? null,
      createdAt: toIso(project.createdAt),
      updatedAt: toIso(project.updatedAt),
    };
  }

  private toPageDto(projectId: string, page: ProjectPageRecord): ProjectPageDto {
    return {
      id: page.id,
      projectId,
      name: page.name,
      key: page.key,
      description: page.description,
      currentVersionId: page.currentVersionId,
      createdAt: toIso(page.createdAt),
      updatedAt: toIso(page.updatedAt),
    };
  }

  private toComponentDto(component: ComponentRecord): ProjectComponentDto {
    return {
      id: component._id,
      projectId: component.projectId,
      name: component.name,
      key: component.key,
      description: component.description,
      currentVersionId: component.currentVersionId,
      createdAt: toIso(component.createdAt),
      updatedAt: toIso(component.updatedAt),
    };
  }

  private toComponentVersionDto(version: ComponentVersionRecord): ProjectPageVersionDto {
    return {
      id: version._id,
      pageId: version.componentId,
      versionNo: version.versionNo,
      description: version.description ?? '',
      document: this.contentOf(version),
      createdAt: toIso(version.createdAt ?? version.updatedAt),
      updatedAt: toIso(version.updatedAt),
      lastModified: toIso(version.updatedAt),
    };
  }

  private toProjectVersionDto(version: ProjectVersionRecord): ProjectVersionDto {
    return {
      id: version._id,
      projectId: version.projectId,
      versionNo: version.versionNo,
      description: version.description ?? '',
      createdAt: toIso(version.createdAt),
      updatedAt: toIso(version.updatedAt),
      lastModified: toIso(version.updatedAt),
    };
  }

  private toSnapshotDto(snapshot: PageVersionRecord, forked: boolean): ProjectPageSnapshotDto {
    return {
      id: snapshot._id,
      pageId: snapshot.pageId,
      forked,
      document: this.contentOf(snapshot),
      updatedAt: toIso(snapshot.updatedAt),
      lastModified: toIso(snapshot.updatedAt),
    };
  }

  private toVersionMeta(
    version: { _id: string; versionNo: number; description?: string; updatedAt: Date; pageId?: string; componentId?: string },
    pageId = version.pageId ?? version.componentId ?? '',
  ): ProjectPageVersionMetaDto {
    return {
      id: version._id,
      pageId,
      versionNo: version.versionNo,
      description: version.description ?? '',
      lastModified: toIso(version.updatedAt),
    };
  }
}

function widgetIdKey(widgets: readonly PageWidget[]): string {
  const ids: string[] = [];
  const walk = (list: readonly PageWidget[]) => {
    for (const widget of list) {
      ids.push(widget.id);
      if ('children' in widget && Array.isArray(widget.children)) {
        walk(widget.children);
      }
    }
  };
  walk(widgets);
  return ids.join('\n');
}
