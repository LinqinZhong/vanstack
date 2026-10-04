import { IsString, MaxLength, MinLength } from 'class-validator';

export class PutWidgetEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  source: string;
}
