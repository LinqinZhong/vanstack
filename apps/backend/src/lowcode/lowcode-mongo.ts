import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { documentEventIds, type PageXmlDocument } from '@vanstack/xml';
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

export type PageVersionRecord = PageXmlDocument & {
  _id: string;
  projectId: string;
  projectKey: string;
  pageId: string;
  pageKey: string;
  versionNo: number;
  description?: string;
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

export type ProjectRecord = {
  _id: string;
  name: string;
  key: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  pages: ProjectPageRecord[];
};

export type LangRecord = {
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
  /** 有多少个已保存的页面版本引用这份事件。 */
  uses: number;
  updatedAt: Date;
};

/**
 * 低代码文档按业务集合存放：`project`、`page.version`、`component`、`component.version`、`function`、`event`、`lang`。
 */
@Injectable()
export class LowcodeMongo implements OnModuleInit, OnModuleDestroy {
  private readonly client: MongoClient;
  private readonly dbName: string;
  private projects: Collection<ProjectRecord> | null = null;
  private pageVersions: Collection<PageVersionRecord> | null = null;
  private components: Collection<ComponentRecord> | null = null;
  private componentVersions: Collection<ComponentVersionRecord> | null = null;
  private functions: Collection<FunctionRecord> | null = null;
  private events: Collection<EventRecord> | null = null;
  private langs: Collection<LangRecord> | null = null;

  constructor(config: ConfigService) {
    this.dbName = config.get<string>('MONGO_DB', 'vanstack');
    this.client = new MongoClient(config.get<string>('MONGO_URI', 'mongodb://localhost:27017'));
  }

  async onModuleInit() {
    await this.client.connect();
    const db = this.client.db(this.dbName);
    await renameCollection(db, 'page_versions', 'page.version');
    this.projects = db.collection<ProjectRecord>('project');
    this.pageVersions = db.collection<PageVersionRecord>('page.version');
    this.components = db.collection<ComponentRecord>('component');
    this.componentVersions = db.collection<ComponentVersionRecord>('component.version');
    this.functions = db.collection<FunctionRecord>('function');
    this.events = db.collection<EventRecord>('event');
    this.langs = db.collection<LangRecord>('lang');
    await adoptBusinessId(this.projects, 'id');
    await adoptBusinessId(this.pageVersions, 'versionId');
    await adoptBusinessId(this.components, 'id');
    await adoptBusinessId(this.componentVersions, 'versionId');
    await this.projects.createIndex({ key: 1 }, { unique: true });
    await this.pageVersions.createIndex({ projectId: 1, pageId: 1, versionNo: 1 });
    await this.components.createIndex({ projectId: 1, key: 1 }, { unique: true });
    await this.componentVersions.createIndex({ projectId: 1, componentId: 1, versionNo: 1 });
    await this.functions.createIndex({ projectId: 1, id: 1 }, { unique: true });
    await this.events.createIndex({ projectId: 1, id: 1 }, { unique: true });
    await this.importMethodUsage(db);
    await this.recountEventUses();
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

  async listPageVersions(pageId: string): Promise<PageVersionRecord[]> {
    return this.pageDocs().find({ pageId }).sort({ versionNo: 1 }).toArray();
  }

  async listPageVersionStamps(pageId: string): Promise<PageVersionRecord[]> {
    return this.pageDocs()
      .find({ pageId }, { projection: { widgets: 0, style: 0, data: 0, events: 0, methods: 0, props: 0, emits: 0 } })
      .sort({ versionNo: 1 })
      .toArray();
  }

  async listProjectVersions(projectId: string): Promise<PageVersionRecord[]> {
    return this.pageDocs().find({ projectId }).toArray();
  }

  async getPage(versionId: string): Promise<PageVersionRecord | null> {
    return this.pageDocs().findOne({ _id: versionId });
  }

  async putPage(record: Omit<PageVersionRecord, 'updatedAt' | 'createdAt'> & { createdAt?: Date }): Promise<PageVersionRecord> {
    const existing = await this.pageDocs().findOne({ _id: record._id });
    const next: PageVersionRecord = {
      ...record,
      description: record.description ?? existing?.description ?? '',
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

  async getLang(projectId: string): Promise<LangRecord | null> {
    return this.langDocs().findOne({ _id: projectId });
  }

  async saveLang(record: LangRecord): Promise<void> {
    await this.langDocs().replaceOne({ _id: record._id }, record, { upsert: true });
  }

  async renameLangProject(projectId: string, projectKey: string): Promise<void> {
    await this.langDocs().updateOne({ _id: projectId }, { $set: { projectKey } });
  }

  async deleteByProject(projectId: string): Promise<void> {
    await this.projectDocs().deleteOne({ _id: projectId });
    await this.langDocs().deleteOne({ _id: projectId });
    await this.pageDocs().deleteMany({ projectId });
    await this.componentDocs().deleteMany({ projectId });
    await this.componentVersionDocs().deleteMany({ projectId });
    await this.functionDocs().deleteMany({ projectId });
    await this.eventDocs().deleteMany({ projectId });
  }

  /** 按已保存的页面版本重算事件引用数。同一版本里重复出现只计一次。 */
  private async recountEventUses() {
    const counts = new Map<string, number>();
    const versions = [
      ...(await this.pageDocs().find().toArray()),
      ...(await this.componentVersionDocs().find().toArray()),
    ];
    for (const version of versions) {
      for (const eventId of documentEventIds(version)) {
        const key = `${version.projectId}\0${eventId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const event of await this.eventDocs().find().toArray()) {
      const uses = counts.get(`${event.projectId}\0${event.id}`) ?? 0;
      if (event.uses !== uses) {
        await this.eventDocs().updateOne({ projectId: event.projectId, id: event.id }, { $set: { uses } });
      }
    }
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
      if ((langs.length > 0 || langValues.length > 0) && !(await this.langDocs().findOne({ _id: id }))) {
        await this.langDocs().insertOne({
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

  private langDocs() {
    if (!this.langs) {
      throw new Error('lang collection is not ready');
    }
    return this.langs;
  }
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
