import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePageVersionDto {
  @IsString()
  @MinLength(1)
  xml: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class UpdatePageVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  xml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class ActivatePageVersionDto {
  @IsString()
  @MinLength(1)
  versionId: string;
}
