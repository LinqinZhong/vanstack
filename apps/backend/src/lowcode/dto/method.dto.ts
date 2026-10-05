import { IsString, MaxLength } from 'class-validator';

export class PutMethodCodeDto {
  @IsString()
  @MaxLength(100_000)
  code: string;
}
