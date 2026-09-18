import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { OssService } from './oss.service';

@Public()
@Controller('files')
export class FilesController {
  constructor(private readonly oss: OssService) {}

  @Get('content/:key')
  async getContent(@Param('key') key: string, @Res() response: Response) {
    const object = await this.oss.getObject(decodeURIComponent(key));
    if (!object) {
      throw new NotFoundException();
    }
    response.setHeader('Content-Type', object.contentType);
    response.setHeader('Cache-Control', 'public, max-age=60');
    response.send(object.body);
  }
}
