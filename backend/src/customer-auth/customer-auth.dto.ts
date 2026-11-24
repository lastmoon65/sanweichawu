import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CustomerLoginDto {
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  code!: string;
}
