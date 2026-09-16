import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import type { DocumentFileDto } from '@vanstack/shared';
import { Document } from '../documents/document.entity';
import { OssService } from '../oss/oss.service';
import { FileObject } from './file-object.entity';

@Injectable()
export class FilesService {
  private readonly publicUrl: string;

  constructor(
    @InjectRepository(FileObject)
    private readonly files: Repository<FileObject>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    private readonly oss: OssService,
    private readonly i18n: I18nService,
    config: ConfigService,
  ) {
    this.publicUrl = config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000');
  }

  async upload(file: Express.Multer.File, documentId?: string): Promise<DocumentFileDto> {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    let document: Document | null = null;
    if (documentId) {
      document = await this.documents.findOne({ where: { id: documentId } });
      if (!document) {
        throw new NotFoundException(this.i18n.t('messages.document.notFound'));
      }
    }

    const stored = await this.oss.upload(file);
    const saved = await this.files.save(
      this.files.create({
        storageKey: stored.key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        document,
      }),
    );

    return this.toDto(saved);
  }

  async findAll(): Promise<DocumentFileDto[]> {
    const rows = await this.files.find({
      relations: { document: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async findOne(id: string): Promise<FileObject> {
    const file = await this.files.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(this.i18n.t('messages.file.notFound'));
    }
    return file;
  }

  async getContent(id: string) {
    const file = await this.findOne(id);
    const object = await this.oss.getObject(file.storageKey);
    if (!object) {
      throw new NotFoundException(this.i18n.t('messages.file.notFound'));
    }
    return {
      body: object.body,
      mimeType: file.mimeType,
      originalName: file.originalName,
    };
  }

  async remove(id: string): Promise<void> {
    const file = await this.findOne(id);
    await this.oss.deleteObject(file.storageKey);
    await this.files.remove(file);
  }

  private toDto(file: FileObject): DocumentFileDto {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: `${this.publicUrl}/api/files/${file.id}/content`,
      documentId: file.document?.id ?? null,
      createdAt: file.createdAt.toISOString(),
    };
  }
}
