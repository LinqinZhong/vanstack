import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { I18n, I18nContext } from 'nestjs-i18n';
import type { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list() {
    return this.documents.findAll();
  }

  @Post('import.xml')
  async importXml(@Req() req: Request) {
    const xml = await this.readXmlBody(req);
    return this.documents.importXml(xml);
  }

  @Get('export.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async exportAll(@Res() res: Response) {
    const xml = await this.documents.exportXml();
    res.setHeader('Content-Disposition', 'attachment; filename="documents.xml"');
    res.send(xml);
  }

  @Get(':id/export.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async exportOne(@Param('id') id: string, @Res() res: Response) {
    const xml = await this.documents.exportXml(id);
    res.setHeader('Content-Disposition', `attachment; filename="document-${id}.xml"`);
    res.send(xml);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateDocumentDto, @I18n() i18n: I18nContext) {
    const item = await this.documents.create(dto);
    return { message: i18n.t('messages.document.created'), item };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @I18n() i18n: I18nContext,
  ) {
    const item = await this.documents.update(id, dto);
    return { message: i18n.t('messages.document.updated'), item };
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.documents.remove(id);
  }

  private async readXmlBody(req: Request): Promise<string> {
    if (typeof req.body === 'string') {
      return req.body;
    }
    if (req.body && typeof req.body === 'object' && 'xml' in req.body) {
      return String((req.body as { xml: string }).xml);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}
