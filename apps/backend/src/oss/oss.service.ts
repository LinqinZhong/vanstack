import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { OssStorage } from './oss.types';

@Injectable()
export class OssService implements OnModuleInit {
  constructor(private readonly storage: OssStorage) {}

  async onModuleInit() {
    await this.storage.ensureReady();
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    return this.storage.putObject(key, body, contentType);
  }

  async upload(file: Express.Multer.File) {
    const ext = file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.'))
      : '';
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    const stored = await this.storage.putObject(key, file.buffer, file.mimetype);
    return stored;
  }

  getPublicUrl(key: string) {
    return this.storage.getPublicUrl(key);
  }

  getObject(key: string) {
    return this.storage.getObject(key);
  }

  deleteObject(key: string) {
    return this.storage.deleteObject(key);
  }

  listObjects(prefix: string) {
    return this.storage.listObjects(prefix);
  }

  async copyObject(from: string, to: string, contentType?: string) {
    const object = await this.storage.getObject(from);
    if (!object) {
      return;
    }
    await this.storage.putObject(to, object.body, contentType ?? object.contentType);
  }
}
