import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type {
  ProjectAssetFileDto,
  ProjectAssetGroupDto,
  ProjectDto,
  ProjectIconFileDto,
  ProjectIconGroupDto,
  ProjectLangCatalogDto,
  ProjectPageDto,
  ProjectPageVersionDto,
  WidgetEventScriptDto,
} from '@vanstack/shared';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateAssetGroupDto, UpdateAssetGroupDto, UploadAssetFileDto } from './dto/asset.dto';
import { CreateIconGroupDto, UpdateIconGroupDto, UploadIconFileDto } from './dto/icon.dto';
import { PutProjectLangsDto } from './dto/lang.dto';
import { PutWidgetEventDto } from './dto/event.dto';
import { CreateProjectPageDto, UpdateProjectPageDto } from './dto/page.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ActivatePageVersionDto, CreatePageVersionDto, UpdatePageVersionDto } from './dto/version.dto';
import { LowcodeService } from './lowcode.service';

@Controller('projects')
@RequirePermissions('lowcode:manage')
export class LowcodeController {
  constructor(private readonly lowcode: LowcodeService) {}

  @Get()
  listProjects(): Promise<ProjectDto[]> {
    return this.lowcode.listProjects();
  }

  @Post()
  createProject(@Body() dto: CreateProjectDto): Promise<ProjectDto> {
    return this.lowcode.createProject(dto);
  }

  @Get(':id')
  getProject(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectDto> {
    return this.lowcode.getProject(id);
  }

  @Patch(':id')
  updateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.lowcode.updateProject(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteProject(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.lowcode.deleteProject(id);
  }

  @Get(':id/langs')
  getLangs(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectLangCatalogDto> {
    return this.lowcode.getLangs(id);
  }

  @Put(':id/langs')
  putLangs(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PutProjectLangsDto,
  ): Promise<ProjectLangCatalogDto> {
    return this.lowcode.putLangs(id, dto);
  }

  @Get(':id/pages')
  listPages(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectPageDto[]> {
    return this.lowcode.listPages(id);
  }

  @Post(':id/pages')
  createPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProjectPageDto,
  ): Promise<ProjectPageDto> {
    return this.lowcode.createPage(id, dto);
  }

  @Get(':id/pages/:pageId')
  getPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<ProjectPageDto> {
    return this.lowcode.getPage(id, pageId);
  }

  @Patch(':id/pages/:pageId')
  updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdateProjectPageDto,
  ): Promise<ProjectPageDto> {
    return this.lowcode.updatePage(id, pageId, dto);
  }

  @Delete(':id/pages/:pageId')
  @HttpCode(204)
  deletePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<void> {
    return this.lowcode.deletePage(id, pageId);
  }

  @Get(':id/pages/:pageId/versions')
  listVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ): Promise<ProjectPageVersionDto[]> {
    return this.lowcode.listVersions(id, pageId);
  }

  @Post(':id/pages/:pageId/versions')
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: CreatePageVersionDto,
  ): Promise<ProjectPageVersionDto> {
    return this.lowcode.createVersion(id, pageId, dto);
  }

  @Get(':id/pages/:pageId/versions/:versionId')
  getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<ProjectPageVersionDto> {
    return this.lowcode.getVersion(id, pageId, versionId);
  }

  @Patch(':id/pages/:pageId/versions/:versionId')
  updateVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdatePageVersionDto,
  ): Promise<ProjectPageVersionDto> {
    return this.lowcode.updateVersion(id, pageId, versionId, dto);
  }

  @Post(':id/pages/:pageId/versions/:versionId/publish')
  publishVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<ProjectPageVersionDto> {
    return this.lowcode.publishVersion(id, pageId, versionId);
  }

  @Delete(':id/pages/:pageId/versions/:versionId')
  @HttpCode(204)
  deleteVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<void> {
    return this.lowcode.deleteVersion(id, pageId, versionId);
  }

  @Post(':id/pages/:pageId/activate-version')
  activateVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: ActivatePageVersionDto,
  ): Promise<ProjectPageDto> {
    return this.lowcode.activateVersion(id, pageId, dto.versionId);
  }

  @Get(':id/assets/groups')
  listAssetGroups(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectAssetGroupDto[]> {
    return this.lowcode.listAssetGroups(id);
  }

  @Post(':id/assets/groups')
  createAssetGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssetGroupDto,
  ): Promise<ProjectAssetGroupDto> {
    return this.lowcode.createAssetGroup(id, dto.name);
  }

  @Patch(':id/assets/groups/:group')
  renameAssetGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
    @Body() dto: UpdateAssetGroupDto,
  ): Promise<ProjectAssetGroupDto> {
    return this.lowcode.renameAssetGroup(id, group, dto.name);
  }

  @Delete(':id/assets/groups/:group')
  @HttpCode(204)
  deleteAssetGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
  ): Promise<void> {
    return this.lowcode.deleteAssetGroup(id, group);
  }

  @Get(':id/assets/groups/:group/files')
  listAssetFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
  ): Promise<ProjectAssetFileDto[]> {
    return this.lowcode.listAssetFiles(id, group);
  }

  @Post(':id/assets/groups/:group/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadAssetFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body() dto?: UploadAssetFileDto,
  ): Promise<ProjectAssetFileDto> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.lowcode.uploadAssetFile(id, group, file, dto?.name);
  }

  @Delete(':id/assets/groups/:group/files/:name')
  @HttpCode(204)
  deleteAssetFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
    @Param('name') name: string,
  ): Promise<void> {
    return this.lowcode.deleteAssetFile(id, group, name);
  }

  @Get(':id/icons/groups')
  listIconGroups(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectIconGroupDto[]> {
    return this.lowcode.listIconGroups(id);
  }

  @Post(':id/icons/groups')
  createIconGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIconGroupDto,
  ): Promise<ProjectIconGroupDto> {
    return this.lowcode.createIconGroup(id, dto.name);
  }

  @Patch(':id/icons/groups/:group')
  renameIconGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
    @Body() dto: UpdateIconGroupDto,
  ): Promise<ProjectIconGroupDto> {
    return this.lowcode.renameIconGroup(id, group, dto.name);
  }

  @Delete(':id/icons/groups/:group')
  @HttpCode(204)
  deleteIconGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
  ): Promise<void> {
    return this.lowcode.deleteIconGroup(id, group);
  }

  @Get(':id/icons/groups/:group/files')
  listIconFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
  ): Promise<ProjectIconFileDto[]> {
    return this.lowcode.listIconFiles(id, group);
  }

  @Post(':id/icons/groups/:group/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadIconFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body() dto?: UploadIconFileDto,
  ): Promise<ProjectIconFileDto> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.lowcode.uploadIconFile(id, group, file, dto?.name);
  }

  @Delete(':id/icons/groups/:group/files/:name')
  @HttpCode(204)
  deleteIconFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('group') group: string,
    @Param('name') name: string,
  ): Promise<void> {
    return this.lowcode.deleteIconFile(id, group, name);
  }

  @Get(':id/events/:eventId')
  getWidgetEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<WidgetEventScriptDto> {
    return this.lowcode.getWidgetEvent(id, eventId);
  }

  @Put(':id/events/:eventId')
  putWidgetEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: PutWidgetEventDto,
  ): Promise<WidgetEventScriptDto> {
    return this.lowcode.putWidgetEvent(id, eventId, dto.source);
  }

  @Delete(':id/events/:eventId')
  @HttpCode(204)
  deleteWidgetEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<void> {
    return this.lowcode.deleteWidgetEvent(id, eventId);
  }
}
