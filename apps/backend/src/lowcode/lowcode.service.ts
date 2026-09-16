import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ProjectDto,
  ProjectPageDto,
  ProjectPageVersionDto,
} from '@vanstack/shared';
import { EMPTY_PAGE_XML, parsePageXml, XmlParseError } from '@vanstack/xml';
import { QueryFailedError, Repository } from 'typeorm';
import { OssService } from '../oss/oss.service';
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

@Injectable()
export class LowcodeService {
  private readonly logger = new Logger(LowcodeService.name);

  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectPage) private readonly pages: Repository<ProjectPage>,
    @InjectRepository(ProjectPageVersion) private readonly versions: Repository<ProjectPageVersion>,
    private readonly oss: OssService,
  ) {}

  async listProjects(): Promise<ProjectDto[]> {
    const rows = await this.projects.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => this.toProjectDto(row));
  }

  async getProject(id: string): Promise<ProjectDto> {
    return this.toProjectDto(await this.requireProject(id));
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
    const keys = (project.pages ?? []).flatMap((page) => [
      page.xmlKey,
      ...(page.versions ?? []).map((version) => version.xmlKey),
    ]).filter(Boolean);
    await this.projects.remove(project);
    await this.deleteOssKeys([...new Set(keys)]);
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
    const keys = [page.xmlKey, ...(page.versions ?? []).map((version) => version.xmlKey)].filter(Boolean);
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
    const page = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    if (version.status !== 'draft') {
      throw new ConflictException('Only draft versions can be published');
    }
    version.status = 'published';
    await this.versions.save(version);
    return this.toVersionDto(version, page.currentVersionId, await this.readXml(version.xmlKey));
  }

  async deleteVersion(projectId: string, pageId: string, versionId: string): Promise<void> {
    const page = await this.requirePage(projectId, pageId);
    const version = await this.requireVersion(projectId, pageId, versionId);
    if (page.currentVersionId === version.id) {
      throw new ConflictException('Cannot delete the version in use');
    }
    const xmlKey = version.xmlKey;
    await this.versions.remove(version);
    await this.deleteOssKeys([xmlKey]);
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
