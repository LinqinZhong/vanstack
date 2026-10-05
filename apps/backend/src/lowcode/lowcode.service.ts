import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
  MethodCodeDto,
  ProjectPageVersionDto,
  ProjectPageVersionMetaDto,
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
  type PageXmlDocument,
} from '@vanstack/xml';
import { OssService } from '../oss/oss.service';
import {
  LowcodeMongo,
  type ComponentRecord,
  type ComponentVersionRecord,
  type PageVersionRecord,
  type LangRecord,
  type ProjectLangValueRecord,
  type ProjectPageRecord,
  type ProjectRecord,
} from './lowcode-mongo';

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
export class LowcodeService {
  private readonly logger = new Logger(LowcodeService.name);

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
    if (!project) {
      throw new NotFoundException();
    }
    const pages = this.sortedPages(project);
    const langRows = [...((await this.mongo.getLang(project._id))?.langs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const versions = await this.mongo.listProjectVersions(project._id);
    const versionById = new Map(versions.map((version) => [version._id, version]));
    const runtimePages = [];
    for (const page of pages) {
      if (!page.currentVersionId || !versionById.has(page.currentVersionId)) {
        continue;
      }
      const version = versionById.get(page.currentVersionId);
      const langs: RuntimeLangDto[] = version
        ? langRows.map((lang) => ({
            key: lang.key,
            name: lang.name,
            dir: lang.dir === 'rtl' ? 'rtl' : 'ltr',
            jsonUrl: this.oss.getPublicUrl(
              this.langObjectKey(project.key, page.key, version.versionNo, lang.key),
            ),
          }))
        : [];
      runtimePages.push({
        name: page.name,
        key: page.key,
        documentUrl: this.runtimeDocumentUrl(project.key, page.key),
        langs,
      });
    }
    return {
      name: project.name,
      key: project.key,
      pages: runtimePages,
    };
  }

  async getRuntimePage(projectKey: string, pageKey: string): Promise<PageXmlDocument> {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(projectKey) || !/^[a-z][a-z0-9-]{0,63}$/.test(pageKey)) {
      throw new NotFoundException();
    }
    const project = await this.mongo.getProjectByKey(projectKey);
    if (!project) {
      throw new NotFoundException();
    }
    const page = project.pages.find((item) => item.key === pageKey);
    if (!page?.currentVersionId) {
      throw new NotFoundException();
    }
    const version = await this.mongo.getPage(page.currentVersionId);
    if (!version || version.pageId !== page.id) {
      throw new NotFoundException();
    }
    return this.contentOf(version);
  }

  async createProject(input: { name: string; key: string; description?: string }): Promise<ProjectDto> {
    const now = new Date();
    const project: ProjectRecord = {
      _id: randomUUID(),
      name: input.name.trim(),
      key: input.key,
      description: input.description?.trim() ?? '',
      createdAt: now,
      updatedAt: now,
      pages: [],
    };
    try {
      await this.mongo.insertProject(project);
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
      await this.mongo.renameLangProject(project._id, project.key);
      const versions = await this.mongo.listProjectVersions(project._id);
      for (const version of versions) {
        await this.mongo.putPage({ ...this.versionBody(version), projectKey: project.key });
      }
    }
    return this.toProjectDto(project);
  }

  async deleteProject(id: string): Promise<void> {
    const project = await this.requireProject(id);
    const versions = await this.mongo.listProjectVersions(project._id);
    const langKeys = ((await this.mongo.getLang(project._id))?.langs ?? []).map((row) => row.key);
    const pageById = new Map(project.pages.map((page) => [page.id, page]));
    const keys = versions.flatMap((version) => {
      const page = pageById.get(version.pageId);
      if (!page) {
        return [];
      }
      return langKeys.map((langKey) => this.langObjectKey(project.key, page.key, version.versionNo, langKey));
    });
    await this.mongo.deleteByProject(project._id);
    const assetKeys = (await this.oss.listObjects(this.assetRoot(project.key))).map((item) => item.key);
    await this.deleteOssKeys([...new Set([...keys, ...assetKeys])]);
  }

  async getLangs(projectId: string): Promise<ProjectLangCatalogDto> {
    await this.requireProject(projectId);
    return this.catalogOf(await this.mongo.getLang(projectId));
  }

