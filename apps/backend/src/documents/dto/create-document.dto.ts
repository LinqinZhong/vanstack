import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LOCALES, type Locale } from '@vanstack/shared';

export class CreateDocumentDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(LOCALES)
  locale?: Locale;
}
