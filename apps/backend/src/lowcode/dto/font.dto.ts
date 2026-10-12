import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadFontFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}