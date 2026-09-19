import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIconGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

export class UpdateIconGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

export class UploadIconFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
