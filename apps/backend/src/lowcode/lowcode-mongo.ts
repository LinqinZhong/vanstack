import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type PageXmlDocument } from '@vanstack/xml';
import { Collection, Db, MongoClient } from 'mongodb';

export type ComponentRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ComponentVersionRecord = PageXmlDocument & {
  _id: string;
  projectId: string;
  projectKey: string;
  componentId: string;
  componentKey: string;
  versionNo: number;
  description?: string;
  createdAt?: Date;
  updatedAt: Date;
};

/** 页面内容快照。多个工程版本可以指向同一份；uses 是指向它的工程版本数。 */
export type PageVersionRecord = PageXmlDocument & {
  _id: string;
  projectId: string;
  projectKey: string;
  pageId: string;
  pageKey: string;
  uses: number;
  createdAt?: Date;
  updatedAt: Date;
};

export type ProjectPageRecord = {
  id: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectLangRecord = {
  key: string;
  name: string;
  dir: 'ltr' | 'rtl';
  sortOrder: number;
};

export type ProjectLangValueRecord = {
  groupKey: string;
  entryKey: string;
  langKey: string;
  value: string;
  sortOrder: number;
};

/** 工程上的命名空间。versionId 指向 namespace.version。 */
export type ProjectNamespaceRecord = {
  name: string;
  versionId: string;
};

export type ProjectRecord = {
  _id: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  /** 命名空间名称，以及各自指向的 namespace.version。 */
  namespace?: ProjectNamespaceRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectVersionRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  versionNo: number;
  description: string;
  pages: ProjectPageRecord[];
  langVersionId: string;
  assetVersionId: string;
  iconVersionId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LangVersionRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  /** 有多少个工程版本引用这份语言库。 */
  uses: number;
  langs: ProjectLangRecord[];
  langValues: ProjectLangValueRecord[];
  updatedAt: Date;
};

export type LibraryFileRecord = {
  name: string;
  key: string;
  size: number;
  contentType?: string;
};

export type LibraryGroupRecord = {
  name: string;
  files: LibraryFileRecord[];
};

export type LibraryVersionRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  /** 有多少个工程版本引用这份库。 */
  uses: number;
  groups: LibraryGroupRecord[];
  updatedAt: Date;
};

export type NamespaceFieldRecord = {
  id: string;
  name: string;
  description: string;
  type: string;
  children?: NamespaceFieldRecord[];
};

export type NamespaceTypeRecord = {
  id: string;
  name: string;
  description: string;
  fields: NamespaceFieldRecord[];
  source: string;
};

export type NamespaceDataRecord = {
  id: string;
  type: string;
  name: string;
  description: string;
  value: unknown;
};

/** 一个命名空间的类型定义和数据。由工程文档的 namespace.versionId 指向。 */
export type NamespaceVersionRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  uses: number;
  types: NamespaceTypeRecord[];
  data: NamespaceDataRecord[];
  updatedAt: Date;
};

/** 迁移前嵌在工程上的语言库，读完就不再写入。 */
export type LegacyLangRecord = {
  _id: string;
  projectKey: string;
  langs: ProjectLangRecord[];
  langValues: ProjectLangValueRecord[];
  updatedAt: Date;
};

export type FunctionRecord = {
  projectId: string;
  projectKey: string;
  id: string;
  code?: string;
  uses: number;
  updatedAt: Date;
};

export type EventRecord = {
  projectId: string;
  projectKey: string;
  id: string;
  source: string;
  /** 有多少个工程版本（以及组件版本）引用这份事件。 */
  uses: number;
  updatedAt: Date;
};

/**
 * 低代码文档按业务集合存放：`project`、`project.version`、`page.version`、`component`、`component.version`、
 * `function`、`event`、`lang.version`、`asset.version`、`icon.version`、`namespace.version`。
 */
@Injectable()
export class LowcodeMongo implements OnModuleInit, OnModuleDestroy {
  private readonly client: MongoClient;
  private readonly dbName: string;
  private projects: Collection<ProjectRecord> | null = null;
  private projectVersions: Collection<ProjectVersionRecord> | null = null;
  private pageVersions: Collection<PageVersionRecord> | null = null;
  private components: Collection<ComponentRecord> | null = null;
  private componentVersions: Collection<ComponentVersionRecord> | null = null;
  private functions: Collection<FunctionRecord> | null = null;
  private events: Collection<EventRecord> | null = null;
  private langVersions: Collection<LangVersionRecord> | null = null;
  private legacyLangs: Collection<LegacyLangRecord> | null = null;
  private assetVersions: Collection<LibraryVersionRecord> | null = null;
  private iconVersions: Collection<LibraryVersionRecord> | null = null;
  private namespaceVersions: Collection<NamespaceVersionRecord> | null = null;

