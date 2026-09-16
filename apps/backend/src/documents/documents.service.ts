import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import type { DocumentDto } from '@vanstack/shared';
import { parseDocumentsXml, serializeDocumentsXml, XmlParseError } from '@vanstack/xml';
import { ConfigService } from '@nestjs/config';
import { Document } from './document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  private readonly publicUrl: string;

  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    private readonly i18n: I18nService,
    config: ConfigService,
  ) {
    this.publicUrl = config.get<string>('APP_PUBLIC_URL', 'http://localhost:3000');
  }

  async findAll(): Promise<DocumentDto[]> {
    const rows = await this.documents.find({
      relations: { files: true },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async findOne(id: string): Promise<DocumentDto> {
    const row = await this.documents.findOne({
      where: { id },
      relations: { files: true },
    });
    if (!row) {
      throw new NotFoundException(this.i18n.t('messages.document.notFound'));
    }
    return this.toDto(row);
  }

  async create(dto: CreateDocumentDto): Promise<DocumentDto> {
    const saved = await this.documents.save(
      this.documents.create({
        title: dto.title,
        summary: dto.summary ?? '',
        content: dto.content ?? '',
        locale: dto.locale ?? 'zh',
      }),
    );
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateDocumentDto): Promise<DocumentDto> {
    const row = await this.documents.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(this.i18n.t('messages.document.notFound'));
    }
    Object.assign(row, dto);
    await this.documents.save(row);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.documents.delete(id);
    if (!result.affected) {
      throw new NotFoundException(this.i18n.t('messages.document.notFound'));
    }
  }

  async importXml(xml: string): Promise<{ items: DocumentDto[]; message: string }> {
    try {
      const payload = parseDocumentsXml(xml);
      const created: DocumentDto[] = [];
      for (const item of payload.documents) {
        created.push(await this.create(item));
      }
      return {
        items: created,
        message: this.i18n.t('messages.document.imported', {
          args: { count: created.length },
        }),
      };
    } catch (error) {
      if (error instanceof XmlParseError) {
        throw new BadRequestException(
          `${this.i18n.t('messages.xml.invalid')}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  async exportXml(id?: string): Promise<string> {
    const documents = id ? [await this.findOne(id)] : await this.findAll();
    return serializeDocumentsXml(documents);
  }

  private toDto(row: Document): DocumentDto {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      content: row.content,
      locale: row.locale,
      files: (row.files ?? []).map((file) => ({
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        url: `${this.publicUrl}/api/files/${file.id}/content`,
        createdAt: file.createdAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
