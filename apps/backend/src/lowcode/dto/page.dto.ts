import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { KEY_PATTERN } from './project.dto';

export class CreateProjectPageDto {
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

export class UpdateProjectPageDto {
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
