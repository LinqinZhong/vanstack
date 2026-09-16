import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../documents/document.entity';
import { OssModule } from '../oss/oss.module';
import { FileObject } from './file-object.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileObject, Document]), OssModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
