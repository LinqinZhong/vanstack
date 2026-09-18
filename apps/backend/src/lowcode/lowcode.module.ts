import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OssModule } from '../oss/oss.module';
import { ProjectLangValue } from './entities/project-lang-value.entity';
import { ProjectLang } from './entities/project-lang.entity';
import { ProjectPageVersion } from './entities/project-page-version.entity';
import { ProjectPage } from './entities/project-page.entity';
import { Project } from './entities/project.entity';
import { LowcodeController } from './lowcode.controller';
import { LowcodeService } from './lowcode.service';
import { RuntimeController } from './runtime.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectPage, ProjectPageVersion, ProjectLang, ProjectLangValue]),
    OssModule,
  ],
  controllers: [LowcodeController, RuntimeController],
  providers: [LowcodeService],
})
export class LowcodeModule {}