  constructor(config: ConfigService) {
    this.dbName = config.get<string>('MONGO_DB', 'vanstack');
    this.client = new MongoClient(config.get<string>('MONGO_URI', 'mongodb://localhost:27017'));
  }

  async onModuleInit() {
    await this.client.connect();
    const db = this.client.db(this.dbName);
    await renameCollection(db, 'page_versions', 'page.version');
    this.projects = db.collection<ProjectRecord>('project');
    this.projectVersions = db.collection<ProjectVersionRecord>('project.version');
    this.pageVersions = db.collection<PageVersionRecord>('page.version');
    this.components = db.collection<ComponentRecord>('component');
    this.componentVersions = db.collection<ComponentVersionRecord>('component.version');
    this.functions = db.collection<FunctionRecord>('function');
    this.events = db.collection<EventRecord>('event');
    this.langVersions = db.collection<LangVersionRecord>('lang.version');
    this.legacyLangs = db.collection<LegacyLangRecord>('lang');
    this.assetVersions = db.collection<LibraryVersionRecord>('asset.version');
    this.iconVersions = db.collection<LibraryVersionRecord>('icon.version');
    this.namespaceVersions = db.collection<NamespaceVersionRecord>('namespace.version');
    await this.namespaceVersions.createIndex({ projectId: 1 });
    await adoptBusinessId(this.projects, 'id');
    await adoptBusinessId(this.pageVersions, 'versionId');
    await adoptBusinessId(this.components, 'id');
    await adoptBusinessId(this.componentVersions, 'versionId');
    await this.projects.createIndex({ key: 1 }, { unique: true });
    await this.projectVersions.createIndex({ projectId: 1, versionNo: 1 }, { unique: true });
    await this.pageVersions.createIndex({ projectId: 1, pageId: 1 });
    await this.components.createIndex({ projectId: 1, key: 1 }, { unique: true });
    await this.componentVersions.createIndex({ projectId: 1, componentId: 1, versionNo: 1 });
    await this.functions.createIndex({ projectId: 1, id: 1 }, { unique: true });
    await this.events.createIndex({ projectId: 1, id: 1 }, { unique: true });
    await this.importMethodUsage(db);
    await this.moveLangs();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return this.projectDocs().find().sort({ createdAt: -1 }).toArray();
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    return this.projectDocs().findOne({ _id: id });
  }

  async getProjectByKey(key: string): Promise<ProjectRecord | null> {
    return this.projectDocs().findOne({ key });
  }

  async insertProject(project: ProjectRecord): Promise<void> {
    await this.projectDocs().insertOne(project);
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    await this.projectDocs().replaceOne({ _id: project._id }, project, { upsert: true });
  }

  async listProjectVersions(projectId: string): Promise<ProjectVersionRecord[]> {
    return this.projectVersionDocs().find({ projectId }).sort({ versionNo: 1 }).toArray();
  }

  async getProjectVersion(id: string): Promise<ProjectVersionRecord | null> {
    return this.projectVersionDocs().findOne({ _id: id });
  }

  async saveProjectVersion(version: ProjectVersionRecord): Promise<void> {
    await this.projectVersionDocs().replaceOne({ _id: version._id }, version, { upsert: true });
  }

  async deleteProjectVersion(id: string): Promise<void> {
    await this.projectVersionDocs().deleteOne({ _id: id });
  }

  async listPageVersions(pageId: string): Promise<PageVersionRecord[]> {
    return this.pageDocs().find({ pageId }).sort({ versionNo: 1 }).toArray();
  }

  async listPageVersionStamps(pageId: string): Promise<PageVersionRecord[]> {
    return this.pageDocs()
      .find({ pageId }, { projection: { widgets: 0, style: 0, data: 0, events: 0, methods: 0, props: 0, emits: 0 } })
      .sort({ versionNo: 1 })
      .toArray();
  }

  async getPage(versionId: string): Promise<PageVersionRecord | null> {
    return this.pageDocs().findOne({ _id: versionId });
  }

