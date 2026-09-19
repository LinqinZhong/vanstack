import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAssetGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

export class UpdateAssetGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

export class UploadAssetFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
