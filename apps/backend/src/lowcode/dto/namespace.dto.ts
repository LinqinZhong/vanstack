import { IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNamespaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

export class RenameNamespaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

export class PutNamespaceDto {
  @IsArray()
  types: unknown[];

  @IsArray()
  data: unknown[];
}
