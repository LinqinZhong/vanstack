import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ProjectAssetFileDto,
  ProjectAssetGroupDto,
  ProjectDto,
  ProjectLangCatalogDto,
  ProjectLangDto,
  ProjectLangEntryDto,
  ProjectLangGroupDto,
  ProjectPageDto,
  ProjectPageVersionDto,
  RuntimeLangDto,
  RuntimeProjectDto,
} from '@vanstack/shared';
import { EMPTY_PAGE_XML, isI18nKey, parsePageXml, XmlParseError } from '@vanstack/xml';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { OssService } from '../oss/oss.service';
import { ProjectLangValue } from './entities/project-lang-value.entity';
import { ProjectLang } from './entities/project-lang.entity';
import { ProjectPageVersion } from './entities/project-page-version.entity';
import { ProjectPage } from './entities/project-page.entity';
import { Project } from './entities/project.entity';

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const code = (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
  return code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT' || code === '23505';
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
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectPage) private readonly pages: Repository<ProjectPage>,
    @InjectRepository(ProjectPageVersion) private readonly versions: Repository<ProjectPageVersion>,
    @InjectRepository(ProjectLang) private readonly langs: Repository<ProjectLang>,
    @InjectRepository(ProjectLangValue) private readonly langValues: Repository<ProjectLangValue>,
    private readonly dataSource: DataSource,
    private readonly oss: OssService,
  ) {}

  async listProjects(): Promise<ProjectDto[]> {
    const rows = await this.projects.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => this.toProjectDto(row));
  }

  async getProject(id: string): Promise<ProjectDto> {
    return this.toProjectDto(await this.requireProject(id));
  }

  async getRuntimeProject(projectKey: string): Promise<RuntimeProjectDto> {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(projectKey)) {
      throw new NotFoundException();
    }
    const project = await this.projects.findOne({ where: { key: projectKey } });
    if (!project) {
      throw new NotFoundException();
    }
    const pages = await this.pages.find({
      where: { projectId: project.id },
      order: { createdAt: 'ASC' },
    });
    const langRows = await this.langs.find({
      where: { projectId: project.id },
      order: { sortOrder: 'ASC' },
    });
    const currentIds = pages
      .map((page) => page.currentVersionId)
      .filter((id): id is string => Boolean(id));
    const currentVersions =
      currentIds.length > 0 ? await this.versions.find({ where: { id: In(currentIds) } }) : [];
    const versionById = new Map(currentVersions.map((version) => [version.id, version]));
    const runtimePages = [];
    for (const page of pages) {
      if (!page.currentVersionId || !page.xmlKey) {
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
        xmlUrl: this.oss.getPublicUrl(page.xmlKey),
        langs,
      });
    }
    return {
      name: project.name,
      key: project.key,
      pages: runtimePages,
    };
  }

  async createProject(input: { name: string; key: string; description?: string }): Promise<ProjectDto> {
    const project = this.projects.create({
      name: input.name.trim(),
      key: input.key,
      description: input.description?.trim() ?? '',
    });
    try {
      return this.toProjectDto(await this.projects.save(project));
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async updateProject(
    id: string,
    input: { name?: string; key?: string; description?: string },
  ): Promise<ProjectDto> {
    const project = await this.requireProject(id);
    if (input.name != null) {
      project.name = input.name.trim();
    }
    if (input.key != null) {
      project.key = input.key;
    }
    if (input.description != null) {
      project.description = input.description.trim();
    }
    try {
      return this.toProjectDto(await this.projects.save(project));
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async deleteProject(id: string): Promise<void> {
    const project = await this.projects.findOne({
      where: { id },
      relations: { pages: { versions: true } },
    });
    if (!project) {
      throw new NotFoundException();
    }
    const langKeys = (await this.langs.find({ where: { projectId: project.id } })).map((row) => row.key);
    const keys = (project.pages ?? []).flatMap((page) => [
      page.xmlKey,
      ...(page.versions ?? []).flatMap((version) => [
        version.xmlKey,
        ...langKeys.map((langKey) => this.langObjectKey(project.key, page.key, version.versionNo, langKey)),
      ]),
    ]).filter(Boolean);
    await this.projects.remove(project);
    const assetKeys = (await this.oss.listObjects(this.assetRoot(project.key))).map((item) => item.key);
    await this.deleteOssKeys([...new Set([...keys, ...assetKeys])]);
  }

  async getLangs(projectId: string): Promise<ProjectLangCatalogDto> {
    await this.requireProject(projectId);
    return this.readLangCatalog(projectId);
  }

  async putLangs(projectId: string, input: { langs: unknown[]; groups: unknown[] }): Promise<ProjectLangCatalogDto> {
    await this.requireProject(projectId);
    const catalog = this.parseLangCatalog(input);
    const langRows = catalog.langs.map((lang, index) =>
      this.langs.create({
        projectId,
        key: lang.key,
        name: lang.name,
        dir: lang.dir,
        sortOrder: index,
      }),
    );
    const valueRows: ProjectLangValue[] = [];
    for (const [groupIndex, group] of catalog.groups.entries()) {
      const filled = group.entries.flatMap((entry, entryIndex) => {
        const cells = Object.entries(entry.values)
          .filter(([, text]) => text)
          .map(([langKey, value]) =>
            this.langValues.create({
              projectId,
              groupKey: group.key,
              entryKey: entry.key,
              langKey,
              value,
              sortOrder: groupIndex * 10000 + entryIndex,
            }),
          );
        return cells;
      });
      if (filled.length > 0) {
        valueRows.push(...filled);
        continue;
      }
      if (catalog.langs.length === 0) {
        continue;
      }
      const entryKey = group.entries[0]?.key ?? nextPlaceholderEntryKey([]);
      valueRows.push(
        this.langValues.create({
          projectId,
          groupKey: group.key,
          entryKey,
          langKey: catalog.langs[0].key,
          value: '',
          sortOrder: groupIndex * 10000,
        }),
      );
    }
    await this.dataSource.transaction(async (em) => {
      await em.delete(ProjectLangValue, { projectId });
      await em.delete(ProjectLang, { projectId });
      if (langRows.length > 0) {
        await em.save(ProjectLang, langRows);
      }
      if (valueRows.length > 0) {
        await em.save(ProjectLangValue, valueRows);
      }
    });
    return this.readLangCatalog(projectId);
  }

  async listPages(projectId: string): Promise<ProjectPageDto[]> {
    await this.requireProject(projectId);
    const rows = await this.pages.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toPageDto(row));
  }

  async getPage(projectId: string, pageId: string): Promise<ProjectPageDto> {
    const page = await this.requirePage(projectId, pageId);
    const xml = page.xmlKey ? await this.readXml(page.xmlKey) : EMPTY_PAGE_XML;
    return this.toPageDto(page, xml);
  }

  async createPage(
    projectId: string,
    input: { name: string; key: string; description?: string },
  ): Promise<ProjectPageDto> {
    const project = await this.requireProject(projectId);
    const xml = EMPTY_PAGE_XML;
    this.assertPageXml(xml);
    const xmlKey = this.xmlObjectKey(project.key, input.key, 1);
    const stored = await this.oss.putObject(xmlKey, Buffer.from(xml, 'utf8'), 'application/xml');

    try {
      const page = await this.pages.save(
        this.pages.create({
          projectId: project.id,
          name: input.name.trim(),
          key: input.key,
          description: input.description?.trim() ?? '',
          currentVersionId: null,
          xmlKey: '',
          xmlUrl: '',
        }),
      );
      await this.versions.save(
        this.versions.create({
          pageId: page.id,
          versionNo: 1,
          status: 'draft',
          description: '',
          xmlKey: stored.key,
          xmlUrl: stored.url,
        }),
      );
      return this.toPageDto(page);
    } catch (error) {
      await this.oss.deleteObject(stored.key).catch(() => undefined);
      this.rethrowUnique(error);
    }
  }

  async updatePage(
    projectId: string,
    pageId: string,
    input: { name?: string; key?: string; description?: string },
  ): Promise<ProjectPageDto> {
    const page = await this.requirePage(projectId, pageId);
    if (input.name != null) {
      page.name = input.name.trim();
    }
    if (input.key != null) {
      page.key = input.key;
    }
    if (input.description != null) {
      page.description = input.description.trim();
    }
    try {
      return this.toPageDto(await this.pages.save(page));
    } catch (error) {
      this.rethrowUnique(error);
    }
  }

  async deletePage(projectId: string, pageId: string): Promise<void> {
    const page = await this.pages.findOne({
      where: { id: pageId, projectId },
      relations: { versions: true },
    });
    if (!page) {
      throw new NotFoundException();
    }
    const project = await this.requireProject(projectId);
    const langKeys = (await this.langs.find({ where: { projectId } })).map((row) => row.key);
    const keys = [
      page.xmlKey,
      ...(page.versions ?? []).flatMap((version) => [
        version.xmlKey,
        ...langKeys.map((langKey) => this.langObjectKey(project.key, page.key, version.versionNo, langKey)),
      ]),
    ].filter(Boolean);
    await this.pages.remove(page);
    await this.deleteOssKeys([...new Set(keys)]);
  }

  async listVersions(projectId: string, pageId: string): Promise<ProjectPageVersionDto[]> {
    const page = await this.requirePage(projectId, pageId);
    const rows = await this.versions.find({
      where: { pageId },
      order: { versionNo: 'ASC' },
    });
    const result: ProjectPageVersionDto[] = [];
    for (const row of rows) {
      result.push(this.toVersionDto(row, page.currentVersionId, await this.readXml(row.xmlKey)));
    }
    return result;
  }

  async getVersion(projectId: string, pageId: string, versionId: string): Promise<ProjectPageVersionDto> {
    const page = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    return this.toVersionDto(version, page.currentVersionId, await this.readXml(version.xmlKey));
  }

  async createVersion(
    projectId: string,
    pageId: string,
    input: { xml: string; description?: string },
  ): Promise<ProjectPageVersionDto> {
    const page = await this.requirePage(projectId, pageId);
    const project = await this.requireProject(projectId);
    this.assertPageXml(input.xml);
    const max = await this.versions
      .createQueryBuilder('version')
      .select('MAX(version.versionNo)', 'max')
      .where('version.pageId = :pageId', { pageId: page.id })
      .getRawOne<{ max: number | string | null }>();
    const versionNo = Number(max?.max ?? 0) + 1;
    const xmlKey = this.xmlObjectKey(project.key, page.key, versionNo);
    const stored = await this.oss.putObject(xmlKey, Buffer.from(input.xml, 'utf8'), 'application/xml');
    try {
      const version = await this.versions.save(
        this.versions.create({
          pageId: page.id,
          versionNo,
          status: 'draft',
          description: input.description?.trim() ?? '',
          xmlKey: stored.key,
          xmlUrl: stored.url,
        }),
      );
      return this.toVersionDto(version, page.currentVersionId, input.xml);
    } catch (error) {
      await this.oss.deleteObject(stored.key).catch(() => undefined);
      this.rethrowUnique(error);
    }
  }

  async updateVersion(
    projectId: string,
    pageId: string,
    versionId: string,
    input: { xml?: string; description?: string },
  ): Promise<ProjectPageVersionDto> {
    const page = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    if (version.status !== 'draft') {
      throw new ConflictException('Published versions cannot be edited');
    }
    if (input.description != null) {
      version.description = input.description.trim();
    }
    let xml = await this.readXml(version.xmlKey);
    if (input.xml != null) {
      this.assertPageXml(input.xml);
      const stored = await this.oss.putObject(
        version.xmlKey,
        Buffer.from(input.xml, 'utf8'),
        'application/xml',
      );
      version.xmlKey = stored.key;
      version.xmlUrl = stored.url;
      xml = input.xml;
    }
    await this.versions.save(version);
    return this.toVersionDto(version, page.currentVersionId, xml);
  }

  async publishVersion(projectId: string, pageId: string, versionId: string): Promise<ProjectPageVersionDto> {
    const project = await this.requireProject(projectId);
    const page = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    if (version.status === 'draft') {
      version.status = 'published';
      await this.versions.save(version);
    }
    await this.writeLangSnapshots(project, page, version);
    return this.toVersionDto(version, page.currentVersionId, await this.readXml(version.xmlKey));
  }

  async deleteVersion(projectId: string, pageId: string, versionId: string): Promise<void> {
    const page = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    if (page.currentVersionId === version.id) {
      throw new ConflictException('Cannot delete the version in use');
    }
    const project = await this.requireProject(projectId);
    const xmlKey = version.xmlKey;
    const langKeys = (await this.langs.find({ where: { projectId } })).map((row) => row.key);
    const langObjects = langKeys.map((langKey) =>
      this.langObjectKey(project.key, page.key, version.versionNo, langKey),
    );
    await this.versions.remove(version);
    await this.deleteOssKeys([xmlKey, ...langObjects]);
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

  async activateVersion(projectId: string, pageId: string, versionId: string): Promise<ProjectPageDto> {
    const page = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    if (version.status !== 'published') {
      throw new ConflictException('Only published versions can be used');
    }
    page.currentVersionId = version.id;
    page.xmlKey = version.xmlKey;
    page.xmlUrl = version.xmlUrl;
    await this.pages.save(page);
    const xml = await this.readXml(page.xmlKey);
    return this.toPageDto(page, xml);
  }

  private async readLangCatalog(projectId: string): Promise<ProjectLangCatalogDto> {
    const langRows = await this.langs.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
    const valueRows = await this.langValues.find({
      where: { projectId },
      order: { sortOrder: 'ASC' },
    });
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

  private async writeLangSnapshots(project: Project, page: ProjectPage, version: ProjectPageVersion) {
    const catalog = await this.readLangCatalog(project.id);
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

  private async requireProject(id: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException();
    }
    return project;
  }

  private async requirePage(projectId: string, pageId: string): Promise<ProjectPage> {
    const page = await this.pages.findOne({ where: { id: pageId, projectId } });
    if (!page) {
      throw new NotFoundException();
    }
    return page;
  }

  private async requireVersion(
    projectId: string,
    pageId: string,
    versionId: string,
  ): Promise<ProjectPageVersion> {
    await this.requirePage(projectId, pageId);
    const version = await this.versions.findOne({ where: { id: versionId, pageId } });
    if (!version) {
      throw new NotFoundException();
    }
    return version;
  }

  private assertPageXml(xml: string) {
    try {
      parsePageXml(xml);
    } catch (error) {
      if (error instanceof XmlParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private xmlObjectKey(projectKey: string, pageKey: string, versionNo: number) {
    return `lowcode/${projectKey}/${pageKey}/v${versionNo}.xml`;
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

  private async readXml(key: string): Promise<string> {
    const object = await this.oss.getObject(key);
    if (!object) {
      return EMPTY_PAGE_XML;
    }
    return object.body.toString('utf8');
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

  private toProjectDto(project: Project): ProjectDto {
    return {
      id: project.id,
      name: project.name,
      key: project.key,
      description: project.description,
      createdAt: toIso(project.createdAt),
      updatedAt: toIso(project.updatedAt),
    };
  }

  private toPageDto(page: ProjectPage, xml?: string): ProjectPageDto {
    return {
      id: page.id,
      projectId: page.projectId,
      name: page.name,
      key: page.key,
      description: page.description,
      currentVersionId: page.currentVersionId,
      xmlKey: page.xmlKey,
      xmlUrl: page.xmlUrl,
      xml,
      createdAt: toIso(page.createdAt),
      updatedAt: toIso(page.updatedAt),
    };
  }

  private toVersionDto(
    version: ProjectPageVersion,
    currentVersionId: string | null,
    xml?: string,
  ): ProjectPageVersionDto {
    return {
      id: version.id,
      pageId: version.pageId,
      versionNo: version.versionNo,
      status: version.id === currentVersionId && version.status === 'published' ? 'in_use' : version.status,
      description: version.description,
      xmlKey: version.xmlKey,
      xmlUrl: version.xmlUrl,
      xml,
      createdAt: toIso(version.createdAt),
      updatedAt: toIso(version.updatedAt),
    };
  }
}