  async putLangs(projectId: string, input: { langs: unknown[]; groups: unknown[] }): Promise<ProjectLangCatalogDto> {
    const project = await this.requireProject(projectId);
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
    const record: LangRecord = {
      _id: project._id,
      projectKey: project.key,
      langs,
      langValues: valueRows,
      updatedAt: new Date(),
    };
    await this.mongo.saveLang(record);
    await this.syncCurrentLangSnapshots(project);
    return this.catalogOf(record);
  }

  async listPages(projectId: string): Promise<ProjectPageDto[]> {
    const project = await this.requireProject(projectId);
    return this.sortedPages(project).map((row) => this.toPageDto(project._id, row));
  }

  async getPage(projectId: string, pageId: string): Promise<ProjectPageDto> {
    const { project, page } = await this.requirePage(projectId, pageId);
    return this.toPageDto(project._id, page);
  }

  async createPage(
    projectId: string,
    input: { name: string; key: string; description?: string },
  ): Promise<ProjectPageDto> {
    const project = await this.requireProject(projectId);
    if (project.pages.some((page) => page.key === input.key)) {
      throw new ConflictException('key already exists');
    }
    const document = this.normalizeDocument(EMPTY_PAGE_DOCUMENT);
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
    const version: PageVersionRecord = {
      _id: randomUUID(),
      projectId: project._id,
      projectKey: project.key,
      pageId: page.id,
      pageKey: page.key,
      versionNo: 1,
      description: '',
      createdAt: now,
      updatedAt: now,
      ...this.contentOf(document),
    };
    project.pages.push(page);
    project.updatedAt = now;
    try {
      await this.mongo.saveProject(project);
      page.currentVersionId = version._id;
      await this.mongo.putPage(this.versionBody(version));
      await this.mongo.saveProject(project);
      await this.writeLangSnapshots(project, page, version);
      return this.toPageDto(project._id, page);
    } catch (error) {
      project.pages = project.pages.filter((item) => item.id !== page.id);
      await this.mongo.saveProject(project).catch(() => undefined);
      await this.mongo.deletePage(version._id).catch(() => undefined);
      this.rethrowUnique(error);
    }
  }

  async updatePage(
    projectId: string,
    pageId: string,
    input: { name?: string; key?: string; description?: string },
  ): Promise<ProjectPageDto> {
    const { project, page } = await this.requirePage(projectId, pageId);
    const previousKey = page.key;
    if (input.name != null) {
      page.name = input.name.trim();
    }
    if (input.key != null) {
      if (project.pages.some((item) => item.id !== page.id && item.key === input.key)) {
        throw new ConflictException('key already exists');
      }
      page.key = input.key;
    }
    if (input.description != null) {
      page.description = input.description.trim();
    }
    const now = new Date();
    page.updatedAt = now;
    project.updatedAt = now;
    await this.mongo.saveProject(project);
    if (page.key !== previousKey) {
      const versions = await this.mongo.listPageVersions(page.id);
      for (const version of versions) {
        await this.mongo.putPage({ ...this.versionBody(version), pageKey: page.key });
      }
    }
    return this.toPageDto(project._id, page);
  }

  async deletePage(projectId: string, pageId: string): Promise<void> {
    const { project, page } = await this.requirePage(projectId, pageId);
    const versions = await this.mongo.listPageVersions(page.id);
    for (const version of versions) {
      await this.syncMethodUses(projectId, this.contentOf(version), EMPTY_PAGE_DOCUMENT);
    }
    await this.mongo.deletePagesByPage(page.id);
    const langKeys = ((await this.mongo.getLang(project._id))?.langs ?? []).map((lang) => lang.key);
    const keys = versions.flatMap((version) =>
      langKeys.map((langKey) => this.langObjectKey(project.key, page.key, version.versionNo, langKey)),
    );
    project.pages = project.pages.filter((item) => item.id !== page.id);
    project.updatedAt = new Date();
    await this.mongo.saveProject(project);
    await this.deleteOssKeys([...new Set(keys)]);
  }

  async listVersions(projectId: string, pageId: string): Promise<ProjectPageVersionDto[]> {
    await this.requirePage(projectId, pageId);
    const rows = await this.mongo.listPageVersions(pageId);
    return rows.map((row) => this.toVersionDto(row));
  }

