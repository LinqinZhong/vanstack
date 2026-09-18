import { IsArray } from 'class-validator';

export class PutProjectLangsDto {
  @IsArray()
  langs: unknown[];

  @IsArray()
  groups: unknown[];
}
