import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListedObject, OssStorage, StoredObject } from './oss.types';

@Injectable()
export class LocalOssStorage extends OssStorage {
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    super();
    this.root = config.get<string>('OSS_LOCAL_DIR', 'uploads');
    this.publicUrl = config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000');
  }

  async putObject(key: string, body: Buffer, _contentType: string): Promise<StoredObject> {
    const filePath = join(this.root, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return { key, url: this.getPublicUrl(key) };
  }

  async getObject(key: string) {
    try {
      const body = await readFile(join(this.root, key));
      return { body, contentType: 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await unlink(join(this.root, key)).catch(() => undefined);
  }

  async listObjects(prefix: string): Promise<ListedObject[]> {
    const start = join(this.root, ...prefix.split('/').filter(Boolean));
    const items: ListedObject[] = [];
    await walkFiles(start, async (filePath) => {
      const key = relative(this.root, filePath).split(sep).join('/');
      if (!key.startsWith(prefix.replace(/^\//, ''))) {
        return;
      }
      const info = await stat(filePath);
      items.push({ key, size: info.size });
    });
    return items;
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/api/files/content/${encodeURIComponent(key)}`;
  }

  createReadStream(key: string) {
    return createReadStream(join(this.root, key));
  }
}

async function walkFiles(dir: string, visit: (filePath: string) => Promise<void>) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const next = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(next, visit);
    } else {
      await visit(next);
    }
  }
}