  async listVersionMeta(projectId: string, pageId: string): Promise<ProjectPageVersionMetaDto[]> {
    await this.requirePage(projectId, pageId);
    const rows = await this.mongo.listPageVersionStamps(pageId);
    return rows.map((row) => this.toVersionMeta(row));
  }

  async getVersion(projectId: string, pageId: string, versionId: string): Promise<ProjectPageVersionDto> {
    const version = await this.requireVersion(projectId, pageId, versionId);
    return this.toVersionDto(version);
  }

  async createVersion(
    projectId: string,
    pageId: string,
    input: { document: object; description?: string },
  ): Promise<ProjectPageVersionDto> {
    const { project, page } = await this.requirePage(projectId, pageId);
    const document = this.normalizeDocument(input.document);
    const existing = await this.mongo.listPageVersions(page.id);
    const versionNo = existing.reduce((max, version) => Math.max(max, version.versionNo), 0) + 1;
    const now = new Date();
    let saved: PageVersionRecord | undefined;
    try {
      saved = await this.mongo.putPage({
        _id: randomUUID(),
        projectId: project._id,
        projectKey: project.key,
        pageId: page.id,
        pageKey: page.key,
        versionNo,
        description: input.description?.trim() ?? '',
        createdAt: now,
        ...this.contentOf(document),
      });
    } catch (error) {
      if (saved) {
        await this.mongo.deletePage(saved._id).catch(() => undefined);
      }
      this.rethrowUnique(error);
    }
    await this.syncMethodUses(projectId, EMPTY_PAGE_DOCUMENT, document);
    if (!page.currentVersionId) {
      page.currentVersionId = saved._id;
      page.updatedAt = now;
      project.updatedAt = now;
      await this.mongo.saveProject(project);
      await this.writeLangSnapshots(project, page, saved);
    }
    return this.toVersionDto(saved);
  }

  async updateVersion(
    projectId: string,
    pageId: string,
    versionId: string,
    input: { document?: object; description?: string },
  ): Promise<ProjectPageVersionDto> {
    const { project, page } = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    if (input.description != null) {
      version.description = input.description.trim();
    }
    if (input.document != null) {
      const next = this.normalizeDocument(input.document);
      const previous = this.contentOf(version);
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
      if (next.emits && next.emits.length > 0) {
        version.emits = next.emits;
      } else {
        delete version.emits;
      }
      await this.syncMethodUses(projectId, previous, next);
    }
    const saved = await this.mongo.putPage(this.versionBody(version));
    if (!page.currentVersionId || page.currentVersionId === version._id) {
      page.currentVersionId = version._id;
      const now = new Date();
      page.updatedAt = now;
      project.updatedAt = now;
      await this.mongo.saveProject(project);
      await this.writeLangSnapshots(project, page, saved);
    }
    return this.toVersionDto(saved);
  }

