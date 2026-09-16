import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @IsString()
  @Matches(KEY_PATTERN)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(KEY_PATTERN)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
