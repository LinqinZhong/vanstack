import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalOssStorage } from './local-oss.storage';
import { FilesController } from './files.controller';
import { OssService } from './oss.service';
import { OssStorage } from './oss.types';
import { S3OssStorage } from './s3-oss.storage';

@Module({
  providers: [
    {
      provide: OssStorage,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('OSS_DRIVER', 'local');
        return driver === 's3' ? new S3OssStorage(config) : new LocalOssStorage(config);
      },
    },
    OssService,
  ],
  controllers: [FilesController],
  exports: [OssService],
})
export class OssModule {}
