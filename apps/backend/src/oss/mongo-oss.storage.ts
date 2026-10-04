import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GridFSBucket, MongoClient, type GridFSFile } from 'mongodb';
import { ListedObject, OssStorage, StoredObject } from './oss.types';

@Injectable()
export class MongoOssStorage extends OssStorage {
  private readonly client: MongoClient;
  private readonly dbName: string;
  private readonly publicUrl: string;
  private bucket: GridFSBucket | null = null;

  constructor(config: ConfigService) {
    super();
    this.dbName = config.get<string>('MONGO_DB', 'vanstack');
    this.publicUrl = config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000');
    this.client = new MongoClient(config.get<string>('MONGO_URI', 'mongodb://localhost:27017'));
  }

  async ensureReady(): Promise<void> {
    await this.client.connect();
    const db = this.client.db(this.dbName);
    await db.command({ ping: 1 });
    this.bucket = new GridFSBucket(db, { bucketName: 'objects' });
    await db.collection('objects.files').createIndex({ filename: 1 });
  }

  override async close(): Promise<void> {
    await this.client.close();
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.deleteObject(key);
    await new Promise<void>((resolve, reject) => {
      const stream = this.bucketOrThrow().openUploadStream(key, {
        metadata: { contentType },
      });
      stream.on('error', reject);
      stream.on('finish', () => resolve());
      stream.end(body);
    });
    return { key, url: this.getPublicUrl(key) };
  }

  async getObject(key: string) {
    const file = await this.latestFile(key);
    if (!file) {
      return null;
    }
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = this.bucketOrThrow().openDownloadStream(file._id);
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve());
    });
    return { body: Buffer.concat(chunks), contentType: contentTypeOf(file) };
  }

  async deleteObject(key: string): Promise<void> {
    const files = await this.bucketOrThrow().find({ filename: key }).toArray();
    for (const file of files) {
      await this.bucketOrThrow().delete(file._id);
    }
  }

  async listObjects(prefix: string): Promise<ListedObject[]> {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const files = await this.bucketOrThrow()
      .find({ filename: { $regex: `^${escaped}` } })
      .sort({ uploadDate: -1 })
      .toArray();
    const seen = new Set<string>();
    const items: ListedObject[] = [];
    for (const file of files) {
      if (seen.has(file.filename)) {
        continue;
      }
      seen.add(file.filename);
      items.push({ key: file.filename, size: file.length });
    }
    return items;
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl.replace(/\/$/, '')}/api/files/content/${encodeURIComponent(key)}`;
  }

  private bucketOrThrow() {
    if (!this.bucket) {
      throw new Error('MongoDB object storage is not ready');
    }
    return this.bucket;
  }

  private async latestFile(key: string) {
    const files = await this.bucketOrThrow().find({ filename: key }).sort({ uploadDate: -1 }).limit(1).toArray();
    return files[0] ?? null;
  }
}

function contentTypeOf(file: GridFSFile) {
  const metadata = file.metadata?.contentType;
  if (typeof metadata === 'string' && metadata) {
    return metadata;
  }
  return 'application/octet-stream';
}
