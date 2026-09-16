import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OssStorage } from './oss.types';

@Injectable()
export class OssService {
  constructor(private readonly storage: OssStorage) {}

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
}