  async deleteVersion(projectId: string, pageId: string, versionId: string): Promise<void> {
    const { project, page } = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    const wasCurrent = page.currentVersionId === version._id;
    const langObjects = ((await this.mongo.getLang(project._id))?.langs ?? []).map((lang) =>
      this.langObjectKey(project.key, page.key, version.versionNo, lang.key),
    );
    await this.mongo.deletePage(versionId);
    if (wasCurrent) {
      const rest = (await this.mongo.listPageVersions(page.id)).sort((a, b) => b.versionNo - a.versionNo);
      page.currentVersionId = rest[0]?._id ?? null;
      page.updatedAt = new Date();
      project.updatedAt = new Date();
      await this.mongo.saveProject(project);
    }
    await this.syncMethodUses(projectId, this.contentOf(version), EMPTY_PAGE_DOCUMENT);
    await this.deleteOssKeys(langObjects);
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
    for (const version of versions) {
      await this.syncMethodUses(projectId, this.contentOf(version), EMPTY_PAGE_DOCUMENT);
    }
    await this.mongo.deleteComponentVersions(component._id);
    await this.mongo.deleteComponent(component._id);
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
    await this.syncMethodUses(projectId, EMPTY_PAGE_DOCUMENT, document);
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
      const previous = this.contentOf(version);
      this.applyDocument(version, next);
      await this.syncMethodUses(projectId, previous, next);
    }
    const saved = await this.mongo.putComponentVersion(this.componentVersionBody(version));
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
    await this.syncMethodUses(projectId, this.contentOf(version), EMPTY_PAGE_DOCUMENT);
  }

  async listAssetGroups(projectId: string): Promise<ProjectAssetGroupDto[]> {
    const project = await this.requireProject(projectId);
    const prefix = this.assetRoot(project.key);
    const names = new Set<string>();
    for (const item of await this.oss.listObjects(prefix)) {
      const rest = item.key.slice(prefix.length);
      const group = rest.split('/')[0];
      if (group) {
        names.add(group);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ name }));
  }

  async createAssetGroup(projectId: string, name: string): Promise<ProjectAssetGroupDto> {
    const project = await this.requireProject(projectId);
    const group = this.assertAssetGroupName(name);
    const existing = await this.listAssetGroups(projectId);
    if (existing.some((item) => item.name === group)) {
      throw new ConflictException('group already exists');
    }
    await this.oss.putObject(this.assetKeepKey(project.key, group), Buffer.alloc(0), 'application/octet-stream');
    return { name: group };
  }

  async renameAssetGroup(projectId: string, fromName: string, toName: string): Promise<ProjectAssetGroupDto> {
    const project = await this.requireProject(projectId);
    const from = this.assertAssetGroupName(fromName);
    const to = this.assertAssetGroupName(toName);
    if (from === to) {
      return { name: to };
    }
    const groups = await this.listAssetGroups(projectId);
    if (!groups.some((item) => item.name === from)) {
      throw new NotFoundException();
    }
    if (groups.some((item) => item.name === to)) {
      throw new ConflictException('group already exists');
    }
    const fromPrefix = this.assetGroupPrefix(project.key, from);
    const objects = await this.oss.listObjects(fromPrefix);
    for (const item of objects) {
      const nextKey = this.assetGroupPrefix(project.key, to) + item.key.slice(fromPrefix.length);
      await this.oss.copyObject(item.key, nextKey);
    }
    await this.deleteOssKeys(objects.map((item) => item.key));
    return { name: to };
  }

  async deleteAssetGroup(projectId: string, name: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const group = this.assertAssetGroupName(name);
    const objects = await this.oss.listObjects(this.assetGroupPrefix(project.key, group));
    await this.deleteOssKeys(objects.map((item) => item.key));
  }

  async listAssetFiles(projectId: string, name: string): Promise<ProjectAssetFileDto[]> {
    const project = await this.requireProject(projectId);
    const group = this.assertAssetGroupName(name);
    const prefix = this.assetGroupPrefix(project.key, group);
    return (await this.oss.listObjects(prefix))
      .filter((item) => {
        const fileName = item.key.slice(prefix.length);
        return fileName && !fileName.includes('/') && fileName !== '.keep';
      })
      .map((item) => ({
        name: item.key.slice(prefix.length),
        key: item.key,
        url: this.oss.getPublicUrl(item.key),
        size: item.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async uploadAssetFile(
    projectId: string,
    name: string,
    file: Express.Multer.File,
    displayName?: string,
  ): Promise<ProjectAssetFileDto> {
    const project = await this.requireProject(projectId);
    const group = this.assertAssetGroupName(name);
    const fileName = this.assertAssetFileName(this.assetUploadName(file.originalname, displayName));
    const key = this.assetGroupPrefix(project.key, group) + fileName;
    const existing = await this.oss.getObject(key);
    if (existing) {
      throw new ConflictException('file already exists');
    }
    const stored = await this.oss.putObject(key, file.buffer, file.mimetype || 'application/octet-stream');
    return {
      name: fileName,
      key: stored.key,
      url: stored.url,
      size: file.size,
    };
  }

  async deleteAssetFile(projectId: string, groupName: string, fileName: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const group = this.assertAssetGroupName(groupName);
    const name = this.assertAssetFileName(fileName);
    await this.oss.deleteObject(this.assetGroupPrefix(project.key, group) + name);
  }

  async listIconGroups(projectId: string): Promise<ProjectIconGroupDto[]> {
    const project = await this.requireProject(projectId);
    const prefix = this.iconRoot(project.key);
    const names = new Set<string>();
    for (const item of await this.oss.listObjects(prefix)) {
      const rest = item.key.slice(prefix.length);
      const group = rest.split('/')[0];
      if (group) {
        names.add(group);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ name }));
  }

  async createIconGroup(projectId: string, name: string): Promise<ProjectIconGroupDto> {
    const project = await this.requireProject(projectId);
    const group = this.assertIconGroupName(name);
    const existing = await this.listIconGroups(projectId);
    if (existing.some((item) => item.name === group)) {
      throw new ConflictException('group already exists');
    }
    await this.oss.putObject(this.iconKeepKey(project.key, group), Buffer.alloc(0), 'application/octet-stream');
    return { name: group };
  }

  async renameIconGroup(projectId: string, fromName: string, toName: string): Promise<ProjectIconGroupDto> {
    const project = await this.requireProject(projectId);
    const from = this.assertIconGroupName(fromName);
    const to = this.assertIconGroupName(toName);
    if (from === to) {
      return { name: to };
    }
    const groups = await this.listIconGroups(projectId);
    if (!groups.some((item) => item.name === from)) {
      throw new NotFoundException();
    }
    if (groups.some((item) => item.name === to)) {
      throw new ConflictException('group already exists');
    }
    const fromPrefix = this.iconGroupPrefix(project.key, from);
    const objects = await this.oss.listObjects(fromPrefix);
    for (const item of objects) {
      const nextKey = this.iconGroupPrefix(project.key, to) + item.key.slice(fromPrefix.length);
      await this.oss.copyObject(item.key, nextKey);
    }
    await this.deleteOssKeys(objects.map((item) => item.key));
    return { name: to };
  }

  async deleteIconGroup(projectId: string, name: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const group = this.assertIconGroupName(name);
    const objects = await this.oss.listObjects(this.iconGroupPrefix(project.key, group));
    await this.deleteOssKeys(objects.map((item) => item.key));
  }

  async listIconFiles(projectId: string, name: string): Promise<ProjectIconFileDto[]> {
    const project = await this.requireProject(projectId);
    const group = this.assertIconGroupName(name);
    const prefix = this.iconGroupPrefix(project.key, group);
    return (await this.oss.listObjects(prefix))
      .filter((item) => {
        const fileName = item.key.slice(prefix.length);
        return fileName && !fileName.includes('/') && fileName !== '.keep';
      })
      .map((item) => ({
        name: item.key.slice(prefix.length),
        key: item.key,
        url: this.oss.getPublicUrl(item.key),
        size: item.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async uploadIconFile(
    projectId: string,
    name: string,
    file: Express.Multer.File,
    displayName?: string,
  ): Promise<ProjectIconFileDto> {
    const project = await this.requireProject(projectId);
    const group = this.assertIconGroupName(name);
    if (!/\.svg$/i.test(file.originalname)) {
      throw new BadRequestException('only svg files are allowed');
    }
    const fileName = this.assertIconFileName(this.assetUploadName(file.originalname, displayName));
    const key = this.iconGroupPrefix(project.key, group) + fileName;
    const existing = await this.oss.getObject(key);
    if (existing) {
      throw new ConflictException('file already exists');
    }
    const stored = await this.oss.putObject(key, file.buffer, file.mimetype || 'image/svg+xml');
    return {
      name: fileName,
      key: stored.key,
      url: stored.url,
      size: file.size,
    };
  }

  async deleteIconFile(projectId: string, groupName: string, fileName: string): Promise<void> {
    const project = await this.requireProject(projectId);
    const group = this.assertIconGroupName(groupName);
    const name = this.assertIconFileName(fileName);
    await this.oss.deleteObject(this.iconGroupPrefix(project.key, group) + name);
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

  private catalogOf(record: LangRecord | null): ProjectLangCatalogDto {
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

  private async syncCurrentLangSnapshots(project: ProjectRecord) {
    for (const page of project.pages) {
      if (!page.currentVersionId) {
        continue;
      }
      const version = await this.mongo.getPage(page.currentVersionId);
      if (version && version.pageId === page.id) {
        await this.writeLangSnapshots(project, page, version);
      }
    }
  }

  private async writeLangSnapshots(project: ProjectRecord, page: ProjectPageRecord, version: PageVersionRecord) {
    const catalog = this.catalogOf(await this.mongo.getLang(project._id));
    if (catalog.langs.length === 0) {
      return;
    }
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

  private langObjectKey(projectKey: string, pageKey: string, versionNo: number, langKey: string) {
    return `lowcode/${projectKey}/lang/${pageKey}-v${versionNo}-${langKey}.json`;
  }

  private async requireProject(id: string): Promise<ProjectRecord> {
    const project = await this.mongo.getProject(id);
    if (!project) {
      throw new NotFoundException();
    }
    project.pages ??= [];
    return project;
  }

  private async requirePage(
    projectId: string,
    pageId: string,
  ): Promise<{ project: ProjectRecord; page: ProjectPageRecord }> {
    const project = await this.requireProject(projectId);
    const page = project.pages.find((item) => item.id === pageId);
    if (!page) {
      throw new NotFoundException();
    }
    return { project, page };
  }

  private async requireComponent(projectId: string, componentId: string): Promise<ComponentRecord> {
    await this.requireProject(projectId);
    const component = await this.mongo.getComponent(componentId);
    if (!component || component.projectId !== projectId) {
      throw new NotFoundException('Component not found');
    }
    return component;
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

  private async requireVersion(projectId: string, pageId: string, versionId: string): Promise<PageVersionRecord> {
    await this.requirePage(projectId, pageId);
    const version = await this.mongo.getPage(versionId);
    if (!version || version.pageId !== pageId || version.projectId !== projectId) {
      throw new NotFoundException();
    }
    return version;
  }

  private sortedPages(project: ProjectRecord): ProjectPageRecord[] {
    return [...project.pages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  private versionBody(version: PageVersionRecord): Omit<PageVersionRecord, 'updatedAt'> {
    return {
      _id: version._id,
      projectId: version.projectId,
      projectKey: version.projectKey,
      pageId: version.pageId,
      pageKey: version.pageKey,
      versionNo: version.versionNo,
      description: version.description,
      createdAt: version.createdAt,
      widgets: version.widgets,
      ...(version.style ? { style: version.style } : {}),
      ...(version.data && version.data.length > 0 ? { data: version.data } : {}),
      ...(version.events ? { events: version.events } : {}),
      ...(version.methods && version.methods.length > 0 ? { methods: version.methods } : {}),
      ...(version.props && version.props.length > 0 ? { props: version.props } : {}),
      ...(version.emits && version.emits.length > 0 ? { emits: version.emits } : {}),
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
    if (next.emits && next.emits.length > 0) {
      version.emits = next.emits;
    } else {
      delete version.emits;
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
      ...(record.emits && record.emits.length > 0 ? { emits: record.emits } : {}),
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

  /** 页面版本文档里方法、事件 id 的增减，就是这个版本对共享代码的引用增减。 */
  private async syncMethodUses(projectId: string, previousPage: PageXmlDocument, nextPage: PageXmlDocument) {
    await this.syncUses(documentMethodIds(previousPage), documentMethodIds(nextPage), (id, delta) =>
      this.mongo.addFunctionUses(projectId, id, delta),
    );
    await this.syncUses(documentEventIds(previousPage), documentEventIds(nextPage), (id, delta) =>
      this.mongo.addEventUses(projectId, id, delta),
    );
  }

  private async syncUses(
    previousIds: string[],
    nextIds: string[],
    apply: (id: string, delta: number) => Promise<number>,
  ) {
    const previous = new Set(previousIds);
    const next = new Set(nextIds);
    for (const id of previous) {
      if (!next.has(id)) {
        await apply(id, -1);
      }
    }
    for (const id of next) {
      if (!previous.has(id)) {
        await apply(id, 1);
      }
    }
  }

  private assetRoot(projectKey: string) {
    return `lowcode/${projectKey}/assets/`;
  }

  private assetGroupPrefix(projectKey: string, group: string) {
    return `${this.assetRoot(projectKey)}${group}/`;
  }

  private assetKeepKey(projectKey: string, group: string) {
    return `${this.assetGroupPrefix(projectKey, group)}.keep`;
  }

  private iconRoot(projectKey: string) {
    return `lowcode/${projectKey}/icons/`;
  }

  private iconGroupPrefix(projectKey: string, group: string) {
    return `${this.iconRoot(projectKey)}${group}/`;
  }

  private iconKeepKey(projectKey: string, group: string) {
    return `${this.iconGroupPrefix(projectKey, group)}.keep`;
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

  private toVersionDto(version: PageVersionRecord): ProjectPageVersionDto {
    return {
      id: version._id,
      pageId: version.pageId,
      versionNo: version.versionNo,
      description: version.description ?? '',
      document: this.contentOf(version),
      createdAt: toIso(version.createdAt ?? version.updatedAt),
      updatedAt: toIso(version.updatedAt),
      lastModified: toIso(version.updatedAt),
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
