import { Module } from '@nestjs/common';
import { OssModule } from '../oss/oss.module';
import { LowcodeController } from './lowcode.controller';
import { LowcodeMongo } from './lowcode-mongo';
import { LowcodeService } from './lowcode.service';
import { RuntimeController } from './runtime.controller';
import { WorkspaceBundleController } from './workspace-bundle.controller';
import { WorkspaceBundleService } from './workspace-bundle.service';

@Module({
  imports: [OssModule],
  controllers: [WorkspaceBundleController, LowcodeController, RuntimeController],
  providers: [LowcodeService, LowcodeMongo, WorkspaceBundleService],
})
export class LowcodeModule {}
