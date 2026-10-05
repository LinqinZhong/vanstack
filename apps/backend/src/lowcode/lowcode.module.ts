import { Module } from '@nestjs/common';
import { OssModule } from '../oss/oss.module';
import { LowcodeController } from './lowcode.controller';
import { LowcodeMongo } from './lowcode-mongo';
import { LowcodeService } from './lowcode.service';
import { RuntimeController } from './runtime.controller';

@Module({
  imports: [OssModule],
  controllers: [LowcodeController, RuntimeController],
  providers: [LowcodeService, LowcodeMongo],
})
export class LowcodeModule {}
