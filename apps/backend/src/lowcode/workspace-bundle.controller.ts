import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { WorkspaceBundleService, type ApplyBundleInput } from './workspace-bundle.service';

@Controller('projects')
@RequirePermissions('lowcode:manage')
export class WorkspaceBundleController {
  constructor(private readonly bundle: WorkspaceBundleService) {}

  @Get(':id/bundle')
  exportProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.bundle.exportProject(id);
  }

  @Put('bundle')
  @HttpCode(204)
  apply(@Body() body: Record<string, unknown>): Promise<void> {
    return this.bundle.apply((body ?? {}) as ApplyBundleInput);
  }

  @Put('bundle/object')
  @HttpCode(204)
  putObject(
    @Query('key') key: string,
    @Headers('x-content-type') contentType: string | undefined,
    @Req() request: Request,
  ): Promise<void> {
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    return this.bundle.putObject(key, body, contentType || 'application/octet-stream');
  }
}
