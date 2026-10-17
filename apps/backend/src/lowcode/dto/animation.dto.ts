import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AnimationKeyframe } from '@vanstack/shared';

export class CreateAnimationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;
}

export class UpdateAnimationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsArray()
  keyframes?: AnimationKeyframe[];
}
