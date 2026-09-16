import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OssModule } from '../oss/oss.module';
import { ProjectPageVersion } from './entities/project-page-version.entity';
import { ProjectPage } from './entities/project-page.entity';
import { Project } from './entities/project.entity';
import { LowcodeController } from './lowcode.controller';
import { LowcodeService } from './lowcode.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectPage, ProjectPageVersion]), OssModule],
  controllers: [LowcodeController],
  providers: [LowcodeService],
})
export class LowcodeModule {}
