import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePageVersionDto {
  @IsObject()
  document: object;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class UpdatePageVersionDto {
  @IsOptional()
  @IsObject()
  document?: object;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
