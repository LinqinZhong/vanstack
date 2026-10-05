import { Controller, Get, Param } from '@nestjs/common';
import type { RuntimeProjectDto } from '@vanstack/shared';
import { Public } from '../auth/decorators/public.decorator';
import { LowcodeService } from './lowcode.service';

@Public()
@Controller('runtime')
export class RuntimeController {
  constructor(private readonly lowcode: LowcodeService) {}

  @Get('projects/:projectKey/pages/:pageKey')
  getRuntimePage(@Param('projectKey') projectKey: string, @Param('pageKey') pageKey: string) {
    return this.lowcode.getRuntimePage(projectKey, pageKey);
  }

  @Get('projects/:projectKey/events/:eventId')
  getRuntimeEvent(@Param('projectKey') projectKey: string, @Param('eventId') eventId: string) {
    return this.lowcode.getRuntimeEvent(projectKey, eventId);
  }

  @Get('projects/:projectKey')
  getRuntimeProject(@Param('projectKey') projectKey: string): Promise<RuntimeProjectDto> {
    return this.lowcode.getRuntimeProject(projectKey);
  }
}
