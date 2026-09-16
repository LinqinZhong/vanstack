import { createReadStream } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OssStorage, StoredObject } from './oss.types';

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

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/api/files/content/${encodeURIComponent(key)}`;
  }

  createReadStream(key: string) {
    return createReadStream(join(this.root, key));
  }
}
