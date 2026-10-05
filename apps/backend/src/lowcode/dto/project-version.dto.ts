import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateProjectVersionDto {
  @IsIn(['blank', 'copy'])
  source: 'blank' | 'copy';

  @IsOptional()
  @IsUUID()
  copyFromId?: string;
}
