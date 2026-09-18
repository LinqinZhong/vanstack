import { Controller, Get, Param } from '@nestjs/common';
import type { RuntimeProjectDto } from '@vanstack/shared';
import { Public } from '../auth/decorators/public.decorator';
import { LowcodeService } from './lowcode.service';

@Public()
@Controller('runtime')
export class RuntimeController {
  constructor(private readonly lowcode: LowcodeService) {}

  @Get('projects/:projectKey')
  getRuntimeProject(@Param('projectKey') projectKey: string): Promise<RuntimeProjectDto> {
    return this.lowcode.getRuntimeProject(projectKey);
  }
}