  async putPage(record: Omit<PageVersionRecord, 'updatedAt' | 'createdAt'> & { createdAt?: Date }): Promise<PageVersionRecord> {
    const existing = await this.pageDocs().findOne({ _id: record._id });
    const next: PageVersionRecord = {
      ...record,
      uses: record.uses ?? existing?.uses ?? 0,
      createdAt: existing?.createdAt ?? record.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await this.pageDocs().replaceOne({ _id: record._id }, next, { upsert: true });
    return next;
  }

  async deletePage(versionId: string): Promise<void> {
    await this.pageDocs().deleteOne({ _id: versionId });
  }

  async deletePagesByPage(pageId: string): Promise<void> {
    await this.pageDocs().deleteMany({ pageId });
  }

  async addPageUses(id: string, delta: number): Promise<number> {
    const updated = await this.pageDocs().findOneAndUpdate(
      { _id: id },
      { $inc: { uses: delta } },
      { returnDocument: 'after' },
    );
    const uses = updated?.uses ?? 0;
    if (uses < 0) {
      await this.pageDocs().updateOne({ _id: id }, { $set: { uses: 0 } });
      return 0;
    }
    return uses;
  }

  async listProjectPageSnapshots(projectId: string): Promise<PageVersionRecord[]> {
    return this.pageDocs().find({ projectId }).toArray();
  }

  async listComponents(projectId: string): Promise<ComponentRecord[]> {
    return this.componentDocs().find({ projectId }).sort({ createdAt: 1 }).toArray();
  }

  async getComponent(id: string): Promise<ComponentRecord | null> {
    return this.componentDocs().findOne({ _id: id });
  }

  async saveComponent(component: ComponentRecord): Promise<void> {
    await this.componentDocs().replaceOne({ _id: component._id }, component, { upsert: true });
  }

  async deleteComponent(id: string): Promise<void> {
    await this.componentDocs().deleteOne({ _id: id });
  }

  async listComponentVersions(componentId: string): Promise<ComponentVersionRecord[]> {
    return this.componentVersionDocs().find({ componentId }).sort({ versionNo: 1 }).toArray();
  }

  async listComponentVersionStamps(componentId: string): Promise<ComponentVersionRecord[]> {
    return this.componentVersionDocs()
      .find(
        { componentId },
        { projection: { widgets: 0, style: 0, data: 0, events: 0, methods: 0, props: 0, emits: 0 } },
      )
      .sort({ versionNo: 1 })
      .toArray();
  }

  async getComponentVersion(versionId: string): Promise<ComponentVersionRecord | null> {
    return this.componentVersionDocs().findOne({ _id: versionId });
  }

  async putComponentVersion(
    record: Omit<ComponentVersionRecord, 'updatedAt' | 'createdAt'> & { createdAt?: Date },
  ): Promise<ComponentVersionRecord> {
    const existing = await this.componentVersionDocs().findOne({ _id: record._id });
    const next: ComponentVersionRecord = {
      ...record,
      description: record.description ?? existing?.description ?? '',
      createdAt: existing?.createdAt ?? record.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await this.componentVersionDocs().replaceOne({ _id: record._id }, next, { upsert: true });
    return next;
  }

  async deleteComponentVersion(versionId: string): Promise<void> {
    await this.componentVersionDocs().deleteOne({ _id: versionId });
  }

  async deleteComponentVersions(componentId: string): Promise<void> {
    await this.componentVersionDocs().deleteMany({ componentId });
  }

  async getFunction(projectId: string, id: string): Promise<FunctionRecord | null> {
    return this.functionDocs().findOne({ projectId, id });
  }

  async putFunctionCode(projectId: string, projectKey: string, id: string, code: string): Promise<void> {
    await this.functionDocs().updateOne(
      { projectId, id },
      {
        $set: { projectKey, code, updatedAt: new Date() },
        $setOnInsert: { uses: 0 },
      },
      { upsert: true },
    );
  }

  async addFunctionUses(projectId: string, id: string, delta: number): Promise<number> {
    const updated = await this.functionDocs().findOneAndUpdate(
      { projectId, id },
      { $inc: { uses: delta }, $set: { updatedAt: new Date() } },
      { upsert: delta > 0, returnDocument: 'after' },
    );
    const uses = updated?.uses ?? 0;
    if (uses <= 0) {
      if (updated?.code == null) {
        await this.functionDocs().deleteOne({ projectId, id });
      } else if (updated.uses !== 0) {
        await this.functionDocs().updateOne({ projectId, id }, { $set: { uses: 0, updatedAt: new Date() } });
      }
      return 0;
    }
    return uses;
  }

  async getEvent(projectId: string, id: string): Promise<EventRecord | null> {
    return this.eventDocs().findOne({ projectId, id });
  }

  async putEvent(projectId: string, projectKey: string, id: string, source: string): Promise<void> {
    await this.eventDocs().updateOne(
      { projectId, id },
      {
        $set: { projectKey, source, updatedAt: new Date() },
        $setOnInsert: { uses: 0 },
      },
      { upsert: true },
    );
  }

  async addEventUses(projectId: string, id: string, delta: number): Promise<number> {
    const updated = await this.eventDocs().findOneAndUpdate(
      { projectId, id },
      { $inc: { uses: delta }, $set: { updatedAt: new Date() } },
      { upsert: delta > 0, returnDocument: 'after' },
    );
    const uses = updated?.uses ?? 0;
    if (uses <= 0) {
      await this.eventDocs().deleteOne({ projectId, id });
      return 0;
    }
    return uses;
  }

  async deleteEvent(projectId: string, id: string): Promise<void> {
    await this.eventDocs().deleteOne({ projectId, id });
  }

  async getLegacyLang(projectId: string): Promise<LegacyLangRecord | null> {
    return this.legacyLangDocs().findOne({ _id: projectId });
  }

  async getLangVersion(id: string): Promise<LangVersionRecord | null> {
    return this.langVersionDocs().findOne({ _id: id });
  }

  async saveLangVersion(record: LangVersionRecord): Promise<void> {
    await this.langVersionDocs().replaceOne({ _id: record._id }, record, { upsert: true });
  }

  async deleteLangVersion(id: string): Promise<void> {
    await this.langVersionDocs().deleteOne({ _id: id });
  }

  async addLangUses(id: string, delta: number): Promise<number> {
    return this.addUses(this.langVersionDocs(), id, delta);
  }

  async getLibraryVersion(kind: 'asset' | 'icon', id: string): Promise<LibraryVersionRecord | null> {
    return this.libraryDocs(kind).findOne({ _id: id });
  }

  async saveLibraryVersion(kind: 'asset' | 'icon', record: LibraryVersionRecord): Promise<void> {
    await this.libraryDocs(kind).replaceOne({ _id: record._id }, record, { upsert: true });
  }

  async deleteLibraryVersion(kind: 'asset' | 'icon', id: string): Promise<void> {
    await this.libraryDocs(kind).deleteOne({ _id: id });
  }

  async addLibraryUses(kind: 'asset' | 'icon', id: string, delta: number): Promise<number> {
    return this.addUses(this.libraryDocs(kind), id, delta);
  }

  async getNamespaceVersion(id: string): Promise<NamespaceVersionRecord | null> {
    return this.namespaceVersionDocs().findOne({ _id: id });
  }

  async saveNamespaceVersion(record: NamespaceVersionRecord): Promise<void> {
    await this.namespaceVersionDocs().replaceOne({ _id: record._id }, record, { upsert: true });
  }

  async deleteNamespaceVersion(id: string): Promise<void> {
    await this.namespaceVersionDocs().deleteOne({ _id: id });
  }

  async countBlobKey(key: string): Promise<number> {
    const filter = { 'groups.files.key': key };
    const assets = await this.libraryDocs('asset').countDocuments(filter);
    const icons = await this.libraryDocs('icon').countDocuments(filter);
    return assets + icons;
  }

  async listFunctions(projectId: string): Promise<FunctionRecord[]> {
    return this.functionDocs().find({ projectId }).toArray();
  }

  async listEvents(projectId: string): Promise<EventRecord[]> {
    return this.eventDocs().find({ projectId }).toArray();
  }

  async setFunctionUses(projectId: string, id: string, uses: number): Promise<void> {
    if (uses <= 0) {
      const current = await this.functionDocs().findOne({ projectId, id });
      if (!current || current.code == null) {
        await this.functionDocs().deleteOne({ projectId, id });
        return;
      }
      await this.functionDocs().updateOne({ projectId, id }, { $set: { uses: 0, updatedAt: new Date() } });
      return;
    }
    await this.functionDocs().updateOne({ projectId, id }, { $set: { uses, updatedAt: new Date() } });
  }

  async setEventUses(projectId: string, id: string, uses: number): Promise<void> {
    if (uses <= 0) {
      await this.eventDocs().deleteOne({ projectId, id });
      return;
    }
    await this.eventDocs().updateOne({ projectId, id }, { $set: { uses, updatedAt: new Date() } });
  }

  async setPageUses(id: string, uses: number): Promise<void> {
    await this.pageDocs().updateOne({ _id: id }, { $set: { uses } });
  }

  async deleteByProject(projectId: string): Promise<void> {
    await this.projectDocs().deleteOne({ _id: projectId });
    await this.projectVersionDocs().deleteMany({ projectId });
    await this.legacyLangDocs().deleteOne({ _id: projectId });
    await this.langVersionDocs().deleteMany({ projectId });
    await this.libraryDocs('asset').deleteMany({ projectId });
    await this.libraryDocs('icon').deleteMany({ projectId });
    await this.pageDocs().deleteMany({ projectId });
    await this.componentDocs().deleteMany({ projectId });
    await this.componentVersionDocs().deleteMany({ projectId });
    await this.functionDocs().deleteMany({ projectId });
    await this.eventDocs().deleteMany({ projectId });
    await this.namespaceVersionDocs().deleteMany({ projectId });
  }

  async renameProjectKey(projectId: string, projectKey: string): Promise<void> {
    const set = { $set: { projectKey } };
    await this.projectVersionDocs().updateMany({ projectId }, set);
    await this.pageDocs().updateMany({ projectId }, set);
    await this.langVersionDocs().updateMany({ projectId }, set);
    await this.libraryDocs('asset').updateMany({ projectId }, set);
    await this.libraryDocs('icon').updateMany({ projectId }, set);
    await this.componentDocs().updateMany({ projectId }, set);
    await this.componentVersionDocs().updateMany({ projectId }, set);
    await this.functionDocs().updateMany({ projectId }, set);
    await this.eventDocs().updateMany({ projectId }, set);
    await this.namespaceVersionDocs().updateMany({ projectId }, set);
  }

  /** 迁走工程文档上残留的 pages 字段，并记下当前工程版本。 */
  async finishProjectMigration(projectId: string, currentVersionId: string): Promise<void> {
    await this.projectDocs().updateOne(
      { _id: projectId },
      { $set: { currentVersionId }, $unset: { pages: '' } },
    );
  }

  private async importMethodUsage(db: Db) {
    const names = await db.listCollections({ name: 'method_usage' }).toArray();
    if (names.length === 0) {
      return;
    }
    const rows = await db.collection<{ projectId: string; methodId: string; uses: number }>('method_usage').find().toArray();
    for (const row of rows) {
      const existing = await this.functionDocs().findOne({ projectId: row.projectId, id: row.methodId });
      if (!existing) {
        await this.functionDocs().insertOne({
          projectId: row.projectId,
          projectKey: '',
          id: row.methodId,
          uses: row.uses,
          updatedAt: new Date(),
        });
      } else if (existing.uses == null) {
        await this.functionDocs().updateOne({ projectId: row.projectId, id: row.methodId }, { $set: { uses: row.uses } });
      }
    }
    await db.dropCollection('method_usage');
  }

  private projectDocs() {
    if (!this.projects) {
      throw new Error('project collection is not ready');
    }
    return this.projects;
  }

  private pageDocs() {
    if (!this.pageVersions) {
      throw new Error('page.version collection is not ready');
    }
    return this.pageVersions;
  }

  private componentDocs() {
    if (!this.components) {
      throw new Error('component collection is not ready');
    }
    return this.components;
  }

  private componentVersionDocs() {
    if (!this.componentVersions) {
      throw new Error('component.version collection is not ready');
    }
    return this.componentVersions;
  }

  private functionDocs() {
    if (!this.functions) {
      throw new Error('function collection is not ready');
    }
    return this.functions;
  }

  /** 把嵌在工程文档里的语言库挪到 `lang`，每个工程一份。 */
  private async moveLangs() {
    const docs = this.projectDocs() as unknown as {
      find(filter: object): { toArray(): Promise<Array<Record<string, unknown>>> };
      updateOne(filter: object, update: object): Promise<unknown>;
    };
    const projects = await docs
      .find({ $or: [{ langs: { $exists: true } }, { langValues: { $exists: true } }] })
      .toArray();
    for (const project of projects) {
      const id = String(project._id);
      const langs = Array.isArray(project.langs) ? (project.langs as ProjectLangRecord[]) : [];
      const langValues = Array.isArray(project.langValues) ? (project.langValues as ProjectLangValueRecord[]) : [];
      if ((langs.length > 0 || langValues.length > 0) && !(await this.legacyLangDocs().findOne({ _id: id }))) {
        await this.legacyLangDocs().insertOne({
          _id: id,
          projectKey: String(project.key ?? ''),
          langs,
          langValues,
          updatedAt: new Date(),
        });
      }
      await docs.updateOne({ _id: project._id }, { $unset: { langs: '', langValues: '' } });
    }
  }

  private eventDocs() {
    if (!this.events) {
      throw new Error('event collection is not ready');
    }
    return this.events;
  }

  private projectVersionDocs() {
    if (!this.projectVersions) {
      throw new Error('project.version collection is not ready');
    }
    return this.projectVersions;
  }

  private legacyLangDocs() {
    if (!this.legacyLangs) {
      throw new Error('lang collection is not ready');
    }
    return this.legacyLangs;
  }

  private langVersionDocs() {
    if (!this.langVersions) {
      throw new Error('lang.version collection is not ready');
    }
    return this.langVersions;
  }

  private namespaceVersionDocs() {
    if (!this.namespaceVersions) {
      throw new Error('namespace.version collection is not ready');
    }
    return this.namespaceVersions;
  }

  private libraryDocs(kind: 'asset' | 'icon') {
    const docs = kind === 'asset' ? this.assetVersions : this.iconVersions;
    if (!docs) {
      throw new Error(`${kind}.version collection is not ready`);
    }
    return docs;
  }

  private async addUses(
    docs: Collection<LangVersionRecord> | Collection<LibraryVersionRecord>,
    id: string,
    delta: number,
  ): Promise<number> {
    const collection = docs as unknown as Collection<{ _id: string; uses: number }>;
    const updated = await collection.findOneAndUpdate(
      { _id: id },
      { $inc: { uses: delta } },
      { returnDocument: 'after' },
    );
    const uses = updated?.uses ?? 0;
    if (uses < 0) {
      await collection.updateOne({ _id: id }, { $set: { uses: 0 } });
      return 0;
    }
    return uses;
  }

  async dumpProject(projectId: string) {
    const project = await this.getProject(projectId);
    if (!project) {
      return null;
    }
    const [
      projectVersions,
      pageVersions,
      components,
      componentVersions,
      functions,
      events,
      langVersions,
      assetVersions,
      iconVersions,
      namespaceVersions,
    ] = await Promise.all([
      this.listProjectVersions(projectId),
      this.listProjectPageSnapshots(projectId),
      this.listComponents(projectId),
      this.componentVersionDocs().find({ projectId }).toArray(),
      this.listFunctions(projectId),
      this.listEvents(projectId),
      this.langVersionDocs().find({ projectId }).toArray(),
      this.libraryDocs('asset').find({ projectId }).toArray(),
      this.libraryDocs('icon').find({ projectId }).toArray(),
      this.namespaceVersionDocs().find({ projectId }).toArray(),
    ]);
    return {
      project,
      projectVersions,
      pageVersions,
      components,
      componentVersions,
      functions,
      events,
      langVersions,
      assetVersions,
      iconVersions,
      namespaceVersions,
    };
  }

  async upsertBundleDoc(collection: string, doc: Record<string, unknown>): Promise<void> {
    const revived = reviveDates(doc);
    switch (collection) {
      case 'project.version':
        await this.saveProjectVersion(revived as ProjectVersionRecord);
        return;
      case 'page.version':
        await this.pageDocs().replaceOne({ _id: String(revived._id) }, revived as PageVersionRecord, { upsert: true });
        return;
      case 'component':
        await this.saveComponent(revived as ComponentRecord);
        return;
      case 'component.version':
        await this.componentVersionDocs().replaceOne(
          { _id: String(revived._id) },
          revived as ComponentVersionRecord,
          { upsert: true },
        );
        return;
      case 'function': {
        const row = stripMongoId(revived) as unknown as FunctionRecord;
        await this.functionDocs().replaceOne({ projectId: row.projectId, id: row.id }, row, { upsert: true });
        return;
      }
      case 'event': {
        const row = stripMongoId(revived) as unknown as EventRecord;
        await this.eventDocs().replaceOne({ projectId: row.projectId, id: row.id }, row, { upsert: true });
        return;
      }
      case 'lang.version':
        await this.saveLangVersion(revived as LangVersionRecord);
        return;
      case 'asset.version':
        await this.saveLibraryVersion('asset', revived as LibraryVersionRecord);
        return;
      case 'icon.version':
        await this.saveLibraryVersion('icon', revived as LibraryVersionRecord);
        return;
      case 'namespace.version':
        await this.saveNamespaceVersion(revived as NamespaceVersionRecord);
        return;
      default:
        throw new Error(`unknown collection ${collection}`);
    }
  }

  async deleteBundleDoc(collection: string, id: string, projectId?: string): Promise<void> {
    switch (collection) {
      case 'project.version':
        await this.deleteProjectVersion(id);
        return;
      case 'page.version':
        await this.deletePage(id);
        return;
      case 'component':
        await this.deleteComponent(id);
        return;
      case 'component.version':
        await this.deleteComponentVersion(id);
        return;
      case 'function':
        await this.functionDocs().deleteOne({ projectId: projectId ?? '', id });
        return;
      case 'event':
        await this.deleteEvent(projectId ?? '', id);
        return;
      case 'lang.version':
        await this.deleteLangVersion(id);
        return;
      case 'asset.version':
        await this.deleteLibraryVersion('asset', id);
        return;
      case 'icon.version':
        await this.deleteLibraryVersion('icon', id);
        return;
      case 'namespace.version':
        await this.deleteNamespaceVersion(id);
        return;
      default:
        throw new Error(`unknown collection ${collection}`);
    }
  }
}

const DATE_FIELDS = new Set(['createdAt', 'updatedAt']);

function reviveDates(value: unknown): Record<string, unknown> {
  return reviveValue(value) as Record<string, unknown>;
}

function reviveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => reviveValue(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (DATE_FIELDS.has(key) && typeof item === 'string') {
      const date = new Date(item);
      next[key] = Number.isNaN(date.getTime()) ? item : date;
      continue;
    }
    next[key] = reviveValue(item);
  }
  return next;
}

function stripMongoId(doc: Record<string, unknown>): Record<string, unknown> {
  const next = { ...doc };
  delete next._id;
  return next;
}

async function adoptBusinessId(
  collection:
    | Collection<ProjectRecord>
    | Collection<PageVersionRecord>
    | Collection<ComponentRecord>
    | Collection<ComponentVersionRecord>,
  field: 'id' | 'versionId',
) {
  const docs = collection as unknown as {
    indexes(): Promise<Array<{ name?: string; key: Record<string, number>; unique?: boolean }>>;
    dropIndex(name: string): Promise<unknown>;
    createIndex(keys: Record<string, number>, options: { unique?: boolean; name?: string }): Promise<unknown>;
    find(filter: object): { toArray(): Promise<Array<Record<string, unknown>>> };
    updateOne(filter: object, update: object): Promise<unknown>;
    insertOne(doc: Record<string, unknown>): Promise<unknown>;
    deleteOne(filter: object): Promise<unknown>;
  };
  let indexes: Array<{ name?: string; key: Record<string, number>; unique?: boolean }>;
  try {
    indexes = await docs.indexes();
  } catch (error) {
    if (isNamespaceMissing(error)) {
      return;
    }
    throw error;
  }
  const paused = indexes.filter((index) => index.name && index.name !== '_id_');
  for (const index of paused) {
    await docs.dropIndex(index.name!);
  }
  for (const doc of await docs.find({ [field]: { $type: 'string' } }).toArray()) {
    const businessId = String(doc[field]);
    if (String(doc._id) === businessId) {
      await docs.updateOne({ _id: doc._id }, { $unset: { [field]: '' } });
      continue;
    }
    const next: Record<string, unknown> = { ...doc, _id: businessId };
    delete next[field];
    try {
      await docs.insertOne(next);
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
    }
    await docs.deleteOne({ _id: doc._id });
  }
  for (const index of paused) {
    if (index.key && field in index.key) {
      continue;
    }
    await docs.createIndex(index.key, {
      ...(index.unique ? { unique: true } : {}),
      name: index.name,
    });
  }
}

function isNamespaceMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 26;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000;
}

async function renameCollection(db: Db, from: string, to: string) {
  const names = new Set((await db.listCollections().toArray()).map((item) => item.name));
  if (!names.has(from) || names.has(to)) {
    return;
  }
  await db.renameCollection(from, to);
}
