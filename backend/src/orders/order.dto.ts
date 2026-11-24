import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min, MinLength } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class OrderVersionDto {
  @IsInt()
  @Min(1)
  version!: number;
}

export class CancelOrderDto extends OrderVersionDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  cancelReason!: string;
}
