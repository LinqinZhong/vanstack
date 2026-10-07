import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OssService } from '../oss/oss.service';
import { LowcodeMongo } from './lowcode-mongo';

const COLLECTIONS = new Set([
  'project.version',
  'page.version',
  'component',
  'component.version',
  'function',
  'event',
  'lang.version',
  'asset.version',
  'icon.version',
  'namespace.version',
]);

type BundleWrite = { collection: string; doc: Record<string, unknown> };
type BundleDelete = { collection: string; id: string; projectId?: string };

export type ApplyBundleInput = {
  project?: Record<string, unknown>;
  writes?: BundleWrite[];
  deletes?: BundleDelete[];
  deleteObjects?: string[];
};

@Injectable()
export class WorkspaceBundleService {
  constructor(
    private readonly mongo: LowcodeMongo,
    private readonly oss: OssService,
  ) {}

  async exportProject(id: string) {
    const dump = await this.mongo.dumpProject(id);
    if (!dump) {
      throw new NotFoundException();
    }
    const keys = new Set<string>();
    for (const version of dump.projectVersions) {
      for (const libraryId of [version.assetVersionId, version.iconVersionId]) {
        const library =
          (await this.mongo.getLibraryVersion('asset', libraryId)) ??
          (await this.mongo.getLibraryVersion('icon', libraryId));
        for (const group of library?.groups ?? []) {
          for (const file of group.files) {
            keys.add(file.key);
          }
        }
      }
    }
    for (const item of await this.oss.listObjects(`lowcode/${dump.project.key}/`)) {
      keys.add(item.key);
    }
    return {
      ...dump,
      objects: [...keys].sort().map((key) => ({ key })),
    };
  }

  async apply(input: ApplyBundleInput): Promise<void> {
    if (input.project) {
      const project = input.project;
      if (typeof project._id !== 'string' || typeof project.key !== 'string') {
        throw new BadRequestException('invalid project');
      }
      const existing = await this.mongo.getProjectByKey(project.key);
      if (existing && existing._id !== project._id) {
        throw new ConflictException('key already exists');
      }
      try {
        await this.mongo.saveProject(reviveProject(project));
      } catch (error) {
        if (isDuplicate(error)) {
          throw new ConflictException('key already exists');
        }
        throw error;
      }
    }
    for (const write of input.writes ?? []) {
      assertCollection(write.collection);
      if (!write.doc || typeof write.doc !== 'object') {
        throw new BadRequestException('invalid document');
      }
      await this.mongo.upsertBundleDoc(write.collection, write.doc);
    }
    for (const item of input.deletes ?? []) {
      assertCollection(item.collection);
      if (!item.id) {
        throw new BadRequestException('invalid delete');
      }
      await this.mongo.deleteBundleDoc(item.collection, item.id, item.projectId);
    }
    for (const key of input.deleteObjects ?? []) {
      assertObjectKey(key);
      await this.oss.deleteObject(key);
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    assertObjectKey(key);
    if (!body.length && body.length !== 0) {
      throw new BadRequestException('empty body');
    }
    await this.oss.putObject(key, body, contentType || 'application/octet-stream');
  }
}

function assertCollection(collection: string) {
  if (!COLLECTIONS.has(collection)) {
    throw new BadRequestException('unknown collection');
  }
}

function assertObjectKey(key: string) {
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new BadRequestException('invalid object key');
  }
}

function reviveProject(doc: Record<string, unknown>) {
  return {
    ...doc,
    createdAt: asDate(doc.createdAt),
    updatedAt: asDate(doc.updatedAt),
  } as Parameters<LowcodeMongo['saveProject']>[0];
}

function asDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000;
}
